# Task 02 — Pinecone Index [Action Steps]

## Implementation Steps

### Step 1: Create Client Adapter (cheap singleton)

**File:** `src/adapters/pinecone.ts`

```ts
import { Pinecone } from "@pinecone-database/pinecone";

let client: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (client) return client;

  const key = process.env.PINECONE_API_KEY;
  if (!key || key.length < 20)
    throw new Error("Missing/short PINECONE_API_KEY");

  client = new Pinecone({
    apiKey: key,
    environment: process.env.PINECONE_ENVIRONMENT ?? "us-east-1-aws",
  });
  console.log("✓ Pinecone client initialized");
  return client;
}

export function resetPineconeClient(): void {
  client = null;
}
```

---

### Step 2: Create Index Lifecycle Service

**File:** `src/services/index.ts`

```ts
import { Pinecone } from "@pinecone-database/pinecone";
import { IndexDescription } from "@pinecone-database/pinecone";
import { getPineconeClient } from "../adapters/pinecone";

const CFG = {
  name: process.env.PINECONE_INDEX_NAME ?? "rag-documents",
  dimension: 1536,
  metric: "cosine" as const,
};

export async function getOrCreatePineconeIndex(): Promise<IndexDescription> {
  const pc = getPineconeClient();
  const { name } = CFG;

  // 1. Check if index exists
  const idxList = await pc.listIndexes();
  const existing = idxList.indexes?.find((i) => i.name === name);
  if (existing) return existing;

  // 2. Create index if not exists
  await pc.createIndex({
    name,
    dimension: CFG.dimension,
    metric: CFG.metric,
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
  });

  // 3. Wait for index to be ready (poll 30 times with 2s intervals)
  for (let i = 0; i < 30; i++) {
    const idx = (await pc.listIndexes()).indexes?.find((i) => i.name === name);
    if (idx?.status?.state === "Ready") return idx;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Index creation timeout");
}

export async function checkIndexHealth(
  name = CFG.name,
): Promise<{ healthy: boolean; totalVectors: number }> {
  const stats = await getPineconeClient().Index(name).describeIndexStats();
  return { healthy: true, totalVectors: stats.totalVectorCount ?? 0 };
}

export async function deletePineconeIndex(name = CFG.name): Promise<void> {
  if (process.env.CONFIRM_DELETE !== "true")
    throw new Error("Set CONFIRM_DELETE=true to nuke");
  await getPineconeClient().deletePineconeIndex(name);
}
```

---

### Step 3: Create Typed Index Wrapper (for Task 03)

**File:** `src/services/index-client.ts`

```ts
import { Pinecone } from "@pinecone-database/pinecone";
import { getPineconeClient } from "../adapters/pinecone";

export const INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? "rag-documents";

export function getPineconeIndexClient(): Pinecone.Index<Pinecone.RecordMetadata> {
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
  values: number[]; // 1536-d embedding
  metadata?: VectorMetadata;
}
```

---

### Step 4: Install Pinecone SDK

```bash
npm install @pinecone-database/pinecone
```

---

### Step 5: Configure Environment Variables

Add to `.env` or `.env.local`:

```bash
PINECONE_API_KEY="pcsk_..."
PINECONE_INDEX_NAME="rag-documents"
PINECONE_ENVIRONMENT="us-east-1-aws"
```

Get your API key from: https://app.pinecone.io

---

### Step 6: Test Implementation

Run this test to verify the setup:

```bash
export PINECONE_API_KEY="pcsk_..."
export PINECONE_INDEX_NAME="test-index"

npx ts-node -e '
import { getOrCreatePineconeIndex, checkIndexHealth } from "./src/services/index";
(async () => {
  const idx = await getOrCreatePineconeIndex();
  console.log("✓", idx.name, idx.dimension, idx.metric);
  const health = await checkIndexHealth();
  console.log("✓ health", health);
})()
'
```

**Expected output:**

```
✓ test-index 1536 cosine
✓ health { healthy: true, totalVectors: 0 }
```

---

## Validation Checklist

- [ ] `src/adapters/pinecone.ts` created with singleton client
- [ ] `src/services/index.ts` created with lifecycle functions
- [ ] `src/services/index-client.ts` created with typed wrapper
- [ ] Pinecone SDK installed (`@pinecone-database/pinecone`)
- [ ] Environment variables configured (`.env`)
- [ ] Test passes with correct index created
- [ ] Index status is "Ready"
- [ ] Health check returns `{healthy: true, totalVectors: 0}`

---

## Troubleshooting

| Error                                              | Solution                                                     |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `Missing/short PINECONE_API_KEY`                   | Verify API key in `.env` is set and starts with `pcsk_`      |
| `UNAUTHENTICATED`                                  | API key format invalid; get from https://app.pinecone.io     |
| `already exists`                                   | Delete existing index or use different `PINECONE_INDEX_NAME` |
| `Index creation timeout`                           | Check Pinecone console; may take longer on first creation    |
| `quota exceeded`                                   | Free tier allows 1 index only; upgrade or delete existing    |
| `Cannot find module '@pinecone-database/pinecone'` | Run `npm install @pinecone-database/pinecone`                |
