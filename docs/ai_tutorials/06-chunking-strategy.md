# Tutorial 06: Chunking Strategy

## Overview

Chunking is the process of splitting documents into smaller, manageable pieces before embedding and storage in a vector database. The right chunking strategy directly impacts RAG system retrieval quality and cost.

**The Problem:** Wrong chunk size = poor retrieval quality and wasted tokens.

---

## Core Concept: Token Estimation

We estimate tokens at **4 characters per token** (English average):

```
Text: "Machine learning is..."  (24 chars)
Tokens: 24 ÷ 4 = 6 tokens
```

---

## Three Strategies Compared

### Strategy 1: Fixed-Size Chunking ⭐⭐⭐⭐⭐ Simple

**What:** Split into exact token sizes, no overlap.

**Pros:**
- ✅ Simple and fast
- ✅ Deterministic (same input = same output)
- ✅ Cheapest (fewest chunks)

**Cons:**
- ❌ Breaks mid-sentence at boundaries
- ❌ Loses context

**Best for:** Initial testing, homogeneous documents

**Usage:**
```bash
curl -X POST http://localhost:5001/PROJECT/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your document...",
    "strategy": "fixed-size",
    "chunkSize": 512
  }'
```

---

### Strategy 2: Sliding Window ⭐⭐⭐⭐ Balanced

**What:** Fixed chunks with overlapping regions (e.g., 512 tokens with 100-token overlap).

**Pros:**
- ✅ Preserves context at boundaries
- ✅ Better retrieval quality than fixed-size
- ✅ Good cost-quality balance

**Cons:**
- ⚠️ 15-25% more chunks = higher embedding cost

**Best for:** Text documents, papers, continuous prose

**Example Effect:**
```
Fixed-size (no overlap):
Chunk 1: "...machine learning is teaching computers"
Chunk 2: "to learn from data without..."
Problem: Concept breaks at boundary

Sliding-window (100 token overlap):
Chunk 1: "...machine learning is teaching computers"
Chunk 2: "...teaching computers to learn from data without..."
Benefit: "teaching computers" appears in both chunks
```

**Usage:**
```bash
curl -X POST http://localhost:5001/PROJECT/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your document...",
    "strategy": "sliding-window",
    "chunkSize": 512,
    "overlap": 100
  }'
```

---

### Strategy 3: Semantic Chunking ⭐⭐⭐⭐⭐ Best Quality

**What:** Split at logical boundaries (headers, sections) instead of arbitrary token counts.

**Pros:**
- ✅ Topically coherent chunks
- ✅ Best retrieval quality
- ✅ Often fewer chunks = lower cost

**Cons:**
- ⚠️ Requires structured documents with headers

**Best for:** Markdown docs, papers with headers, documentation

**Usage:**
```bash
curl -X POST http://localhost:5001/PROJECT/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your structured document...",
    "strategy": "semantic"
  }'
```

---

## Compare All Strategies

Test all three strategies at once to see cost and quality trade-offs:

```bash
curl -X POST http://localhost:5001/PROJECT/us-central1/api/chunk \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your document...",
    "strategy": "compare"
  }'
```

**Response Example:**
```json
{
  "status": "success",
  "mode": "comparison",
  "textLength": 2451,
  "textEstimatedTokens": 613,
  "strategies": [
    {
      "strategy": "fixed-size",
      "chunkCount": 2,
      "avgChunkSize": 1226,
      "estimatedTokens": 613,
      "estimatedCost": "$0.00000400"
    },
    {
      "strategy": "sliding-window",
      "chunkCount": 3,
      "avgChunkSize": 817,
      "estimatedTokens": 613,
      "estimatedCost": "$0.00000600"
    },
    {
      "strategy": "semantic",
      "chunkCount": 2,
      "avgChunkSize": 1226,
      "estimatedTokens": 613,
      "estimatedCost": "$0.00000400"
    }
  ],
  "comparison": {
    "recommendation": "semantic (best quality + cost)"
  }
}
```

---

## Key Parameters

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `text` | required | Document to chunk |
| `strategy` | "compare" | Which strategy to use |
| `chunkSize` | 512 | Target chunk size in tokens |
| `overlap` | 100 | Overlap for sliding-window (tokens) |

---

## Cost Analysis

For a **10,000-token document:**

| Strategy | Chunks | Cost | Notes |
|----------|--------|------|-------|
| Fixed-size (512) | 20 | $0.00004 | Cheapest |
| Sliding-window (512, 100) | 25 | $0.00005 | 25% more |
| Semantic (adaptive) | 15 | $0.00003 | Best cost if well-structured |

---

## Trade-offs Summary

```
             Simplicity   Speed    Context   Cost      Quality
Fixed        ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐  ⭐       ⭐⭐⭐⭐⭐  ⭐⭐⭐
Sliding      ⭐⭐⭐      ⭐⭐⭐⭐   ⭐⭐⭐⭐⭐ ⭐⭐⭐     ⭐⭐⭐⭐
Semantic     ⭐⭐       ⭐⭐⭐    ⭐⭐⭐⭐⭐ ⭐⭐⭐⭐   ⭐⭐⭐⭐⭐
```

---

## Choosing Your Strategy

**Use Fixed-Size if:**
- Testing or prototyping
- Budget is critical
- Documents are homogeneous

**Use Sliding-Window if:**
- You want good quality without complexity
- Text documents with continuous prose
- Can absorb 15-25% cost increase

**Use Semantic if:**
- Documents are well-structured (markdown, papers)
- Quality is paramount
- Budget allows for variable chunk sizes

---

## Next Steps

1. **Run `test-chunking.sh`** to see all strategies in action
2. **Choose a strategy** based on your documents
3. **Use in upsertion** — Chunking happens automatically during document ingestion
4. **Monitor quality** — Task 07 provides evaluation metrics

---

## Implementation Details

Source code:
- **Service:** [src/services/chunking.ts](../../functions/src/services/chunking.ts)
- **Endpoint:** [src/endpoints/api/chunk.ts](../../functions/src/endpoints/api/chunk.ts)

Three functions available:
1. `fixedSizeChunk(text, chunkSizeTokens)` — Fixed-size strategy
2. `slidingWindowChunk(text, chunkSize, overlap)` — Sliding-window strategy
3. `semanticChunk(text)` — Semantic strategy
4. `evaluateAllStrategies(text)` — Compare all three

---

## Common Issues

| Problem | Solution |
|---------|----------|
| Chunks too small | Increase `chunkSize` to 768-1024 |
| Lost context | Use `sliding-window` strategy |
| Cost too high | Use `semantic` or increase `chunkSize` |
| Chunks incoherent | Use `semantic` for structured docs |

---

## Learning Path

- **Task 00** → Project setup
- **Task 01** → Embedding
- **Task 02** → Pinecone index
- **Task 03** → Data upsertion
- **Task 04** → Similarity search
- **Task 05** → RAG pipeline
- **→ Task 06** → Chunking strategy ← **YOU ARE HERE**
- **Task 07** → Evaluation & metrics
- **Task 08** → Retrieval improvement
