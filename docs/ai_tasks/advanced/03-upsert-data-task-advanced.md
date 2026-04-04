---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 03 — Upsert Data [advanced]

## Goal

Load documents from various sources, embed them, and upsert vectors into Pinecone index, understanding how to populate a vector database.

---

## Learning Outcomes

After completing this task, you'll understand:

| Topic                           | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| **Data loading patterns**       | JSON, CSV, API sources with error handling           |
| **Integration with embeddings** | Connecting Task 01 output to Pinecone                |
| **Batch processing**            | Efficiently upsert 1000s of vectors                  |
| **Metadata extraction**         | Preserve document context during chunking            |
| **Progress tracking**           | Monitor upsertion with metrics                       |
| **Error recovery**              | Handle partial failures gracefully                   |
| **Cost estimation**             | Calculate embedding + storage costs before execution |
| **Deduplication**               | Avoid upserting same document twice                  |

---

## Requirements

### Input

- Documents (JSON file, CSV, API endpoint, or plain text)
- Each document has: `id`, `text`, optional `metadata`

### Output

- All documents embedded (1536-dimensional vectors)
- All vectors upserted to Pinecone index
- Metadata preserved for retrieval context

### Process

1. Load documents from source
2. Validate document structure
3. Split documents into chunks (if needed)
4. Embed each chunk using OpenAI API
5. Create Pinecone vector with metadata
6. Batch upsert to index
7. Verify in Pinecone
8. Report metrics (time, cost, count)

---

## Why Data Upsertion Matters

### The Problem: Bridging Documents to Vectors

You have three components:

- **Documents with meaning** (natural language)
- **Vector database** (stores numbers)
- **Embedding model** (converts text → numbers)

**Challenge:** Reliably move documents → vectors → database

#### Traditional Approach (Naive)

```
1. Load all documents into memory
2. Convert each to embedding (one at a time)
3. Insert one by one to database
4. Hope nothing fails
```

**Common Failures:**
| Issue | Consequence |
|-------|-------------|
| API rate limits (429 error) | Process stops halfway |
| Memory overflow (10K docs) | Application crashes |
| Network timeout | Lose all progress |
| Metadata missing | Can't trace results |
| Cost explodes | $100+ for large datasets |

> **Result:** Fragile, expensive, slow

### The Solution: Robust Batch Upsertion

```
1. Load documents in batches
2. Embed in parallel with rate limiting
3. Group into batches for Pinecone
4. Upsert with deduplication
5. Track progress → Resume from last batch
6. Verify completeness
7. Report costs and metrics
```

**Benefits:**

- ✅ Handles 100K+ documents
- ✅ Resume from failures (checkpoint)
- ✅ Cost tracking (estimate before running)
- ✅ Progress visibility
- ✅ Metadata preserved

---

## Implementation

| Aspect            | Details                               |
| ----------------- | ------------------------------------- |
| **File**          | `/src/services/upsert.ts`             |
| **Core Function** | `upsertDocuments(documents, options)` |

```typescript
export interface Document {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

export async function upsertDocuments(
  documents: Document[],
  options?: UpsertOptions,
): Promise<UpsertResult>;
```

---

## Implementation Guide

### Step 1: Document Loading

**File:** `src/services/document-loader.ts`

