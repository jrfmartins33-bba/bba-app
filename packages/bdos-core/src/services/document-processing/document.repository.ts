import type { DocumentArtifact } from "../../domain/document-processing";

export interface DocumentRepository {
  createDocument(
    organizationId: string,
    actor: string,
    document: DocumentArtifact,
  ): Promise<DocumentArtifact>;

  findDocumentById(
    organizationId: string,
    id: string,
  ): Promise<DocumentArtifact | null>;
}
