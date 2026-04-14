---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 02 — Pinecone Index [advanced]

> **Goal**  
> Spin up a Pinecone vector index (1536-d, cosine) and keep one cheap, pooled client ready for upsert/search ops.

---

## 1. What & Why

| In-Memory Brute Force | Pinecone Vector DB |
| --------------------- | ------------------ |
| O(n·d) per query      | O(log n) via HNSW  |
| 1 M docs → 100 s      | 1 M docs → <100 ms |
| 600 MB RAM            | Distributed pods   |
| $0                    | ¢ per query        |

→ Use Pinecone for production RAG.

---

## 2. Spec

| Input                                           | Output                       |
| ----------------------------------------------- | ---------------------------- |
| `PINECONE_INDEX_NAME`                           | Index ready (1536-d, cosine) |
| `PINECONE_API_KEY`                              | Pooled singleton client      |
| `PINECONE_ENVIRONMENT`                          | Health-check pass            |

Free tier: 1 index, 100 k vectors, no credit card.

---

## 3. Core API Surface

```ts
// src/adapters/pinecone.ts
export function getPineconeClient(): Pinecone; // singleton
export function resetPineconeClient(): void; // test helper

// src/services/index.ts
export async function getOrCreatePineconeIndex(): Promise<IndexDescription>;
export async function checkIndexHealth(): Promise<any>;
export async function deletePineconeIndex(name?: string): Promise<void>;
```

---

## 4. Key Knowledge

### 4.1 HNSW in One Line

Builds a layered graph → greedy hops → O(log n) recall.

### 4.2 Metric Cheat-Sheet

- **cosine** — angle (use for embeddings)
- **euclidean** — distance (use for coordinates)
- **dotproduct** — projection (only if already unit vectors)

### 4.3 Cost

Free: 1 index, 100 k vectors, ∞ queries → $0.  
Next tier: ~$0.10 per 100 k vectors + ¢ per query.

---

## 5. Common Issues

| Symptom                    | Fix                           |
| -------------------------- | ----------------------------- |
| `PINECONE_API_KEY not set` | add to `.env`, restart dev    |
| `UNAUTHENTICATED`          | key must start with `pcsk_`   |
| `already exists`           | pick new name or delete       |
| `quota exceeded`           | free tier allows 1 index only |

---

## 6. Next Steps

**Sequence:**  
Task 03 → upsert OpenAI embeddings into this index.  
Task 04 → query the index for similarity search  
Task 05 → use search in RAG pipeline

**To deepen understanding:**

- Read HNSW paper (Malkov & Yashunin)
- Explore Pinecone docs: https://docs.pinecone.io
- Try different pod types and replicas
- Monitor index metrics in Pinecone console

---

## 7. Tutorial Trigger

- **pinecone.md** → Fill "Implementation" section with index management patterns

Tutorial focus:

- What = Vector databases: why they exist, how they work
- Why = Semantic search at scale requires indexing
- How = Pinecone setup, index configuration, lifecycle
- Gotchas = Quota limits, dimension mismatches, region selection
- Trade-offs = Cost vs storage, performance vs complexity, free vs paid
