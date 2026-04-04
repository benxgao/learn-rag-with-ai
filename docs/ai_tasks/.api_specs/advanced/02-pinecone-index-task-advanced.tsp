import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 02: Pinecone Index
 *
 * Vector Database Configuration & Management
 * Validate index configuration, dimension compatibility
 */
@service({
  title: "AI RAG API - Task 02: Pinecone Index",
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
namespace AIRagAPI.PineconeIndex;

// ============================================================================
// TASK 02: Pinecone Index - Vector Database Configuration & Management
// ============================================================================

/** Get Pinecone index information and metadata
 *
 * Task: 02 - Pinecone Index
 * Purpose: Validate index configuration, dimension compatibility
 * Used by: Tasks 03 (upsertion), 04 (search), 07-08 (evaluation & improvement)
 */
@doc("Retrieve vector index configuration and statistics")
@route("/api/index/info")
@get
op getIndexInfo(): IndexInfoResponse;

model IndexInfoResponse {
  @doc("Index name from environment config")
  name: string;

  @doc("Vector dimension (1536 for OpenAI text-embedding-3-small)")
  dimension: int32;

  @doc("Similarity metric: cosine recommended for semantic search")
  metric: "cosine" | "euclidean" | "dotproduct";

  @doc("Pod type: s1 (dev) | s1.x1 | s1.x2 (production)")
  podType: string;

  @doc("Number of replicas for availability (1=dev, 2+=production)")
  replicas: int32;

  @doc("Total vectors currently in index")
  vectorCount: int32;

  @doc("Index readiness status")
  status: "initializing" | "ready" | "degraded";

  @doc("Namespace count (for multi-tenant organization)")
  namespaces?: int32;

  @doc("Last update timestamp")
  lastUpdated: utcDateTime;
}
