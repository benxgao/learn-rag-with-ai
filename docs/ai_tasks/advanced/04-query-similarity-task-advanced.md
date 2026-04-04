---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 04 — Query Similarity [advanced]

## Goal

Implement semantic search by retrieving the most similar documents from Pinecone based on query text, understanding how similarity scoring enables AI-powered retrieval.

---

## Learning Outcomes

After completing this task, you'll understand:

- **How cosine similarity enables semantic matching** — Not keyword search, but meaning-based
- **Retrieval pipeline mechanics** — Query embedding → vector search → ranking
- **Similarity scoring interpretation** — 0.5 vs 0.9: what's the difference?
- **topK parameter tuning** — When to retrieve 3, 5, or 10 results
- **Filtering strategies** — Score thresholds, diversity scoring
- **Real-world retrieval patterns** — Production-grade search implementations

---

## Requirements

**Input:**

- `query`: string (natural language question like "What is machine learning?")
- `topK`: number (default: 3, how many results to return)

**Process:**

1. Embed query text using same model as documents (text-embedding-3-small)
2. Call Pinecone `query()` with embedded vector
3. Retrieve top-K vectors with highest similarity scores
4. Transform results into readable format with scores

**Output:**

- Array of documents sorted by relevance
- Similarity scores (0.0-1.0 range)
- Include original text and metadata
- Source attribution

---

## Implementation

**File:** `/src/services/retrieval.ts`

**Core Interface:**

```typescript
export interface RetrievalResult {
  id: string;
  text: string;
  score: number; // Similarity score: 0.0-1.0
  metadata?: Record<string, any>;
}

export async function querySimilar(
  query: string,
  topK: number = 3,
): Promise<RetrievalResult[]>;
```

---

## Implementation Guide

### Step 1: Basic similarity search

```typescript
// src/services/retrieval.ts
import { getIndex } from "../adapters/pinecone";
import { createEmbedding } from "./embedding";

export interface RetrievalResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Query similar documents from Pinecone
 *
 * Process:
 * 1. Embed the query (create vector representation)
 * 2. Search Pinecone for nearest neighbors
 * 3. Return top-K results with similarity scores
 */
export async function querySimilar(
  query: string,
  topK: number = 3,
): Promise<RetrievalResult[]> {
  // Step 1: Create embedding for query
  const queryEmbedding = await createEmbedding(query);

  // Step 2: Search Pinecone
  const index = getIndex();
  const searchResults = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  // Step 3: Transform results
  return searchResults.matches.map((match) => ({
    id: match.id,
    text: (match.metadata?.text as string) || "",
    score: match.score || 0,
    metadata: match.metadata,
  }));
}
```

### Step 2: Add utility functions for interpretation

```typescript
/**
 * Convert similarity score to human-readable label
 * Guide interpretation of numeric scores
 */
export function getSimilarityLabel(score: number): string {
  if (score >= 0.9) return "🟢 Perfect match";
  if (score >= 0.8) return "🟢 Excellent match";
  if (score >= 0.7) return "🟡 Good match";
  if (score >= 0.6) return "🟡 Fair match";
  if (score >= 0.5) return "🔴 Weak match";
  return "🔴 Poor match";
}

/**
 * Format results for display
 */
export function formatResults(results: RetrievalResult[]): string {
  return results
    .map(
      (r, i) =>
        `${i + 1}. [${getSimilarityLabel(r.score)}] ${r.text.substring(0, 100)}...\n   Score: ${r.score.toFixed(3)}`,
    )
    .join("\n\n");
}

/**
 * Filter results by minimum score threshold
 * Useful for strict quality requirements
 */
export async function querySimilarFiltered(
  query: string,
  topK: number = 3,
  minScore: number = 0.7,
): Promise<RetrievalResult[]> {
  const results = await querySimilar(query, topK * 2); // Over-fetch to account for filtering
  return results.filter((r) => r.score >= minScore).slice(0, topK);
}
```

### Step 3: Create API endpoint

```typescript
// src/endpoints/api/search.ts
import { Router, Request, Response } from "express";
import { querySimilar, formatResults } from "../../services/retrieval";

const router = Router();

/**
 * POST /api/search
 *
 * Request body:
 * {
 *   "query": "What is machine learning?",
 *   "topK": 3
 * }
 *
 * Response:
 * {
 *   "query": "What is machine learning?",
 *   "topK": 3,
 *   "results": [
 *     {
 *       "id": "doc-1",
 *       "text": "Machine learning is...",
 *       "score": 0.92
 *     }
 *   ]
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  const { query, topK = 3 } = req.body;

  // Validate input
  if (!query) {
    return res.status(400).json({ error: "query required" });
  }

  if (typeof topK !== "number" || topK < 1 || topK > 100) {
    return res.status(400).json({ error: "topK must be 1-100" });
  }

  try {
    const results = await querySimilar(query, topK);
    return res.json({
      query,
      topK,
      resultCount: results.length,
      results,
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Search failed",
    });
  }
});

export default router;
```

