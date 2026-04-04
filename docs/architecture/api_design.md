# API Design — Task-Driven Endpoints

Design and specification for all RAG API endpoints aligned with 8 advanced tutorial tasks.

**Core principle:** Each endpoint maps to a learning outcome from Tasks 0-8, enabling step-by-step system building.

---

## Implementation Map

| Task | Goal | API Endpoint | Service Implementation |
|------|------|--------------|------------------------|
| 00 | Environment setup | GET `/api/health` | config + status checks |
| 01 | OpenAI embedding | POST `/api/embed` | `embedding.ts` |
| 02 | Pinecone index | GET `/api/index/info` | `pinecone.ts` adapter |
| 03 | Data upsertion | POST `/api/index/upsert` | batch processing + embedding |
| 04 | Similarity search | POST `/api/search` | `retrieval.ts` |
| 05 | RAG pipeline | POST `/api/rag/ask` | `rag.ts` (5-stage) |
| 06 | Chunking | POST `/api/chunk` | chunking utilities |
| 07 | Evaluation | POST `/api/eval/retrieval` | metrics calculation |
| 08 | Improvement | POST `/api/search/enhanced` | query expansion + reranking |

---

## Task 00: Health Check

**GET** `/api/health`

Verify system readiness — all components connected and operational.

**Response structure:**
- `status`: "healthy" | "degraded" | "error"
- `components`: OpenAI (connected + model), Pinecone (connected + dimension), Firebase (configured)
- `timestamp`: ISO 8601 format
- `vectorCount`: Current vectors in index

**Purpose:** Environment validation (Task 00)
**Related:** System architecture health monitoring

---

## Task 01: Text Embedding

**POST** `/api/embed`

Convert text to 1536-dimensional semantic vector using OpenAI model.

**Input:** `text` (string, required, max 50K tokens)
**Output:** vector array (1536 floats), tokenCount, estimatedCost

**Implementation notes:**
- Model: `text-embedding-3-small` (not configurable)
- Cost: ~$0.02 per 1M tokens
- Latency: ~100-150ms per request
- Singleton client: Initialize once, reuse across requests
- Error cases: Invalid input, token limit exceeded, API rate limit

**Task reference:** Task 01 — OpenAI Embedding

---

## Task 02: Vector Index Info

**GET** `/api/index/info`

Retrieve Pinecone index metadata and connection status.

**Output:** indexName, dimension (1536), metric (cosine), status (active), vector count, namespace count, index size

**Implementation notes:**
- No authentication required (check in advance)
- Singleton client: Initialize once, reuse
- Connection pool: Essential for scaling
- Read-only operation: Safe to call frequently
- Error cases: Connection failure, index not found

**Task reference:** Task 02 — Pinecone Index

---

## Task 03: Batch Data Upsertion

**POST** `/api/index/upsert`

Load documents, embed them, and store vectors in Pinecone with metadata.

**Input:** documents array with {id, text, metadata}, optional batchSize, estimateCostOnly flag
**Output:** metrics (processed count, upserted count, tokens, cost, duration), error list with retry info

**Implementation workflow:**
1. Load documents from request or file source
2. Validate structure (id, text required; metadata optional)
3. Batch into groups (default 100)
4. For each batch: embed texts → create vectors with metadata → upsert to Pinecone
5. Track progress, handle partial failures gracefully
6. Return comprehensive metrics for cost/duration analysis

**Key considerations:**
- Batch processing > one-by-one (efficiency, cost)
- Progress checkpointing: Resume from last successful batch
- Rate limit handling: Exponential backoff
- Metadata preservation: Carry through pipeline for retrieval context
- Cost estimation: Calculate before execution
- Error recovery: Partial failures should not block entire job

**Task reference:** Task 03 — Upsert Data

---

## Task 04: Semantic Search

**POST** `/api/search`

Find most similar documents using cosine similarity scoring.

