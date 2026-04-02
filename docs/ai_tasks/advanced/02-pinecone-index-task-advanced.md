# Task 02 — Pinecone Index [ENHANCED]

## Goal

Set up and configure a Pinecone vector index to store and manage embeddings at scale, learning how vector databases work.

---

## Learning Outcomes

After completing this task, you'll understand:
- **Vector database fundamentals** — How Pinecone stores and retrieves vectors
- **Index configuration trade-offs** — Metric choice, dimensionality, pod types
- **Singleton pattern for expensive clients** — Connection pooling, cost efficiency
- **Index lifecycle management** — Create, validate, describe, delete operations
- **Metadata handling** — Storing and filtering by document properties
- **Error handling** — Quota limits, network failures, configuration errors
- **Cost implications** — Storage, operations, request pricing
- **Production readiness** — Health checks, monitoring, scaling strategies

---

## Requirements

**Input:**
- Index name (e.g., "rag-documents")
- Dimension: 1536 (matches OpenAI embeddings)
- Metric: "cosine" (similarity scoring)

**Output:**
- Pinecone index ready for upserting vectors
- Client connection validated and pooled
- Health check passing

**Infrastructure:**
- Pinecone account (free tier: 1 index, 100K vectors)
- API key (from Pinecone console)
- Region selection (us-east-1 recommended for US)

---

## Why Pinecone Matters

### The Problem: In-Memory Search is Inefficient

```
Pure in-memory search (no database):
- Load all embeddings into RAM
- Linear scan through all vectors
- Similarity calculation for each: O(n*d) where n=documents, d=dimensions

Performance:
- 100 documents, 1536 dimensions: ~154K operations per query
- 1,000,000 documents: 1.5 BILLION operations
- Latency: 100ms → 100+ seconds
- Memory: 100K docs * 1536 dims * 4 bytes = 600 MB

❌ Doesn't scale. Can't do real-time search.
```

### The Solution: Vector Database with Indexing

```
Pinecone (vector database):
- Uses HNSW (Hierarchical Navigable Small World) indexing
- Approximate search: O(log n) complexity
- Pre-computed index: Skip linear scan
- Distributed storage: Handles millions of vectors
- Fast retrieval: <100ms even for millions

Performance:
- Same 1M documents: <100ms response time
- Memory: Distributed across pods
- Scalability: Add pods to handle more

✅ Scales to billions of vectors.
✅ Real-time semantic search.
✅ Production-ready infrastructure.
```

### The Trade-off

```
In-Memory                  Pinecone Vector DB
─────────────────────────────────────────────
- Fast for small data      - Fast for any size
- Requires all in RAM      - Distributed storage
- Simple implementation    - Managed service
- $0 cost                  - Pays per storage + ops
- Hard to scale            - Scales automatically

→ Choice: Use Pinecone for production RAG systems
```

---

## Implementation

**File:** `/src/adapters/pinecone.ts`

**Core Functions:**
```typescript
export function getPineconeClient(): Pinecone
export async function getOrCreateIndex(name: string): Promise<IndexDescription>
export async function checkIndexHealth(name: string): Promise<boolean>
export async function deleteIndex(name: string): Promise<void>
```

---

## Implementation Guide

### Step 1: Create Pinecone Client Adapter

```typescript
// src/adapters/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Singleton Pinecone client
 * 
 * Why singleton?
 * - Connection pooling: Reuses connections to Pinecone API
 * - Rate limit tracking: Single point for monitoring quotas
 * - Cost efficiency: One authenticated connection
 * - Thread-safe: One client per process
 */
let client: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!client) {
    const apiKey = process.env.PINECONE_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'PINECONE_API_KEY environment variable not set. ' +
        'Get your key from https://app.pinecone.io → API Keys'
      );
    }
    
    if (apiKey.length < 20) {
      throw new Error(
        'PINECONE_API_KEY looks invalid (too short). ' +
        'Get the full key from Pinecone console.'
      );
    }
    
    client = new Pinecone({
      apiKey,
      environment: process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws',
    });
    
    console.log('✓ Pinecone client initialized');
  }
  
  return client;
}

/**
 * Reset client (useful for testing)
 */
export function resetPineconeClient(): void {
  client = null;
}
```