---

## Testing

### Test 1: Basic functionality

```bash
# Start dev server
npm run dev

# In another terminal, test search
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What is machine learning?", "topK": 3}'

# Expected response:
# {
#   "query": "What is machine learning?",
#   "topK": 3,
#   "resultCount": 3,
#   "results": [
#     {
#       "id": "doc-1",
#       "text": "Machine learning is a subset...",
#       "score": 0.9247
#     },
#     ...
#   ]
# }
```

### Test 2: Various queries to understand semantics

```bash
# Semantic similarity (not keyword matching)
curl -X POST http://localhost:5000/api/search \
  -d '{"query": "AI learns from examples", "topK": 3}'
# Should find doc-1 even though wording is different

# Related concept
curl -X POST http://localhost:5000/api/search \
  -d '{"query": "embeddings and vectors", "topK": 3}'
# Should prioritize doc-3

# Unrelated query
curl -X POST http://localhost:5000/api/search \
  -d '{"query": "cooking recipes", "topK": 3}'
# All scores should be <0.5
```

### Success Criteria

- ✅ Query is embedded without errors
- ✅ Results returned with scores
- ✅ Scores in range 0.0-1.0
- ✅ Results sorted by score (highest first)
- ✅ Response time <1 second
- ✅ Related queries return semantically similar results

---

## Cosine Similarity Explained

### The Math (Simple Version)

```
Similarity = (A · B) / (||A|| × ||B||)

Where:
- A = query embedding vector
- B = document embedding vector
- · = dot product (sum of element-wise products)
- ||A|| = magnitude/length of vector A

Result range: -1.0 to 1.0
- 1.0  = identical vectors (perfect match)
- 0.0  = perpendicular vectors (no relation)
- -1.0 = opposite vectors (contradiction)
```

### Visual Example

```
Query: "machine learning"
  ↓ (embed)
[0.1, -0.2, 0.3, ...] (1536 dimensions)

Compare with:
Doc A: "ML is teaching computers"
  [0.09, -0.21, 0.31, ...] → Cosine: 0.95 ✅ (similar angle)

Doc B: "cooking recipes"
  [-0.4, 0.8, -0.2, ...] → Cosine: 0.12 ❌ (very different angle)

Doc C: "deep learning frameworks"
  [0.08, -0.19, 0.29, ...] → Cosine: 0.82 ✅ (similar angle)
```

### Why Cosine, Not Euclidean Distance?

| Metric                 | What it measures       | Best for        | Range |
| ---------------------- | ---------------------- | --------------- | ----- |
| **Cosine similarity**  | Angle between vectors  | Text embeddings | 0-1   |
| **Euclidean distance** | Straight-line distance | Spatial data    | 0-∞   |

**For embeddings:** Cosine is better because:

- Normalized embeddings have length 1
- Only direction matters, not magnitude
- Gives 0-1 range (easier interpretation)
- More efficient computation

---

## topK Parameter Tuning

### What topK means

```
topK = 3 means: "Give me the 3 most similar documents"

topK = 1  → Only best match (strict, fastest)
topK = 3  → Top 3 (balanced, recommended default)
topK = 10 → Top 10 (comprehensive, slower)
```

### Guidance by use case

| Use case                | topK | Why                                 |
| ----------------------- | ---- | ----------------------------------- |
| Quick answer            | 1-2  | Speed, highest confidence           |
| Q&A system              | 3-5  | Good balance of context + precision |
| Research                | 5-10 | Multiple perspectives               |
| Keyword search fallback | 10+  | Recovery mode                       |

### Real-world impact

```
Query: "What is RAG?"

topK=1: Returns best match only
- Answer: One paragraph explanation
- Risk: Misses important context

topK=3: Returns best 3
- Answer: Comprehensive from multiple angles
- Balance: Good context + focused

topK=10: Returns many results
- Answer: Very thorough
- Risk: Too much information, harder to synthesize
```

### How to choose:

1. **Start with topK=3** (industry standard)
2. **If answers lack context** → increase to 5
3. **If answers seem noisy** → decrease to 2
4. **Use evaluation metrics** (Task 07) to measure impact

---

## Score Interpretation

### What different scores mean

