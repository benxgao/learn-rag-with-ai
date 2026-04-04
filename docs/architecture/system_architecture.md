# System Architecture - AI RAG API

## Overview

A **Retrieval-Augmented Generation (RAG)** system that combines semantic search with LLM generation to answer questions grounded in your document collection.

**Core principle:** Ground LLM responses in retrieved documents to reduce hallucination and ensure accuracy.

---

## Core Pipeline

```
Documents → Chunk → Embed → Store → Query → Retrieve → Generate
```

**End-to-end flow:**
1. **Chunking** — Split documents into semantic units (512 tokens)
2. **Embedding** — Convert chunks to 1536-dim vectors (OpenAI)
3. **Storage** — Store vectors with metadata (Pinecone)
4. **Retrieval** — Find top-K similar documents (cosine similarity)
5. **Generation** — Answer based on retrieved context (GPT-3.5-turbo)

---

## Components & Tasks

### Task 00: Project Setup
**Goal:** Establish complete development environment

**Location:** Root configuration files
- `.env` — API keys and credentials
- `package.json` — Dependencies and versions
- `firebase.json` — Firebase configuration
- `functions/.env.local` — Firebase Functions secrets

**Key concepts:**
- Environment variable validation before use
- API key authentication (OpenAI, Pinecone, Firebase, GCP)
- Singleton pattern for expensive clients
- Health checks for system readiness

---

### Task 01: OpenAI Embedding
**Goal:** Transform text into semantic vectors

**Location:** `src/adapters/openai.ts` | `src/services/embedding.ts` | `src/endpoints/api/embed.ts`

**Model specs:**
- Model: `text-embedding-3-small`
- Dimensions: 1536
- Cost: $0.02 per 1M tokens
- Latency: ~100ms per request

**Key functions:**
- `getOpenAIClient()` — Singleton client initialization
- `createEmbedding(text: string): Promise<number[]>` — Create vector
- `estimateTokens(text: string): number` — Token counting
- `estimateCost(text: string): number` — Cost calculation

**Why embeddings matter:**
- Capture semantic meaning (not keywords)
- Enable similarity-based search
- 1536 dimensions = good balance of cost vs quality

**Example:**
```
Query: "machine learning"
      ↓ embedding
Vector: [0.1, -0.2, 0.3, ..., 0.5]  (1536 values)

Doc A: "ML teaches computers..."
Vector: [0.11, -0.19, 0.31, ..., 0.48]  (similarity: 0.95 ✅)

Doc B: "Teaching profession..."
Vector: [-0.4, 0.8, -0.2, ..., -0.3]  (similarity: 0.15 ❌)
```

---

### Task 02: Pinecone Vector Index
**Goal:** Set up vector database for semantic search

**Location:** `src/adapters/pinecone.ts`

**Index specs:**
- Dimension: 1536 (matches embeddings)
- Metric: cosine (similarity scoring)
- Pod type: starter/free tier available

**Key functions:**
- `getIndex()` — Get index connection (singleton)
- `index.upsert()` — Store vectors with metadata
- `index.query()` — Search by vector
- `index.describe_index_stats()` — Monitor usage

**Why Pinecone matters:**
- Distributed vector storage (scales to billions)
- HNSW indexing for O(log n) search complexity
- <100ms query latency at any scale
- Managed infrastructure (no ops overhead)

**Trade-offs:**
| In-Memory | Pinecone |
|-----------|----------|
| Fast for small | Fast for any size |
| RAM required | Distributed storage |
| Simple code | Managed service |
| $0 cost | Pay per usage |
| Can't scale | Auto-scales |

---

### Task 03: Data Upsertion
**Goal:** Load documents, embed, and store in Pinecone

**Location:** `src/services/upsertion.ts` (custom implementation)

**Process:**
1. Load documents (JSON, CSV, API, or plain text)
2. Validate structure (id, text, metadata)
3. Split into chunks (if needed)
4. Embed each chunk via OpenAI API
5. Batch upsert to Pinecone
6. Verify and report metrics

**Key considerations:**
- Batch processing (not one-by-one)
- Rate limiting (OpenAI API quotas)
- Progress tracking (resume from checkpoints)
- Cost estimation before execution
- Metadata preservation for retrieval context

**Challenges & Solutions:**

| Problem | Solution |
|---------|----------|
| API rate limits (429) | Batch with exponential backoff |
| Memory overflow | Process in batches |
| Network timeouts | Checkpoint progress |
| Lost metadata | Embed with metadata attached |
| Cost explosion | Estimate before running |

---

### Task 04: Similarity Search
**Goal:** Implement semantic retrieval

**Location:** `src/services/retrieval.ts` | `src/endpoints/api/search.ts`

**Interface:**
```typescript
export interface RetrievalResult {
  id: string;
  text: string;
  score: number;  // Cosine similarity: 0.0-1.0
  metadata?: Record<string, any>;
}

export async function querySimilar(
  query: string,
  topK: number = 3
): Promise<RetrievalResult[]>
```