**Input:** query (string), topK (default 3, range 1-10), optional minScore threshold (0.0-1.0)
**Output:** results array with {id, text, score, metadata}, resultCount, duration

**Implementation workflow:**
1. Embed query using same model as documents (text-embedding-3-small)
2. Search Pinecone with query vector for topK results
3. Return results sorted by similarity score descending
4. Include metadata for each result

**Key metrics:**
- Similarity scores: 0.0-1.0 (higher = more similar)
- Typical good results: 0.7+ range
- topK tuning: 3-5 usually optimal (more = diminishing returns + higher cost)
- Latency target: <100ms search time

**Task reference:** Task 04 — Query Similarity

---

## Task 05: Complete RAG Pipeline

**POST** `/api/rag/ask`

Five-stage RAG pipeline: embed → retrieve → assemble → prompt → generate.

**Input:** question (string), topK (default 3), maxTokens (default 500)
**Output:** answer, sources (array with id/text/score), tokens breakdown, estimatedCost, duration

**Five-stage implementation:**
1. **Embedding** (~100ms): Convert question to vector
2. **Retrieval** (~100ms): Find top-K similar documents from Pinecone
3. **Context Assembly** (~1ms): Format documents into readable context
4. **Prompt Construction** (~1ms): Build system prompt with rules + context + question
5. **Generation** (~1-2s): Call GPT-3.5-turbo, get answer grounded in context

**System prompt template:**
- Instructed to answer ONLY from provided documents
- Clear "if not in documents, say 'I don't have enough information'" rule
- Conciseness requirement (1-2 paragraphs)
- Citation of sources when possible
- No information from training data

**Error handling:**
- No relevant documents: Return graceful "no information" response
- Empty question: Validation error
- LLM failures: Retry with exponential backoff

**Task reference:** Task 05 — Simple RAG

---

## Task 06: Document Chunking

**POST** `/api/chunk`

Split documents into optimal chunks for embedding and retrieval.

**Input:** text (string), strategy (fixed|sliding|semantic, default sliding), chunkSize (tokens, default 512), overlap (tokens, default 100)
**Output:** chunks array with {index, text, tokenCount}, totalChunks, totalTokens, averageChunkSize

**Chunking strategies:**

| Strategy | Characteristics | Best for | Trade-offs |
|----------|-----------------|----------|------------|
| **fixed** | Exact size, no overlap | Quick start | Loses boundary context |
| **sliding** | Size + overlap (~100 tokens) | Most use cases (recommended) | Slightly more vectors |
| **semantic** | Topic boundaries, variable size | Long-form documents | Requires topic detection |

**Key parameters:**
- Chunk size: 512 tokens optimal (balance: precision vs context). Range 256-1024 configurable.
- Overlap: 100 tokens prevents boundary artifacts
- Token counting: Approximate 4 chars per token

**Task reference:** Task 06 — Chunking Strategy

---

## Task 07: Retrieval Evaluation

**POST** `/api/eval/retrieval`

Measure retrieval quality using standard information retrieval metrics.

**Input:** testCases array with {id, query, expectedDocIds, explanation}, topK (default 5)
**Output:** summary metrics (totalTests, passed/failed, averagePrecision/Recall/MRR/nDCG), per-query results with individual metrics

**Metrics:**

| Metric | Definition | Target | Implementation |
|--------|-----------|--------|-----------------|
| **Precision@K** | (correct ∩ retrieved) / retrieved | >80% | Count matches in top-K |
| **Recall@K** | (correct ∩ retrieved) / correct | >90% | What % of expected docs found |
| **MRR** | 1 / position of first correct | >0.8 | Higher = found sooner |
| **nDCG** | Discounted cumulative gain | >0.85 | Accounts for ranking quality |

**Implementation:**
1. For each test case, run query through retrieval system
2. Compare retrieved doc IDs with expected doc IDs
3. Calculate metrics per query
4. Aggregate into summary statistics
5. Flag failures and reasons

