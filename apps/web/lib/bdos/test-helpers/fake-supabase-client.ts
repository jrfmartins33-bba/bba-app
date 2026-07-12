// Fake in-memory de SupabaseClient para testar código que depende de
// measurement-repository.ts sem rede/credenciais reais -- nada neste
// repositório tinha isso antes (medido: apps/web só tinha um teste de
// função pura, planning-import-source-type.test.ts). Não é um fake
// genérico de PostgREST -- cobre exatamente os padrões de chamada que
// measurement-repository.ts usa (from().select().eq()/.in()/.maybeSingle()/
// .single(), insert().select().single(), update().eq()...), mais
// storage.from().download(). Suficiente para testar
// processMeasurementBulletinImport de ponta a ponta contra tabelas em
// memória, sem tocar o Supabase real -- por isso pode rodar dentro de
// `pnpm test`/CI, que não tem credenciais de banco.
//
// Simula 23505 (unique_violation) para as constraints reais que
// measurement-repository.ts depende: work_packages
// (engineering_project_id, normalized_code) e measurement_workspaces
// (measurement_bulletin_import_id, parcial WHERE NOT NULL) --
// managed_service_items e measurement_workspace_lines não precisam
// disso para os cenários testados aqui (ver comentário em cada
// FakeTableConfig).

export interface FakeTableConfig {
  readonly uniqueConstraints?: ReadonlyArray<{
    readonly columns: ReadonlyArray<string>;
    readonly partial?: (row: Record<string, unknown>) => boolean;
  }>;
  // Simula DEFAULT de coluna (ex.: status TEXT NOT NULL DEFAULT 'Draft').
  // measurement-repository.ts omite deliberadamente campos com default
  // no payload de insert (ver insertMeasurementWorkspace/
  // insertMeasurementBulletinImport) para deixar o schema decidir --
  // sem isso aqui, a linha em memória simplesmente não teria a coluna,
  // diferente do Postgres real.
  readonly defaults?: Record<string, unknown>;
}

interface PostgrestLikeError {
  readonly code: string;
  readonly message: string;
}

type FilterOp = { readonly column: string; readonly kind: "eq"; readonly value: unknown } | { readonly column: string; readonly kind: "in"; readonly values: ReadonlyArray<unknown> };

class FakeQueryBuilder implements PromiseLike<{ data: unknown; error: PostgrestLikeError | null }> {
  private readonly filters: FilterOp[] = [];
  private mode: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> | null = null;
  private wantsSingleRow = false;

  constructor(
    private readonly rows: Record<string, unknown>[],
    private readonly config: FakeTableConfig
  ) {}

  select(_columns: string): this {
    return this;
  }

