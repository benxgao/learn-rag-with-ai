# Task 06 — Chunking Strategy [ENHANCED]

## Goal

Master document chunking strategies to optimize retrieval quality and cost, understanding the critical impact of chunk size and overlap on RAG system performance.

---

## Learning Outcomes

After completing this task, you'll understand:
- **Chunking fundamentals** — Why and how to split documents intelligently
- **Strategy trade-offs** — Fixed size vs sliding window vs semantic chunking
- **Quality impact** — How chunks affect retrieval and answer quality
- **Cost implications** — Tokens, embeddings, and storage costs per strategy
- **Evaluation methodology** — Measuring which strategy works best
- **Metadata preservation** — Keeping document context through chunking
- **Real-world patterns** — What works for different document types
- **Optimization techniques** — Fine-tuning chunk size for your data

---

## Requirements

**Input:**
- Documents (text, papers, documentation)
- Document types (short, medium, long-form)
- Quality metrics (what makes a "good" retrieval?)

**Output:**
- Chunks with optimal size, overlap, metadata
- Strategy recommendation for your use case
- Quality metrics showing strategy comparison
- Cost analysis per strategy

**Key parameters:**
- Chunk size (default: 512 tokens)
- Overlap (default: 100 tokens)
- Strategy (fixed, sliding, semantic)

---

## Why Chunking Matters

### The Problem: Wrong Chunk Size = Bad Retrieval

```
Strategy A: Chunks too small (100 tokens)
- Document: "Machine learning is teaching computers..."
- Chunk 1: "Machine learning is teaching"
- Chunk 2: "computers to learn from data"
- Problem: Chunks lack context, can't answer full questions
- Result: Retrieved chunks are useless

Strategy B: Chunks too large (2000 tokens)
- Problem: Entire document as 1 chunk
- Issue: Low precision (retrieves too much noise)
- Example: Question about one topic retrieves irrelevant sections
- Result: LLM drowns in irrelevant text

Strategy C: Chunks just right (512 tokens)
- Problem: Found the sweet spot
- Benefit: Contains enough context for understanding
- Benefit: Focused enough for precision
- Result: Good retrieval quality AND manageable context
```

### The Solution: Strategic Chunking

```
Test different strategies:
1. Fixed-size: Simple, fast, consistent
2. Sliding window: Overlap prevents boundary artifacts
3. Semantic: Chunks based on topic boundaries

Measure retrieval quality:
- MRR (Mean Reciprocal Rank)
- nDCG (Normalized Discounted Cumulative Gain)

Choose strategy that maximizes quality within cost budget
```

---

## Chunking Strategies

### Strategy 1: Fixed-Size Chunking

**Definition:** Split documents into chunks of exact size, no overlap

```
Document:
"Machine learning is a subset of AI that enables computers to learn from data.
Deep learning uses neural networks. Transformers power modern NLP."

Fixed chunks (30 chars, no overlap):
┌─────────────────────────────────┐
│ Machine learning is a sub       │
├─────────────────────────────────┤
│ set of AI that enables co       │
├─────────────────────────────────┤
│ mputers to learn from data.     │
└─────────────────────────────────┘

Pros: ✅ Simple, fast, deterministic
Cons: ❌ No context at boundaries, misses structure
```

**Implementation:**
```typescript
function fixedSizeChunks(
  text: string,
  chunkSize: number = 512 // tokens, ~2000 characters
): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  const words = text.split(/\s+/);
  
  for (const word of words) {
    if ((currentChunk + ' ' + word).length > chunkSize * 4) {
      // Approximate: 4 characters per token
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += ' ' + word;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Usage
const chunks = fixedSizeChunks(document, 512);
console.log(`Created ${chunks.length} chunks`);
console.log(`Avg chunk size: ${chunks.reduce((a, c) => a + c.length, 0) / chunks.length} chars`);
```

**Best for:** Homogeneous documents, structured data, initial testing

---

### Strategy 2: Sliding Window Chunking

**Definition:** Fixed-size chunks with overlap to preserve context

