"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileQuestion, RotateCw } from "lucide-react";
import { Card, SkeletonCard, StatusBadge } from "@bba/ui";
import { useBbaStore } from "@bba/lib";
import { fetchMeasurementImports } from "./measurement-imports-client";
import { canOpenReport, formatImportDate, resolveHumanLabel, translateImportStatus } from "./measurement-imports-view-model";
import type { MeasurementImportListItem } from "@/lib/bdos/measurement-imports-listing-service";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1B — central executiva de
 * Boletins de Medição (`/medicoes`). Client Component + fetch, mesmo
 * padrão comprovado do restante do produto (BbaProjectWorkspaceExperience,
 * MemoriasPage legado) -- nenhum Server Component, nenhuma consulta
 * Supabase direta, nenhuma chamada ao Decision Brief builder. A ordem
 * apresentada é exatamente a ordem devolvida pela API (não reordena).
 */

type ViewState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly imports: ReadonlyArray<MeasurementImportListItem> }
  | { readonly phase: "error" };

export function MeasurementImportsPage() {
  const router = useRouter();
  const signOut = useBbaStore((state) => state.signOut);
  const [state, setState] = useState<ViewState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const outcome = await fetchMeasurementImports();

    if (outcome.kind === "unauthenticated") {
      // Mesmo fluxo de BbaDashboardShell quando a sessão não é mais válida.
      signOut();
      router.replace("/login");
      return;
    }

    if (outcome.kind === "error") {
      setState({ phase: "error" });
      return;
    }

    setState({ phase: "ready", imports: outcome.imports });
  }, [router, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <div className="span-12 measurement-imports-list">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <Card className="span-12 workspace-card" title="Medições">
        <p className="workspace-card__description">Não foi possível carregar as Medições.</p>
        <button className="bba-button bba-button--secondary bba-button--sm" onClick={() => void load()} type="button">
          <RotateCw size={16} /> Tentar novamente
        </button>
      </Card>
    );
  }

  if (state.imports.length === 0) {
    return (
      <Card className="span-12 workspace-card" title="Medições">
        <div className="workspace-card__icon" aria-hidden="true">
          <FileQuestion size={20} />
        </div>
        <p className="workspace-card__description">Nenhum Boletim de Medição disponível.</p>
        <p className="workspace-card__note">
          Os boletins de medição analisados aparecerão aqui, com acesso direto ao Relatório Executivo de cada um.
        </p>
      </Card>
    );
  }

  return (
    <div className="span-12 measurement-imports-list">
      {state.imports.map((item) => {
        const presentation = translateImportStatus(item.status);
        const label = resolveHumanLabel(item);
        const openable = canOpenReport(item);

        return (
          <Card className="workspace-card measurement-imports-item" key={item.measurementBulletinImportId} title={label}>
            <dl className="workspace-fact-list">
              <div className="workspace-fact">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={presentation.badge}>{presentation.label}</StatusBadge>
                </dd>
              </div>
              <div className="workspace-fact">
                <dt>Criado em</dt>
                <dd>{formatImportDate(item.createdAt)}</dd>
              </div>
              <div className="workspace-fact">
                <dt>Atualizado em</dt>
                <dd>{formatImportDate(item.updatedAt)}</dd>
              </div>
            </dl>

            {openable ? (
              <Link
                className="bba-button bba-button--primary bba-button--sm"
                href={`/medicoes/${item.measurementBulletinImportId}`}
              >
                Abrir Relatório Executivo
              </Link>
            ) : (
              <p className="workspace-card__note">Análise ainda não disponível.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
