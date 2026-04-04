---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 01 — OpenAI Embedding [advanced]

## Goal

Create a function that transforms text into semantic vector embeddings using OpenAI's embedding model, understanding how embeddings enable AI applications.

---

## Learning Outcomes

After completing this task, you'll understand:

- **What embeddings are** — Numerical representations that capture semantic meaning
- **Why embeddings enable semantic search** — Beyond simple keyword matching
- **How to integrate OpenAI API from TypeScript** — Production-grade client patterns
- **Error handling and resilience** — Rate limits, auth failures, retries
- **Cost management** — Token counting and pricing implications
- **Dimension and model selection** — Why 1536 dimensions for text-embedding-3-small
- **Singleton pattern for expensive resources** — Client initialization best practice

---

## Requirements

**Input:**

- `text`: string (natural language text, e.g., "What is machine learning?")

**Output:**

- `embedding`: number[] array
  - Type: 1536-dimensional vector
  - Format: normalized float values in range [-1, 1]
  - Properties: Captures semantic meaning of input text

**Model Selection:**

- Model: `text-embedding-3-small`
- Dimensions: 1536
- Cost: $0.02 per 1M tokens
- Speed: ~100ms per request
- Why this model: Good balance of cost vs quality for RAG systems

---

## Why Embeddings Matter

### The Problem: Keyword Search Limitations

```
Traditional keyword search:
Query: "machine learning"
Doc A: "ML is teaching computers to learn"
Doc B: "The teaching profession requires patience"
Match score: Same (both have "teaching")
Result: ❌ False positive (Doc B irrelevant)
```

### The Solution: Semantic Search with Embeddings

```
Semantic search:
Query: "machine learning" → [0.1, -0.2, 0.3, ..., 0.5]
Doc A: "ML is teaching computers..." → [0.11, -0.19, 0.31, ..., 0.48]
Doc B: "The teaching profession..." → [-0.4, 0.8, -0.2, ..., -0.3]

Similarity A: 0.95 ✅ (very similar meaning)
Similarity B: 0.15 ❌ (different meaning, despite keyword match)
```

**Result:** Embeddings understand meaning, not just keywords.

---

## Implementation

**See:** [Action Steps](./.task_actions/advanced/01-openai-embedding-action-advanced.md)

**Files to create:**

- `src/adapters/openai.ts` — OpenAI client initialization (singleton pattern)
- `src/services/embedding.ts` — Embedding business logic with cost tracking
- `src/endpoints/api/embed.ts` — REST endpoint for embedding requests

**Key functions:**

- `getOpenAIClient(): OpenAI` — Singleton client
- `createEmbedding(text: string): Promise<number[]>` — Create embeddings
- `estimateTokens(text: string): number` — Token estimation
- `estimateCost(text: string): number` — Cost calculation

---

## Embedding Fundamentals

### What is an Embedding?

**Simple definition:** A list of numbers that represents the meaning of text.

```
Text: \"machine learning\"
     ↓ (embedding model)
Vector: [0.123, -0.456, 0.789, ..., 0.234]
        └─ 1536 dimensions ─┘

Properties:
- Same text → Same embedding
- Similar texts → Similar embeddings
- Different texts → Different embeddings
```

### How Embeddings Capture Meaning

```
Embeddings are trained on massive text corpora.
They learn:
- Semantic relationships (\"king\" - \"man\" + \"woman\" ≈ \"queen\")
- Topic associations (ML terms cluster together)
- Similarity patterns (similar ideas → similar vectors)

Result: Numbers encode meaning
```

### Dimensions Explained

**Why 1536 dimensions?**

```
More dimensions = More capacity for meaning

1 dimension:    [0.5]              ← Can only represent 1 bit of info
10 dimensions:  [0.1, 0.2, ...]    ← More nuanced
1536 dimensions: [0.123, -0.456, ...] ← Very detailed

OpenAI chose 1536 as sweet spot:
- Enough dimensions to capture fine-grained meaning
- Not so many as to be computationally expensive
- Works well for semantic search
```

---

## Cost Analysis

### Pricing

```
OpenAI text-embedding-3-small:
$0.02 per 1 million input tokens

For comparison:
- GPT-3.5-turbo: $0.50 per 1M input tokens (25x more expensive)
- text-embedding-3-large: $0.08 per 1M tokens (4x more)
```

### Token Counting

```typescript
// Rough formula: 4 characters ≈ 1 token

Examples:
- \"hello\" (5 chars) ≈ 2 tokens
- \"machine learning\" (15 chars) ≈ 4 tokens
- \"The quick brown fox...\" (50 chars) ≈ 13 tokens

For accurate counts, use OpenAI's tokenizer
But 4x rule is good enough for estimation
```

### Cost Examples

```
100 chars (25 tokens)  ≈ $0.0000005 ← Negligible
1000 chars (250 tokens) ≈ $0.000005 ← Still negligible
10000 chars (2500 tokens) ≈ $0.00005 ← Very cheap

→ Embeddings are cheaper than LLM calls by 25x
→ For RAG, embedding cost is rarely a bottleneck
```

---

## Next Steps

**After this task:**

1. Move to Task 02 to store embeddings in Pinecone
2. Task 03 will combine embedding + storage
3. Task 04 will use embeddings for search

**To deepen understanding:**

- Read OpenAI embedding docs: https://platform.openai.com/docs/guides/embeddings
- Experiment with different texts and observe embedding similarity
- Try text-embedding-3-large to see difference in quality

---

## Tutorial Trigger

- **embeddings.md** → Fill \"How\" section with OpenAI integration patterns

Tutorial focus:

- What = Embeddings: numerical representations of semantic meaning
- Why = Enables semantic search (beyond keyword matching)
- How = OpenAI API integration with singleton client pattern
- Gotchas = Rate limits, token costs, dimension validation, error handling
- Trade-offs = Cost vs quality (small vs large models)