```
Document:
"Machine learning is a subset of AI that enables computers to learn from data.
Deep learning uses neural networks. Transformers power modern NLP."

Sliding chunks (30 chars, 10 char overlap):
┌─────────────────────────────────┐
│ Machine learning is a sub       │ ← Chunk 1
│        ↓ (overlap 10 chars)
│        et of AI that enables co │ ← Chunk 2
│                    ↓ (overlap)
│                    mputers to learn │ ← Chunk 3
└─────────────────────────────────┘

Pros: ✅ Context preserved at boundaries
Cons: ❌ More chunks = higher cost
```

**Implementation:**
```typescript
function slidingWindowChunks(
  text: string,
  chunkSize: number = 512, // tokens
  overlap: number = 100     // tokens (20% overlap)
): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  let start = 0;
  const step = chunkSize - overlap;
  
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    
    if (end === words.length) break;
    start += step;
  }
  
  return chunks;
}

// Usage
const chunks = slidingWindowChunks(document, 512, 100);
console.log(`Created ${chunks.length} chunks with 100-token overlap`);
console.log(`Cost multiplier: ${(chunks.length / fixedSizeChunks(document).length).toFixed(2)}x`);
```

**Best for:** Text documents, papers, continuous prose

---

### Strategy 3: Semantic Chunking

**Definition:** Split based on topic/semantic boundaries, not fixed size

```
Document:
"Machine learning is a subset of AI.
[Section 1: Definition]

Deep learning uses neural networks.
[Section 2: Implementation]

Transformers power modern NLP.
[Section 3: Application]"

Semantic chunks (based on sections):
┌─────────────────────────────────┐
│ Machine learning is a subset of AI │ ← Chunk 1 (definition)
├─────────────────────────────────┤
│ Deep learning uses neural networks │ ← Chunk 2 (implementation)
├─────────────────────────────────┤
│ Transformers power modern NLP   │ ← Chunk 3 (application)
└─────────────────────────────────┘

Pros: ✅ Coherent chunks, topically consistent
Cons: ❌ Complex, variable size, needs topic detection
```

**Implementation (simple variant using headers):**
```typescript
function semanticChunksByHeaders(text: string): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const line of lines) {
    // Detect markdown headers or topic breaks
    if (line.match(/^#+\s/) && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += '\n' + line;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Usage
const chunks = semanticChunksByHeaders(document);
console.log(`Created ${chunks.length} semantic chunks`);
```

**Best for:** Structured documents, papers with headers, documentation

---

## Strategy Comparison

### Metrics Table

| Metric | Fixed Size | Sliding Window | Semantic |
|--------|-----------|-----------------|----------|
| Simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Speed | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Context Preservation | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cost Efficiency | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Retrieval Quality | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Implementation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

### Cost Comparison

```
Document: 10,000 tokens

Fixed-size (512 tokens):
- Chunks: 10,000 / 512 = 20 chunks
- Embedding cost: 20 × $0.000002 = $0.00004
- ✅ Cheapest

Sliding window (512, 100 overlap):
- Chunks: ~25 chunks (higher due to overlap)
- Embedding cost: 25 × $0.000002 = $0.00005
- ⚠️ 25% more expensive

Semantic (variable size):
- Chunks: ~15 chunks (depends on structure)
- Embedding cost: 15 × $0.000002 = $0.00003
- ✅ Best cost, assumes good structure
```

### Quality Comparison (Example Results)

```
Retrieval Quality Test (measuring nDCG):

Question: "What is machine learning?"

Fixed-size strategy:
- MRR: 0.75 (75th percentile answer)
- nDCG: 0.82
- Reason: Some chunks incomplete

Sliding window strategy:
- MRR: 0.88 (88th percentile)
- nDCG: 0.89
- Reason: Overlap preserves context

Semantic strategy:
- MRR: 0.92 (92nd percentile)
- nDCG: 0.91
- Reason: Topically coherent chunks
```

---

## Implementation: Testing All Strategies

