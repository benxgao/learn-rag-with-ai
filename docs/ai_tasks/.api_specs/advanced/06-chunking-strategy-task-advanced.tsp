import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 06: Chunking Strategy
 *
 * Intelligent Document Splitting
 * Split documents into optimally sized chunks for embedding
 */
@service({
  title: "AI RAG API - Task 06: Chunking Strategy",
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
namespace AIRagAPI.ChunkingStrategy;

// ============================================================================
// TASK 06: Chunking Strategy - Intelligent Document Splitting
// ============================================================================

/** Split documents into optimally sized chunks for embedding
 *
 * Task: 06 - Chunking Strategy
 * Purpose: Improve retrieval by choosing appropriate chunk boundaries
 * Strategies:
 *   - fixed: Exact size, fast, but loses context at boundaries
 *   - sliding: Size + overlap, preserves boundary context (RECOMMENDED)
 *   - semantic: Topic boundaries, best quality but slower
 * Trade-offs: Size affects cost (more chunks = more embeddings)
 */
@doc("Split documents into chunks using specified strategy")
@route("/api/chunk")
@post
op chunkDocument(
  @body body: ChunkRequest
): ChunkResponse;

model ChunkRequest {
  @doc("Text document to chunk")
  @minLength(1)
  text: string;

  @doc("Chunking algorithm: fixed | sliding | semantic (default: sliding)")
  strategy?: "fixed" | "sliding" | "semantic";

  @doc("Target chunk size in tokens (default: 512, range: 256-1024)")
  chunkSize?: int32;

  @doc("Overlap in tokens between chunks (default: 100, only for sliding)")
  overlap?: int32;

  @doc("Document ID for chunk metadata (optional)")
  documentId?: string;
}

model ChunkResponse {
  @doc("Array of text chunks")
  chunks: Chunk[];

  @doc("Total chunks created")
  totalChunks: int32;

  @doc("Total tokens across all chunks")
  totalTokens: int32;

  @doc("Average tokens per chunk")
  averageChunkSize: int32;

  @doc("Estimated embedding cost for chunks")
  estimatedEmbeddingCost: float32;

  @doc("Strategy used for chunking")
  strategy: "fixed" | "sliding" | "semantic";

  @doc("Processing duration in milliseconds")
  duration: int32;
}

model Chunk {
  @doc("Chunk index (0-based)")
  index: int32;

  @doc("Chunk text content")
  text: string;

  @doc("Token count in chunk")
  tokenCount: int32;

  @doc("Starting character position in original document")
  startIndex: int32;

  @doc("Ending character position in original document")
  endIndex: int32;
}