### Step 2: Index Management Functions

```typescript
// src/services/index.ts
import { getPineconeClient } from '../adapters/pinecone';
import type { IndexDescription } from '@pinecone-database/pinecone';

/**
 * Index configuration
 * 
 * Why these values?
 * - Dimension: 1536 (OpenAI text-embedding-3-small output)
 * - Metric: cosine (best for semantic similarity)
 * - Pod type: s1 (most cost-effective)
 * - Replicas: 1 (free tier) or 2+ (production)
 */
const INDEX_CONFIG = {
  name: process.env.PINECONE_INDEX_NAME || 'rag-documents',
  dimension: 1536,
  metric: 'cosine' as const, // 'euclidean' | 'dotproduct' | 'cosine'
  podType: 's1',
  replicas: 1,
};

/**
 * Get or create Pinecone index
 * 
 * Process:
 * 1. Connect to Pinecone
 * 2. Check if index exists
 * 3. Create if not found
 * 4. Wait for ready state
 * 5. Return index description
 */
export async function getOrCreateIndex(): Promise<IndexDescription> {
  const client = getPineconeClient();
  const indexName = INDEX_CONFIG.name;
  
  console.log(`\n📍 Index Management: "${indexName}"`);\n  try {\n    // Step 1: Check if index exists\n    console.log(`  Checking if index exists...`);\n    const indexes = await client.listIndexes();\n    const existing = indexes.find(idx => idx.name === indexName);\n    \n    if (existing) {\n      console.log(`  ✓ Index already exists`);\n      console.log(`    - Dimension: ${existing.dimension}`);\n      console.log(`    - Metric: ${existing.metric}`);\n      console.log(`    - Status: ${existing.status?.state || 'unknown'}`);\n      return existing;\n    }\n    \n    // Step 2: Create new index\n    console.log(`  Creating new index...`);\n    console.log(`    - Name: ${indexName}`);\n    console.log(`    - Dimension: ${INDEX_CONFIG.dimension}`);\n    console.log(`    - Metric: ${INDEX_CONFIG.metric}`);\n    console.log(`    - Pod type: ${INDEX_CONFIG.podType}`);\n    \n    await client.createIndex({\n      name: indexName,\n      dimension: INDEX_CONFIG.dimension,\n      metric: INDEX_CONFIG.metric,\n      spec: {\n        serverless: {\n          cloud: 'aws',\n          region: 'us-east-1',\n        },\n      },\n    });\n    \n    // Step 3: Wait for index to be ready\n    console.log(`  Waiting for index to be ready...`);\n    let ready = false;\n    let attempts = 0;\n    const maxAttempts = 30; // 30 * 2 sec = 1 minute timeout\n    \n    while (!ready && attempts < maxAttempts) {\n      const indexes = await client.listIndexes();\n      const index = indexes.find(idx => idx.name === indexName);\n      \n      if (index?.status?.state === 'Ready') {\n        ready = true;\n        console.log(`  ✓ Index ready`);\n      } else {\n        attempts++;\n        console.log(`  ⏳ Waiting (${attempts}/${maxAttempts})...`);\n        await new Promise(resolve => setTimeout(resolve, 2000));\n      }\n    }\n    \n    if (!ready) {\n      throw new Error(\n        `Index creation timeout. Check Pinecone console at ` +\n        `https://app.pinecone.io/indexes`\n      );\n    }\n    \n    // Step 4: Get and return final description\n    const indexes = await client.listIndexes();\n    const description = indexes.find(idx => idx.name === indexName);\n    \n    if (!description) {\n      throw new Error('Index created but not found when fetching');\n    }\n    \n    return description;\n  } catch (error) {\n    if (error instanceof Error) {\n      if (error.message.includes('already exists')) {\n        // Race condition: Another process created it\n        const indexes = await client.listIndexes();\n        const existing = indexes.find(idx => idx.name === indexName);\n        if (existing) return existing;\n      }\n      \n      if (error.message.includes('UNAUTHENTICATED')) {\n        throw new Error(\n          'Authentication failed with Pinecone. ' +\n          'Check PINECONE_API_KEY in .env file.'\n        );\n      }\n      \n      if (error.message.includes('quota')) {\n        throw new Error(\n          'Quota exceeded. Free tier allows 1 index. ' +\n          'Upgrade at https://app.pinecone.io/billing'\n        );\n      }\n    }\n    throw error;\n  }\n}\n\n/**\n * Check if index is healthy and accessible\n */\nexport async function checkIndexHealth(indexName: string = INDEX_CONFIG.name): Promise<boolean> {\n  const client = getPineconeClient();\n  \n  try {\n    const index = client.Index(indexName);\n    \n    // Simple health check: stats call\n    const stats = await index.describeIndexStats();\n    \n    return {\n      healthy: true,\n      totalVectors: stats.totalVectorCount || 0,\n      totalSize: stats.totalSize || 0,\n      namespaces: stats.namespaces ? Object.keys(stats.namespaces).length : 0,\n    };\n  } catch (error) {\n    if (error instanceof Error) {\n      if (error.message.includes('NOT_FOUND')) {\n        throw new Error(`Index \"${indexName}\" not found in Pinecone`);\n      }\n      \n      if (error.message.includes('UNAVAILABLE')) {\n        throw new Error(\n          'Pinecone service unavailable. Check your connection or ' +\n          'region setting.'\n        );\n      }\n    }\n    throw error;\n  }\n}\n\n/**\n * Get index statistics\n */\nexport async function getIndexStats(indexName: string = INDEX_CONFIG.name) {\n  const client = getPineconeClient();\n  const index = client.Index(indexName);\n  \n  const stats = await index.describeIndexStats();\n  \n  return {\n    totalVectors: stats.totalVectorCount || 0,\n    totalSize: stats.totalSize || 0,\n    namespaces: stats.namespaces,\n    dimension: stats.dimension,\n  };\n}\n\n/**\n * Delete index (use with caution!)\n */\nexport async function deleteIndex(indexName: string = INDEX_CONFIG.name): Promise<void> {\n  const client = getPineconeClient();\n  \n  console.log(`⚠️  Deleting index: \"${indexName}\"`);\n  \n  // Safety: Require confirmation\n  if (process.env.CONFIRM_DELETE !== 'true') {\n    throw new Error(\n      'Cannot delete index without CONFIRM_DELETE=true env var.\\n' +\n      'This is a safety measure. Set env var if you really want to delete.'\n    );\n  }\n  \n  try {\n    await client.deleteIndex(indexName);\n    console.log(`✓ Index deleted`);\n  } catch (error) {\n    if (error instanceof Error && error.message.includes('NOT_FOUND')) {\n      console.log(`Index not found (already deleted)`);\n      return;\n    }\n    throw error;\n  }\n}\n```\n\n### Step 3: Index Wrapper for Type Safety