**Test case design:**
- Define ground truth: Which docs should be retrieved for each query?
- Start with 5-10 diverse queries
- Include semantic variations (not just keyword matches)
- Document rationale for each expected result

**Task reference:** Task 07 — Eval Retrieval

---

## Task 08: Enhanced Retrieval

**POST** `/api/search/enhanced`

Optimized search using query expansion and/or reranking techniques.

**Input:** query (string), topK (default 3), techniques (array: queryExpansion|reranking|hybrid), optional params
**Output:** results array, techniques applied, metrics (improvement %, cost overhead, duration)

**Technique details:**

**Query Expansion**
- Generate 3-5 query variants (templates or LLM-based)
- Search each variant independently
- Combine and deduplicate results
- Cost: +30% API calls | Benefit: +15% quality | Latency: +200ms

**Reranking**
- Initial retrieve: top-10 candidates
- Rerank using semantic similarity
- Return top-3 reranked
- Cost: +10% | Benefit: +5-10% top-1 accuracy | Latency: +50ms

**Hybrid Search** (Advanced)
- Vector similarity + keyword/BM25 search
- Fuse scores from both methods
- Cost: +20% | Benefit: +10% precision | Latency: +100ms

**Decision logic:**
- Use evaluation (Task 07) to identify baseline performance
- Apply technique if baseline nDCG <0.80
- Measure improvement via A/B test
- Choose technique by cost-benefit trade-off

**Task reference:** Task 08 — Improve Retrieval---

## Global API Design Principles

### Error Handling
Consistent error format across all endpoints:
- `error`: Machine-readable error code (VALIDATION_ERROR, API_ERROR, RATE_LIMIT, NOT_FOUND, SERVER_ERROR)
- `message`: Human-readable description
- `code`: Categorized error type
- `details`: Additional context where applicable

HTTP status codes:
- `200` — Success
- `400` — Validation/input error
- `401` — Authentication required
- `429` — Rate limit exceeded
- `500` — Server error

### Authentication & Authorization
- **MVP:** No authentication (local dev)
- **Production:** Firebase Auth JWT on all endpoints
- **API Keys:** Optional for programmatic access (future phase)

### Rate Limiting
- 100 requests/min per IP (general)
- 10 embedding requests/min (expensive operations)
- 1000 requests/day per client

### Response Metadata
All responses include:
- `duration`: Milliseconds taken
- `timestamp`: ISO 8601 format

### Cost Tracking
Optional but recommended for all endpoints:
- `tokens`: Breakdown (embeddingTokens, promptTokens, completionTokens)
- `estimatedCost`: Actual cost incurred
- `costBreakdown`: Per-component cost

Cost reference rates:
- Embedding: $0.02 per 1M tokens
- LLM prompt: $0.50 per 1M tokens
- LLM completion: $1.50 per 1M tokens

---

## Service Architecture

**Layered design:**
```
API Endpoints (Express routers)
    ↓
Service Layer (business logic: rag.ts, retrieval.ts, embedding.ts)
    ↓
Adapter Layer (external APIs: openai.ts, pinecone.ts)
    ↓
External Services (OpenAI, Pinecone, Firebase)
```

**Key patterns:**
1. **Singletons** — Initialize expensive clients once (OpenAI, Pinecone)
2. **Dependency injection** — Pass clients to services
3. **Error boundaries** — Handle failures gracefully at each layer
4. **Async/await** — All external API calls

**File organization:**
- `src/endpoints/api/` — Route handlers
- `src/services/` — Business logic
- `src/adapters/` — External API clients
- `src/types/` — TypeScript interfaces
- `src/utils/` — Shared utilities

---

## Production Checklist

**Before deployment:**

**Authentication & Security**
- [ ] Firebase Auth integrated
- [ ] JWT validation on protected endpoints
- [ ] API key rotation strategy
- [ ] Input validation: length limits, type checks
- [ ] CORS configured properly

