import { ProcurementScopeKind, type ProcurementScope } from "../procurement-case";
import {
  BudgetLineKind,
  BudgetVersionOriginKind,
  BudgetVersionStatus,
  LineageRelationNature,
  addBudgetLine,
  calculateBudgetVersionTotal,
  calculateLineTotal,
  consolidateBudgetVersion,
  createBudgetVersion,
  hasHierarchyCycle,
  orderedChildren,
  centsFromExactReais,
  registerLineageRelation,
  removeBudgetLine,
  updateBudgetLine,
  updateBudgetLinePosition,
  type BudgetLine,
  type BudgetVersion,
} from "./index";

const organizationId = "organization-alpha-engenharia";
const procurementCaseId = "case-lagoa-do-arroz";
const correlationId = "budget-version-correlation-001";
const createdBy = "engenharia-de-custos";
const sourceSystem = "bdos-core";

const wholeCaseScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId };
const lotAScope: ProcurementScope = { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId: "lot-a" };
const lotBScope: ProcurementScope = { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId: "lot-b" };

// ---------------------------------------------------------------------------
// 18.3 — Versão do Orçamento
// ---------------------------------------------------------------------------

runTest("Versão do Orçamento nasce em rascunho", () => {
  const result = createVersion();
  assertVersionSuccess(result, "expected version creation success");
  assertEqual(result.budgetVersion.status, BudgetVersionStatus.Draft, "new version must start as Draft");
  assertEqual(result.budgetVersion.lines.length, 0, "new version must start with no lines");
});

runTest("admite origem nativa", () => {
  const result = createVersion({ origin: { kind: BudgetVersionOriginKind.Native } });
  assertVersionSuccess(result, "expected version creation success");
  assertEqual(result.budgetVersion.originLineage.origin.kind, BudgetVersionOriginKind.Native, "origin kind mismatch");
});

runTest("admite referência documental opaca", () => {
  const result = createVersion({
    origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "evidencia-opaca-001" },
  });
  assertVersionSuccess(result, "expected version creation success");
  assertEqual(result.budgetVersion.originLineage.origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference, "origin kind mismatch");
});

runTest("pertence ao Processo e à organização corretos", () => {
  const result = createVersion();
  assertVersionSuccess(result, "expected version creation success");
  assertEqual(result.budgetVersion.procurementCaseId, procurementCaseId, "procurementCaseId mismatch");
  assertEqual(result.budgetVersion.organizationId, organizationId, "organizationId mismatch");
});

runTest("admite linhas enquanto rascunho", () => {
  const version = createVersion();
  assertVersionSuccess(version, "expected version creation success");

  const added = addBudgetLine(groupInput(version.budgetVersion, "group-1", 0));
  assertVersionSuccess(added, "expected line addition success");
  assertEqual(added.budgetVersion.lines.length, 1, "expected exactly one line");
});

runTest("consolida explicitamente e torna-se imutável", () => {
  const version = createVersion();
  assertVersionSuccess(version, "expected version creation success");

  const consolidated = consolidateBudgetVersion({ budgetVersion: version.budgetVersion });
  assertVersionSuccess(consolidated, "expected consolidation success");
  assertEqual(consolidated.budgetVersion.status, BudgetVersionStatus.Consolidated, "expected Consolidated status");
});

runTest("não cria nova versão durante consolidação", () => {
  const version = createVersion();
  assertVersionSuccess(version, "expected version creation success");
  const consolidated = consolidateBudgetVersion({ budgetVersion: version.budgetVersion });
  assertVersionSuccess(consolidated, "expected consolidation success");
  assertEqual(consolidated.budgetVersion.id, version.budgetVersion.id, "consolidation must preserve the same version id");
});

