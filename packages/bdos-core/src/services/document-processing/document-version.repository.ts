import type { DocumentVersion } from "../../domain/document-processing";

export interface DocumentVersionRepository {
  createDocumentVersion(
    organizationId: string,
    actor: string,
    documentVersion: DocumentVersion,
  ): Promise<DocumentVersion>;

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
