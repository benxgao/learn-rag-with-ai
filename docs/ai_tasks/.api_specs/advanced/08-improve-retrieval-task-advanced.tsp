import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 08: Improve Retrieval
 *
 * Enhancement Techniques & Optimization
 * Improve search quality beyond baseline semantic search
 */
@service({
  title: "AI RAG API - Task 08: Improve Retrieval",
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
namespace AIRagAPI.ImproveRetrieval;

// ============================================================================
// TASK 08: Improve Retrieval - Enhancement Techniques & Optimization
// ============================================================================

/** Enhanced search using query expansion and/or reranking
 *
 * Task: 08 - Improve Retrieval
 * Purpose: Improve search quality beyond baseline semantic search
 * Techniques:
 *   - queryExpansion: Generate query variants, search all, combine results (+30% cost, +15% quality)
 *   - reranking: Re-score top candidates for better ranking (+10% cost, +5-10% accuracy)
 *   - hybrid: Combine vector search + keyword search (advanced)
 * Trade-off: Quality vs cost - measure with Task 07 metrics
 */
@doc("Enhanced search with query expansion and/or reranking")
@route("/api/search/enhanced")
@post
op searchEnhanced(
  @body body: EnhancedSearchRequest
): EnhancedSearchResponse;

model EnhancedSearchRequest {
  @doc("User search query")
  @minLength(1)
  query: string;

  @doc("Number of results to return (default: 3)")
  topK?: int32;

  @doc("Enhancement techniques to apply")
  @minItems(1)
  techniques: ("queryExpansion" | "reranking" | "hybrid")[];

  @doc("Minimum score threshold (optional)")
  minScore?: float32;

  @doc("Namespace to search (optional)")
  namespaceName?: string;
}

model EnhancedSearchResponse {
  @doc("Original query")
  query: string;

  @doc("Query variants generated (if queryExpansion enabled)")
  queryVariants?: string[];

  @doc("Enhanced search results")
  results: EnhancedSearchResult[];

  @doc("Total results returned")
  resultCount: int32;

  @doc("Techniques applied")
  techniquesApplied: string[];

  @doc("Performance metrics")
  metrics: {
    @doc("Total API calls made (for cost tracking)")
    totalAPICalls: int32;

    @doc("Estimated cost overhead vs baseline search")
    costOverhead: float32;

    @doc("Total processing duration in milliseconds")
    duration: int32;

    @doc("Estimated quality improvement (%)")
    qualityImprovement?: float32;
  };

  @doc("Cost and token details")
  cost: {
    @doc("Total tokens used")
    tokensUsed: int32;

    @doc("Estimated cost in USD")
    estimatedCost: float32;

    @doc("Cost breakdown by component")
    breakdown?: {
      embedding: float32;
      reranking?: float32;
    };
  };
}

model EnhancedSearchResult {
  @doc("Document/chunk ID")
  id: string;

  @doc("Document text")
  text: string;

  @doc("Final relevance score after enhancement")
  score: float32;

  @doc("Original baseline score (if enhanced)")
  baselineScore?: float32;

  @doc("Score improvement from enhancement")
  scoreImprovement?: float32;

  @doc("Confidence level")
  confidence: "high" | "medium" | "low";

  @doc("Document metadata")
  metadata?: Record<string, string | number | boolean>;

  @doc("Which techniques ranked this result (for transparency)")
  rankedBy?: string[];
}
