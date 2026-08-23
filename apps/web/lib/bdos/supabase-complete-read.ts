export interface SupabaseReadPage<T> {
  readonly data: ReadonlyArray<T> | null;
  readonly error: unknown | null;
}

const DEFAULT_PAGE_SIZE = 1_000;

/**
 * Reads a complete ordered Supabase/PostgREST result without relying on the
 * project's maximum-row setting. The next offset advances by the number of
 * rows actually returned, so a server-side cap smaller than `pageSize` cannot
 * create gaps. A final empty page is the only completion signal.
 */
export async function readAllSupabasePages<T>(
  readPage: (from: number, to: number) => PromiseLike<SupabaseReadPage<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new Error("O tamanho da página deve ser um inteiro positivo.");
  }

  const rows: T[] = [];

  while (true) {
    const from = rows.length;
    const { data, error } = await readPage(from, from + pageSize - 1);
    if (error) throw error;

    const page = data ?? [];
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}