```
Score 0.95+  "Perfect/Near-perfect match"
             Query: "machine learning"
             Result: "Machine learning definition"
             → Use for factual lookups

Score 0.85-0.95  "Excellent match"
                 Query: "How do computers learn?"
                 Result: "Machine learning explanation"
                 → High confidence, good relevance

Score 0.70-0.85  "Good match"
                 Query: "AI techniques"
                 Result: "Machine learning overview"
                 → Relevant but not exact, usually useful

Score 0.60-0.70  "Fair match"
                 Query: "neural networks"
                 Result: "Machine learning basics"
                 → Related but not precisely matching
                 → Include with caution

Score <0.60      "Weak/Poor match"
                 Query: "cooking recipes"
                 Result: "Machine learning"
                 → Usually not relevant, filter out
```

### Using scores in practice

```typescript
// Strict quality filter
const results = await querySimilar(query, topK);
const highQuality = results.filter((r) => r.score > 0.85);

// Confidence-based answers
if (results[0].score > 0.9) {
  return `High confidence: ${answer}`;
} else if (results[0].score > 0.75) {
  return `Moderate confidence: ${answer}`;
} else {
  return `Low confidence, see sources`;
}

// Relevance-based filtering
const relevantResults = results.filter((r) => r.score > minScore);
if (relevantResults.length === 0) {
  return "No sufficiently relevant results found";
}
```

---

## Common Patterns

### Pattern 1: Score-based confidence

```typescript
export async function searchWithConfidence(query: string, topK: number = 3) {
  const results = await querySimilar(query, topK);

  if (results.length === 0) {
    return { confidence: "none", results: [] };
  }

  const topScore = results[0].score;
  let confidence = "low";

  if (topScore >= 0.9) confidence = "high";
  else if (topScore >= 0.75) confidence = "medium";

  return { confidence, results };
}
```

### Pattern 2: Threshold filtering

```typescript
export async function searchMinimumQuality(
  query: string,
  minScore: number = 0.75,
  maxResults: number = 3,
) {
  // Fetch more to compensate for filtering
  const candidates = await querySimilar(query, maxResults * 3);

  // Keep only high-quality results
  return candidates.filter((r) => r.score >= minScore).slice(0, maxResults);
}
```

### Pattern 3: Result diversity

```typescript
// Avoid returning very similar documents
export async function searchDiverse(query: string, topK: number = 3) {
  const results = await querySimilar(query, topK * 2);
  const selected: RetrievalResult[] = [];

  for (const result of results) {
    // Check if too similar to already selected
    const tooSimilar = selected.some((r) =>
      areSimilar(result.text, r.text, 0.95),
    );

    if (!tooSimilar) {
      selected.push(result);
      if (selected.length === topK) break;
    }
  }

  return selected;
}
```

---

## Troubleshooting

| Problem                  | Cause                      | Solution                                                      |
| ------------------------ | -------------------------- | ------------------------------------------------------------- |
| "No results returned"    | Empty index                | Verify documents are seeded (Task 03)                         |
| "All scores < 0.5"       | Semantic mismatch          | Query doesn't match documents, try different phrasing         |
| "Timeout after 30s"      | Slow Pinecone              | Reduce topK or check network                                  |
| "Dimension mismatch"     | Different embedding model  | Ensure same model (text-embedding-3-small) for query and docs |
| "Inconsistent scores"    | Non-deterministic behavior | Scores should be consistent for same query                    |
| "Expected doc not found" | Wrong document ID format   | Verify doc IDs during seeding match query results             |

---

## Performance Tuning

### Latency optimization

```typescript
// Parallel embedding + search (doesn't help, serialized)
// Instead: Reduce topK for faster response
// topK=1 ~100ms faster than topK=10
```

### Cost optimization

```typescript
// Embed query: ~$0.000001 per call
// Search: Free (Pinecone pricing)
// Total: Negligible cost per search
```

---

## Constraints

- topK default = 3 (can be customized in API)
- No filtering yet (implement in Task 08)
- No re-ranking (implement in Task 08)
- Single index only (no cross-index search)

---

## Next Steps

**After this task:**

1. Move to Task 05 to see how retrieval fits into RAG
2. Return to Task 04 tuning after Task 07 (evaluation)
3. Implement advanced retrieval in Task 08

---

## Tutorial Trigger

- **vector-search.md** → Fill "How" section with query and similarity search patterns

**Tutorial focus:**

- How = Pinecone query, embedding queries, similarity search mechanics
- Gotchas = cosine similarity interpretation, topK selection, no results scenarios
- Trade-offs = speed vs comprehensiveness, precision vs recall
