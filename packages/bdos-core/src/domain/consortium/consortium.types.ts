export type ConsortiumId = string;
export type ConsortiumMemberId = string;
export type OrganizationId = string;

export enum ConsortiumCompositionStatus {
  Draft = "Draft",
  Consolidated = "Consolidated",
}

export interface ConsortiumMember {
  readonly id: ConsortiumMemberId;
  readonly consortiumId: ConsortiumId;
  readonly partyNameSnapshot: string;
  readonly partyTradeNameSnapshot: string | null;
  readonly partyIdentifier: string | null;
  readonly shareBasisPoints: number;
  readonly isLeader: boolean;
  readonly memberOrganizationId: OrganizationId | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface Consortium {
  readonly id: ConsortiumId;
  readonly organizationId: OrganizationId;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly cnpj: string | null;
  readonly compositionStatus: ConsortiumCompositionStatus;
  readonly members: ReadonlyArray<ConsortiumMember>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CreateConsortiumInput {
  readonly id: ConsortiumId;
  readonly organizationId: OrganizationId;
  readonly legalName: string;
  readonly tradeName?: string | null;
  readonly cnpj?: string | null;
  readonly compositionStatus?: ConsortiumCompositionStatus;
  readonly members?: ReadonlyArray<CreateConsortiumMemberInput>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateConsortiumMemberInput {
  readonly id: ConsortiumMemberId;
  readonly partyNameSnapshot?: string;
  readonly partyName?: string; // alias semântico aceito na entrada
  readonly partyTradeNameSnapshot?: string | null;
  readonly partyTradeName?: string | null; // alias semântico aceito na entrada
  readonly partyIdentifier?: string | null;
  readonly shareBasisPoints: number;
  readonly isLeader?: boolean;
  readonly memberOrganizationId?: OrganizationId | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
