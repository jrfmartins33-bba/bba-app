import type { DocumentVersion } from "../../domain/document-processing";

export type PersistDocumentVersionResult =
  | { readonly outcome: "created"; readonly documentVersion: DocumentVersion }
  | { readonly outcome: "reused"; readonly documentVersion: DocumentVersion };

export interface DocumentVersionRepository {
  createOrReuseDocumentVersion(
    organizationId: string,
    actor: string,
    documentVersion: DocumentVersion,
  ): Promise<PersistDocumentVersionResult>;

  findDocumentVersionById(
    organizationId: string,
    id: string,
  ): Promise<DocumentVersion | null>;

  findDocumentVersionByDocumentAndSha256(
    organizationId: string,
    documentId: string,
    sha256: string,
  ): Promise<DocumentVersion | null>;

  listDocumentVersionsByDocument(
    organizationId: string,
    documentId: string,
  ): Promise<ReadonlyArray<DocumentVersion>>;
}
