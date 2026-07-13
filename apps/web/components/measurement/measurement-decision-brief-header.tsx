import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.2 — cabeçalho contextual
 * mínimo do Relatório Executivo. `generatedAt` só existe quando o
 * Brief já carregou -- não afirma ser a data da análise ou da
 * importação, só do relatório. Nenhum outro campo de `metadata`
 * (identificador de origem, versões técnicas) aparece aqui;
 * pertencem a Sprints futuras, se algum dia forem exibidos.
 */
export function MeasurementDecisionBriefHeader({ generatedAt }: { generatedAt: string | null }) {
  const formattedGeneratedAt = generatedAt === null ? null : formatGeneratedAt(generatedAt);

  return (
    <section className="page-header">
      <div>
        <span className="workspaces-eyebrow">Medições</span>
        <h1>Relatório Executivo</h1>
        <p>Análise do Boletim de Medição</p>
        {formattedGeneratedAt ? <p className="workspace-card__note">Relatório gerado em {formattedGeneratedAt}</p> : null}
      </div>
      <Link className="bba-button bba-button--ghost bba-button--sm" href="/medicoes">
        <ArrowLeft size={16} /> Voltar para Medições
      </Link>
    </section>
  );
}

/**
 * Defensivo mesmo com `extractValidDecisionBrief` já rejeitando
 * `generatedAt` não formatável antes do estado `loaded` -- se algum
 * dia esta função for chamada isoladamente (ex.: teste direto do
 * cabeçalho), nunca deve produzir a string literal "Invalid Date".
 * Sem fallback textual: um valor não formatável simplesmente omite a
 * linha, mesmo comportamento de `generatedAt === null`.
 */
export function formatGeneratedAt(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("pt-BR");
}