```typescript
import fs from 'fs';
import path from 'path';

export interface Document {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Load documents from JSON file
 *
 * File format:
 * [
 *   {
 *     "id": "doc-1",
 *     "text": "Document content here...",
 *     "metadata": { "source": "manual", "tags": ["ai"] }
 *   },
 *   ...
 * ]
 */
export async function loadDocumentsFromJSON(
  filePath: string
): Promise<Document[]> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      throw new Error('Root must be an array of documents');
    }

    const validated: Document[] = parsed.map((doc, index) => {
      if (!doc.id) {
        throw new Error(`Document at index ${index} missing required 'id'`);
      }

      if (!doc.text || typeof doc.text !== 'string') {
        throw new Error(
          `Document ${doc.id} has invalid 'text' field (must be string)`
        );
      }

      return {
        id: String(doc.id),
        text: doc.text.trim(),
        metadata: doc.metadata || {},
      };
    });

    return validated;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load documents from ${filePath}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Load documents from CSV file
 *
 * CSV format (first row is headers):
 * id,text,source
 * doc-1,"Document text here",wikipedia
 * doc-2,"Another document",article
 */
export async function loadDocumentsFromCSV(
  filePath: string,
  textColumn: string = 'text'
): Promise<Document[]> {
  // Using simple CSV parsing (could use csv-parse library for production)
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('
  ').filter(l => l.trim());

  if (lines.length < 2) {
    throw new Error('CSV must have header row + at least 1 data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const idIndex = headers.indexOf('id');
  const textIndex = headers.indexOf(textColumn);

  if (idIndex === -1 || textIndex === -1) {
    throw new Error(
      `CSV must have 'id' and '${textColumn}' columns. ` +
      `Found: ${headers.join(', ')}`
    );
  }

  const documents: Document[] = lines.slice(1).map((line, rowIndex) => {
    const values = line.split(',');
    const id = values[idIndex]?.trim();
    const text = values[textIndex]?.trim();

    if (!id || !text) {
      throw new Error(
        `Row ${rowIndex + 2} missing required 'id' or '${textColumn}'`
      );
    }

    const metadata: Record<string, any> = {};
    headers.forEach((header, index) => {
      if (header !== 'id' && header !== textColumn) {
        metadata[header] = values[index]?.trim() || null;
      }
    });

    return { id, text, metadata };
  });

  return documents;
}

/**
 * Load documents from API endpoint
 */
export async function loadDocumentsFromAPI(
  url: string,
  authToken?: string
): Promise<Document[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('API response must be an array of documents');
  }

  return data as Document[];
}
```

---

### Step 2: Embedding Integration

**File:** `src/services/upsert.ts` (part 1)

```typescript
import { createEmbedding } from "./embedding";
import { getIndexClient, UpsertVector } from "./index-client";
import type { Document } from "./document-loader";

export interface UpsertOptions {
  batchSize?: number; // Default: 100
  rateLimitMs?: number; // Delay between API calls
  dryRun?: boolean; // Don't actually upsert
  resumeFrom?: number; // Skip first N documents
}

export interface UpsertMetrics {
  documentsLoaded: number;
  documentsEmbedded: number;
  vectorsUpserted: number;
  failedCount: number;
  totalTime: number; // milliseconds
  embeddingCost: number; // USD
  storageCost: number; // USD per month
}

const DEFAULT_OPTIONS: Required<UpsertOptions> = {
  batchSize: 100,
  rateLimitMs: 100,
  dryRun: false,
  resumeFrom: 0,
};

/**
 * Embed documents and prepare for Pinecone upsert
 */
async function embedDocuments(
  documents: Document[],
  options: Required<UpsertOptions>,
): Promise<{ vectors: UpsertVector[]; cost: number }> {
  const vectors: UpsertVector[] = [];
  let totalCost = 0;

  console.log(`
  📝 Embedding ${documents.length} documents...`);

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];

    // Skip if resuming
    if (i < options.resumeFrom) continue;

    try {
      // Embed text
      const embedding = await createEmbedding(doc.text);

      // Track cost
      const tokens = Math.ceil(doc.text.length / 4);
      const cost = tokens * (0.02 / 1_000_000);
      totalCost += cost;

      // Create vector
      vectors.push({
        id: doc.id,
        values: embedding,
        metadata: {
          text: doc.text.substring(0, 1000), // Limit metadata size
          ...doc.metadata,
        },
      });

      // Log progress every 10 documents
      if ((i + 1) % 10 === 0) {
        console.log(
          `  [${i + 1}/${documents.length}] ` +
            `Cost so far: $${totalCost.toFixed(6)}`,
        );
      }

      // Rate limiting
      if (i < documents.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.rateLimitMs),
        );
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to embed ${doc.id}: ${error}`);
      // Continue with next document
    }
  }

  console.log(`  ✓ Embedded ${vectors.length}/${documents.length}`);
  console.log(`  Estimated cost: $${totalCost.toFixed(6)}`);

  return { vectors, cost: totalCost };
}
```

---

### Step 3: Upsert to Pinecone

**File:** `src/services/upsert.ts` (part 2)

```typescript
/**
 * Upsert vectors to Pinecone in batches
 */
async function upsertBatch(
  vectors: UpsertVector[],
  batchSize: number = 100,
): Promise<{ upsertedCount: number; failedIds: string[] }> {
  const index = getIndexClient();
  let upsertedCount = 0;
  const failedIds: string[] = [];

  console.log(`
  ⬆️  Upserting ${vectors.length} vectors...`);

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);

    try {
      const result = await index.upsert(batch);
      upsertedCount += result.length;

      console.log(
        `  [${Math.min(i + batchSize, vectors.length)}/${vectors.length}] ` +
          `Upserted: ${result.length}`,
      );
    } catch (error) {
      // Track failed vectors
      batch.forEach((v) => failedIds.push(v.id));
      console.warn(`  ⚠️  Batch upsert failed: ${error}`);
    }
  }

  console.log(
    `  ✓ Completed: ${upsertedCount} upserted, ${failedIds.length} failed`,
  );

  return { upsertedCount, failedIds };
}