runTest("rejeita qualquer alteração após consolidação", () => {
  const version = createVersion();
  assertVersionSuccess(version, "expected version creation success");
  const consolidated = consolidateBudgetVersion({ budgetVersion: version.budgetVersion });
  assertVersionSuccess(consolidated, "expected consolidation success");

  const attempt = addBudgetLine(groupInput(consolidated.budgetVersion, "group-1", 0));
  assertVersionFailure(attempt, "expected failure adding a line to a consolidated version");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.4 — Hierarquia
// ---------------------------------------------------------------------------

runTest("Grupo sem pai", () => {
  const version = createVersion();
  assertVersionSuccess(version, "expected version creation success");
  const withGroup = addBudgetLine(groupInput(version.budgetVersion, "group-1", 0));
  assertVersionSuccess(withGroup, "expected group creation success");
  assertEqual(withGroup.budgetVersion.lines[0]?.parentLineId, null, "group must have no parent");
});

runTest("Subgrupo sob Grupo, Item sob Subgrupo, Item diretamente sob Grupo, Item sem código externo", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-1", "group-1", 0)));
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-under-subgroup", "subgroup-1", 0, centsFromExactReais(100), "GRP-01.01.01")),
  );
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-under-group-cot-015", "group-1", 1, centsFromExactReais(50), null)),
  );

  const subgroup = version.lines.find((line) => line.id === "subgroup-1");
  const itemUnderSubgroup = version.lines.find((line) => line.id === "item-under-subgroup");
  const itemUnderGroup = version.lines.find((line) => line.id === "item-under-group-cot-015");

  assertEqual(subgroup?.parentLineId, "group-1", "subgroup must be parented to the group");
  assertEqual(itemUnderSubgroup?.parentLineId, "subgroup-1", "item must be parented to the subgroup");
  assertEqual(itemUnderGroup?.parentLineId, "group-1", "item must be allowed directly under a group");
  assertEqual(itemUnderGroup?.externalCode, null, "an item without an external code (COT-015-like) must be representable");
});

runTest("rejeição de Grupo com pai", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));

  const attempt = addBudgetLine({ ...groupInput(version, "group-2", 1), parentLineId: "group-1" });
  assertVersionFailure(attempt, "expected failure: group must not have a parent");
  assertEqual(attempt.errors[0]?.code, "incompatible_parent_kind", "error code mismatch");
});

runTest("rejeição de Subgrupo sem pai compatível", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  version = requireSuccess(addBudgetLine(serviceItemInput(version, "item-1", "group-1", 1, centsFromExactReais(1))));

  const missingParent = addBudgetLine(subgroupInput(version, "subgroup-1", null, 2));
  assertVersionFailure(missingParent, "expected failure: subgroup requires a parent");
  assertEqual(missingParent.errors[0]?.code, "missing_parent_line", "error code mismatch");

  const incompatibleParent = addBudgetLine(subgroupInput(version, "subgroup-2", "item-1", 3));
  assertVersionFailure(incompatibleParent, "expected failure: subgroup parent must be a group");
  assertEqual(incompatibleParent.errors[0]?.code, "incompatible_parent_kind", "error code mismatch");
});

runTest("rejeição de pai de outra Versão", () => {
  const versionA = requireSuccess(createVersion({ id: "version-a" }));
  const versionB = requireSuccess(createVersion({ id: "version-b" }));
  const groupOfA = requireSuccess(addBudgetLine(groupInput(versionA, "group-of-a", 0)));

  const foreignParentVersion: BudgetVersion = { ...versionB, lines: [...versionB.lines, groupOfA.lines[0] as BudgetLine] };
  const attempt = addBudgetLine(subgroupInput(foreignParentVersion, "subgroup-x", "group-of-a", 0));
  assertVersionFailure(attempt, "expected failure: parent belongs to another version");
  assertEqual(attempt.errors[0]?.code, "parent_from_another_version", "error code mismatch");
});

runTest("rejeição de linha filha de si mesma", () => {
  const version = requireSuccess(createVersion());
  const attempt = addBudgetLine({ ...groupInput(version, "group-1", 0), parentLineId: "group-1" });
  assertVersionFailure(attempt, "expected failure: a line cannot be its own parent");
  assertEqual(attempt.errors[0]?.code, "self_parent", "error code mismatch");
});

