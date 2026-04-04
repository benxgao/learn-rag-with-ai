import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 01: OpenAI Embedding
 *
 * Text to Vector Transformation
 * Transform natural language into 1536-dimensional vectors
 */
@service({
  title: "AI RAG API - Task 01: OpenAI Embedding",
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
namespace AIRagAPI.Embedding;

// ============================================================================
// TASK 01: OpenAI Embedding - Text to Vector Transformation
// ============================================================================

/** Create semantic vector embedding from text
 *
 * Task: 01 - OpenAI Embedding
 * Purpose: Transform natural language into 1536-dimensional vectors
 * Model: text-embedding-3-small
 * Pricing: $0.02 per 1M input tokens
 */
@doc("Convert text to semantic vector embedding")
@route("/api/embed")
@post
op createEmbedding(
  @body body: EmbedRequest
): EmbedResponse;

model EmbedRequest {
  @doc("Text to embed (max 50K tokens, ~200K characters)")
  @minLength(1)
  @maxLength(200000)
  text: string;
}

model EmbedResponse {
  @doc("1536-dimensional embedding vector from text-embedding-3-small")
  embedding: float32[];

  @doc("Output dimension (always 1536 for text-embedding-3-small)")
  dimensions: int32;

  @doc("Estimated token count used (rough: 1 token ≈ 4 characters)")
  tokenCount: int32;

  @doc("Estimated cost in USD ($0.02 per 1M tokens)")
  estimatedCost: float32;

  @doc("Model used for embedding")
  model: "text-embedding-3-small";

  @doc("Request processing time in milliseconds")
  duration: int32;
}