/**
 * Complete upsert pipeline
 */
export async function upsertDocuments(
  documents: Document[],
  options: UpsertOptions = {},
): Promise<UpsertMetrics> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  console.log(`
  🚀 Upsert Pipeline Started`);
  console.log(`   Documents: ${documents.length}`);
  console.log(`   Batch size: ${opts.batchSize}`);
  console.log(`   Rate limit: ${opts.rateLimitMs}ms between embeddings`);

  if (documents.length === 0) {
    throw new Error("No documents to upsert");
  }

  // Step 1: Embed
  const { vectors, cost: embeddingCost } = await embedDocuments(
    documents,
    opts,
  );

  if (vectors.length === 0) {
    throw new Error("No vectors created (all embeddings failed)");
  }

  // Step 2: Upsert
  const { upsertedCount, failedIds } = opts.dryRun
    ? { upsertedCount: vectors.length, failedIds: [] }
    : await upsertBatch(vectors, opts.batchSize);

  // Step 3: Estimate storage cost (~$0.025 per 1K vectors/month)
  const storageCost = (upsertedCount / 1000) * 0.025;

  const duration = Date.now() - startTime;

  console.log(`
  ✅ Upsert Complete`);
  console.log(`   Time: ${(duration / 1000).toFixed(1)}s`);
  console.log(`   Documents loaded: ${documents.length}`);
  console.log(`   Vectors upserted: ${upsertedCount}`);
  console.log(`   Failed: ${failedIds.length}`);
  console.log(`   Embedding cost: $${embeddingCost.toFixed(6)}`);
  console.log(`   Storage cost/month: $${storageCost.toFixed(6)}`);

  if (failedIds.length > 0) {
    console.warn(`   Failed IDs: ${failedIds.join(", ")}`);
  }

  return {
    documentsLoaded: documents.length,
    documentsEmbedded: vectors.length,
    vectorsUpserted: upsertedCount,
    failedCount: failedIds.length,
    totalTime: duration,
    embeddingCost,
    storageCost,
  };
}
```

---

### Step 4: CLI Integration

**File:** `src/commands/upsert.ts`

```typescript
import { loadDocumentsFromJSON } from '../services/document-loader';
import { upsertDocuments } from '../services/upsert';

// Usage: npx ts-node src/commands/upsert.ts <file.json>
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log('Usage: npx ts-node src/commands/upsert.ts <documents.json>');
    console.log('
    Example documents.json:');
    console.log(
      JSON.stringify(
        [
          {
            id: 'doc-1',
            text: 'Machine learning is a subset of AI...',
            metadata: { source: 'wiki', topic: 'ai' },
          },
          {
            id: 'doc-2',
            text: 'Embeddings are numerical representations...',
            metadata: { source: 'article', topic: 'embeddings' },
          },
        ],
        null,
        2
      )
    );
    process.exit(1);
  }

  try {
    console.log(`Loading documents from ${filePath}...`);
    const documents = await loadDocumentsFromJSON(filePath);
    console.log(`Loaded ${documents.length} documents`);

    const metrics = await upsertDocuments(documents, {
      batchSize: 50,
      rateLimitMs: 200, // Conservative rate for API limits
    });

    console.log('
    📊 Final Metrics:');
    console.log(`  Loaded:          ${metrics.documentsLoaded}`);
    console.log(`  Embedded:        ${metrics.documentsEmbedded}`);
    console.log(`  Upserted:        ${metrics.vectorsUpserted}`);
    console.log(`  Failed:          ${metrics.failedCount}`);
    console.log(`  Duration:        ${(metrics.totalTime / 1000).toFixed(1)}s`);
    console.log(`  Embedding cost:  $${metrics.embeddingCost.toFixed(6)}`);
    console.log(`  Monthly storage: $${metrics.storageCost.toFixed(6)}`);
  } catch (error) {
    console.error('Upsert failed:', error);
    process.exit(1);
  }
}

