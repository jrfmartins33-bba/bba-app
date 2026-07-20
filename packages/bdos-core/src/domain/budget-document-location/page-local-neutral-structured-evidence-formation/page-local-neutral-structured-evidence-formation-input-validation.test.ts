import type { BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput } from "./budget-document-page-local-neutral-structured-evidence-formation.types";
import { validatePageLocalNeutralStructuredEvidenceFormationInput } from "./page-local-neutral-structured-evidence-formation-input-validation";
import { buildPageLocalNeutralStructuredEvidenceFormationInput } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";
import type { SyntheticGeometryPage } from "./testing/page-local-neutral-structured-evidence-formation-test-bridge";

function cell(text: string, left: number, top: number) { return { text, leftPoints: left, topPoints: top, rightPoints: left + 40, bottomPoints: top + 10 }; }
const rows = [0, 1, 2, 3].map((r) => { const y = 100 + r * 20; return [cell(`1.${r + 1}`, 50, y), cell(`Servico ${r}`, 120, y), cell(`${r + 1}0,00`, 300, y)]; });
const page: SyntheticGeometryPage = { widthPoints: 600, heightPoints: 800, items: rows.flat() };
const valid = buildPageLocalNeutralStructuredEvidenceFormationInput("input-validation", [page]);

// Os casos adversariais mutam deliberadamente campos de literal-type e
// coleções readonly dos contratos de origem; `unknown` isola essa
// adulteração deliberada do sistema de tipos sem afrouxar o contrato real.
function expectValid(input: BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput): void {
  const result = validatePageLocalNeutralStructuredEvidenceFormationInput(input);
  if (result.kind !== "valid") throw new Error(`expected valid, got ${JSON.stringify(result.problems)}`);
}
function expectInvalid(input: unknown, code: string): void {
  const result = validatePageLocalNeutralStructuredEvidenceFormationInput(input as BudgetDocumentPageLocalNeutralStructuredEvidenceFormationInput);
  if (result.kind !== "invalid") throw new Error(`expected invalid (${code}), got valid`);
  if (result.problems[0].code !== code) throw new Error(`expected ${code}, got ${result.problems[0].code}`);
}

expectValid(valid);

// --- versão de contrato não suportada (cada um dos quatro) --------------------
expectInvalid({ ...valid, structureReconstruction: { ...valid.structureReconstruction, schemaVersion: 999 } }, "source_contract_version_unsupported");
expectInvalid({ ...valid, tabularRegionDetection: { ...valid.tabularRegionDetection, detectorVersion: "unknown" } }, "source_contract_version_unsupported");
expectInvalid({ ...valid, physicalCellHypothesisFormation: { ...valid.physicalCellHypothesisFormation, formationEngineVersion: "unknown" } }, "source_contract_version_unsupported");
expectInvalid({ ...valid, physicalCellTextEvidenceFormation: { ...valid.physicalCellTextEvidenceFormation, normalizationVersion: "unknown" } }, "source_contract_version_unsupported");

// --- status failed (cada um dos quatro) --------------------------------------
expectInvalid({ ...valid, structureReconstruction: { ...valid.structureReconstruction, status: "failed" } }, "source_structure_reconstruction_contract_invalid");
expectInvalid({ ...valid, tabularRegionDetection: { ...valid.tabularRegionDetection, status: "failed" } }, "source_tabular_region_detection_contract_invalid");
expectInvalid({ ...valid, physicalCellHypothesisFormation: { ...valid.physicalCellHypothesisFormation, status: "failed" } }, "source_physical_cell_hypothesis_formation_contract_invalid");
expectInvalid({ ...valid, physicalCellTextEvidenceFormation: { ...valid.physicalCellTextEvidenceFormation, status: "failed" } }, "source_physical_cell_text_evidence_contract_invalid");

// --- sourceByteHash divergente e linhagem achatada divergente -----------------
expectInvalid({ ...valid, structureReconstruction: { ...valid.structureReconstruction, sourceByteHash: "deadbeef" } }, "source_lineage_mismatch");
expectInvalid({ ...valid, tabularRegionDetection: { ...valid.tabularRegionDetection, sourceReconstructorName: "other-reconstructor" } }, "source_lineage_mismatch");
expectInvalid({ ...valid, physicalCellHypothesisFormation: { ...valid.physicalCellHypothesisFormation, sourceTabularRegionDetectorVersion: "other" } }, "source_lineage_mismatch");
expectInvalid({ ...valid, physicalCellTextEvidenceFormation: { ...valid.physicalCellTextEvidenceFormation, sourcePhysicalCellHypothesisFormationContextFingerprint: "other" } }, "source_lineage_mismatch");

// --- fingerprint inválido (na g.1, folha da cadeia — não referenciada por lineage) -
expectInvalid({ ...valid, physicalCellTextEvidenceFormation: { ...valid.physicalCellTextEvidenceFormation, formationContextFingerprint: "0".repeat(64) } }, "source_fingerprint_invalid");

// --- gates de população/referência via mutação da reconstrução estrutural -----
// (o fingerprint da reconstrução é apenas de identidade, então mutar `groups`
// mantém o fingerprint e a linhagem válidos, alcançando os gates de referência.)
type MutableStructure = { groups: Array<{ pages: Array<{ lines: unknown[]; segments: unknown[] }> }> };
const cloneStructure = (): MutableStructure => structuredClone(valid.structureReconstruction) as unknown as MutableStructure;
{
  const s = cloneStructure();
  s.groups = []; // remove todos os grupos → população divergente da f.2a
  expectInvalid({ ...valid, structureReconstruction: s }, "source_group_reference_invalid");
}
{
  const s = cloneStructure();
  s.groups[0].pages = [];
  expectInvalid({ ...valid, structureReconstruction: s }, "source_page_reference_invalid");
}
{
  const s = cloneStructure();
  s.groups[0].pages[0].lines = s.groups[0].pages[0].lines.slice(1); // remove uma linha referenciada por uma região candidata
  expectInvalid({ ...valid, structureReconstruction: s }, "source_line_reference_invalid");
}
{
  const s = cloneStructure();
  s.groups[0].pages[0].segments = s.groups[0].pages[0].segments.slice(1); // remove um segmento referenciado por uma linha
  expectInvalid({ ...valid, structureReconstruction: s }, "source_segment_reference_invalid");
}

// --- M4: a existência de `textEvidenceGroup` dentro do laço sobre `t.groups`
// (page-local-neutral-structured-evidence-formation-input-validation.ts) é
// segura porque a igualdade de população `structureGroupKeys` == `candidateGroupKeys`
// == `cellFormationGroupKeys` == `textEvidenceGroupKeys` já foi provada ANTES
// do laço começar — o caso adversarial `s.groups = []` acima já demonstra que
// QUALQUER divergência de população entre os quatro contratos (de qualquer
// lado) é rejeitada por `source_group_reference_invalid` antes de o laço ser
// alcançado, tornando redundante testar a divergência isoladamente do lado de
// g.1. Uma tentativa de mutar `physicalCellTextEvidenceFormation.groups`
// isoladamente, ao contrário da mutação em `structureReconstruction.groups`
// acima, não constrói esse cenário: o fingerprint de conteúdo da g.1
// (diferente do fingerprint de reconstrução estrutural, que é só de
// identidade) já cobre `groups`, então a mutação é capturada antes por
// `source_fingerprint_invalid` — uma garantia estritamente mais forte do que
// a que o condicional removido dependia.

console.log("ok - input validation accepts the real quadruple and rejects unsupported versions, failed statuses, byte-hash/lineage divergence, invalid fingerprint, and group/page/line/segment reference gaps, each with its exact code");
