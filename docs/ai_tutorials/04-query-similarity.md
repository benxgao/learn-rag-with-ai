# 04 - Query Similarity & Semantic Search

## What

Semantic search by embedding user queries and finding similar documents from Pinecone using cosine similarity scoring.

## Why

Enables AI-powered retrieval where meaning matters more than keywords. Different wording like "What is machine learning?" and "AI learns from examples" find the same concepts.

## How

**Service:** `src/services/rag/retrieval.ts::querySimilar()`

- Embed query text using OpenAI (same model as documents)
- Search Pinecone index with embedded vector
- Return top-K results with similarity scores (0.0-1.0)

**API:** `src/endpoints/api/search.ts`

- `POST /api/search` - Search for similar documents
- Request: `{ query: string, topK?: number, minScore?: number }`
- Response: `{ results: [{ id, text, score, metadata }], metrics: { ... } }`

## Trade-offs

| Aspect                 | Pro                         | Con                     |
| ---------------------- | --------------------------- | ----------------------- |
| **topK=1**             | Fastest, highest confidence | Misses context if wrong |
| **topK=3-5**           | Best balance                | Requires synthesis      |
| **topK=10+**           | Comprehensive               | Noise & slower          |
| **minScore filtering** | Quality control             | Loses some results      |
| **No filtering**       | More results                | May include noise       |

## Gotchas

1. **Same embedding model required** - Query and documents must use same OpenAI model or similarity scores are meaningless
2. **Score interpretation** - 0.9+ = perfect match, 0.7-0.8 = good, <0.5 = usually noise
3. **Empty results** - High minScore (e.g., 0.95) may return nothing; use 0.7 as default
4. **Rate limiting** - OpenAI embeds at ~500K tokens/min; batch queries if doing many
5. **Index must be populated** - Run `/api/upsert` first to load documents
6. **Vector dimension mismatch** - Pinecone index must be 1536-dim for text-embedding-3-small

## Usage Examples

### Basic search

```bash
curl -X POST http://localhost:5001/PROJECT/us-central1/api/search \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d '{"query": "What is machine learning?", "topK": 3}'
```

### Filtered search (high quality only)

```bash
curl -X POST http://localhost:5001/PROJECT/us-central1/api/search \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d '{"query": "embeddings", "topK": 5, "minScore": 0.75}'
```

### Get sample queries

```bash
curl -X GET http://localhost:5001/PROJECT/us-central1/api/search/sample \
  -H "auth_token: test"
```

## Implementation Details

### Cosine Similarity Scoring

Measures angle between vectors (not distance). For embeddings:

- **0.95+**: Near-duplicate or perfect match
- **0.85-0.95**: Excellent relevance
- **0.70-0.85**: Good match, safe to use
- **0.50-0.70**: Fair match, use with caution
- **<0.50**: Weak match, typically noise

### Score Interpretation Helper

```typescript
getSimilarityLabel(score) → "🟢 Perfect match" | "🟡 Good match" | "🔴 Poor match"
```

### Filtering Strategy

For production quality control, filter by score threshold (default 0.7):

```typescript
const highQuality = await querySimilarFiltered(
  "user query",
  (topK = 3),
  (minScore = 0.7),
);
```