main();
```

---

## Testing

### Test 1: Load and Upsert Sample Documents

```bash
# Create sample documents
cat > sample-docs.json << 'EOF'
[
  {
    "id": "doc-1",
    "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.",
    "metadata": { "source": "ai-intro", "difficulty": "beginner" }
  },
  {
    "id": "doc-2",
    "text": "Embeddings are numerical representations of text that capture semantic meaning. They allow us to perform similarity search on documents.",
    "metadata": { "source": "embeddings-guide", "difficulty": "intermediate" }
  },
  {
    "id": "doc-3",
    "text": "Vector databases like Pinecone optimize storage and retrieval of embeddings at scale. They use advanced indexing techniques like HNSW.",
    "metadata": { "source": "vector-db", "difficulty": "intermediate" }
  }
]
EOF

# Run upsert
npx ts-node src/commands/upsert.ts sample-docs.json
```

**Expected Output:**

```
Loading documents from sample-docs.json...
Loaded 3 documents

🚀 Upsert Pipeline Started
   Documents: 3
   Batch size: 100
   Rate limit: 100ms between embeddings

📝 Embedding 3 documents...
   [3/3] Cost so far: $0.000001
   ✓ Embedded 3/3
   Estimated cost: $0.000001

⬆️  Upserting 3 vectors...
   [3/3] Upserted: 3
   ✓ Completed: 3 upserted, 0 failed

✅ Upsert Complete
   Time: 1.5s
   Documents loaded: 3
   Vectors upserted: 3
   Failed: 0
   Embedding cost: $0.000001
   Storage cost/month: $0.000001
```

### Test 2: Verify vectors in Pinecone

```typescript
// Verify upsertion worked
import { getIndexClient } from "./src/services/index-client";

async function verify() {
  const index = getIndexClient();
  const stats = await index.describeIndexStats();

  console.log(`Total vectors: ${stats.totalVectorCount}`);
  console.log(`Should include our 3 documents`);
}

verify();
```

### Test 3: Error scenarios

```bash
# Test with invalid documents
cat > invalid-docs.json << 'EOF'
[
  { \"text\": \"Missing id field\" },
  { \"id\": \"doc-2\", \"text\": \"Valid\" }
]
EOF

npx ts-node src/commands/upsert.ts invalid-docs.json
# Expected: Error \"Document at index 0 missing required 'id'\"

# Test with empty documents
cat > empty-docs.json << 'EOF'
[]
EOF

npx ts-node src/commands/upsert.ts empty-docs.json
# Expected: Error \"No documents to upsert\"
```

**Success criteria:**

- ✅ Documents loaded correctly
- ✅ All documents embedded (3 embeddings created)
- ✅ All vectors upserted to Pinecone
- ✅ Metrics reported accurately
- ✅ Pinecone stats show total_vectors increased
- ✅ Metadata preserved in vectors
- ✅ Errors handled gracefully

---

## Data Pipeline Fundamentals

### ETL: Extract, Transform, Load

```
Extract: Load documents from source
  ↓ Get raw documents
  Format: JSON, CSV, API, database

Transform: Prepare documents for embedding
  ↓ Validate structure
  ↓ Clean text (remove special chars)
  ↓ Split into chunks
  ↓ Add metadata

Load: Embed and upsert
  ↓ Create embeddings
  ↓ Batch upsert to Pinecone
  ↓ Verify success

Result: Documents → Vectors → Database
```

### Batch Processing Why

```
Processing 1000 documents:

One-at-a-time (slow):
  Load doc 1 → Embed 1 → Upsert 1 → Load doc 2 → ...
  Time: 1000 embeds × 100ms = 100 seconds

Batched (fast):
  Load all 1000 → Embed in parallel (10 at a time) → Batch upsert
  Time: 100 batches × 100ms = 10 seconds
  → 10x faster!

Benefit: Batch upsert is optimized for multiple vectors at once
```

---

## Cost Analysis

### Per-Document Costs

```
Embedding (OpenAI):
  ~100 chars = 25 tokens
  Cost: 25 * ($0.02 / 1M) = $0.0000005

Storage (Pinecone):
  1 vector = ~8KB
  1000 vectors = ~8MB
  Cost: $0.025 per 1K vectors per month

Total for 1000 documents:
  Embedding: 1000 × $0.0000005 = $0.0005
  Storage: $0.025
  → ~$0.03 per 1000 documents
```

### Scale Examples

```
100 documents:
  Embedding: $0.00005
  Storage: $0.0025
  Total: ~$0.003

10,000 documents:
  Embedding: $0.005
  Storage: $0.25
  Total: ~$0.26 upfront (very cheap)

100,000 documents (1M tokens):
  Embedding: $0.05 (at free tier rates)
  Storage: $2.50/month
  Total: ~$2.55 upfront
```

---

## Common Patterns

### Pattern 1: Incremental upsert (don't re-embed everything)

```typescript
export async function incrementalUpsert(
  newDocuments: Document[],
  alreadyUpsetIds: Set<string>,
): Promise<UpsertMetrics> {
  // Filter out already upserted
  const toUpsert = newDocuments.filter((doc) => !alreadyUpsetIds.has(doc.id));

  console.log(`Found ${toUpsert.length} new documents to upsert`);

  return upsertDocuments(toUpsert);
}
```

### Pattern 2: Upsert with checkpoints (resume from failures)

```typescript
export async function upsertWithCheckpoints(
  documents: Document[],
  checkpointFile: string,
): Promise<UpsertMetrics> {
  let startIndex = 0;

  if (fs.existsSync(checkpointFile)) {
    const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, "utf-8"));
    startIndex = checkpoint.lastIndex;
    console.log(`Resuming from document ${startIndex}`);
  }

  const metrics = await upsertDocuments(documents, {
    resumeFrom: startIndex,
  });

  // Save checkpoint
  fs.writeFileSync(
    checkpointFile,
    JSON.stringify({ lastIndex: documents.length, ...metrics }),
  );

  return metrics;
}
```

---

## Error Handling Reference

| Error                      | Cause             | Solution                |
| -------------------------- | ----------------- | ----------------------- |
| \"Document missing id\"    | Bad input         | Validate JSON structure |
| \"No documents to upsert\" | Empty input       | Provide documents       |
| \"429 Too Many Requests\"  | Rate limited      | Increase rateLimitMs    |
| \"Invalid API key\"        | Auth failed       | Check OPENAI_API_KEY    |
| \"Index not found\"        | No Pinecone index | Create index first      |
| \"Upsert batch failed\"    | Pinecone error    | Check quota, retry      |

---

## Performance Optimization

### Embeddings Throughput

```
Baseline: 100ms per embedding

