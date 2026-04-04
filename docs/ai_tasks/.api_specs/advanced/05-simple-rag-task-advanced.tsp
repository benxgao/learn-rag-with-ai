import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 05: Simple RAG
 *
 * Retrieval-Augmented Generation Pipeline
 * Answer questions grounded in private documents
 */
@service({
  title: "AI RAG API - Task 05: Simple RAG",
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
namespace AIRagAPI.SimpleRAG;

// ============================================================================
// TASK 05: Simple RAG - Retrieval-Augmented Generation Pipeline
// ============================================================================

/** Complete RAG pipeline: retrieve documents + generate grounded answer
 *
 * Task: 05 - Simple RAG
 * Purpose: Answer questions grounded in private documents
 * Process: 5 stages -
 *   1. Embed query
 *   2. Retrieve relevant docs (Task 04)
 *   3. Assemble context
 *   4. Build prompt with context
 *   5. Generate answer with LLM
 * Prevents: Hallucination, grounds answers in sources
 */
@doc("Ask question and get answer grounded in documents")
@route("/api/rag/ask")
@post
op askQuestion(
  @body body: RAGRequest
): RAGResponse;

model RAGRequest {
  @doc("User question in natural language")
  @minLength(1)
  question: string;

  @doc("Number of documents to retrieve for context (default: 3, range: 1-10)")
  topK?: int32;

  @doc("Maximum length of answer in tokens (default: 200, prevents verbose output)")
  maxAnswerTokens?: int32;

  @doc("Namespace to search in (optional)")
  namespaceName?: string;

  @doc("System prompt override (optional, default: grounding template)")
  systemPrompt?: string;
}

model RAGResponse {
  @doc("Original user question")
  question: string;

  @doc("Generated answer grounded in retrieved documents")
  answer: string;

  @doc("Source documents used to answer question")
  sources: SourceDocument[];

  @doc("Total tokens consumed (embedding + prompt + completion)")
  tokensUsed: {
    embedding: int32;
    prompt: int32;
    completion: int32;
    total: int32;
  };

  @doc("Total cost in USD across all components")
  estimatedCost: float32;

  @doc("Total pipeline duration in milliseconds")
  duration: int32;

  @doc("Confidence in answer quality (high=multiple sources, low=single source/uncertainty)")
  confidence: "high" | "medium" | "low";
}

model SourceDocument {
  @doc("Source document/chunk ID")
  id: string;

  @doc("Excerpt of source text")
  text: string;

  @doc("Relevance score from retrieval")
  score: float32;

  @doc("Document metadata")
  metadata?: Record<string, string | number | boolean>;
}
