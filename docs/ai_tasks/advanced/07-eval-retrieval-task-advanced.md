---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 07 — Eval Retrieval [advanced]

## Goal

Establish systematic evaluation methods to measure retrieval quality, understand what makes search work well, and identify concrete improvement opportunities.

---

## Learning Outcomes

After completing this task, you'll understand:

- **How to measure retrieval quality systematically** — Beyond gut feeling
- **Evaluation metrics** — Precision, Recall, MRR, NDCG explained
- **Test case design** — Creating meaningful evaluation datasets
- **Failure analysis** — Why retrieval fails and how to diagnose
- **Data-driven improvement** — Using metrics to guide optimization
- **Production monitoring** — Tracking search quality over time

---

## Requirements

**Create evaluation dataset:**

- 5-10 test queries
- Expected relevant documents for each query
- Ground truth labels (which docs should be retrieved)

**Calculate metrics:**

- **Precision@K** — Of K results, how many are relevant?
- **Recall@K** — Of all relevant docs, how many did we find?
- **MRR** — Mean Reciprocal Rank (how quickly we find first relevant)
- **NDCG** — Normalized Discounted Cumulative Gain (overall ranking quality)

**Output:**

- Per-query evaluation results
- Summary metrics
- Pass/fail assessment

---

## Implementation

**File:** `/evals/retrieval.test.ts`

**Core Interfaces:**

```typescript
export interface TestCase {
  id: string;
  query: string;
  expectedDocs: string[]; // Document IDs that should be retrieved
  explanation?: string; // Why these docs are relevant
}

export interface EvalResult {
  query: string;
  retrieved: string[];
  expected: string[];
  precision: number;
  recall: number;
  mrr: number;
  ndcg: number;
  success: boolean;
}
```

---

## Implementation Guide

### Step 1: Define test cases

```typescript
// evals/retrieval.test.ts
import { querySimilar } from "../src/services/retrieval";

/**
 * Test cases must match your seeded documents
 * For Task 03, we seeded 5 documents:
 * - doc-1: Machine learning
 * - doc-2: Vector databases
 * - doc-3: Embeddings
 * - doc-4: RAG (Retrieval-Augmented Generation)
 * - doc-5: Semantic search
 */

export interface TestCase {
  id: string;
  query: string;
  expectedDocs: string[];
  explanation?: string;
}

export const testCases: TestCase[] = [
  {
    id: "test-ml-definition",
    query: "What is machine learning?",
    expectedDocs: ["doc-1"],
    explanation: "Directly about ML definition",
  },
  {
    id: "test-vector-db",
    query: "How do vector databases work?",
    expectedDocs: ["doc-2"],
    explanation: "Core topic of vector databases",
  },
  {
    id: "test-embeddings-concept",
    query: "What are embeddings?",
    expectedDocs: ["doc-3"],
    explanation: "Embeddings definition",
  },
  {
    id: "test-rag-pipeline",
    query: "Tell me about RAG systems",
    expectedDocs: ["doc-4"],
    explanation: "RAG is the topic",
  },
  {
    id: "test-semantic-search",
    query: "How to search semantically?",
    expectedDocs: ["doc-5", "doc-2", "doc-3"],
    explanation: "Semantic search relies on embeddings and vector search",
  },
  {
    id: "test-ai-learning",
    query: "AI that learns from examples",
    expectedDocs: ["doc-1"],
    explanation: "Semantic match to ML definition (not keyword match)",
  },
  {
    id: "test-vector-similarity",
    query: "Finding similar content with vectors",
    expectedDocs: ["doc-2", "doc-5"],
    explanation: "Vector similarity is core to both",
  },
];
```
