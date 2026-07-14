import { ProcurementScopeKind, createProcurementCase, createProcurementLot, type ProcurementCase, type ProcurementLot, type ProcurementScope } from "../procurement-case";
import {
  BudgetLineKind,
  BudgetVersionOriginKind,
  BudgetVersionStatus,
  LineageRelationNature,
  addBudgetLine,
  calculateBudgetVersionTotal,
  calculateLineTotal,
  centsFromDecimalString,
  centsFromExactReais,
  centsFromInteger,
  consolidateBudgetVersion,
  createBudgetVersion,
  hasHierarchyCycle,
  orderedChildren,
  registerLineageRelation,
  removeBudgetLine,
  sumCents,
  updateBudgetLine,
  updateBudgetLinePosition,
  type BudgetLine,
  type BudgetLineDescription,
  type BudgetVersion,
  type LineageRelation,
} from "./index";

const organizationId = "organization-alpha-engenharia";
const correlationId = "budget-version-correlation-001";
const createdBy = "engenharia-de-custos";
const sourceSystem = "bdos-core";

const procurementCase: ProcurementCase = requireCaseSuccess(
  createProcurementCase({ id: "case-lagoa-do-arroz", organizationId, title: "Processo de teste — Barragem Lagoa do Arroz" }),
);
const procurementCaseId = procurementCase.id;

const lotA: ProcurementLot = requireLotSuccess(createProcurementLot({ id: "lot-a", procurementCase, title: "Lote A" }));
const lotB: ProcurementLot = requireLotSuccess(createProcurementLot({ id: "lot-b", procurementCase, title: "Lote B" }));

const wholeCaseScope: ProcurementScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId };
const lotAScope: ProcurementScope = { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId: lotA.id };
const lotBScope: ProcurementScope = { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId: lotB.id };

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
  assertEqual(requireLineage(result.budgetVersion).origin.kind, BudgetVersionOriginKind.Native, "origin kind mismatch");
});

runTest("admite referência documental opaca", () => {
  const result = createVersion({
    origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "evidencia-opaca-001" },
  });
  assertVersionSuccess(result, "expected version creation success");
  assertEqual(requireLineage(result.budgetVersion).origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference, "origin kind mismatch");
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

runTest("posição: rejeita negativa, decimal, NaN, Infinity e inteiro não seguro em addBudgetLine", () => {
  const version = requireSuccess(createVersion());
  const invalidPositions: ReadonlyArray<number> = [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2];

  invalidPositions.forEach((position, index) => {
    const attempt = addBudgetLine(groupInput(version, `group-invalid-position-${index}`, position));
    assertVersionFailure(attempt, `expected failure for invalid position ${position}`);
    assertEqual(attempt.errors[0]?.code, "invalid_position", `error code mismatch for position ${position}`);
  });
});

runTest("posição: updateBudgetLinePosition rejeita posição inválida", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));

  const attempt = updateBudgetLinePosition({ budgetVersion: version, lineId: "group-1", position: -3 });
  assertVersionFailure(attempt, "expected failure for negative position");
  assertEqual(attempt.errors[0]?.code, "invalid_position", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.6 — Escopo das linhas
// ---------------------------------------------------------------------------

runTest("versão global com linha global e com linha de lote válido", () => {
  let version = requireSuccess(createVersion({ scope: wholeCaseScope }));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-global", 0, wholeCaseScope)));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 1, lotAScope, lotA)));
  assertEqual(version.lines.length, 2, "both a global-scoped and a lot-scoped line must be accepted");
});

runTest("versão de lote com linha do mesmo lote", () => {
  let version = requireSuccess(createVersion({ scope: lotAScope, procurementLot: lotA }));
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope, lotA)));
  assertEqual(version.lines.length, 1, "line scoped to the same lot must be accepted");
});

runTest("rejeição de linha de outro lote dentro de versão restrita a lote", () => {
  const version = requireSuccess(createVersion({ scope: lotAScope, procurementLot: lotA }));
  const attempt = addBudgetLine(groupInput(version, "group-lot-b", 0, lotBScope, lotB));
  assertVersionFailure(attempt, "expected failure: line from another lot");
  assertEqual(attempt.errors[0]?.code, "line_scope_incompatible", "error code mismatch");
});

