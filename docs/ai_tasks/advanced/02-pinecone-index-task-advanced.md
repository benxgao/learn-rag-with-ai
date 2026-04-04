---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 02 — Pinecone Index  [advanced]

> **Goal**  
> Spin up a Pinecone vector index (1536-d, cosine) and keep one cheap, pooled client ready for upsert/search ops.

---

## 1. What & Why

| In-Memory Brute Force | Pinecone Vector DB |
|-----------------------|--------------------|
| O(n·d) per query      | O(log n) via HNSW  |
| 1 M docs → 100 s      | 1 M docs → <100 ms |
| 600 MB RAM            | Distributed pods   |
| $0                    | ¢ per query        |

→ Use Pinecone for production RAG.

---

## 2. Spec

| Input | Output |
|-------|--------|
| `PINECONE_INDEX_NAME` (default `rag-documents`) | Index ready (1536-d, cosine) |
| `PINECONE_API_KEY` | Pooled singleton client |
| `PINECONE_ENVIRONMENT` | Health-check pass |

Free tier: 1 index, 100 k vectors, no credit card.

---

## 3. Core API Surface

```ts
// src/adapters/pinecone.ts
export function getPineconeClient(): Pinecone          // singleton
export function resetPineconeClient(): void            // test helper

// src/services/index.ts
export async function getOrCreateIndex(): Promise<IndexDescription>
export async function checkIndexHealth(): Promise<{healthy:boolean; totalVectors:number}>
export async function deleteIndex(name?:string): Promise<void>
```

---

## 4. Implementation

### 4.1 Client Adapter (cheap singleton)

```ts
// src/adapters/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

let client: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (client) return client;

  const key = process.env.PINECONE_API_KEY;
  if (!key || key.length < 20) throw new Error('Missing/short PINECONE_API_KEY');

  client = new Pinecone({
    apiKey: key,
    environment: process.env.PINECONE_ENVIRONMENT ?? 'us-east-1-aws',
  });
  console.log('✓ Pinecone client initialized');
  return client;
}

export function resetPineconeClient(): void { client = null; }
```

### 4.2 Index Lifecycle

```ts
// src/services/index.ts
import { getPineconeClient } from '../adapters/pinecone';

const CFG = {
  name: process.env.PINECONE_INDEX_NAME ?? 'rag-documents',
  dimension: 1536,
  metric: 'cosine' as const,
};

export async function getOrCreateIndex() {
  const pc = getPineconeClient();
  const { name } = CFG;

  // 1. Exists?
  const idxList = await pc.listIndexes();
  const existing = idxList.find(i => i.name === name);
  if (existing) return existing;

  // 2. Create
  await pc.createIndex({
    name,
    dimension: CFG.dimension,
    metric: CFG.metric,
    spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
  });

  // 3. Wait ready (poll 30×2 s)
  for (let i = 0; i < 30; i++) {
    const idx = (await pc.listIndexes()).find(i => i.name === name);
    if (idx?.status?.state === 'Ready') return idx;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Index creation timeout');
}

export async function checkIndexHealth(name = CFG.name) {
  const stats = await getPineconeClient().Index(name).describeIndexStats();
  return { healthy: true, totalVectors: stats.totalVectorCount ?? 0 };
}

export async function deleteIndex(name = CFG.name) {
  if (process.env.CONFIRM_DELETE !== 'true')
    throw new Error('Set CONFIRM_DELETE=true to nuke');
  await getPineconeClient().deleteIndex(name);
}
```

### 4.3 Typed Index Wrapper (for Task 03)

```ts
// src/services/index-client.ts
import { getPineconeClient } from '../adapters/pinecone';

export const INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? 'rag-documents';

export function getIndexClient() {
  return getPineconeClient().Index(INDEX_NAME);
}

export interface VectorMetadata {
  text: string;
  documentId: string;
  chunkIndex: number;
  source?: string;
  timestamp?: number;
}

export interface UpsertVector {
  id: string;
  values: number[];        // 1536-d
  metadata?: VectorMetadata;
}
```

---

## 5. Quick Test

```bash
export PINECONE_API_KEY="pcsk_..."
export PINECONE_INDEX_NAME="test-index"

npx ts-node -e '
import{getOrCreateIndex,checkIndexHealth} from"./src/services/index";
(async()=>{
  const i=await getOrCreateIndex();
  console.log("✓",i.name,i.dimension,i.metric);
  console.log("✓ health",await checkIndexHealth());
})()'
```

Expect:

```
✓ test-index 1536 cosine
✓ health { healthy: true, totalVectors: 0 }
```

---

## 6. Key Knowledge

### 6.1 HNSW in One Line  
Builds a layered graph → greedy hops → O(log n) recall.

### 6.2 Metric Cheat-Sheet  
- **cosine** — angle (use for embeddings)  
- **euclidean** — distance (use for coordinates)  
- **dotproduct** — projection (only if already unit vectors)

### 6.3 Cost  
Free: 1 index, 100 k vectors, ∞ queries → $0.  
Next tier: ~$0.10 per 100 k vectors + ¢ per query.

---

## 7. Gotchas

| Symptom | Fix |
|---------|-----|
| `PINECONE_API_KEY not set` | add to `.env`, restart dev |
| `UNAUTHENTICATED` | key must start with `pcsk_` |
| `already exists` | pick new name or delete |
| `quota exceeded` | free tier allows 1 index only |

---

## 8. Next

Task 03 → upsert OpenAI embeddings into this index.
Task 04: Query the index for similarity search
Task 05: Use search in RAG pipeline

**To deepen understanding:**
- Read HNSW paper (Malkov & Yashunin)
- Explore Pinecone docs: https://docs.pinecone.io
- Try different pod types and replicas
- Monitor index metrics in Pinecone console

---

## Tutorial Trigger

- **pinecone.md** → Fill \"Implementation\" section with index management patterns

Tutorial focus:
- What = Vector databases: why they exist, how they work
- Why = Semantic search at scale requires indexing
- How = Pinecone setup, index configuration, lifecycle
- Gotchas = Quota limits, dimension mismatches, region selection
- Trade-offs = Cost vs storage, performance vs complexity, free vs paid