**Pipeline (3 steps):**
1. **Embed query** — Convert question to 1536-dim vector (~100ms)
2. **Search Pinecone** — Find top-K similar vectors (~50ms)
3. **Format results** — Return with scores and metadata (~1ms)

**Key metrics:**
- Similarity score: 0.5-0.9 is typical
- topK tuning: Usually 3-5 documents optimal
- Latency: <200ms for real-time search

---

### Task 05: RAG (Retrieval-Augmented Generation)
**Goal:** Build complete question-answering system

**Location:** `src/services/rag.ts` | `src/endpoints/api/rag.ts`

**Five-stage pipeline:**

```
┌─────────────────────────────┐
│ 1. EMBEDDING (~100ms)       │ Convert question to vector
├─────────────────────────────┤
│ 2. RETRIEVAL (~100ms)       │ Find top-3 similar documents
├─────────────────────────────┤
│ 3. CONTEXT ASSEMBLY (~1ms)  │ Format documents nicely
├─────────────────────────────┤
│ 4. PROMPT CONSTRUCTION (~1ms)│ Add instructions + context
├─────────────────────────────┤
│ 5. GENERATION (~1-2s)       │ Call LLM with full prompt
└─────────────────────────────┘
```

**Output:**
```typescript
export interface RAGResult {
  question: string;
  answer: string;  // Grounded in retrieved documents
  sources: Array<{
    id: string;
    text: string;
    score: number;
  }>;
  tokensUsed: number;
  duration: number;  // milliseconds
}
```

**Why RAG works:**
- **Problem:** Pure LLM hallucinates false facts
- **Solution:** Ground answer in retrieved documents
- **Result:** Accurate answers verified against source material

**Example system prompt:**
```
You are a helpful AI assistant answering questions based on documents.

RELEVANT DOCUMENTS:
[3 most similar documents]

RULES:
1. Answer ONLY using provided documents
2. If answer not in documents: "I don't have enough information"
3. Be concise (1-2 paragraphs)
4. Cite document sources when possible
5. Do NOT add information from training data
```

**Cost per request:** ~$0.0003 (negligible)

---

### Task 06: Chunking Strategy
**Goal:** Optimize document splitting for retrieval quality

**Location:** `src/utils/chunking.ts` (custom implementation)

**Strategies:**

**1. Fixed-Size Chunking** (Simple)
- Size: 512 tokens (~2000 characters)
- No overlap
- Best for: Homogeneous documents, quick starts
- Con: Loses context at boundaries

**2. Sliding Window** (Balanced)
- Size: 512 tokens
- Overlap: 100 tokens
- Best for: Most use cases
- Pro: Preserves boundary context

**3. Semantic Chunking** (Advanced)
- Split at topic boundaries
- Variable chunk size
- Best for: Long-form documents
- Con: Requires topic detection

**Key parameters:**
- Chunk size: Affects retrieval precision (larger = less precise)
- Overlap: Affects quality (larger = better context)
- Metadata: Preserve document source for retrieval context

**Trade-offs:**

| Small (256 tokens) | Medium (512) | Large (1024) |
|---|---|---|
| High precision | Balanced | Low precision |
| Many chunks | Fewer chunks | Very few chunks |
| Cost ↑ | Cost neutral | Cost ↓ |
| Limited context | Good context | Too much noise |

**Guidance:** Start with sliding window, 512 tokens, 100 overlap.

---

### Task 07: Retrieval Evaluation
**Goal:** Measure and improve search quality

**Location:** `evals/retrieval.test.ts` (custom implementation)

**Metrics:**

| Metric | Definition | Target |
|--------|-----------|--------|
| **Precision@K** | Of K results, % relevant | >80% |
| **Recall@K** | Of all relevant, % found | >90% |
| **MRR** | Position of first relevant | >0.8 |
| **nDCG** | Ranking quality score | >0.85 |

**Test case structure:**
```typescript
interface TestCase {
  id: string;
  query: string;
  expectedDocs: string[];  // Which docs should be retrieved
  explanation?: string;    // Why these are relevant
}
```

**Evaluation workflow:**
1. Define 5-10 test queries with ground truth
2. Run retrieval for each query
3. Calculate metrics per query
4. Identify failure patterns
5. Iterate on chunking/embedding strategy

**Example failures & diagnosis:**

| Failure | Cause | Solution |
|---------|-------|----------|
| Low recall | Chunks too small | Increase overlap |
| Low precision | Chunks too large | Reduce chunk size |
| Semantic misses | Query variation not covered | Add query expansion (Task 08) |

---

### Task 08: Retrieval Improvement
**Goal:** Optimize retrieval beyond baseline

**Location:** `src/services/query-expansion.ts` (custom implementation)

**Advanced techniques:**

**1. Query Expansion** (Generates query variants)
```
Original: "How do neural networks learn?"

Variants:
- "neural networks learning mechanism"
- "deep learning training process"
- "how machines learn from data"

Benefit: Finds docs matching different phrasings (+15% retrieval)
```