runTest("rejeição de linha global dentro de versão restrita a lote", () => {
  const version = requireSuccess(createVersion({ scope: lotAScope, procurementLot: lotA }));
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
    addBudgetLine(serviceItemInput(version, "item-lot-a", "group-1", 1, centsFromExactReais(300), null, lotAScope, lotA)),
  );
  version = requireSuccess(
    addBudgetLine(serviceItemInput(version, "item-lot-b", "group-1", 2, centsFromExactReais(700), null, lotBScope, lotB)),
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
// 18.14 — Inteiros monetários seguros
// ---------------------------------------------------------------------------

runTest("centavos: maior valor seguro é aceito, primeiro valor inseguro é rejeitado", () => {
  const maxSafe = Number.MAX_SAFE_INTEGER;
  assertEqual(centsFromInteger(maxSafe), maxSafe, "MAX_SAFE_INTEGER cents must be accepted");
  assertEqual(assertThrows(() => centsFromInteger(maxSafe + 2)), true, "a value beyond the safe integer range must be rejected");
});

runTest("centavos: sumCents rejeita soma que ultrapassa o intervalo seguro", () => {
  const nearMax = Number.MAX_SAFE_INTEGER - 1;
  assertEqual(assertThrows(() => sumCents([nearMax, 10])), true, "sum exceeding the safe integer range must be rejected, not silently wrapped");
});

runTest("centavos: sumCents rejeita parcela inválida (negativa ou fracionária)", () => {
  assertEqual(assertThrows(() => sumCents([100, -5])), true, "a negative parcel inside sumCents must be rejected");
  assertEqual(assertThrows(() => sumCents([100, 1.5])), true, "a fractional parcel inside sumCents must be rejected");
});

runTest("centavos: centsFromDecimalString nunca arredonda — rejeita negativos, mais de duas casas, NaN, Infinity", () => {
  const invalidDecimals: ReadonlyArray<string> = ["-1.00", "1.234", "abc", "NaN", "Infinity", "-0.01", "1.999"];
  invalidDecimals.forEach((value) => {
    assertEqual(assertThrows(() => centsFromDecimalString(value)), true, `expected "${value}" to be rejected, never rounded`);
  });
});

runTest("centavos: centsFromInteger rejeita fração, NaN e infinito", () => {
  assertEqual(assertThrows(() => centsFromInteger(1.5)), true, "fractional cents must be rejected");
  assertEqual(assertThrows(() => centsFromInteger(NaN)), true, "NaN cents must be rejected");
  assertEqual(assertThrows(() => centsFromInteger(Infinity)), true, "infinite cents must be rejected");
  assertEqual(assertThrows(() => centsFromInteger(-1)), true, "negative cents must be rejected");
});

// ---------------------------------------------------------------------------
// 18.8 — Relação de Rastreabilidade (origem separada da relação que a documenta)
// ---------------------------------------------------------------------------

runTest("criação com Relação de Rastreabilidade já registrada", () => {
  const version = requireSuccess(createVersion({ id: "version-with-lineage", originLineageId: "lineage-with-id" }));
  assertEqual(version.originLineage !== null, true, "expected a registered lineage relation");
  assertEqual(requireLineage(version).id, "lineage-with-id", "lineage id mismatch");
});

runTest("criação sem Relação de Rastreabilidade", () => {
  const version = requireSuccess(createVersion({ id: "version-without-lineage", originLineageId: undefined }));
  assertEqual(version.originLineage, null, "expected no registered lineage relation when originLineageId is omitted");
});

runTest("Relação de Rastreabilidade preserva origem, destino e natureza", () => {
  const version = requireSuccess(
    createVersion({ origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "evidencia-001" } }),
  );

  const lineage = requireLineage(version);
  assertEqual(lineage.nature, LineageRelationNature.Origin, "lineage nature mismatch");
  assertEqual(lineage.destinationBudgetVersionId, version.id, "lineage destination must be this version");
  assertEqual(lineage.origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference, "lineage origin kind mismatch");
});

runTest("Relação de Rastreabilidade nunca atravessa organização usuária (por construção)", () => {
  const version = requireSuccess(createVersion());
  assertEqual(requireLineage(version).organizationId, version.organizationId, "lineage organization must match the version's organization");
});

runTest("Relação de Rastreabilidade não é alterada silenciosamente após consolidação", () => {
  const version = requireSuccess(createVersion());
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));
  assertEqual(requireLineage(consolidated).id, requireLineage(version).id, "lineage id must be preserved through consolidation");
  assertEqual(requireLineage(consolidated).origin.kind, requireLineage(version).origin.kind, "lineage origin must be preserved through consolidation");
});

