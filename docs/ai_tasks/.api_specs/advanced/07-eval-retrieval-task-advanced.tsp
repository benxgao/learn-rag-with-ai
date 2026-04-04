import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 07: Evaluation & Retrieval
 *
 * Quality Measurement Metrics
 * Evaluate retrieval quality using information retrieval metrics
 */
@service({
  title: "AI RAG API - Task 07: Evaluation & Retrieval",
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
namespace AIRagAPI.EvalRetrieval;

// ============================================================================
// TASK 07: Evaluation & Retrieval - Quality Measurement Metrics
// ============================================================================

/** Evaluate retrieval quality using information retrieval metrics
 *
 * Task: 07 - Evaluation & Retrieval
 * Purpose: Measure search quality with Precision, Recall, MRR, nDCG
 * Metrics:
 *   - Precision@K: % of retrieved results that are relevant (>80% target)
 *   - Recall@K: % of relevant docs found (>90% target)
 *   - MRR: Position of first relevant doc (>0.8 target)
 *   - nDCG: Ranking quality score (>0.85 target)
 * Used by: Task 08 to guide improvements
 */
@doc("Evaluate retrieval quality against test cases")
@route("/api/eval/retrieval")
@post
op evaluateRetrieval(
  @body body: EvalRequest
): EvalResponse;

model EvalRequest {
  @doc("Test cases with expected relevant documents")
  @minItems(1)
  testCases: EvalTestCase[];

  @doc("Number of results to evaluate (default: 5, must match retrieval topK)")
  topK?: int32;

  @doc("Namespace to evaluate (optional)")
  namespaceName?: string;
}

model EvalTestCase {
  @doc("Test case identifier")
  id: string;

  @doc("Query to evaluate")
  @minLength(1)
  query: string;

  @doc("Document IDs that should be retrieved (ground truth)")
  @minItems(1)
  expectedDocs: string[];

  @doc("Optional explanation of why these docs are relevant")
  explanation?: string;
}

model EvalResponse {
  @doc("Aggregated evaluation metrics across all test cases")
  summary: {
    @doc("Total test cases evaluated")
    totalTests: int32;

    @doc("Passed test cases (nDCG >= 0.5)")
    passed: int32;

    @doc("Failed test cases")
    failed: int32;

    @doc("Pass rate percentage")
    passRate: float32;

    @doc("Average Precision@K across tests")
    avgPrecision: float32;

    @doc("Average Recall@K across tests")
    avgRecall: float32;

    @doc("Average Mean Reciprocal Rank")
    avgMRR: float32;

    @doc("Average Normalized Discounted Cumulative Gain")
    avgnDCG: float32;
  };

  @doc("Per-test-case detailed results")
  results: EvalResult[];

  @doc("Total evaluation duration in milliseconds")
  duration: int32;
}

model EvalResult {
  @doc("Test case ID")
  testCaseId: string;

  @doc("Query tested")
  query: string;

  @doc("Expected relevant documents")
  expected: string[];

  @doc("Documents actually retrieved")
  retrieved: string[];

  @doc("Intersection of expected and retrieved")
  matches: string[];

  @doc("Precision: matches / retrieved length")
  precision: float32;

  @doc("Recall: matches / expected length")
  recall: float32;

  @doc("MRR: 1 / position of first match (0 if no match)")
  mrr: float32;

  @doc("nDCG: Normalized discounted cumulative gain (0-1)")
  ndcg: float32;

  @doc("Test passed (nDCG >= 0.5)")
  success: boolean;
}
