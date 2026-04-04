import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 04: Query Similarity
 *
 * Semantic Search with Cosine Similarity
 * Find most relevant documents using cosine similarity scoring
 */
@service({
  title: "AI RAG API - Task 04: Query Similarity",
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
namespace AIRagAPI.QuerySimilarity;

// ============================================================================
// TASK 04: Query Similarity - Semantic Search with Cosine Similarity
// ============================================================================

/** Search for semantically similar documents
 *
 * Task: 04 - Query Similarity
 * Purpose: Find most relevant documents using cosine similarity scoring
 * Process: Embed query → Vector search → Score results → Return top-K
 * Similarity score: 0.0-1.0 (higher = more relevant, 0.7+ = good match)
 */
@doc("Find most similar documents using semantic search")
@route("/api/search")
@post
op querySimilar(
  @body body: SearchRequest
): SearchResponse;

model SearchRequest {
  @doc("Natural language search query (e.g., 'What is machine learning?')")
  @minLength(1)
  query: string;

  @doc("Number of results to return (default: 3, range: 1-10)")
  topK?: int32;

  @doc("Minimum similarity score threshold (0.0-1.0, optional filter)")
  minScore?: float32;

  @doc("Namespace to search in (optional, default root)")
  namespaceName?: string;
}

model SearchResponse {
  @doc("Original search query")
  query: string;

  @doc("Search results sorted by relevance descending")
  results: SearchResult[];

  @doc("Total results returned")
  resultCount: int32;

  @doc("Query processing time in milliseconds")
  duration: int32;

  @doc("Tokens used for query embedding")
  tokensUsed: int32;

  @doc("Estimated cost in USD")
  estimatedCost: float32;
}

model SearchResult {
  @doc("Document or chunk identifier")
  id: string;

  @doc("Document text content")
  text: string;

  @doc("Cosine similarity score (0.0-1.0, higher = more relevant)")
  score: float32;

  @doc("Interpretation of score: 'high' (0.9+) | 'medium' (0.75-0.9) | 'low' (<0.75)")
  confidence: "high" | "medium" | "low";

  @doc("Document metadata from upsertion")
  metadata?: Record<string, string | number | boolean>;
}