```typescript\n// src/services/index-client.ts\nimport { getPineconeClient } from '../adapters/pinecone';\nimport type { Index } from '@pinecone-database/pinecone';\n\nconst INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rag-documents';\n\n/**\n * Get typed index client\n * All upsert/query operations use this\n */\nexport function getIndexClient(): Index {\n  const client = getPineconeClient();\n  return client.Index(INDEX_NAME);\n}\n\n/**\n * Vector metadata type\n * All vectors stored in Pinecone should have this shape\n */\nexport interface VectorMetadata {\n  text: string;           // Original text content\n  documentId: string;     // Source document\n  chunkIndex: number;     // Chunk number within document\n  source?: string;        // Optional: where it came from\n  timestamp?: number;     // Optional: when it was added\n}\n\n/**\n * Upsert vector with metadata\n * \n * Note: This is a wrapper. Actual upsert logic is in Task 03\n */\nexport interface UpsertVector {\n  id: string;                          // Unique ID\n  values: number[];                    // 1536-dimensional embedding\n  metadata?: VectorMetadata;           // Document metadata\n}\n```\n\n---\n\n## Testing\n\n### Test 1: Create and connect to index\n\n```bash\n# Set up environment\nexport PINECONE_API_KEY=\"your-api-key-here\"\nexport PINECONE_ENVIRONMENT=\"us-east-1-aws\"\nexport PINECONE_INDEX_NAME=\"test-index\"\n\n# Run test\ncat > test-index.ts << 'EOF'\nimport { getOrCreateIndex, checkIndexHealth } from './src/services/index';\n\nasync function test() {\n  try {\n    console.log('Testing index creation...');\n    const index = await getOrCreateIndex();\n    \n    console.log('Index details:');\n    console.log(`  Name: ${index.name}`);\n    console.log(`  Dimension: ${index.dimension}`);\n    console.log(`  Metric: ${index.metric}`);\n    console.log(`  Status: ${index.status?.state}`);\n    \n    console.log('\\nIndex health check...');\n    const health = await checkIndexHealth();\n    console.log(`  Vectors: ${health.totalVectors}`);\n    console.log(`  Size: ${health.totalSize}`);\n    console.log('\\n✅ Test passed!');\n  } catch (error) {\n    console.error('❌ Test failed:', error);\n    process.exit(1);\n  }\n}\n\ntest();\nEOF\n\nnpx ts-node test-index.ts\n\n# Expected output:\n# Testing index creation...\n# Index details:\n#   Name: test-index\n#   Dimension: 1536\n#   Metric: cosine\n#   Status: Ready\n#\n# Index health check...\n#   Vectors: 0\n#   Size: 0\n#\n# ✅ Test passed!\n```\n\n### Test 2: Verify index is accessible\n\n```bash\n# Quick connectivity test\ncurl -X POST https://api.pinecone.io/indexes \\\n  -H \"Api-Key: $PINECONE_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  2>/dev/null | jq '.indexes[] | select(.name == \"test-index\")'\n\n# Expected: Shows index details in JSON\n```\n\n### Test 3: Multiple index operations\n\n```typescript\n// Sequential operations test\nasync function testOperations() {\n  const { getIndexStats, getOrCreateIndex } = await import('./src/services/index');\n  \n  // Create\n  const index1 = await getOrCreateIndex();\n  console.log(`✓ Created: ${index1.name}`);\n  \n  // Verify exists\n  const index2 = await getOrCreateIndex();\n  console.log(`✓ Verified idempotent: ${index2.name === index1.name}`);\n  \n  // Get stats\n  const stats = await getIndexStats();\n  console.log(`✓ Stats retrieved: ${stats.totalVectors} vectors`);\n}\n```\n\n**Success criteria:**\n- ✅ Index created successfully\n- ✅ Status shows \"Ready\"\n- ✅ Can describe index stats\n- ✅ Dimension is 1536\n- ✅ Metric is \"cosine\"\n- ✅ Multiple calls are idempotent (don't error on 2nd run)\n\n---\n\n## Vector Database Fundamentals\n\n### What is a Vector Database?\n\n**Simple definition:** A database optimized for storing and searching numerical vectors (lists of numbers).\n\n```\nTraditional SQL Database:\n  Stores: Rows of data (names, dates, etc.)\n  Indexes: B-trees for sorted values\n  Search: \"Find rows where price > 100\"\n\nVector Database:\n  Stores: Vectors (1536 numbers)\n  Indexes: HNSW/IVF for similarity\n  Search: \"Find vectors similar to [0.1, -0.2, ...]\" \n```\n\n### How HNSW Indexing Works\n\n```\nWithout index (brute force):\n  Query: [0.1, -0.2, 0.3, ...]\n         ↓ Calculate similarity with EVERY vector\n  [0.11, -0.19, ...] ← Yes, similar\n  [0.8, 0.5, ...]    ← No, different\n  [0.12, -0.21, ...] ← Yes, similar\n  ← Linear time O(n)\n\nWith HNSW index (hierarchical navigation):\n  Query: [0.1, -0.2, 0.3, ...]\n         ↓ Start at random high-level node\n  [0.8, 0.5, ...] ← Wrong direction\n         ↓ Navigate to closer node\n  [0.11, -0.19, ...] ← Getting closer\n         ↓ Move down hierarchy\n  [0.12, -0.21, ...] ← Found similar!\n  ← Logarithmic time O(log n)\n\nResult: 1M documents, 100ms search (vs 100+ seconds without index)\n```\n\n### Metric Types: cosine vs euclidean vs dotproduct\n\n```\nCosine Distance (RECOMMENDED for embeddings):\n  Measures: Angle between vectors\n  Formula: 1 - (A·B) / (|A| × |B|)\n  Range: 0 (identical) to 2 (opposite)\n  Use: Semantic similarity (embeddings are normalized)\n  \nEuclidean Distance:\n  Measures: Straight-line distance\n  Formula: √(Σ(a - b)²)\n  Range: 0 (identical) to ∞\n  Use: Spatial distance (when magnitude matters)\n  \nDot Product:\n  Measures: Vector projection\n  Formula: Σ(a × b)\n  Range: -∞ to +∞\n  Use: When vectors are pre-normalized\n\n→ For embeddings, use cosine (ignores magnitude, measures meaning)\n```\n\n---\n\n## Cost Analysis\n\n### Pinecone Pricing\n\n```\nFREE TIER:\n  - 1 index\n  - 100,000 vectors (1536 dimensions)\n  - Serverless compute\n  - Cost: $0\n\nPAID TIERS:\n  Starter ($0.10/month minimum):\n    - 100K-10M vectors\n    - Serverless architecture\n    - Automatic scaling\n    \n  Standard ($0.30/month + usage):\n    - Pod-based (dedicated capacity)\n    - More control\n    - Better for high throughput\n\nUSAGE COSTS:\n  Query: ~$0.0000005 per query\n  Upsert: ~$0.0000001 per vector\n  Storage: Included in plan\n```\n\n### Cost Examples\n\n```\n10K vectors (free tier):\n  Storage: ~0 cost\n  100 queries/month: ~$0\n  1K uperts/month: ~$0\n  → Essentially free\n\n1M vectors (standard):\n  Storage: ~$5-10/month\n  10K queries/month: ~$0.005\n  10K uperts/month: ~$0.001\n  → ~$50-100/month\n\n100M vectors (enterprise):\n  Storage: ~$50-100/month\n  1M queries/month: ~$0.5\n  1M uperts/month: ~$0.1\n  → ~$500-1000/month\n```\n\n---\n\n## Common Patterns\n\n### Pattern 1: Index management with initialization\n\n```typescript\nlet indexPromise: Promise<Index> | null = null;\n\nexport async function initializeIndex(): Promise<Index> {\n  if (!indexPromise) {\n    indexPromise = getOrCreateIndex().then(() => getIndexClient());\n  }\n  return indexPromise;\n}\n\n// Usage\nconst index = await initializeIndex();\n// Subsequent calls reuse cached promise\n```\n\n### Pattern 2: Health check with retries\n\n```typescript\nexport async function checkIndexHealthWithRetry(\n  maxRetries: number = 3,\n  delayMs: number = 1000\n): Promise<boolean> {\n  let lastError: Error | null = null;\n  \n  for (let attempt = 1; attempt <= maxRetries; attempt++) {\n    try {\n      const health = await checkIndexHealth();\n      return health.healthy;\n    } catch (error) {\n      lastError = error as Error;\n      \n      if (attempt < maxRetries) {\n        console.log(`Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);\n        await new Promise(resolve => setTimeout(resolve, delayMs));\n      }\n    }\n  }\n  \n  throw new Error(\n    `Health check failed after ${maxRetries} attempts: ${lastError?.message}`\n  );\n}\n```\n\n### Pattern 3: Batch index operations\n\n```typescript\nexport async function batchUpsert(\n  vectors: UpsertVector[],\n  batchSize: number = 100\n): Promise<string[]> {\n  const index = getIndexClient();\n  const upsertedIds: string[] = [];\n  \n  for (let i = 0; i < vectors.length; i += batchSize) {\n    const batch = vectors.slice(i, i + batchSize);\n    \n    const ids = await index.upsert(batch);\n    upsertedIds.push(...ids);\n    \n    console.log(`Upserted ${upsertedIds.length}/${vectors.length}`);\n  }\n  \n  return upsertedIds;\n}\n```\n\n---\n\n## Error Handling Reference\n\n| Error | Cause | Solution | Retry? |\n|-------|-------|----------|--------|\n| \"PINECONE_API_KEY not set\" | Missing env var | Add to .env | No |\n| \"UNAUTHENTICATED\" | Invalid API key | Check Pinecone console | No |\n| \"already exists\" | Index name taken | Use different name | No |\n| \"quota exceeded\" | Free tier full | Upgrade plan | No |\n| \"NOT_FOUND\" | Index doesn't exist | Create it first | No |\n| \"UNAVAILABLE\" | Service down | Wait and retry | Yes (30s) |\n| \"INVALID_ARGUMENT\" | Bad dimension | Use 1536 for embeddings | No |\n| Timeout | Request slow | Retry with backoff | Yes |\n\n---\n\n## Performance Optimization\n\n### Latency\n\n```\nTypical latency (1M vectors):\n- Query: 50-150ms\n- Upsert: 100-500ms\n\nOptimization:\n- Use batch upsert (not single)\n- Reduce metadata size\n- Use serverless (auto-scaling)\n```\n\n### Throughput\n\n```\nMaximum throughput:\n- Queries: 100-1000 QPS (depends on pod)\n- Uperts: Similar to queries\n\nScaling:\n- Free tier: ~10 concurrent requests\n- Starter: ~100 concurrent\n- Standard: ~1000+ concurrent\n\nFor higher: Use connection pooling\n```\n\n---\n\n## Constraints\n\n- Single index per subscription (free tier)\n- 1536 dimensions (for OpenAI embeddings)\n- Maximum metadata size: 40KB per vector\n- Index creation: 1-2 minutes\n- No direct SQL access (API only)\n\n---\n\n## Troubleshooting\n\n### \"PINECONE_API_KEY not set\"\n\n```\n❌ Problem:\n  Error: PINECONE_API_KEY environment variable not set\n\n✅ Solution:\n  1. Go to https://app.pinecone.io → API Keys\n  2. Copy your API key\n  3. Create .env file in /functions\n  4. Add: PINECONE_API_KEY=pcsk_...\n  5. Restart dev server\n```\n\n### \"UNAUTHENTICATED\"\n\n```\n❌ Problem:\n  Error: UNAUTHENTICATED - Authentication failed\n\n✅ Solution:\n  1. Verify API key format (starts with pcsk_)\n  2. Try regenerating key in Pinecone console\n  3. Check .env file has no extra spaces\n  4. Restart application\n```\n\n### \"already exists\"\n\n```\n❌ Problem:\n  Error: Index with name 'rag-documents' already exists\n\n✅ Solution:\n  Option 1: Change PINECONE_INDEX_NAME env var\n  Option 2: Delete existing index (be careful!)\n         Set: CONFIRM_DELETE=true\n         Run: await deleteIndex()\n```\n\n### \"quota exceeded\"\n\n```\n❌ Problem:\n  Error: Quota exceeded. Cannot create more indexes.\n\n✅ Solutions:\n  Free tier: Delete existing index, create new one\n  Paid tier: Upgrade plan at https://app.pinecone.io/billing\n```\n\n---\n\n## Next Steps\n\n**After this task:**\n1. Task 03: Upsert embeddings into this index\n2. Task 04: Query the index for similarity search\n3. Task 05: Use search in RAG pipeline\n\n**To deepen understanding:**\n- Read HNSW paper (Malkov & Yashunin)\n- Explore Pinecone docs: https://docs.pinecone.io\n- Try different pod types and replicas\n- Monitor index metrics in Pinecone console\n\n---\n\n## Tutorial Trigger\n\n- **pinecone.md** → Fill \"Implementation\" section with index management patterns\n\nTutorial focus:\n- What = Vector databases: why they exist, how they work\n- Why = Semantic search at scale requires indexing\n- How = Pinecone setup, index configuration, lifecycle\n- Gotchas = Quota limits, dimension mismatches, region selection\n- Trade-offs = Cost vs storage, performance vs complexity, free vs paid\n
