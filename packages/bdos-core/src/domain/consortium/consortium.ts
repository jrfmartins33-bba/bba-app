import {
  type Consortium,
  type ConsortiumMember,
  ConsortiumCompositionStatus,
  type CreateConsortiumInput,
  type CreateConsortiumMemberInput,
} from "./consortium.types";

export class ConsortiumValidationError extends Error {
  constructor(message: string) {
    super(`ConsortiumValidationError: ${message}`);
    this.name = "ConsortiumValidationError";
  }
}

export const TOTAL_SHARE_BASIS_POINTS = 10000; // 100.00%

export function calculateTotalSharesBasisPoints(members: ReadonlyArray<ConsortiumMember>): number {
  return members.reduce((sum, member) => sum + member.shareBasisPoints, 0);
}

export function validateConsortiumMemberInput(member: CreateConsortiumMemberInput): void {
  if (!member.id || typeof member.id !== "string" || member.id.trim().length === 0) {
    throw new ConsortiumValidationError("Consortium member id must be a non-empty string.");
  }
  const name = member.partyNameSnapshot ?? member.partyName;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ConsortiumValidationError("Consortium member partyNameSnapshot must be a non-empty string.");
  }
  if (
    typeof member.shareBasisPoints !== "number" ||
    !Number.isSafeInteger(member.shareBasisPoints) ||
    member.shareBasisPoints < 0 ||
    member.shareBasisPoints > TOTAL_SHARE_BASIS_POINTS
  ) {
    throw new ConsortiumValidationError(
      `Consortium member shareBasisPoints must be an integer between 0 and 10000 (0% to 100%). Found: ${member.shareBasisPoints}`,
    );
  }
}

export function validateConsortiumComposition(
  members: ReadonlyArray<ConsortiumMember>,
  compositionStatus: ConsortiumCompositionStatus,
): void {
  const totalShares = calculateTotalSharesBasisPoints(members);

  const leaders = members.filter((m) => m.isLeader);
  if (leaders.length > 1) {
    throw new ConsortiumValidationError(
      `Consortium can have at most one leader. Found ${leaders.length} leaders: ${leaders.map((l) => l.partyNameSnapshot).join(", ")}.`,
    );
  }

  // Valida duplicação de partyIdentifier dentro do mesmo consórcio
  const seenIdentifiers = new Set<string>();
  for (const m of members) {
    if (m.partyIdentifier) {
      const normalized = m.partyIdentifier.trim();
      if (seenIdentifiers.has(normalized)) {
        throw new ConsortiumValidationError(
          `Consortium member with partyIdentifier "${m.partyIdentifier}" is duplicated in this consortium.`,
        );
      }
      seenIdentifiers.add(normalized);
    }
  }

  if (compositionStatus === ConsortiumCompositionStatus.Consolidated) {
    if (members.length === 0) {
      throw new ConsortiumValidationError("Consolidated consortium must have at least one member.");
    }
    if (totalShares !== TOTAL_SHARE_BASIS_POINTS) {
      throw new ConsortiumValidationError(
        `Consolidated consortium composition must total exactly 100% (10000 basis points). Found: ${totalShares} basis points (${(totalShares / 100).toFixed(2)}%).`,
      );
    }
  } else {
    if (totalShares > TOTAL_SHARE_BASIS_POINTS) {
      throw new ConsortiumValidationError(
        `Draft consortium shares cannot exceed 100% (10000 basis points). Found: ${totalShares} basis points.`,
      );
    }
  }
}

export function createConsortium(input: CreateConsortiumInput): Consortium {
  if (!input.id || typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new ConsortiumValidationError("Consortium id must be a non-empty string.");
  }
  if (!input.organizationId || typeof input.organizationId !== "string" || input.organizationId.trim().length === 0) {
    throw new ConsortiumValidationError("Consortium organizationId must be a non-empty string.");
  }
  if (!input.legalName || typeof input.legalName !== "string" || input.legalName.trim().length === 0) {
    throw new ConsortiumValidationError("Consortium legalName must be a non-empty string.");
  }

  const compositionStatus = input.compositionStatus ?? ConsortiumCompositionStatus.Draft;
  const rawMembers = input.members ?? [];

  for (const m of rawMembers) {
    validateConsortiumMemberInput(m);
  }

  const members: ReadonlyArray<ConsortiumMember> = rawMembers.map((m) => {
    const name = (m.partyNameSnapshot ?? m.partyName)!.trim();
    const tradeName = (m.partyTradeNameSnapshot ?? m.partyTradeName)?.trim() || null;
    return {
      id: m.id.trim(),
      consortiumId: input.id.trim(),
      partyNameSnapshot: name,
      partyTradeNameSnapshot: tradeName,
      partyIdentifier: m.partyIdentifier ? m.partyIdentifier.trim() : null,
      shareBasisPoints: m.shareBasisPoints,
      isLeader: Boolean(m.isLeader),
      memberOrganizationId: m.memberOrganizationId ? m.memberOrganizationId.trim() : null,
      metadata: m.metadata ?? {},
    };
  });

  validateConsortiumComposition(members, compositionStatus);

  return {
    id: input.id.trim(),
    organizationId: input.organizationId.trim(),
    legalName: input.legalName.trim(),
    tradeName: input.tradeName ? input.tradeName.trim() : null,
    cnpj: input.cnpj ? input.cnpj.trim() : null,
    compositionStatus,
    members,
    metadata: input.metadata ?? {},
  };
}

export function addMemberToConsortium(consortium: Consortium, memberInput: CreateConsortiumMemberInput): Consortium {
  if (consortium.compositionStatus === ConsortiumCompositionStatus.Consolidated) {
    throw new ConsortiumValidationError("Cannot add member directly to a Consolidated consortium. Set to Draft first.");
  }

  validateConsortiumMemberInput(memberInput);

  if (consortium.members.some((m) => m.id === memberInput.id)) {
    throw new ConsortiumValidationError(`Consortium member with id "${memberInput.id}" already exists in this consortium.`);
  }

  const name = (memberInput.partyNameSnapshot ?? memberInput.partyName)!.trim();
  const tradeName = (memberInput.partyTradeNameSnapshot ?? memberInput.partyTradeName)?.trim() || null;

  const newMember: ConsortiumMember = {
    id: memberInput.id.trim(),
    consortiumId: consortium.id,
    partyNameSnapshot: name,
    partyTradeNameSnapshot: tradeName,
    partyIdentifier: memberInput.partyIdentifier ? memberInput.partyIdentifier.trim() : null,
    shareBasisPoints: memberInput.shareBasisPoints,
    isLeader: Boolean(memberInput.isLeader),
    memberOrganizationId: memberInput.memberOrganizationId ? memberInput.memberOrganizationId.trim() : null,
    metadata: memberInput.metadata ?? {},
  };

  const updatedMembers = [...consortium.members, newMember];
  validateConsortiumComposition(updatedMembers, consortium.compositionStatus);

  return {
    ...consortium,
    members: updatedMembers,
  };
}

export function consolidateConsortiumComposition(consortium: Consortium): Consortium {
  validateConsortiumComposition(consortium.members, ConsortiumCompositionStatus.Consolidated);

  return {
    ...consortium,
    compositionStatus: ConsortiumCompositionStatus.Consolidated,
  };
}

export function formatSharePercentagePtBr(basisPoints: number): string {
  const percent = basisPoints / 100;
  return `${percent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function getConsortiumLeader(consortium: Consortium): ConsortiumMember | null {
  return consortium.members.find((m) => m.isLeader) ?? null;
}