**Performance & Scaling**
- [ ] Tested with 100+ concurrent requests
- [ ] Connection pooling enabled (OpenAI, Pinecone)
- [ ] Rate limiting enforced
- [ ] Async queue for bulk operations (Task 03)
- [ ] CDN configured for static content (if applicable)

**Monitoring & Observability**
- [ ] Error tracking (Sentry or similar)
- [ ] Latency tracking per endpoint
- [ ] Cost tracking per operation
- [ ] Token usage monitoring (prevent budget overruns)
- [ ] Alert thresholds defined

**Documentation**
- [ ] OpenAPI/Swagger specs
- [ ] Example requests/responses
- [ ] Error codes fully documented
- [ ] Rate limit guidance clear
- [ ] Cost estimation guide

**Testing**
- [ ] Unit tests for services
- [ ] Integration tests with mocked external APIs
- [ ] E2E tests for critical flows (especially Task 05 RAG)
- [ ] Load testing (100+ concurrent users)
- [ ] Failure scenarios: missing docs, API errors, timeouts

---

## Implementation Roadmap

**Phase 1: Core (Tasks 0-2)**
- Health check endpoint
- Embedding service with OpenAI client
- Pinecone index validation

**Phase 2: Ingestion (Task 3)**
- Document upsertion with batch processing
- Progress tracking
- Error recovery

**Phase 3: Retrieval (Tasks 4-8)**
- Semantic search (baseline)
- Full RAG pipeline
- Chunking strategies
- Evaluation metrics
- Enhancement techniques

**Phase 4: Production**
- Authentication + authorization
- Rate limiting
- Monitoring + alerting
- Performance optimization
- Documentation + examples

---

## Key Implementation Details

**Embedding Service (Task 01)**
- Singleton OpenAI client initialization
- Token counting (critical for cost)
- Caching for repeated texts (optional optimization)
- Rate limit handling with backoff

**Vector Database (Task 02)**
- Singleton Pinecone client
- Connection pooling (not manual, handled by SDK)
- Index metadata validation
- Graceful degradation if unavailable

**Batch Processing (Task 03)**
- Document validation before embedding
- Batching strategy: group 50-100 docs
- Checkpoint: Save progress every batch
- Retry logic: Exponential backoff for rate limits
- Metrics: Track tokens, costs, timing

**Retrieval (Task 04)**
- Embed query with same model as docs
- Search returns sorted by similarity descending
- Include metadata with results
- Lazy evaluation: Don't compute scores unnecessarily

**RAG Pipeline (Task 05)**
- Use streaming for long responses (optional)
- Implement source attribution from metadata
- Graceful degradation: Return "no information" vs errors
- Log query → retrieved docs → answer for analysis

**Chunking (Task 06)**
- Default: Sliding window (512 tokens, 100 overlap)
- Support all three strategies (fixed, sliding, semantic)
- Token counting accuracy critical (impacts embedding cost)
- Preserve document source in metadata

**Evaluation (Task 07)**
- Implement all four metrics (Precision, Recall, MRR, nDCG)
- Store test cases in separate file or DB
- Generate report with pass/fail summary
- Use metrics to guide Task 08 improvements

**Enhancement (Task 08)**
- Start with query expansion (lowest cost)
- Only add reranking if nDCG <0.80
- A/B test improvements with evaluation (Task 07)
- Track cost vs quality trade-offs

---

## Tech Stack Recommendations

**Runtime & Framework**
- Node.js 22+ (LTS)
- TypeScript 5.0+
- Express.js 4.18+

**External Services**
- OpenAI API (text-embedding-3-small, gpt-3.5-turbo)
- Pinecone (vector DB)
- Firebase (auth, hosting, functions)
- GCP Secret Manager (credentials)

**Development Tools**
- ESLint + Prettier (code quality)
- Jest (testing)
- Postman/Insomnia (API testing)
- Firebase Emulator Suite (local testing)

**Monitoring & Logging**
- Sentry (error tracking)
- Firebase Functions logs (runtime)
- Custom dashboards (cost, latency, errors)

