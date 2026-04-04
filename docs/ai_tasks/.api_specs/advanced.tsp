import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification
 *
 * Task-driven API endpoints aligned with advanced learning curriculum (Tasks 00-08)
 * Each endpoint maps to a specific task's learning outcomes and implementation
 */
@service({
  title: "AI RAG API",
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
namespace AIRagAPI;

// ============================================================================
// TASK 00: Project Setup - System Health & Configuration Validation
// ============================================================================

/** Health check endpoint for system readiness validation
 *
 * Task: 00 - Project Setup
 * Purpose: Verify all components (OpenAI, Pinecone, Firebase) are connected
 * Use case: Environment validation, CI/CD health checks
 */
@doc("Verify system readiness and component connectivity")
@route("/api/health")
op getHealth(): HealthStatus;

model HealthStatus {
  @doc("Overall system status: healthy | degraded | error")
  status: "healthy" | "degraded" | "error";

  @doc("Timestamp in ISO 8601 format")
  timestamp: utcDateTime;

  @doc("Individual component status checks")
  components: {
    @doc("OpenAI API connection and model availability")
    openai: ComponentStatus;

    @doc("Pinecone vector database connection")
    pinecone: ComponentStatus;

    @doc("Firebase authentication and RTDB")
    firebase: ComponentStatus;
  };

  @doc("Current vector count in Pinecone index")
  vectorCount: int32;

  @doc("Index metadata including dimension and metric")
  indexMetadata?: {
    dimension: int32;
    metric: "cosine" | "euclidean" | "dotproduct";
    replicas: int32;
  };
}

model ComponentStatus {
  @doc("Component availability: up | down")
  status: "up" | "down";

  @doc("Additional component-specific details")
  details?: string;

  @doc("Last verified timestamp")
  lastChecked: utcDateTime;
}

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
  namespace?: string;
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
  namespace?: string;
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
  namespace?: string;

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
  namespace?: string;
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
  namespace?: string;
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