runTest("detecta ciclo hierárquico (verificação estrutural defensiva)", () => {
  const cyclicLines: ReadonlyArray<BudgetLine> = [
    lineLiteral("a", BudgetLineKind.Group, "b"),
    lineLiteral("b", BudgetLineKind.Subgroup, "a"),
  ];
  assertEqual(hasHierarchyCycle(cyclicLines), true, "expected a cycle to be detected");

  const acyclicLines: ReadonlyArray<BudgetLine> = [
    lineLiteral("a", BudgetLineKind.Group, null),
    lineLiteral("b", BudgetLineKind.Subgroup, "a"),
  ];
  assertEqual(hasHierarchyCycle(acyclicLines), false, "expected no cycle in a valid hierarchy");
});

// ---------------------------------------------------------------------------
// 18.5 — Ordenação
// ---------------------------------------------------------------------------

runTest("ordenação estável entre irmãos, independente da ordem de inserção", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-c", 2)));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-a", 0)));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-b", 1)));

  const ordered = orderedChildren(version.lines, null);
  assertEqual(
    ordered.map((line) => line.id).join(","),
    "group-a,group-b,group-c",
    "children must be ordered by position, not insertion order",
  );
});

runTest("rejeição de posição duplicada entre irmãos", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-a", 0)));

  const attempt = addBudgetLine(groupInput(version, "group-b", 0));
  assertVersionFailure(attempt, "expected failure: duplicate position among siblings");
  assertEqual(attempt.errors[0]?.code, "duplicate_position", "error code mismatch");
});

runTest("reordenação permitida em rascunho, proibida após consolidação", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-a", 0)));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-b", 1)));

  const reordered = updateBudgetLinePosition({ budgetVersion: version, lineId: "group-a", position: 5 });
  assertVersionSuccess(reordered, "expected reordering success while in draft");

  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: reordered.budgetVersion }));
  const attempt = updateBudgetLinePosition({ budgetVersion: consolidated, lineId: "group-b", position: 9 });
  assertVersionFailure(attempt, "expected failure: cannot reorder after consolidation");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.6 — Escopo das linhas
// ---------------------------------------------------------------------------

runTest("versão global com linha global e com linha de lote válido", () => {
  let version = requireSuccess(createVersion({ scope: wholeCaseScope }));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-global", 0, wholeCaseScope)));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 1, lotAScope)));
  assertEqual(version.lines.length, 2, "both a global-scoped and a lot-scoped line must be accepted");
});

runTest("versão de lote com linha do mesmo lote", () => {
  let version = requireSuccess(createVersion({ scope: lotAScope }));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope)));
  assertEqual(version.lines.length, 1, "line scoped to the same lot must be accepted");
});

runTest("rejeição de linha de outro lote dentro de versão restrita a lote", () => {
  const version = requireSuccess(createVersion({ scope: lotAScope }));
  const attempt = addBudgetLine(groupInput(version, "group-lot-b", 0, lotBScope));
  assertVersionFailure(attempt, "expected failure: line from another lot");
  assertEqual(attempt.errors[0]?.code, "line_scope_incompatible", "error code mismatch");
});

runTest("rejeição de linha global dentro de versão restrita a lote", () => {
  const version = requireSuccess(createVersion({ scope: lotAScope }));
  const attempt = addBudgetLine(groupInput(version, "group-global", 0, wholeCaseScope));
  assertVersionFailure(attempt, "expected failure: whole-case line cannot widen a lot-scoped version");
  assertEqual(attempt.errors[0]?.code, "line_scope_incompatible", "error code mismatch");
});