Optimizations:
- Decrease rateLimitMs (but watch rate limits)
- Parallel embedding batches
- Shorter documents → faster embedding

Max safe rate:
- Free tier: 20 requests/min (3s between)
- Paid tier: Higher (check your tier)
```

### Upsert Throughput

```
Batch size effects:
- Small (10): More network calls
- Medium (100): Optimal
- Large (1000): Better throughput, more memory

Recommendation: Batch size = 100
```

---

## Constraints

- Text documents only (no images)
- Max document size: 100K characters (can chunk)
- Metadata: 40KB per vector
- Metadata fields must be: string, number, boolean, list

---

## Troubleshooting

### \"Document missing id\"

```
❌ Problem:
  Error: Document at index 0 missing required 'id'

✅ Solution:
  1. Check input JSON has 'id' field for each document
  2. Format: { \"id\": \"string\", \"text\": \"string\" }
  3. All documents need id and text
```

### \"429 Too Many Requests\"

```
❌ Problem:
  Error: Rate limited by OpenAI

✅ Solution:
  Option 1: Increase rateLimitMs (default 100ms → 200ms)
  Option 2: Upgrade OpenAI plan
  Option 3: Batch smaller documents

  Code:
  await upsertDocuments(docs, { rateLimitMs: 500 })
```

### \"Index not found\"

```
❌ Problem:
  Error: Index \"rag-documents\" not found

✅ Solution:
  1. Create index first: await getOrCreateIndex()
  2. Check PINECONE_INDEX_NAME env var
  3. Verify in Pinecone console
```

---

## Next Steps

**After this task:**

1. Task 04: Query the index to find similar documents
2. Task 05: Use queries in RAG pipeline
3. Task 06: Optimize chunking for better retrieval

**To deepen understanding:**

- Experiment with different batch sizes
- Monitor costs for various document sizes
- Try incremental upsertion pattern
- Implement checkpoint system for large datasets

---

## Tutorial Trigger

- **system_architecture.md** → Fill \"Data Pipeline\" section with upsert patterns

Tutorial focus:

- What = ETL pipeline: transforming documents to vectors
- Why = Need robust, scalable way to populate vector database
- How = Batch processing, error handling, cost tracking
- Gotchas = Rate limits, metadata size, duplicate handling
- Trade-offs = Speed vs cost, batch size vs memory, incremental vs full refresh