  insert(payload: Record<string, unknown>): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, kind: "eq", value });
    return this;
  }

  in(column: string, values: ReadonlyArray<unknown>): this {
    this.filters.push({ column, kind: "in", values });
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: PostgrestLikeError | null }> {
    this.wantsSingleRow = true;
    const { data, error } = this.execute();
    if (error) {
      return { data: null, error };
    }
    const list = data as Record<string, unknown>[];
    return { data: list.length === 0 ? null : list[0], error: null };
  }

  async single(): Promise<{ data: unknown; error: PostgrestLikeError | null }> {
    this.wantsSingleRow = true;
    const { data, error } = this.execute();
    if (error) {
      return { data: null, error };
    }
    const list = data as Record<string, unknown>[];
    if (list.length === 0) {
      return { data: null, error: { code: "PGRST116", message: "no rows returned" } };
    }
    return { data: list[0], error: null };
  }

  then<TResult1 = { data: unknown; error: PostgrestLikeError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: PostgrestLikeError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private matchesFilters(row: Record<string, unknown>): boolean {
    return this.filters.every((filter) => {
      if (filter.kind === "eq") {
        return row[filter.column] === filter.value;
      }
      return filter.values.includes(row[filter.column]);
    });
  }

  private violatesUniqueConstraint(candidate: Record<string, unknown>, excludeRow?: Record<string, unknown>): boolean {
    for (const constraint of this.config.uniqueConstraints ?? []) {
      if (constraint.partial && !constraint.partial(candidate)) {
        continue;
      }
      const collides = this.rows.some(
        (row) =>
          row !== excludeRow &&
          (!constraint.partial || constraint.partial(row)) &&
          constraint.columns.every((column) => row[column] === candidate[column])
      );
      if (collides) {
        return true;
      }
    }
    return false;
  }

  private execute(): { data: unknown; error: PostgrestLikeError | null } {
    if (this.mode === "insert") {
      const candidate = { ...this.config.defaults, ...this.payload } as Record<string, unknown>;
      if (this.violatesUniqueConstraint(candidate)) {
        return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      this.rows.push(candidate);
      return { data: [candidate], error: null };
    }

    if (this.mode === "update") {
      const matching = this.rows.filter((row) => this.matchesFilters(row));
      const updated: Record<string, unknown>[] = [];
      for (const row of matching) {
        const candidate = { ...row, ...this.payload };
        if (this.violatesUniqueConstraint(candidate, row)) {
          return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
        Object.assign(row, this.payload);
        updated.push(row);
      }
      return { data: updated, error: null };
    }

    // select
    const matching = this.rows.filter((row) => this.matchesFilters(row));
    return { data: matching, error: null };
  }
}

class FakeStorageBucket {
  // Lê `client.__files` no momento da chamada (não uma cópia
  // capturada na criação) -- testes reatribuem `supabase.__files = {...}`
  // entre chamadas ao serviço (ex.: simular um retry com um arquivo
  // diferente), e o download precisa enxergar o valor atual.
  constructor(private readonly client: FakeSupabaseClient) {}

  async download(path: string): Promise<{ data: { arrayBuffer: () => Promise<ArrayBuffer> } | null; error: { message: string } | null }> {
    const bytes = this.client.__files[path];
    if (!bytes) {
      return { data: null, error: { message: `object not found: ${path}` } };
    }
    return {
      data: {
        arrayBuffer: async () => {
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          return copy.buffer;
        }
      },
      error: null
    };
  }

  // Simula supabase.storage.from(bucket).list(folderPath, { search }) --
  // usado por confirmMeasurementBulletinUpload para confirmar a
  // existência do objeto sem baixá-lo (mesmo padrão do Epic 18).
  // `__files` guarda o path completo como chave; aqui simulamos a
  // listagem de "pasta" filtrando por prefixo e projetando só o nome
  // do objeto (último segmento), como a API real devolve.
  async list(folderPath: string, options?: { search?: string }): Promise<{ data: Array<{ name: string }> | null; error: { message: string } | null }> {
    const prefix = `${folderPath}/`;
    const names = Object.keys(this.client.__files)
      .filter((path) => path.startsWith(prefix))
      .map((path) => path.slice(prefix.length))
      .filter((name) => !options?.search || name === options.search);

    return { data: names.map((name) => ({ name })), error: null };
  }
}

export interface FakeSupabaseClient {
  from(table: string): FakeQueryBuilder;
  readonly storage: { from(bucket: string): FakeStorageBucket };
  readonly __tables: Record<string, Record<string, unknown>[]>;
  __files: Record<string, Uint8Array>;
}

export function createFakeSupabaseClient(params: {
  tables: Record<string, FakeTableConfig>;
  files?: Record<string, Uint8Array>;
}): FakeSupabaseClient {
  const state: Record<string, Record<string, unknown>[]> = {};
  for (const tableName of Object.keys(params.tables)) {
    state[tableName] = [];
  }

  const client: FakeSupabaseClient = {
    from(table: string): FakeQueryBuilder {
      if (!(table in state)) {
        throw new Error(`FakeSupabaseClient: tabela "${table}" não configurada.`);
      }
      return new FakeQueryBuilder(state[table] as Record<string, unknown>[], params.tables[table] as FakeTableConfig);
    },
    storage: {
      from(_bucket: string): FakeStorageBucket {
        return new FakeStorageBucket(client);
      }
    },
    __tables: state,
    __files: { ...(params.files ?? {}) }
  };

  return client;
}