runTest("rejeição de escopo de outro Processo", () => {
  const version = requireSuccess(createVersion({ scope: wholeCaseScope }));
  const foreignScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-other" };
  const attempt = addBudgetLine(groupInput(version, "group-foreign", 0, foreignScope));
  assertVersionFailure(attempt, "expected failure: scope from another Processo");
  assertEqual(attempt.errors[0]?.code, "line_scope_incompatible", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.7 — Totalizações
// ---------------------------------------------------------------------------

runTest("total do Item de Serviço, derivado do Subgrupo, derivado do Grupo, e da Versão, sem dupla contagem", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-1", "group-1", 0)));
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-a", "subgroup-1", 0, centsFromExactReais(1000.5))),
  );
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-b", "subgroup-1", 1, centsFromExactReais(2000.25))),
  );
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-c-cot-015", "group-1", 1, centsFromExactReais(500.43), null)),
  );

  assertEqual(calculateLineTotal(version.lines, "item-a"), centsFromExactReais(1000.5), "item-a total mismatch");
  assertEqual(
    calculateLineTotal(version.lines, "subgroup-1"),
    centsFromExactReais(1000.5) + centsFromExactReais(2000.25),
    "subgroup total must equal the sum of its descendant items only",
  );
  assertEqual(
    calculateLineTotal(version.lines, "group-1"),
    centsFromExactReais(1000.5) + centsFromExactReais(2000.25) + centsFromExactReais(500.43),
    "group total must equal the sum of all descendant items only (subgroup total is never re-added)",
  );
  assertEqual(
    calculateBudgetVersionTotal(version),
    centsFromExactReais(1000.5) + centsFromExactReais(2000.25) + centsFromExactReais(500.43),
    "version total must equal exactly the sum of leaf service items, with COT-015-like item included",
  );
});

runTest("totalização independe da ordem de inserção", () => {
  let versionInsertedInOrder = requireSuccess(createVersion({ id: "version-order-1" }));
  versionInsertedInOrder = requireSuccess(addBudgetLine(groupInput(versionInsertedInOrder, "group-1", 0)));
  versionInsertedInOrder = requireSuccess(addBudgetLine(serviceItemInput(versionInsertedInOrder, "item-1", "group-1", 1, centsFromExactReais(10))));
  versionInsertedInOrder = requireSuccess(addBudgetLine(serviceItemInput(versionInsertedInOrder, "item-2", "group-1", 2, centsFromExactReais(20))));

  let versionInsertedReversed = requireSuccess(createVersion({ id: "version-order-2" }));
  versionInsertedReversed = requireSuccess(addBudgetLine(groupInput(versionInsertedReversed, "group-1", 0)));
  versionInsertedReversed = requireSuccess(addBudgetLine(serviceItemInput(versionInsertedReversed, "item-2", "group-1", 2, centsFromExactReais(20))));
  versionInsertedReversed = requireSuccess(addBudgetLine(serviceItemInput(versionInsertedReversed, "item-1", "group-1", 1, centsFromExactReais(10))));

  assertEqual(
    calculateBudgetVersionTotal(versionInsertedInOrder),
    calculateBudgetVersionTotal(versionInsertedReversed),
    "total must not depend on insertion order",
  );
});

runTest("totalização respeita o Escopo consultado", () => {
  let version = requireSuccess(createVersion({ scope: wholeCaseScope }));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0, wholeCaseScope)));
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-lot-a", "group-1", 1, centsFromExactReais(300), null, lotAScope)),
  );
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-lot-b", "group-1", 2, centsFromExactReais(700), null, lotBScope)),
  );

  assertEqual(calculateBudgetVersionTotal(version, lotAScope), centsFromExactReais(300), "lot A total mismatch");
  assertEqual(calculateBudgetVersionTotal(version, lotBScope), centsFromExactReais(700), "lot B total mismatch");
  assertEqual(calculateBudgetVersionTotal(version), centsFromExactReais(1000), "whole-case total must include both lots");
});

