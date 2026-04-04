import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 03: Upsert Data
 *
 * Batch Document Embedding & Ingestion
 * Load documents into vector index with metadata preservation
 */
@service({
  title: "AI RAG API - Task 03: Upsert Data",
  version: "1.0.0",
})
@server(
  "http://localhost:3000",
  "Development server"
)
@server(
  "https://api.example.com",
  "Production server"
)
namespace AIRagAPI.UpsertData;

// ============================================================================
// TASK 03: Upsert Data - Batch Document Embedding & Ingestion
// ============================================================================

/** Batch ingest documents: embed, chunk, and store in Pinecone
 *
 * Task: 03 - Upsert Data
 * Purpose: Load documents into vector index with metadata preservation
 * Process: Document loading → Chunking → Embedding → Upsertion → Verification
 * Cost: Embedding tokens charged per document
 */
@doc("Batch upsert documents with embedding and metadata")
@route("/api/index/upsert")
@post
op upsertDocuments(
  @body body: UpsertRequest
): UpsertResponse;

model UpsertRequest {
  @doc("Array of documents to embed and store")
  @minItems(1)
  @maxItems(100)
  documents: Document[];

  @doc("Chunking strategy: fixed | sliding | semantic (default: sliding)")
  chunkingStrategy?: "fixed" | "sliding" | "semantic";

  @doc("Chunk size in tokens (default: 512, range: 256-1024)")
  chunkSize?: int32;

  @doc("Chunk overlap in tokens for context preservation (default: 100)")
  overlap?: int32;

  @doc("Namespace for vector organization (optional, default root)")
  namespaceName?: string;
}

model Document {
  @doc("Unique document identifier")
  @minLength(1)
  id: string;

  @doc("Document content to embed")
  @minLength(1)
  text: string;

  @doc("Optional metadata preserved with vectors (key-value pairs)")
  metadata?: Record<string, string | number | boolean>;
}

model UpsertResponse {
  @doc("Total documents processed")
  totalDocuments: int32;

  @doc("Documents successfully upserted")
  successCount: int32;

  @doc("Documents failed to upsert")
  failureCount: int32;

  @doc("Total chunks created from documents")
  totalChunks: int32;

  @doc("Total tokens embedded (for cost tracking)")
  totalTokens: int32;

  @doc("Estimated cost in USD")
  estimatedCost: float32;

  @doc("Processing time in milliseconds")
  duration: int32;

  @doc("Error details for failed documents")
  errors?: Array<{
    documentId: string;
    error: string;
  }>;
}
