# Task 03 — Upsert Data [ENHANCED]

## Goal

Load documents from various sources, embed them, and upsert vectors into Pinecone index, understanding how to populate a vector database.

---

## Learning Outcomes

After completing this task, you'll understand:
- **Data loading patterns** — JSON, CSV, API sources with error handling
- **Integration with embeddings** — Connecting Task 01 output to Pinecone
- **Batch processing** — Efficiently upsert 1000s of vectors
- **Metadata extraction** — Preserve document context during chunking
- **Progress tracking** — Monitor upsertion with metrics
- **Error recovery** — Handle partial failures gracefully
- **Cost estimation** — Calculate embedding + storage costs before execution
- **Deduplication** — Avoid upserting same document twice

---

## Requirements

**Input:**
- Documents (JSON file, CSV, API endpoint, or plain text)
- Each document has: id, text, optional metadata

**Output:**
- All documents embedded (1536-dimensional vectors)
- All vectors upserted to Pinecone index
- Metadata preserved for retrieval context

**Process:**
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

```
You have:
- Documents with meaning (natural language)
- Vector database (stores numbers)
- Embedding model (converts text → numbers)

Challenge: Reliably move documents → vectors → database

Traditional approach (naive):
1. Load all documents into memory
2. Convert each to embedding (one at a time)
3. Insert one by one to database
4. Hope nothing fails

Failures:
- API rate limits (429 error) → Stop halfway
- Memory overflow (10K docs) → Crash
- Network timeout → Lose progress
- Metadata missing → Can't trace results
- Cost explodes → $100+ for large datasets

Result: Fragile, expensive, slow
```

### The Solution: Robust Batch Upsertion

```
Better approach:
1. Load documents in batches
2. Embed in parallel with rate limiting
3. Group into batches for Pinecone
4. Upsert with deduplication
5. Track progress → Resume from last batch
6. Verify completeness
7. Report costs and metrics

Benefits:
✅ Handles 100K+ documents
✅ Resume from failures (checkpoint)
✅ Cost tracking (estimate before running)
✅ Progress visibility
✅ Metadata preserved
```

---

## Implementation

**File:** `/src/services/upsert.ts`

**Core Functions:**
```typescript
export interface Document {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

export async function upsertDocuments(
  documents: Document[],
  options?: UpsertOptions
): Promise<UpsertResult>
```

---

## Implementation Guide

### Step 1: Document Loading