### Step 1: Create Chunking Service

```typescript
// src/services/chunking.ts

export interface ChunkingStrategy {
  name: string;
  chunkSize: number;
  overlap?: number;
  chunk(text: string): string[];
}

export class FixedSizeStrategy implements ChunkingStrategy {
  name = 'fixed-size';
  
  constructor(
    public chunkSize: number = 512,
  ) {}
  
  chunk(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let current = '';
    
    for (const word of words) {
      if ((current + ' ' + word).length > this.chunkSize * 4) {
        chunks.push(current.trim());
        current = word;
      } else {
        current += ' ' + word;
      }
    }
    
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}

export class SlidingWindowStrategy implements ChunkingStrategy {
  name = 'sliding-window';
  
  constructor(
    public chunkSize: number = 512,
    public overlap: number = 100,
  ) {}
  
  chunk(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    const step = this.chunkSize - this.overlap;
    
    for (let i = 0; i < words.length; i += step) {
      const end = Math.min(i + this.chunkSize, words.length);
      chunks.push(words.slice(i, end).join(' '));
      if (end === words.length) break;
    }
    
    return chunks;
  }
}

// Usage
const strategies: ChunkingStrategy[] = [
  new FixedSizeStrategy(512),
  new SlidingWindowStrategy(512, 100),
];

for (const strategy of strategies) {
  const chunks = strategy.chunk(document);
  console.log(`${strategy.name}: ${chunks.length} chunks`);
}
```

### Step 2: Evaluate Strategies

```typescript
// src/services/chunking-evaluation.ts

export interface ChunkingMetrics {
  strategyName: string;
  chunkCount: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  totalSize: number;
  embeddingCost: number;
  retrievalQuality?: number; // Will fill after testing
}

export function evaluateStrategy(
  strategy: ChunkingStrategy,
  text: string
): ChunkingMetrics {
  const chunks = strategy.chunk(text);
  const sizes = chunks.map(c => c.length);
  const totalSize = sizes.reduce((a, b) => a + b, 0);
  const avgTokens = totalSize / 4; // Rough: 4 chars per token
  const embeddingCost = chunks.length * 0.000002; // $0.02 per 1M tokens
  
  return {
    strategyName: strategy.name,
    chunkCount: chunks.length,
    avgChunkSize: Math.round(totalSize / chunks.length),
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
    totalSize,
    embeddingCost,
  };
}

// Usage
const results = strategies.map(s => evaluateStrategy(s, document));
console.table(results);
```

---

## Testing & Comparison

### Test 1: Basic Chunking

```bash
# Create test document
cat > test-document.txt << 'EOF'
Machine learning is a subset of artificial intelligence that enables
systems to learn and improve from experience. Deep learning, a subfield
of machine learning, uses neural networks with multiple layers.
Transformers represent a breakthrough in neural network architecture.
EOF

# Test each strategy
node -e "
const strategies = [
  { name: 'fixed-512', chunks: fixedSizeChunks(doc, 512) },
  { name: 'sliding-512-100', chunks: slidingWindowChunks(doc, 512, 100) },
];

strategies.forEach(s => {
  console.log(\`\${s.name}: \${s.chunks.length} chunks\`);
});
"
```

### Test 2: Cost Comparison

```typescript
// Create large document
const largeDoc = document.repeat(50); // ~50K tokens

const metrics = strategies.map(s => evaluateStrategy(s, largeDoc));

console.log('\n📊 Cost Comparison:');
metrics.forEach(m => {
  console.log(`${m.strategyName}:`);
  console.log(`  Chunks: ${m.chunkCount}`);
  console.log(`  Cost: $${m.embeddingCost.toFixed(6)}`);
});

// Find cheapest
const cheapest = metrics.reduce((a, b) => 
  a.embeddingCost < b.embeddingCost ? a : b
);
console.log(`\n💰 Cheapest: ${cheapest.strategyName}`);
```

### Test 3: Quality Evaluation