runTest("rejeita totalCents em Grupo ou Subgrupo (nunca uma parcela própria)", () => {
  const version = requireSuccess(createVersion());
  const attempt = addBudgetLine({ ...groupInput(version, "group-1", 0), totalCents: centsFromExactReais(1) });
  assertVersionFailure(attempt, "expected failure: group must never carry its own totalCents");
  assertEqual(attempt.errors[0]?.code, "invalid_total_cents", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.8 — Rastreabilidade
// ---------------------------------------------------------------------------

runTest("Relação de Rastreabilidade preserva origem, destino e natureza", () => {
  const version = requireSuccess(
    createVersion({ origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "evidencia-001" } }),
  );

  assertEqual(version.originLineage.nature, LineageRelationNature.Origin, "lineage nature mismatch");
  assertEqual(version.originLineage.destinationBudgetVersionId, version.id, "lineage destination must be this version");
  assertEqual(version.originLineage.origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference, "lineage origin kind mismatch");
});

runTest("Relação de Rastreabilidade nunca atravessa organização usuária (por construção)", () => {
  const version = requireSuccess(createVersion());
  assertEqual(version.originLineage.organizationId, version.organizationId, "lineage organization must match the version's organization");
});

runTest("Relação de Rastreabilidade não é alterada silenciosamente após consolidação", () => {
  const version = requireSuccess(createVersion());
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));
  assertEqual(consolidated.originLineage.id, version.originLineage.id, "lineage id must be preserved through consolidation");
  assertEqual(consolidated.originLineage.origin.kind, version.originLineage.origin.kind, "lineage origin must be preserved through consolidation");
});

runTest("Relação de Rastreabilidade pode ser registrada posteriormente, enquanto em rascunho", () => {
  const version = requireSuccess(createVersion({ origin: { kind: BudgetVersionOriginKind.Native } }));
  const updated = registerLineageRelation({
    budgetVersion: version,
    origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "evidencia-registrada-depois" },
  });
  assertVersionSuccess(updated, "expected success registering a later lineage relation while in draft");
  assertEqual(updated.budgetVersion.originLineage.origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference, "origin kind must be updated");
});