runTest("registro posterior da Relação de Rastreabilidade, enquanto em rascunho, usa a origem já declarada", () => {
  const version = requireSuccess(
    createVersion({
      id: "version-lineage-later",
      origin: { kind: BudgetVersionOriginKind.DocumentaryOpaqueReference, reference: "evidencia-declarada-na-criacao" },
      originLineageId: undefined,
    }),
  );
  assertEqual(version.originLineage, null, "precondition: version must start without a registered lineage");

  const updated = registerLineageRelation({ budgetVersion: version, id: "lineage-registered-later" });
  assertVersionSuccess(updated, "expected success registering a later lineage relation while in draft");
  const lineage = requireLineage(updated.budgetVersion);
  assertEqual(lineage.id, "lineage-registered-later", "lineage id must equal the provided opaque identity");
  assertEqual(lineage.origin.kind, BudgetVersionOriginKind.DocumentaryOpaqueReference, "lineage must use the origin already declared on the version");
  assertEqual(
    (lineage.origin as { reference: string }).reference,
    "evidencia-declarada-na-criacao",
    "lineage origin reference must match the origin declared at creation, never an independent one",
  );
  assertEqual(updated.budgetVersion.origin.kind, version.origin.kind, "the version's own declared origin must remain unchanged");
});

runTest("identidade da Relação de Rastreabilidade não é derivada da Versão", () => {
  const version = requireSuccess(createVersion({ id: "version-xyz", originLineageId: undefined }));
  const updated = requireSuccess(registerLineageRelation({ budgetVersion: version, id: "totally-custom-opaque-id" }));
  assertEqual(requireLineage(updated).id, "totally-custom-opaque-id", "lineage id must be exactly the provided opaque identity");
  assertEqual(requireLineage(updated).id.includes(version.id), false, "lineage id must not be derived from (or contain) the version id");
});

runTest("rejeita identificador vazio ao registrar Relação de Rastreabilidade", () => {
  const version = requireSuccess(createVersion({ id: "version-blank-lineage-id", originLineageId: undefined }));
  const attempt = registerLineageRelation({ budgetVersion: version, id: "" });
  assertVersionFailure(attempt, "expected failure for blank lineage relation id");
  assertEqual(attempt.errors[0]?.code, "missing_lineage_relation_id", "error code mismatch");
});

runTest("rejeita registro de uma segunda Relação de Rastreabilidade — nunca substitui a primeira", () => {
  const version = requireSuccess(createVersion({ id: "version-double-lineage", originLineageId: "lineage-first" }));
  const attempt = registerLineageRelation({ budgetVersion: version, id: "lineage-second" });
  assertVersionFailure(attempt, "expected failure: a second lineage relation must be rejected");
  assertEqual(attempt.errors[0]?.code, "origin_lineage_already_registered", "error code mismatch");

  // A primeira relação permanece intacta após a tentativa duplicada.
  assertEqual(requireLineage(version).id, "lineage-first", "the first lineage relation must be preserved, untouched by the rejected attempt");
});

runTest("registro posterior de Relação de Rastreabilidade é proibido após consolidação", () => {
  const version = requireSuccess(createVersion({ id: "version-consolidated-lineage", originLineageId: undefined }));
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));
  const attempt = registerLineageRelation({ budgetVersion: consolidated, id: "lineage-after-consolidation" });
  assertVersionFailure(attempt, "expected failure registering a lineage relation on a consolidated version");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

// ---------------------------------------------------------------------------
// 18.9 — Validação conjunta Processo/organização/Escopo/Lote e identificadores vazios
// ---------------------------------------------------------------------------