**2. Multi-Retriever Fusion** (Combine search methods)
```
Search 1: Semantic similarity (embedding-based)
Search 2: Keyword search (BM25 or full-text)
Search 3: Hybrid reranking

Benefit: Covers different retrieval patterns (+10% quality)
```

**3. Reranking** (Reorder results by relevance)
```
Initial retrieval: [Doc A (0.75), Doc B (0.70), Doc C (0.68)]
Rerank by semantic similarity to query
Final order: [Doc B (re-scored 0.88), Doc A (0.82), Doc C (0.65)]

Benefit: Top result improves quality (+5-10%)
```

**Cost-quality trade-offs:**

| Technique | Quality ↑ | Cost ↑ | Latency ↑ |
|-----------|-----------|--------|-----------|
| Query expansion | +15% | +30% | +200ms |
| Multi-retriever | +10% | +50% | +100ms |
| Reranking | +5% | +10% | +50ms |

**Recommendation:** Start with query expansion if nDCG < 0.80.

---

## Data Flow Diagrams

### Ingestion Pipeline
```
Documents
    ↓
├─ Load (JSON, CSV, API, files)
├─ Validate (structure, metadata)
├─ Chunk (512 tokens, 100 overlap)
├─ Embed (1536-dim vectors, OpenAI)
├─ Batch upsert (Pinecone index)
└─ Verify (stats, sample queries)
```

### Query Pipeline
```
Question
    ↓
├─ Embed (same model as documents)
├─ Search (top-K similar vectors)
├─ Retrieve (vectors + metadata)
├─ Assemble (format documents)
├─ Prompt (system instructions + context)
├─ Generate (LLM response)
└─ Return (answer + sources + metrics)
```

---

## API Structure

```
POST /api/embed                    # Embed text → vector
POST /api/search                   # Search similar documents
POST /api/rag/ask                  # Full RAG pipeline
GET  /api/health                   # System status
```

---

## Configuration

**Environment variables:**
```env
OPENAI_API_KEY=sk-...              # OpenAI API key
PINECONE_API_KEY=...               # Pinecone API key
PINECONE_INDEX=rag-documents       # Index name
PINECONE_ENVIRONMENT=us-east-1     # Region
FIREBASE_PROJECT_ID=...            # Firebase project
GCP_PROJECT_ID=...                 # GCP project
TEST_ENV=true                      # Protect test requests
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Embedding latency | <150ms | Per request |
| Search latency | <100ms | Pinecone query |
| RAG latency | <3s | End-to-end |
| Retrieval precision | >80% | Task 07 metrics |
| Retrieval recall | >90% | Task 07 metrics |
| Uptime | 99.9% | Production SLA |

---

## Security & Operations

**Security:**
- API key authentication
- Rate limiting (100 req/min default)
- Input validation (length limits)
- No data persistence (vectors only)
- Firebase auth for admin endpoints

**Monitoring:**
- Health check endpoint
- Token usage tracking (cost)
- Retrieval quality metrics (Task 07)
- Error logging with context

**Scaling:**
- Horizontal: Multiple API instances
- Vertical: Larger Pinecone pods (paid tiers)
- Async: Queue for bulk operations
- Cache: Common queries (optional)

---

## Implementation Roadmap

**Phase 1: Baseline (Tasks 0-4)**
- ✅ Environment setup
- ✅ Embedding service
- ✅ Vector index
- ✅ Data ingestion
- ✅ Semantic search

**Phase 2: RAG (Task 5)**
- ✅ Complete pipeline
- ✅ Answer generation
- ✅ Source attribution

**Phase 3: Quality (Tasks 6-7)**
- ✅ Chunking optimization
- ✅ Retrieval evaluation
- ✅ Metrics-driven improvement

**Phase 4: Advanced (Task 8)**
- ✅ Query expansion
- ✅ Multi-strategy retrieval
- ✅ Reranking

---

## Key Design Principles

1. **Singleton clients** — Expensive resources (OpenAI, Pinecone) initialized once
2. **Batch processing** — Efficient data loading and embedding
3. **Progress tracking** — Resume from checkpoints on failure
4. **Cost awareness** — Estimate before running expensive operations
5. **Error handling** — Graceful degradation, clear error messages
6. **Metrics-driven** — Measure quality, iterate based on data
7. **Grounding** — All LLM responses tied to retrieved documents
8. **Metadata preservation** — Keep document context through pipeline

---

## Constraints & Limitations

- **Context window:** GPT-3.5-turbo = 4K tokens (plan for 2-3 docs)
- **Rate limits:** OpenAI ~90K tokens/min, Pinecone varies by tier
- **Chunk size:** 512 tokens optimal (configurable 256-1024)
- **Top-K:** Usually 3-5 (more = diminishing returns)
- **Cost:** Negligible per query (~$0.0003)