runTest("registro posterior de Relação de Rastreabilidade é proibido após consolidação", () => {
  const version = requireSuccess(createVersion());
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));
  const attempt = registerLineageRelation({
    budgetVersion: consolidated,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected failure registering a lineage relation on a consolidated version");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.9 — Validação conjunta Processo/organização/Escopo e identificadores vazios
// ---------------------------------------------------------------------------

runTest("rejeita Versão do Orçamento com identificador vazio", () => {
  const attempt = createBudgetVersion({
    id: "",
    organizationId,
    procurementCaseId,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected missing id failure");
  assertEqual(attempt.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejeita Linha do Orçamento com identificador vazio", () => {
  const version = requireSuccess(createVersion());
  const attempt = addBudgetLine({ ...groupInput(version, "", 0) });
  assertVersionFailure(attempt, "expected missing id failure");
  assertEqual(attempt.errors[0]?.code, "missing_id", "error code mismatch");
});

runTest("rejeita Versão do Orçamento cujo Escopo pertence a outro Processo (validação conjunta Processo/Escopo)", () => {
  const foreignScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId: "case-other" };
  const attempt = createBudgetVersion({
    id: "version-mismatched-scope",
    organizationId,
    procurementCaseId,
    scope: foreignScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected scope/case mismatch failure");
  assertEqual(attempt.errors[0]?.code, "scope_case_mismatch", "error code mismatch");
});

runTest("rejeita Escopo estruturalmente arbitrário na criação da Versão", () => {
  const malformedScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId, procurementLotId: "lot-a" } as unknown as ProcurementScope;
  const attempt = createBudgetVersion({
    id: "version-malformed-scope",
    organizationId,
    procurementCaseId,
    scope: malformedScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected malformed scope failure");
  assertEqual(attempt.errors[0]?.code, "malformed_scope", "error code mismatch");
});

runTest("rejeita Escopo estruturalmente arbitrário ao adicionar uma Linha", () => {
  const version = requireSuccess(createVersion());
  const malformedScope = { kind: ProcurementScopeKind.Lot, procurementCaseId } as unknown as ProcurementScope;
  const attempt = addBudgetLine({ ...groupInput(version, "group-1", 0, malformedScope) });
  assertVersionFailure(attempt, "expected malformed scope failure");
  assertEqual(attempt.errors[0]?.code, "malformed_scope", "error code mismatch");
});

runTest("correlationId, createdBy e sourceSystem podem ser omitidos ao criar a Versão", () => {
  const result = createBudgetVersion({
    id: "version-without-provenance-fields",
    organizationId,
    procurementCaseId,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionSuccess(result, "expected success without correlationId/createdBy/sourceSystem");
});

// ---------------------------------------------------------------------------
// 18.10 — Compatibilidade de Escopo entre pai e filho
// ---------------------------------------------------------------------------

runTest("aceita filho cujo Escopo é compatível com o Escopo do pai", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-lot-a", "group-lot-a", 0, lotAScope)));
  assertEqual(version.lines.length, 2, "expected both lines to be accepted");
});

runTest("rejeita filho cujo Escopo diverge do Escopo do pai", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope)));
  const attempt = addBudgetLine(subgroupInput(version, "subgroup-lot-b", "group-lot-a", 0, lotBScope));
  assertVersionFailure(attempt, "expected child scope incompatible with parent scope failure");
  assertEqual(attempt.errors[0]?.code, "child_scope_incompatible_with_parent", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.11 — Alteração controlada de Linhas do Orçamento
// ---------------------------------------------------------------------------

runTest("altera descrição, código externo e total de uma Linha em rascunho", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  version = requireSuccess(addBudgetLine(serviceItemInput(version, "item-1", "group-1", 0, centsFromExactReais(10))));

  const updated = updateBudgetLine({
    budgetVersion: version,
    lineId: "item-1",
    description: "Descrição alterada",
    externalCode: "NEW-CODE",
    totalCents: centsFromExactReais(20),
  });
  assertVersionSuccess(updated, "expected update success");
  const updatedLine = updated.budgetVersion.lines.find((line) => line.id === "item-1");
  assertEqual(updatedLine?.description, "Descrição alterada", "description must be updated");
  assertEqual(updatedLine?.externalCode, "NEW-CODE", "external code must be updated");
  assertEqual(updatedLine?.totalCents, centsFromExactReais(20), "total must be updated");
});

runTest("rejeita alteração de Linha após consolidação", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));

  const attempt = updateBudgetLine({ budgetVersion: consolidated, lineId: "group-1", description: "Nova descrição" });
  assertVersionFailure(attempt, "expected failure updating a line on a consolidated version");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

runTest("altera o Escopo de uma Linha-pai apenas quando os filhos existentes permanecem compatíveis", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-lot-a", "group-lot-a", 0, lotAScope)));

  const incompatibleAttempt = updateBudgetLine({ budgetVersion: version, lineId: "group-lot-a", scope: lotBScope });
  assertVersionFailure(incompatibleAttempt, "expected failure: changing parent scope would strand an existing child");
  assertEqual(incompatibleAttempt.errors[0]?.code, "child_scope_incompatible_with_parent", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.12 — Remoção controlada de Linhas do Orçamento
// ---------------------------------------------------------------------------

runTest("remove uma Linha sem filhos em rascunho", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-2", 1)));

  const removed = removeBudgetLine({ budgetVersion: version, lineId: "group-2" });
  assertVersionSuccess(removed, "expected removal success");
  assertEqual(removed.budgetVersion.lines.length, 1, "expected exactly one remaining line");
});

runTest("rejeita remoção de Linha que possui filhos", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-1", "group-1", 0)));

  const attempt = removeBudgetLine({ budgetVersion: version, lineId: "group-1" });
  assertVersionFailure(attempt, "expected failure removing a line with children");
  assertEqual(attempt.errors[0]?.code, "line_has_children", "error code mismatch");
});

runTest("rejeita remoção de Linha após consolidação", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));

  const attempt = removeBudgetLine({ budgetVersion: consolidated, lineId: "group-1" });
  assertVersionFailure(attempt, "expected failure removing a line from a consolidated version");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.13 — Consolidação repetida não é mecanismo físico de idempotência
// ---------------------------------------------------------------------------

runTest("consolidação repetida é um no-op de domínio, não um mecanismo físico de idempotência", () => {
  const version = requireSuccess(createVersion());
  const firstConsolidation = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));
  const secondConsolidation = requireSuccess(consolidateBudgetVersion({ budgetVersion: firstConsolidation }));

  assertEqual(secondConsolidation.id, firstConsolidation.id, "id must be unchanged");
  assertEqual(secondConsolidation.status, BudgetVersionStatus.Consolidated, "status must remain Consolidated");
  // Esta asserção documenta a distinção: nenhuma identidade de execução,
  // nenhuma persistência e nenhuma concorrência estão envolvidas aqui —
  // apenas um retorno inalterado em memória. O mecanismo físico de
  // idempotência (execução concorrente contra um registro persistido)
  // permanece uma decisão em aberto, reservada à Sprint 21.3C.
});

// ---------------------------------------------------------------------------
// Fixtures and local test helpers
// ---------------------------------------------------------------------------

function createVersion(overrides: Partial<Parameters<typeof createBudgetVersion>[0]> = {}) {
  return createBudgetVersion({
    id: "version-lagoa-do-arroz",
    organizationId,
    procurementCaseId,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.Native },
    correlationId,
    createdBy,
    sourceSystem,
    ...overrides,
  });
}

function groupInput(version: BudgetVersion, id: string, position: number, scope: ProcurementScope = version.scope) {
  return {
    budgetVersion: version,
    id,
    kind: BudgetLineKind.Group,
    description: `Grupo ${id}`,
    position,
    scope,
  };
}

function subgroupInput(version: BudgetVersion, id: string, parentLineId: string | null, position: number, scope: ProcurementScope = version.scope) {
  return {
    budgetVersion: version,
    id,
    kind: BudgetLineKind.Subgroup,
    description: `Subgrupo ${id}`,
    parentLineId,
    position,
    scope,
  };
}

function serviceItemInput(
  version: BudgetVersion,
  id: string,
  parentLineId: string | null,
  position: number,
  totalCents: number,
  externalCode: string | null = `COD-${id}`,
  scope: ProcurementScope = version.scope,
) {
  return {
    budgetVersion: version,
    id,
    kind: BudgetLineKind.ServiceItem,
    description: `Item de Serviço ${id}`,
    parentLineId,
    position,
    scope,
    externalCode,
    totalCents,
  };
}

function lineLiteral(id: string, kind: BudgetLineKind, parentLineId: string | null): BudgetLine {
  return {
    id,
    budgetVersionId: "version-synthetic",
    kind,
    description: id,
    externalCode: null,
    parentLineId,
    position: 0,
    scope: wholeCaseScope,
    totalCents: kind === BudgetLineKind.ServiceItem ? 0 : null,
    metadata: {},
  };
}

function requireSuccess(result: ReturnType<typeof createBudgetVersion>): BudgetVersion {
  if (!result.success) {
    throw new Error(`requireSuccess: unexpected failure — ${JSON.stringify(result.errors)}`);
  }
  return result.budgetVersion;
}

function assertVersionSuccess(
  result: ReturnType<typeof createBudgetVersion>,
  message: string,
): asserts result is Extract<ReturnType<typeof createBudgetVersion>, { success: true }> {
  if (!result.success) {
    throw new Error(`${message}: ${JSON.stringify(result.errors)}`);
  }
}

function assertVersionFailure(
  result: ReturnType<typeof createBudgetVersion>,
  message: string,
): asserts result is Extract<ReturnType<typeof createBudgetVersion>, { success: false }> {
  if (result.success) {
    throw new Error(message);
  }
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