runTest("rejeita Versão do Orçamento com identificador vazio", () => {
  const attempt = createBudgetVersion({
    id: "",
    procurementCase,
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
    procurementCase,
    scope: foreignScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected scope/case mismatch failure");
  assertEqual(attempt.errors[0]?.code, "scope_case_mismatch", "error code mismatch");
});

runTest("organizationId e procurementCaseId da Versão são sempre derivados do Processo, nunca fatos independentes", () => {
  const result = requireSuccess(createBudgetVersion({
    id: "version-derived-facts",
    procurementCase,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  }));
  assertEqual(result.organizationId, procurementCase.organizationId, "organizationId must be derived from procurementCase");
  assertEqual(result.procurementCaseId, procurementCase.id, "procurementCaseId must be derived from procurementCase");
});

runTest("rejeita Escopo estruturalmente arbitrário na criação da Versão", () => {
  const malformedScope = { kind: ProcurementScopeKind.WholeCase, procurementCaseId, procurementLotId: "lot-a" } as unknown as ProcurementScope;
  const attempt = createBudgetVersion({
    id: "version-malformed-scope",
    procurementCase,
    scope: malformedScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected malformed scope failure");
  assertEqual(attempt.errors[0]?.code, "malformed_scope", "error code mismatch");
});

runTest("rejeita Escopo de lote sem fornecer o Lote correspondente (Versão)", () => {
  const attempt = createBudgetVersion({
    id: "version-lot-scope-no-lot",
    procurementCase,
    scope: lotAScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected failure: lot-scoped version without a ProcurementLot proof");
  assertEqual(attempt.errors[0]?.code, "missing_procurement_lot", "error code mismatch");
});

runTest("rejeita Escopo com identificador de lote vazio (Versão)", () => {
  const blankLotIdScope = { kind: ProcurementScopeKind.Lot, procurementCaseId, procurementLotId: "" } as unknown as ProcurementScope;
  const attempt = createBudgetVersion({
    id: "version-blank-lot-id",
    procurementCase,
    scope: blankLotIdScope,
    procurementLot: lotA,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected failure: blank procurementLotId is not well-formed");
  assertEqual(attempt.errors[0]?.code, "malformed_scope", "error code mismatch");
});

runTest("rejeita Escopo com identificador de lote diferente do Lote fornecido (Versão)", () => {
  const attempt = createBudgetVersion({
    id: "version-scope-lot-mismatch",
    procurementCase,
    scope: lotAScope,
    procurementLot: lotB,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected failure: scope.procurementLotId does not match the provided lot's identity");
  assertEqual(attempt.errors[0]?.code, "scope_lot_mismatch", "error code mismatch");
});

runTest("rejeita Lote de outra organização usuária (Versão)", () => {
  const foreignOrgLot: ProcurementLot = { ...lotA, organizationId: "organization-other" };
  const attempt = createBudgetVersion({
    id: "version-lot-foreign-org",
    procurementCase,
    scope: lotAScope,
    procurementLot: foreignOrgLot,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected failure: lot from a different organização usuária");
  assertEqual(attempt.errors[0]?.code, "lot_organization_mismatch", "error code mismatch");
});

runTest("rejeita Lote de outro Processo (Versão)", () => {
  const foreignCaseLot: ProcurementLot = { ...lotA, procurementCaseId: "case-other" };
  const attempt = createBudgetVersion({
    id: "version-lot-foreign-case",
    procurementCase,
    scope: lotAScope,
    procurementLot: foreignCaseLot,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionFailure(attempt, "expected failure: lot from a different Processo");
  assertEqual(attempt.errors[0]?.code, "lot_case_mismatch", "error code mismatch");
});

runTest("aceita Versão de lote com Lote corretamente validado", () => {
  const result = createBudgetVersion({
    id: "version-lot-valid",
    procurementCase,
    scope: lotAScope,
    procurementLot: lotA,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionSuccess(result, "expected success with a correctly validated lot");
});

runTest("rejeita Linha com Escopo de lote não validado", () => {
  const version = requireSuccess(createVersion());
  const attempt = addBudgetLine(groupInput(version, "group-lot-unvalidated", 0, lotAScope));
  assertVersionFailure(attempt, "expected failure: lot-scoped line without a ProcurementLot proof");
  assertEqual(attempt.errors[0]?.code, "missing_procurement_lot", "error code mismatch");
});

runTest("rejeita alteração de Linha para Escopo de lote não validado", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));

  const attempt = updateBudgetLine({ budgetVersion: version, lineId: "group-1", scope: lotAScope });
  assertVersionFailure(attempt, "expected failure: updating to a lot scope without a ProcurementLot proof");
  assertEqual(attempt.errors[0]?.code, "missing_procurement_lot", "error code mismatch");
});

runTest("rejeita Escopo estruturalmente arbitrário ao adicionar uma Linha", () => {
  const version = requireSuccess(createVersion());
  const malformedScope = { kind: ProcurementScopeKind.Lot, procurementCaseId } as unknown as ProcurementScope;
  const attempt = addBudgetLine({ ...groupInput(version, "group-1", 0, malformedScope) });
  assertVersionFailure(attempt, "expected malformed scope failure");
  assertEqual(attempt.errors[0]?.code, "malformed_scope", "error code mismatch");
});

runTest("correlationId, createdBy e sourceSystem podem ser omitidos ao criar a Versão, e não aparecem em metadata", () => {
  const result = createBudgetVersion({
    id: "version-without-provenance-fields",
    procurementCase,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.Native },
  });
  assertVersionSuccess(result, "expected success without correlationId/createdBy/sourceSystem");
  assertEqual(Object.prototype.hasOwnProperty.call(result.budgetVersion.metadata, "correlationId"), false, "correlationId key must be absent, not undefined");
  assertEqual(Object.prototype.hasOwnProperty.call(result.budgetVersion.metadata, "createdBy"), false, "createdBy key must be absent, not undefined");
  assertEqual(Object.prototype.hasOwnProperty.call(result.budgetVersion.metadata, "sourceSystem"), false, "sourceSystem key must be absent, not undefined");
});

// ---------------------------------------------------------------------------
// 18.10 — Compatibilidade de Escopo entre pai e filho
// ---------------------------------------------------------------------------

runTest("aceita filho cujo Escopo é compatível com o Escopo do pai", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope, lotA)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-lot-a", "group-lot-a", 0, lotAScope, lotA)));
  assertEqual(version.lines.length, 2, "expected both lines to be accepted");
});

runTest("rejeita filho cujo Escopo diverge do Escopo do pai", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope, lotA)));
  const attempt = addBudgetLine(subgroupInput(version, "subgroup-lot-b", "group-lot-a", 0, lotBScope, lotB));
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
    description: { status: "Confirmed", text: "Descrição alterada" },
    externalCode: "NEW-CODE",
    totalCents: centsFromExactReais(20),
  });
  assertVersionSuccess(updated, "expected update success");
  const updatedLine = updated.budgetVersion.lines.find((line) => line.id === "item-1");
  assertDescriptionText(updatedLine?.description, "Descrição alterada", "description must be updated");
  assertEqual(updatedLine?.externalCode, "NEW-CODE", "external code must be updated");
  assertEqual(updatedLine?.totalCents, centsFromExactReais(20), "total must be updated");
});

runTest("atualização de Linha pode corrigir uma lacuna de descrição para confirmada, enquanto em rascunho", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(
    addBudgetLine({ ...groupInput(version, "group-1", 0), description: { status: "AbsentFromSource" } }),
  );

  const beforeUpdate = version.lines.find((line) => line.id === "group-1");
  assertEqual(beforeUpdate?.description.status, "AbsentFromSource", "precondition: description must start absent");

  const updated = requireSuccess(
    updateBudgetLine({ budgetVersion: version, lineId: "group-1", description: { status: "Confirmed", text: "Descrição agora confirmada" } }),
  );
  const afterUpdate = updated.lines.find((line) => line.id === "group-1");
  assertDescriptionText(afterUpdate?.description, "Descrição agora confirmada", "description must now be confirmed");
});

runTest("rejeita alteração de Linha após consolidação", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-1", 0)));
  const consolidated = requireSuccess(consolidateBudgetVersion({ budgetVersion: version }));

  const attempt = updateBudgetLine({ budgetVersion: consolidated, lineId: "group-1", description: { status: "Confirmed", text: "Nova descrição" } });
  assertVersionFailure(attempt, "expected failure updating a line on a consolidated version");
  assertEqual(attempt.errors[0]?.code, "consolidated_version_immutable", "error code mismatch");
});

runTest("altera o Escopo de uma Linha-pai apenas quando os filhos existentes permanecem compatíveis", () => {
  let version = requireSuccess(createVersion());
  version = requireSuccess(addBudgetLine(groupInput(version, "group-lot-a", 0, lotAScope, lotA)));
  version = requireSuccess(addBudgetLine(subgroupInput(version, "subgroup-lot-a", "group-lot-a", 0, lotAScope, lotA)));

  const incompatibleAttempt = updateBudgetLine({ budgetVersion: version, lineId: "group-lot-a", scope: lotBScope, procurementLot: lotB });
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
    procurementCase,
    scope: wholeCaseScope,
    origin: { kind: BudgetVersionOriginKind.Native },
    originLineageId: "lineage-default",
    correlationId,
    createdBy,
    sourceSystem,
    ...overrides,
  });
}

function groupInput(
  version: BudgetVersion,
  id: string,
  position: number,
  scope: ProcurementScope = version.scope,
  procurementLot?: ProcurementLot,
) {
  return {
    budgetVersion: version,
    id,
    kind: BudgetLineKind.Group,
    description: { status: "Confirmed" as const, text: `Grupo ${id}` },
    position,
    scope,
    procurementLot,
  };
}

function subgroupInput(
  version: BudgetVersion,
  id: string,
  parentLineId: string | null,
  position: number,
  scope: ProcurementScope = version.scope,
  procurementLot?: ProcurementLot,
) {
  return {
    budgetVersion: version,
    id,
    kind: BudgetLineKind.Subgroup,
    description: { status: "Confirmed" as const, text: `Subgrupo ${id}` },
    parentLineId,
    position,
    scope,
    procurementLot,
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
  procurementLot?: ProcurementLot,
) {
  return {
    budgetVersion: version,
    id,
    kind: BudgetLineKind.ServiceItem,
    description: { status: "Confirmed" as const, text: `Item de Serviço ${id}` },
    parentLineId,
    position,
    scope,
    procurementLot,
    externalCode,
    totalCents,
  };
}

function lineLiteral(id: string, kind: BudgetLineKind, parentLineId: string | null): BudgetLine {
  return {
    id,
    budgetVersionId: "version-synthetic",
    kind,
    description: { status: "Confirmed", text: id },
    externalCode: null,
    parentLineId,
    position: 0,
    scope: wholeCaseScope,
    totalCents: kind === BudgetLineKind.ServiceItem ? 0 : null,
    metadata: {},
  };
}

function requireLineage(version: BudgetVersion): LineageRelation {
  if (version.originLineage === null) {
    throw new Error("requireLineage: expected a registered origin Relação de Rastreabilidade");
  }
  return version.originLineage;
}

function assertDescriptionText(description: BudgetLineDescription | undefined, expectedText: string, message: string): void {
  if (description === undefined || description.status !== "Confirmed") {
    throw new Error(`${message}: expected a Confirmed description, got ${JSON.stringify(description)}`);
  }
  assertEqual(description.text, expectedText, message);
}

function assertThrows(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function requireSuccess(result: ReturnType<typeof createBudgetVersion>): BudgetVersion {
  if (!result.success) {
    throw new Error(`requireSuccess: unexpected failure — ${JSON.stringify(result.errors)}`);
  }
  return result.budgetVersion;
}

function requireCaseSuccess(result: ReturnType<typeof createProcurementCase>): ProcurementCase {
  if (!result.success) {
    throw new Error(`requireCaseSuccess: unexpected failure — ${JSON.stringify(result.errors)}`);
  }
  return result.procurementCase;
}

function requireLotSuccess(result: ReturnType<typeof createProcurementLot>): ProcurementLot {
  if (!result.success) {
    throw new Error(`requireLotSuccess: unexpected failure — ${JSON.stringify(result.errors)}`);
  }
  return result.procurementLot;
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