```typescript
// Test with actual retrieval
const testQuestions = [
  'What is machine learning?',
  'How do neural networks work?',
  'Explain transformers',
];

for (const strategy of strategies) {
  console.log(`\n📊 Testing ${strategy.name}:`);
  
  const chunks = strategy.chunk(document);
  
  for (const question of testQuestions) {
    const relevantChunks = findRelevant(chunks, question);
    const quality = evaluateRetrieval(question, relevantChunks);
    
    console.log(`  Q: "${question}"`);
    console.log(`  Relevant chunks: ${relevantChunks.length}`);
    console.log(`  Quality score: ${quality.toFixed(2)}`);
  }
}
```

---

## Real-World Patterns

### Pattern 1: Adaptive Chunk Size

```typescript
function adaptiveChunkSize(documentLength: number): number {
  // Longer documents need smaller chunks for precision
  if (documentLength < 1000) return 256;      // Short: 256 tokens
  if (documentLength < 5000) return 512;      // Medium: 512 tokens
  if (documentLength < 20000) return 768;     // Long: 768 tokens
  return 1024;                                // Very long: 1024 tokens
}

// Usage
const optimalSize = adaptiveChunkSize(document.length);
const chunks = fixedSizeChunks(document, optimalSize);
```

### Pattern 2: Overlap Based on Domain

```typescript
function optimalOverlap(domain: string): number {
  const overlapPercentages = {
    'technical': 0.20,    // 20% overlap (good for coherence)
    'legal': 0.30,        // 30% overlap (preserve exact language)
    'fiction': 0.10,      // 10% overlap (natural breaks exist)
    'default': 0.15,      // 15% overlap (balanced)
  };
  
  return overlapPercentages[domain] || overlapPercentages.default;
}
```

### Pattern 3: Metadata Attachment

```typescript
interface Chunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  documentId: string;
  chunkNumber: number;
}

function chunkWithMetadata(
  text: string,
  documentId: string,
  strategy: ChunkingStrategy
): Chunk[] {
  const chunks = strategy.chunk(text);
  const result: Chunk[] = [];
  let position = 0;
  
  chunks.forEach((chunkText, index) => {
    result.push({
      id: `${documentId}-chunk-${index}`,
      text: chunkText,
      startIndex: position,
      endIndex: position + chunkText.length,
      documentId,
      chunkNumber: index,
    });
    position += chunkText.length + 1; // +1 for space
  });
  
  return result;
}
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Chunks too small" | Small chunk size | Increase to 512+ tokens |
| "Retrieval misses context" | No overlap | Add 10-20% overlap |
| "Cost too high" | Many small chunks | Increase chunk size or use semantic |
| "Chunks are incoherent" | Fixed size cuts mid-topic | Use semantic or sliding window |
| "Some chunks very large" | Variable strategy | Enforce max size limit |

---

## Constraints

- Fixed-size strategy doesn't preserve semantic boundaries
- Sliding window increases cost (more chunks)
- Semantic strategy needs structured documents
- Chunk size affects both cost and quality
- No one-size-fits-all strategy

---

## Optimization Checklist

- [ ] Test 3+ chunk sizes (256, 512, 768, 1024)
- [ ] Measure retrieval quality for each
- [ ] Calculate cost per strategy
- [ ] Benchmark on real questions
- [ ] A/B test in production if possible
- [ ] Document chosen strategy and rationale
- [ ] Set up monitoring for retrieval quality

---

## Next Steps

1. **After this task:** Move to Task 05 (RAG) using your optimal chunking strategy
2. **Quality improvement:** Use Task 07 (Evaluation) to measure impact
3. **Advanced:** Combine with Task 08 (Improve Retrieval) for better results

---

## Tutorial Trigger

- **rag.md** → Add "Chunking Considerations" section

Tutorial focus:
- What = Chunking strategies and their trade-offs
- Why = Chunk quality directly impacts retrieval and answer quality
- How = Implement and evaluate different strategies
- Gotchas = Fixed size too small/large, no overlap = lost context
- Trade-offs = Cost vs quality, complexity vs results