```typescript
// src/services/document-loader.ts
import fs from 'fs';\nimport path from 'path';\n\nexport interface Document {\n  id: string;\n  text: string;\n  metadata?: Record<string, any>;\n}\n\n/**\n * Load documents from JSON file\n * \n * File format:\n * [\n *   {\n *     \"id\": \"doc-1\",\n *     \"text\": \"Document content here...\",\n *     \"metadata\": { \"source\": \"manual\", \"tags\": [\"ai\"] }\n *   },\n *   ...\n * ]\n */\nexport async function loadDocumentsFromJSON(\n  filePath: string\n): Promise<Document[]> {\n  try {\n    const content = fs.readFileSync(filePath, 'utf-8');\n    const parsed = JSON.parse(content);\n    \n    if (!Array.isArray(parsed)) {\n      throw new Error('Root must be an array of documents');\n    }\n    \n    const validated: Document[] = parsed.map((doc, index) => {\n      if (!doc.id) {\n        throw new Error(`Document at index ${index} missing required 'id'`);\n      }\n      \n      if (!doc.text || typeof doc.text !== 'string') {\n        throw new Error(\n          `Document ${doc.id} has invalid 'text' field (must be string)`\n        );\n      }\n      \n      return {\n        id: String(doc.id),\n        text: doc.text.trim(),\n        metadata: doc.metadata || {},\n      };\n    });\n    \n    return validated;\n  } catch (error) {\n    if (error instanceof Error) {\n      throw new Error(\n        `Failed to load documents from ${filePath}: ${error.message}`\n      );\n    }\n    throw error;\n  }\n}\n\n/**\n * Load documents from CSV file\n * \n * CSV format (first row is headers):\n * id,text,source\n * doc-1,\"Document text here\",wikipedia\n * doc-2,\"Another document\",article\n */\nexport async function loadDocumentsFromCSV(\n  filePath: string,\n  textColumn: string = 'text'\n): Promise<Document[]> {\n  // Using simple CSV parsing (could use csv-parse library for production)\n  const content = fs.readFileSync(filePath, 'utf-8');\n  const lines = content.split('\\n').filter(l => l.trim());\n  \n  if (lines.length < 2) {\n    throw new Error('CSV must have header row + at least 1 data row');\n  }\n  \n  const headers = lines[0].split(',').map(h => h.trim());\n  const idIndex = headers.indexOf('id');\n  const textIndex = headers.indexOf(textColumn);\n  \n  if (idIndex === -1 || textIndex === -1) {\n    throw new Error(\n      `CSV must have 'id' and '${textColumn}' columns. ` +\n      `Found: ${headers.join(', ')}`\n    );\n  }\n  \n  const documents: Document[] = lines.slice(1).map((line, rowIndex) => {\n    const values = line.split(',');\n    const id = values[idIndex]?.trim();\n    const text = values[textIndex]?.trim();\n    \n    if (!id || !text) {\n      throw new Error(\n        `Row ${rowIndex + 2} missing required 'id' or '${textColumn}'`\n      );\n    }\n    \n    const metadata: Record<string, any> = {};\n    headers.forEach((header, index) => {\n      if (header !== 'id' && header !== textColumn) {\n        metadata[header] = values[index]?.trim() || null;\n      }\n    });\n    \n    return { id, text, metadata };\n  });\n  \n  return documents;\n}\n\n/**\n * Load documents from API endpoint\n */\nexport async function loadDocumentsFromAPI(\n  url: string,\n  authToken?: string\n): Promise<Document[]> {\n  const headers: HeadersInit = {\n    'Content-Type': 'application/json',\n  };\n  \n  if (authToken) {\n    headers['Authorization'] = `Bearer ${authToken}`;\n  }\n  \n  const response = await fetch(url, { headers });\n  \n  if (!response.ok) {\n    throw new Error(\n      `API request failed: ${response.status} ${response.statusText}`\n    );\n  }\n  \n  const data = await response.json();\n  \n  if (!Array.isArray(data)) {\n    throw new Error('API response must be an array of documents');\n  }\n  \n  return data as Document[];\n}\n```\n\n### Step 2: Embedding Integration\n\n```typescript\n// src/services/upsert.ts (part 1)\nimport { createEmbedding } from './embedding';\nimport { getIndexClient, UpsertVector } from './index-client';\nimport type { Document } from './document-loader';\n\nexport interface UpsertOptions {\n  batchSize?: number;      // Default: 100\n  rateLimitMs?: number;    // Delay between API calls\n  dryRun?: boolean;        // Don't actually upsert\n  resumeFrom?: number;     // Skip first N documents\n}\n\nexport interface UpsertMetrics {\n  documentsLoaded: number;\n  documentsEmbedded: number;\n  vectorsUpserted: number;\n  failedCount: number;\n  totalTime: number;        // milliseconds\n  embeddingCost: number;     // USD\n  storageCost: number;       // USD per month\n}\n\nconst DEFAULT_OPTIONS: Required<UpsertOptions> = {\n  batchSize: 100,\n  rateLimitMs: 100,\n  dryRun: false,\n  resumeFrom: 0,\n};\n\n/**\n * Embed documents and prepare for Pinecone upsert\n */\nasync function embedDocuments(\n  documents: Document[],\n  options: Required<UpsertOptions>\n): Promise<{ vectors: UpsertVector[]; cost: number }> {\n  const vectors: UpsertVector[] = [];\n  let totalCost = 0;\n  \n  console.log(`\\n📝 Embedding ${documents.length} documents...`);\n  \n  for (let i = 0; i < documents.length; i++) {\n    const doc = documents[i];\n    \n    // Skip if resuming\n    if (i < options.resumeFrom) continue;\n    \n    try {\n      // Embed text\n      const embedding = await createEmbedding(doc.text);\n      \n      // Track cost\n      const tokens = Math.ceil(doc.text.length / 4);\n      const cost = tokens * (0.02 / 1_000_000);\n      totalCost += cost;\n      \n      // Create vector\n      vectors.push({\n        id: doc.id,\n        values: embedding,\n        metadata: {\n          text: doc.text.substring(0, 1000),  // Limit metadata size\n          ...doc.metadata,\n        },\n      });\n      \n      // Progress\n      if ((i + 1) % 10 === 0) {\n        console.log(\n          `  [${i + 1}/${documents.length}] ` +\n          `Cost so far: $${totalCost.toFixed(6)}`\n        );\n      }\n      \n      // Rate limiting\n      if (i < documents.length - 1) {\n        await new Promise(resolve =>\n          setTimeout(resolve, options.rateLimitMs)\n        );\n      }\n    } catch (error) {\n      console.warn(`  ⚠️  Failed to embed ${doc.id}: ${error}`);\n      // Continue with next document\n    }\n  }\n  \n  console.log(`  ✓ Embedded ${vectors.length}/${documents.length}`);\n  console.log(`  Estimated cost: $${totalCost.toFixed(6)}`);\n  \n  return { vectors, cost: totalCost };\n}\n```\n\n### Step 3: Upsert to Pinecone\n\n```typescript\n// src/services/upsert.ts (part 2)\n\n/**\n * Upsert vectors to Pinecone in batches\n */\nasync function upsertBatch(\n  vectors: UpsertVector[],\n  batchSize: number = 100\n): Promise<{ upsertedCount: number; failedIds: string[] }> {\n  const index = getIndexClient();\n  let upsertedCount = 0;\n  const failedIds: string[] = [];\n  \n  console.log(`\\n⬆️  Upserting ${vectors.length} vectors...`);\n  \n  for (let i = 0; i < vectors.length; i += batchSize) {\n    const batch = vectors.slice(i, i + batchSize);\n    \n    try {\n      const result = await index.upsert(batch);\n      upsertedCount += result.length;\n      \n      console.log(\n        `  [${Math.min(i + batchSize, vectors.length)}/${vectors.length}] ` +\n        `Upserted: ${result.length}`\n      );\n    } catch (error) {\n      // Track failed vectors\n      batch.forEach(v => failedIds.push(v.id));\n      console.warn(`  ⚠️  Batch upsert failed: ${error}`);\n    }\n  }\n  \n  console.log(`  ✓ Completed: ${upsertedCount} upserted, ` +\n              `${failedIds.length} failed`);\n  \n  return { upsertedCount, failedIds };\n}\n\n/**\n * Complete upsert pipeline\n */\nexport async function upsertDocuments(\n  documents: Document[],\n  options: UpsertOptions = {}\n): Promise<UpsertMetrics> {\n  const opts = { ...DEFAULT_OPTIONS, ...options };\n  const startTime = Date.now();\n  \n  console.log(`\\n🚀 Upsert Pipeline Started`);\n  console.log(`   Documents: ${documents.length}`);\n  console.log(`   Batch size: ${opts.batchSize}`);\n  console.log(`   Rate limit: ${opts.rateLimitMs}ms between embeddings`);\n  \n  // Validate\n  if (documents.length === 0) {\n    throw new Error('No documents to upsert');\n  }\n  \n  // Step 1: Embed\n  const { vectors, cost: embeddingCost } = await embedDocuments(\n    documents,\n    opts\n  );\n  \n  if (vectors.length === 0) {\n    throw new Error('No vectors created (all embeddings failed)');\n  }\n  \n  // Step 2: Upsert\n  const { upsertedCount, failedIds } = opts.dryRun\n    ? { upsertedCount: vectors.length, failedIds: [] }\n    : await upsertBatch(vectors, opts.batchSize);\n  \n  // Step 3: Estimate storage cost\n  const vectorsPerMonth = (upsertedCount / 1000) * (0.000025); // ~$0.025 per 1K vectors/month\n  const storageCost = vectorsPerMonth;\n  \n  const duration = Date.now() - startTime;\n  \n  console.log(`\\n✅ Upsert Complete`);\n  console.log(`   Time: ${(duration / 1000).toFixed(1)}s`);\n  console.log(`   Documents loaded: ${documents.length}`);\n  console.log(`   Vectors upserted: ${upsertedCount}`);\n  console.log(`   Failed: ${failedIds.length}`);\n  console.log(`   Embedding cost: $${embeddingCost.toFixed(6)}`);\n  console.log(`   Storage cost/month: $${storageCost.toFixed(6)}`);\n  \n  if (failedIds.length > 0) {\n    console.warn(`   Failed IDs: ${failedIds.join(', ')}`);\n  }\n  \n  return {\n    documentsLoaded: documents.length,\n    documentsEmbedded: vectors.length,\n    vectorsUpserted: upsertedCount,\n    failedCount: failedIds.length,\n    totalTime: duration,\n    embeddingCost,\n    storageCost,\n  };\n}\n```\n\n### Step 4: CLI Integration\n\n```typescript\n// src/commands/upsert.ts\nimport { loadDocumentsFromJSON } from '../services/document-loader';\nimport { upsertDocuments } from '../services/upsert';\n\n/**\n * CLI: npx ts-node src/commands/upsert.ts <file.json>\n */\nasync function main() {\n  const filePath = process.argv[2];\n  \n  if (!filePath) {\n    console.log('Usage: npx ts-node src/commands/upsert.ts <documents.json>');\n    console.log('\\nExample documents.json:');\n    console.log(JSON.stringify([\n      {\n        id: 'doc-1',\n        text: 'Machine learning is a subset of AI...',\n        metadata: { source: 'wiki', topic: 'ai' },\n      },\n      {\n        id: 'doc-2',\n        text: 'Embeddings are numerical representations...',\n        metadata: { source: 'article', topic: 'embeddings' },\n      },\n    ], null, 2));\n    process.exit(1);\n  }\n  \n  try {\n    console.log(`Loading documents from ${filePath}...`);\n    const documents = await loadDocumentsFromJSON(filePath);\n    \n    console.log(`Loaded ${documents.length} documents`);\n    console.log('\\nStarting upsert process...');\n    \n    const metrics = await upsertDocuments(documents, {\n      batchSize: 50,\n      rateLimitMs: 200, // Slower for API rate limiting\n    });\n    \n    console.log('\\n📊 Metrics:');\n    console.log(`  Loaded: ${metrics.documentsLoaded}`);\n    console.log(`  Embedded: ${metrics.documentsEmbedded}`);\n    console.log(`  Upserted: ${metrics.vectorsUpserted}`);\n    console.log(`  Failed: ${metrics.failedCount}`);\n    console.log(`  Duration: ${(metrics.totalTime / 1000).toFixed(1)}s`);\n    console.log(`  Embedding cost: $${metrics.embeddingCost.toFixed(6)}`);\n    console.log(`  Monthly storage: $${metrics.storageCost.toFixed(6)}`);\n  } catch (error) {\n    console.error('Upsert failed:', error);\n    process.exit(1);\n  }\n}\n\nmain();\n```\n\n---\n\n## Testing\n\n### Test 1: Load and upsert sample documents\n\n```bash\n# Create sample documents\ncat > sample-docs.json << 'EOF'\n[\n  {\n    \"id\": \"doc-1\",\n    \"text\": \"Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.\",\n    \"metadata\": { \"source\": \"ai-intro\", \"difficulty\": \"beginner\" }\n  },\n  {\n    \"id\": \"doc-2\",\n    \"text\": \"Embeddings are numerical representations of text that capture semantic meaning. They allow us to perform similarity search on documents.\",\n    \"metadata\": { \"source\": \"embeddings-guide\", \"difficulty\": \"intermediate\" }\n  },\n  {\n    \"id\": \"doc-3\",\n    \"text\": \"Vector databases like Pinecone optimize storage and retrieval of embeddings at scale. They use advanced indexing techniques like HNSW.\",\n    \"metadata\": { \"source\": \"vector-db\", \"difficulty\": \"intermediate\" }\n  }\n]\nEOF\n\n# Run upsert\nnpx ts-node src/commands/upsert.ts sample-docs.json\n\n# Expected output:\n# Loading documents from sample-docs.json...\n# Loaded 3 documents\n#\n# Starting upsert process...\n# 🚀 Upsert Pipeline Started\n#    Documents: 3\n#    Batch size: 100\n#    Rate limit: 100ms between embeddings\n#\n# 📝 Embedding 3 documents...\n#   [3/3] Cost so far: $0.000001\n#   ✓ Embedded 3/3\n#   Estimated cost: $0.000001\n#\n# ⬆️  Upserting 3 vectors...\n#   [3/3] Upserted: 3\n#   ✓ Completed: 3 upserted, 0 failed\n#\n# ✅ Upsert Complete\n#    Time: 1.5s\n#    Documents loaded: 3\n#    Vectors upserted: 3\n#    Failed: 0\n#    Embedding cost: $0.000001\n#    Storage cost/month: $0.000001\n```\n\n### Test 2: Verify vectors in Pinecone\n\n```typescript\n// Verify upsertion worked\nimport { getIndexClient } from './src/services/index-client';\n\nasync function verify() {\n  const index = getIndexClient();\n  const stats = await index.describeIndexStats();\n  \n  console.log(`Total vectors: ${stats.totalVectorCount}`);\n  console.log(`Should include our 3 documents`);\n}\n\nverify();\n```\n\n### Test 3: Error scenarios\n\n```bash\n# Test with invalid documents\ncat > invalid-docs.json << 'EOF'\n[\n  { \"text\": \"Missing id field\" },\n  { \"id\": \"doc-2\", \"text\": \"Valid\" }\n]\nEOF\n\nnpx ts-node src/commands/upsert.ts invalid-docs.json\n# Expected: Error \"Document at index 0 missing required 'id'\"\n\n# Test with empty documents\ncat > empty-docs.json << 'EOF'\n[]\nEOF\n\nnpx ts-node src/commands/upsert.ts empty-docs.json\n# Expected: Error \"No documents to upsert\"\n```\n\n**Success criteria:**\n- ✅ Documents loaded correctly\n- ✅ All documents embedded (3 embeddings created)\n- ✅ All vectors upserted to Pinecone\n- ✅ Metrics reported accurately\n- ✅ Pinecone stats show total_vectors increased\n- ✅ Metadata preserved in vectors\n- ✅ Errors handled gracefully\n\n---\n\n## Data Pipeline Fundamentals\n\n### ETL: Extract, Transform, Load\n\n```\nExtract: Load documents from source\n  ↓ Get raw documents\n  Format: JSON, CSV, API, database\n  \nTransform: Prepare documents for embedding\n  ↓ Validate structure\n  ↓ Clean text (remove special chars)\n  ↓ Split into chunks\n  ↓ Add metadata\n  \nLoad: Embed and upsert\n  ↓ Create embeddings\n  ↓ Batch upsert to Pinecone\n  ↓ Verify success\n  \nResult: Documents → Vectors → Database\n```\n\n### Batch Processing Why\n\n```\nProcessing 1000 documents:\n\nOne-at-a-time (slow):\n  Load doc 1 → Embed 1 → Upsert 1 → Load doc 2 → ...\n  Time: 1000 embeds × 100ms = 100 seconds\n  \nBatched (fast):\n  Load all 1000 → Embed in parallel (10 at a time) → Batch upsert\n  Time: 100 batches × 100ms = 10 seconds\n  → 10x faster!\n  \nBenefit: Batch upsert is optimized for multiple vectors at once\n```\n\n---\n\n## Cost Analysis\n\n### Per-Document Costs\n\n```\nEmbedding (OpenAI):\n  ~100 chars = 25 tokens\n  Cost: 25 * ($0.02 / 1M) = $0.0000005\n  \nStorage (Pinecone):\n  1 vector = ~8KB\n  1000 vectors = ~8MB\n  Cost: $0.025 per 1K vectors per month\n  \nTotal for 1000 documents:\n  Embedding: 1000 × $0.0000005 = $0.0005\n  Storage: $0.025\n  → ~$0.03 per 1000 documents\n```\n\n### Scale Examples\n\n```\n100 documents:\n  Embedding: $0.00005\n  Storage: $0.0025\n  Total: ~$0.003\n  \n10,000 documents:\n  Embedding: $0.005\n  Storage: $0.25\n  Total: ~$0.26 upfront (very cheap)\n  \n100,000 documents (1M tokens):\n  Embedding: $0.05 (at free tier rates)\n  Storage: $2.50/month\n  Total: ~$2.55 upfront\n```\n\n---\n\n## Common Patterns\n\n### Pattern 1: Incremental upsert (don't re-embed everything)\n\n```typescript\nexport async function incrementalUpsert(\n  newDocuments: Document[],\n  alreadyUpsetIds: Set<string>\n): Promise<UpsertMetrics> {\n  // Filter out already upserted\n  const toUpsert = newDocuments.filter(\n    doc => !alreadyUpsetIds.has(doc.id)\n  );\n  \n  console.log(`Found ${toUpsert.length} new documents to upsert`);\n  \n  return upsertDocuments(toUpsert);\n}\n```\n\n### Pattern 2: Upsert with checkpoints (resume from failures)\n\n```typescript\nexport async function upsertWithCheckpoints(\n  documents: Document[],\n  checkpointFile: string\n): Promise<UpsertMetrics> {\n  let startIndex = 0;\n  \n  if (fs.existsSync(checkpointFile)) {\n    const checkpoint = JSON.parse(\n      fs.readFileSync(checkpointFile, 'utf-8')\n    );\n    startIndex = checkpoint.lastIndex;\n    console.log(`Resuming from document ${startIndex}`);\n  }\n  \n  const metrics = await upsertDocuments(documents, {\n    resumeFrom: startIndex,\n  });\n  \n  // Save checkpoint\n  fs.writeFileSync(\n    checkpointFile,\n    JSON.stringify({ lastIndex: documents.length, ...metrics })\n  );\n  \n  return metrics;\n}\n```\n\n---\n\n## Error Handling Reference\n\n| Error | Cause | Solution |\n|-------|-------|----------|\n| \"Document missing id\" | Bad input | Validate JSON structure |\n| \"No documents to upsert\" | Empty input | Provide documents |\n| \"429 Too Many Requests\" | Rate limited | Increase rateLimitMs |\n| \"Invalid API key\" | Auth failed | Check OPENAI_API_KEY |\n| \"Index not found\" | No Pinecone index | Create index first |\n| \"Upsert batch failed\" | Pinecone error | Check quota, retry |\n\n---\n\n## Performance Optimization\n\n### Embeddings Throughput\n\n```\nBaseline: 100ms per embedding\n\nOptimizations:\n- Decrease rateLimitMs (but watch rate limits)\n- Parallel embedding batches\n- Shorter documents → faster embedding\n\nMax safe rate:\n- Free tier: 20 requests/min (3s between)\n- Paid tier: Higher (check your tier)\n```\n\n### Upsert Throughput\n\n```\nBatch size effects:\n- Small (10): More network calls\n- Medium (100): Optimal\n- Large (1000): Better throughput, more memory\n\nRecommendation: Batch size = 100\n```\n\n---\n\n## Constraints\n\n- Text documents only (no images)\n- Max document size: 100K characters (can chunk)\n- Metadata: 40KB per vector\n- Metadata fields must be: string, number, boolean, list\n\n---\n\n## Troubleshooting\n\n### \"Document missing id\"\n\n```\n❌ Problem:\n  Error: Document at index 0 missing required 'id'\n\n✅ Solution:\n  1. Check input JSON has 'id' field for each document\n  2. Format: { \"id\": \"string\", \"text\": \"string\" }\n  3. All documents need id and text\n```\n\n### \"429 Too Many Requests\"\n\n```\n❌ Problem:\n  Error: Rate limited by OpenAI\n\n✅ Solution:\n  Option 1: Increase rateLimitMs (default 100ms → 200ms)\n  Option 2: Upgrade OpenAI plan\n  Option 3: Batch smaller documents\n  \n  Code:\n  await upsertDocuments(docs, { rateLimitMs: 500 })\n```\n\n### \"Index not found\"\n\n```\n❌ Problem:\n  Error: Index \"rag-documents\" not found\n\n✅ Solution:\n  1. Create index first: await getOrCreateIndex()\n  2. Check PINECONE_INDEX_NAME env var\n  3. Verify in Pinecone console\n```\n\n---\n\n## Next Steps\n\n**After this task:**\n1. Task 04: Query the index to find similar documents\n2. Task 05: Use queries in RAG pipeline\n3. Task 06: Optimize chunking for better retrieval\n\n**To deepen understanding:**\n- Experiment with different batch sizes\n- Monitor costs for various document sizes\n- Try incremental upsertion pattern\n- Implement checkpoint system for large datasets\n\n---\n\n## Tutorial Trigger\n\n- **system_architecture.md** → Fill \"Data Pipeline\" section with upsert patterns\n\nTutorial focus:\n- What = ETL pipeline: transforming documents to vectors\n- Why = Need robust, scalable way to populate vector database\n- How = Batch processing, error handling, cost tracking\n- Gotchas = Rate limits, metadata size, duplicate handling\n- Trade-offs = Speed vs cost, batch size vs memory, incremental vs full refresh\n
