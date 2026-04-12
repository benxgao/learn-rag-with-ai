# Task 07: Retrieval Evaluation — Learning Guide

## Core Concept

**Evaluation is about measuring how well your retrieval system finds the right information.** Instead of guessing, we use quantitative metrics to understand what's working and what needs improvement.

## Why This Matters

When building a RAG (Retrieval-Augmented Generation) system, retrieval quality directly impacts:

- **Accuracy** — Does the system find correct information?
- **Completeness** — Does it find all relevant information?
- **Speed** — Does it find the right answer quickly?
- **Relevance** — Are results actually useful?

Without measurement, optimization is just guessing.

---

## The Four Evaluation Metrics

### 1. **Precision@K** — "Are my results trustworthy?"

**What it measures**: Of the K results I returned, how many were actually relevant?

$$\text{Precision@K} = \frac{\text{# relevant docs in top K}}{K}$$

**Real example**:

- Query: "What is machine learning?"
- Top 3 results: [doc-1 (ML), doc-2 (Vectors), doc-4 (RAG)]
- Only doc-1 is directly relevant
- **Precision@3 = 1/3 ≈ 0.33 (33%)**

**Why it matters**: High precision means users don't waste time reading irrelevant results. Low precision = lots of noise (hallucination risk in LLMs).

**When it fails**: Query is too broad or embeddings aren't discriminative enough.

---

### 2. **Recall@K** — "Am I finding everything?"

**What it measures**: Of all the relevant documents that exist, how many did I find in the top K?

$$\text{Recall@K} = \frac{\text{# relevant docs in top K}}{\text{total # relevant docs}}$$

**Real example**:

- Query: "Tell me about vector databases"
- Total relevant docs: 4 (doc-2, doc-3, doc-5, doc-7)
- Top 5 results only contained: doc-2, doc-3
- **Recall@5 = 2/4 = 0.50 (50%)**

**Why it matters**: High recall means you're not missing critical information. Low recall = incomplete answers (missing context).

**When it fails**: Chunking strategy is too aggressive or embedding model isn't capturing the right semantics.

---

### 3. **MRR (Mean Reciprocal Rank)** — "How fast do I find the right answer?"

**What it measures**: How quickly do I find the first relevant result?

$$\text{MRR} = \frac{1}{\text{rank of first relevant doc}}$$

**Real examples**:

- First relevant result at position 1: MRR = 1/1 = **1.0** ✓ (Perfect)
- First relevant result at position 3: MRR = 1/3 ≈ **0.33**
- First relevant result at position 5: MRR = 1/5 = **0.2**
- No relevant result found: MRR = **0** ✗

**Why it matters**: Users rarely scroll past the first few results. If the correct answer is at position 5, it might as well be invisible.

**Threshold interpretation**:

- MRR > 0.5: First relevant answer usually in top 2 ✓
- MRR < 0.3: Correct answer buried too deep ✗

**When it fails**: Ranking algorithm doesn't prioritize relevance (needs reranking).

---

### 4. **NDCG (Normalized Discounted Cumulative Gain)** — "Is my ranking quality good overall?"

**What it measures**: Ranking quality where position matters (top results are more important).

$$\text{NDCG} = \frac{\text{DCG}}{\text{IDCG}}$$

Where:

- **DCG** = Actual ranking score: $\sum_{i=1}^{k} \frac{\text{rel}_i}{\log_2(i+1)}$
- **IDCG** = Perfect ranking score (all relevant docs at top)

**Why the discount?** Results at position 1 are worth ~3.3x more than position 5, which are worth ~5.3x more than position 20.

**Real example**:

| Position | Doc   | Relevant? | Formula     | Contribution |
| -------- | ----- | --------- | ----------- | ------------ |
| 1        | doc-1 | ✓ Yes     | 1 / log₂(2) | 1.0          |
| 2        | doc-4 | ✗ No      | 0 / log₂(3) | 0.0          |
| 3        | doc-2 | ✓ Yes     | 1 / log₂(4) | 0.5          |
| 4        | doc-7 | ✗ No      | 0 / log₂(5) | 0.0          |
| 5        | doc-3 | ✓ Yes     | 1 / log₂(6) | 0.43         |

**DCG** = 1.0 + 0 + 0.5 + 0 + 0.43 = **1.93**

If ideal ranking (all 3 relevant docs at top): **IDCG** = 1.0 + 0.5 + 0.43 = **1.93**

**NDCG** = 1.93 / 1.93 = **1.0** ✓ (Perfect!)

**Why it matters**: It's a holistic measure accounting for both relevance and position. NDCG captures "did I put the good stuff first?"

---

## Production Quality Standards

These thresholds define a "passing" retrieval system:

| Metric      | Threshold | Meaning                         |
| ----------- | --------- | ------------------------------- |
| Precision@3 | > **70%** | First 3 results are mostly good |
| Recall@5    | > **80%** | Finding 80% of relevant docs    |
| MRR         | > **0.5** | First relevant result in top 2  |
| NDCG        | > **0.6** | Ranking quality adequate        |

## Test Cases: Seven Real Scenarios

Your evaluation tests these semantic search scenarios:

1. **Direct definition** — "What is machine learning?"
2. **Technology knowledge** — "How do vector databases work?"
3. **Concept learning** — "What are embeddings?"
4. **System understanding** — "Tell me about RAG systems"
5. **Process query** — "How to search semantically?"
6. **Semantic variation** — "AI that learns from examples"
7. **Vector operations** — "Finding similar content with vectors"

These span from simple keyword matches to complex semantic relationships.

---

## Diagnostic Framework: When Things Go Wrong

### Scenario: Precision@3 is 0.33 (FAILING)

**What it means**: Only 1 of 3 top results is relevant

**Root causes** (check in order):

1. **Query too broad** → User asks vague question → Returns too many results
   - Solution: Implement query expansion ("machine learning" → "machine learning algorithms, supervised learning, neural networks")
2. **Embeddings not discriminative** → Similar-looking docs are actually different topics
   - Solution: Try different embedding model (e.g., BGE, Voyage)
3. **Chunking strategy** → Chunks mix multiple topics
   - Solution: Reduce chunk size or add semantic boundaries

**Action**: Start with query expansion, then evaluate; if still low, try different embeddings.

---

### Scenario: Recall@5 is 0.40 (FAILING)

**What it means**: Only finding 40% of relevant documents

**Root causes**:

1. **Chunks too large** → Important details buried in medium of irrelevant content
   - Solution: Reduce chunk size (256 tokens → 128 tokens)

2. **Insufficient overlap** → Relevant content split across non-overlapping chunks
   - Solution: Add 20-50% overlap between chunks

3. **Embedding quality** → Model doesn't capture semantic relationships
   - Solution: Use domain-specific embeddings or fine-tune

**Action**: Adjust chunking first (fastest), then re-evaluate.

---

### Scenario: MRR is 0.25 (FAILING)

**What it means**: First relevant result at position 4, when you want it at position 1-2

**Root causes**:

1. **No reranking** → Initial ranking doesn't prioritize relevance
   - Solution: Add reranker (e.g., cross-encoder model)

2. **Similarity scoring inconsistent** → Irrelevant docs score high
   - Solution: Use different similarity metric (cosine, dot product)

**Action**: Add reranking layer (gives biggest improvement).

---

### Scenario: NDCG is 0.50 (MARGINAL)

**What it means**: Relevant docs are scattered throughout results, not concentrated at top

**Root causes**: Inconsistent relevance scoring

**Solutions**:

- Normalize similarity scores (0-1 range)
- Use weighted relevance (grade docs as highly/moderately relevant)
- Experiment with different K values

---

## How Metrics Work Together

```
Perfect System (all metrics high):
├─ Precision@3 = 0.95 → Top results are good
├─ Recall@5 = 0.90 → Finding most relevant docs
├─ MRR = 0.95 → First result usually correct
└─ NDCG = 0.85 → Ranking is high quality

Broken System (mixed metrics):
├─ Precision@3 = 0.50 ✗ Too much noise
├─ Recall@5 = 0.40 ✗ Missing documents
├─ MRR = 0.20 ✗ Correct answer buried
└─ NDCG = 0.35 ✗ Ranking quality poor
→ FIX: Probably needs chunking or embedding overhaul

Typical System (baseline):
├─ Precision@3 = 0.65 → Acceptable but could improve
├─ Recall@5 = 0.75 → Missing some relevant docs
├─ MRR = 0.45 → First result not always right
└─ NDCG = 0.55 → Adequate ranking
→ FIX: Try reranking first (fastest win)
```

---

## Implementation Summary

### What You Get

| Component           | Purpose                                     | Status         |
| ------------------- | ------------------------------------------- | -------------- |
| `retrieval.test.ts` | 4 metrics + 7 test cases + 9 unit tests     | ✅ Core        |
| `run-evaluation.ts` | Live evaluation against real Pinecone index | ✅ Runner      |
| Unit tests          | Verify metric calculations correct          | ✅ 9/9 passing |
| Thresholds          | Production quality criteria                 | ✅ Configured  |
| Diagnostics         | Auto-identify failures + recommendations    | ✅ Built-in    |

### Running Evaluations

**Option 1: Quick validation** (no API calls needed)

```bash
npm run test:eval  # Runs all 9 unit tests
```

**Option 2: Real-world test** (queries live Pinecone)

```bash
npm run eval  # Full evaluation with metrics
```

---

## Key Takeaways

### Concept 1: You Can't Optimize What You Don't Measure

- Metrics = language between problems and solutions
- "Low precision" tells you to filter; "low recall" tells you to find more
- Each metric points to a specific problem area

### Concept 2: Metrics Have Trade-offs

- High precision but low recall = Few results, but they're good
- High recall but low precision = Many results, but lots of noise
- Balance them using thresholds

### Concept 3: Ranking Position Matters (NDCG)

- Position 1 result is ~5x more valuable than position 10
- Even if you find all relevant docs, if they're ranked badly, users won't see them
- That's why MRR and NDCG are critical

### Concept 4: Different Metrics Diagnose Different Failures

- **Precision** → Data quality problem
- **Recall** → Data coverage problem
- **MRR** → Ranking algorithm problem
- **NDCG** → Position consistency problem

### Concept 5: Evaluation Enables Iteration

Rather than: "Our system is bad" (vague)
You can say: "Precision@3 = 0.40, which means we're returning irrelevant results. Try reranking first."

---

## Next Steps for Learning

1. **Understand the math**: Study each metric formula with examples
2. **Run the tests**: Execute `npm run test:eval` and see all 9 pass
3. **Interpret results**: Generate evaluation output and match to diagnostic guide
4. **Debug one metric**: Intentionally break a test case and see which metrics fail
5. **Extend it**: Add your own test cases for domain-specific queries

This progression builds intuition about how metrics reflect system behavior.

---

**Remember**: Evaluation metrics are your conversation with your data. They tell you what's working, what's broken, and exactly how to fix it.

---

I'll provide you with a concise learning summary of the metrics visualization document. Since I'm in Ask mode, I can present this as a reference guide:

---

## **RAG Evaluation Metrics: Learning Guide**

### **The 4 Core Metrics**

| Metric          | Question                       | Formula                         | Threshold |
| --------------- | ------------------------------ | ------------------------------- | --------- |
| **Precision@K** | Are results relevant?          | Relevant docs in top-K / K      | >70%      |
| **Recall@K**    | Did we find all relevant docs? | Found relevant / Total relevant | >80%      |
| **MRR**         | How fast to first answer?      | 1 / rank of first relevant      | >0.5      |
| **NDCG**        | Is ranking quality good?       | DCG / IDCG                      | >0.6      |

---

### **Quick Mental Models**

**Precision** = Quality (prevents hallucination)

- High = Results are mostly useful
- Low = Getting lots of junk

**Recall** = Completeness (prevents missing info)

- High = Found important docs
- Low = Missing key information

**MRR** = Speed (prevents buried answers)

- High = Right answer at rank 1-2
- Low = Right answer at rank 4+

**NDCG** = Overall ranking health (prevents inconsistency)

- High = Relevant docs clustered near top
- Low = Relevant docs scattered throughout

---

### **Real Example: "What is machine learning?"**

```
Expected docs: [doc-1]
Retrieved: [doc-1✓, doc-3✗, doc-2✗]

Precision@3:  1/3 = 0.33 ❌ FAIL (getting junk)
Recall@5:     1/1 = 1.0  ✅ PASS (found it)
MRR:          1/1 = 1.0  ✅ PASS (immediate)
NDCG:         1.0        ✅ PASS (perfect rank)
```

---

### **Debugging Your RAG System**

| Problem              | Solution                               |
| -------------------- | -------------------------------------- |
| Only Precision fails | Add reranking, tighten filters         |
| Only Recall fails    | Smaller chunks, better embeddings      |
| Only MRR fails       | Cross-encoder reranking, hybrid search |
| Only NDCG fails      | Normalize scores, learning-to-rank     |
| All fail             | Check index, chunking, or test cases   |

---

# Task 07: Quick Reference Guide

## 🎯 What Was Delivered

### ✅ Core Implementation

- **495 lines** of production-grade TypeScript evaluation code
- **9 unit tests** validating metric calculations (all passing)
- **7 comprehensive test cases** for semantic search evaluation
- **4 metrics** implemented: Precision@3, Recall@5, MRR, NDCG

### 📦 Files Created/Modified

```
✓ functions/src/__tests__/retrieval.test.ts    (495 lines, 9 tests)
✓ functions/scripts/run-evaluation.ts          (Evaluation runner script)
✓ functions/package.json                       (Updated with eval scripts)
✓ docs/.../TASK_07_IMPLEMENTATION.md          (Full technical guide)
✓ TASK_07_COMPLETE.md                         (Completion summary)
✓ quick-reference.md                          (This file)
```

## 🚀 Quick Start Commands

### Run Unit Tests (No API calls required)

```bash
npm run test:eval
# Output: 9/9 TESTS PASSED ✓
```

### Run Full Evaluation (Requires Pinecone index)

```bash
npm run eval
# Output: Detailed results with recommendations
```

### Run All Tests Including Example

```bash
npm test
# Output: All tests in project including retrieval eval
```

## 📊 Metrics at a Glance

| Metric      | Formula              | Meaning             | Threshold |
| ----------- | -------------------- | ------------------- | --------- |
| Precision@3 | Relevant ÷ Retrieved | False positive rate | > 70%     |
| Recall@5    | Found ÷ Expected     | Missing docs        | > 80%     |
| MRR         | 1 ÷ First-Match-Rank | Speed to relevance  | > 0.5     |
| NDCG        | DCG ÷ IDCG           | Ranking quality     | > 0.6     |

## 🧪 Test Cases

```
1. Direct ML definition        → "What is machine learning?"
2. Vector DB concepts          → "How do vector databases work?"
3. Embeddings fundamentals     → "What are embeddings?"
4. RAG architecture            → "Tell me about RAG systems"
5. Semantic search multi-doc   → "How to search semantically?"
6. Semantic variation          → "AI that learns from examples"
7. Vector operations           → "Finding similar content with vectors"
```

## 🔍 Example Output

```
Testing 7 query scenarios...

SUMMARY METRICS
================
Total Queries: 7
Passed: 6/7 (85.7%)

Average Metrics:
  Precision@3: 0.750 ✓ (threshold: 0.700)
  Recall@5:    0.850 ✓ (threshold: 0.800)
  MRR:         0.620 ✓ (threshold: 0.500)
  NDCG:        0.680 ✓ (threshold: 0.600)
```

## 🛠️ Diagnostic Quick Reference

### Low Precision → Too many irrelevant results

```
Actions:
  • Query expansion with semantic filtering
  • Add post-filtering based on domain rules
  • Implement cross-encoder reranking
```

### Low Recall → Missing relevant documents

```
Actions:
  • Reduce chunk size (try 256-512 tokens)
  • Increase chunk overlap (try 20% overlap)
  • Evaluate embedding model quality
  • Test dense passage retrieval layer
```

### Low MRR → Correct answer buried deep

```
Actions:
  • Add retrieval reranking layer
  • Fine-tune similarity scoring
  • Try hybrid search (BM25 + semantic)
  • Test different embedding models
```

### Low NDCG → Poor ranking consistency

```
Actions:
  • Implement graded relevance scores (0-3)
  • Add learning-to-rank approach
  • Normalize similarity scores
  • Experiment with different K values
```

## 📝 API Reference

### Run Evaluation Programmatically

```typescript
import {
  runFullEvaluation, // Run all 7 test cases
  evaluateQuery, // Test single query
  formatEvalResults, // Format output
  testCases, // Access test cases
  METRIC_THRESHOLDS, // Access thresholds
} from "./src/__tests__/retrieval.test";

// Example: Full evaluation
const summary = await runFullEvaluation();
console.log(formatEvalResults(summary));

// Example: Single query
const result = await evaluateQuery({
  id: "my-test",
  query: "What is RAG?",
  expectedDocs: ["doc-4"],
});
console.log(`MRR: ${result.mrr}`);
```

### Metric Calculation Functions

```typescript
// Calculate only precision without running query
calculatePrecision(
  retrieved: string[],    // IDs returned by search
  expected: string[],     // IDs that should be found
  k: number = 3
): number                 // Score 0.0-1.0

// Same pattern for:
calculateRecall(retrieved, expected, k=5)
calculateMRR(retrieved, expected)
calculateNDCG(retrieved, expected, k=5)
```

## 📚 Key Concepts

### Ground Truth Dataset

```typescript
TestCase {
  id: string              // Unique identifier
  query: string           // User question
  expectedDocs: string[]  // Docs that should be retrieved
  explanation?: string    // Why these docs are relevant
}
```

### Evaluation Result per Query

```typescript
EvalResult {
  queryId: string         // Test case ID
  retrieved: string[]     // Docs returned by search (in order)
  expected: string[]      // Expected relevant docs
  precision: number       // Precision@K score
  recall: number          // Recall@K score
  mrr: number            // Mean Reciprocal Rank
  ndcg: number           // NDCG score
  success: boolean       // All thresholds passed
}
```

### Summary Statistics

```typescript
EvalSummary {
  totalQueries: number     // 7 for this task
  successCount: number     // Queries that passed all thresholds
  passRate: number         // Success rate (0.0-1.0)
  avgPrecision: number     // Average across all queries
  avgRecall: number        // Average across all queries
  avgMRR: number          // Average across all queries
  avgNDCG: number         // Average across all queries
  results: EvalResult[]   // Per-query results
}
```

## 🔗 Environment Requirements

For `npm run eval` (live testing):

```bash
# .env file should contain:
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=your_index
OPENAI_API_KEY=your_key
FIREBASE_PROJECT_ID=your_project

# Also ensure:
gcp_credentials.json exists in functions/
Documents seeded in Pinecone (Task 03 completed)
```

For `npm run test:eval` (unit tests):

- No requirements - works offline

## 📈 Production Integration

### CI/CD Pipeline Example

```yaml
test:eval:
  script:
    - cd functions
    - npm run test:eval
  retry: 2

eval:production:
  script:
    - cd functions
    - npm run build
    - npm run eval
  only:
    - main
  artifacts:
    reports:
      - results.json
```

### Exit Codes

```
0 - All queries passed (passRate == 1.0)
0 - Good performance   (passRate >= 0.8)
1 - Below target       (passRate < 0.8)
1 - Error occurred
```

## 🎓 Learning Path

1. **Understand metrics** → Read TASK_07_IMPLEMENTATION.md formulas section
2. **Run tests** → `npm run test:eval` (validates math)
3. **Examine test cases** → Review the 7 queries in code
4. **Run full eval** → `npm run eval` against live data
5. **Interpret results** → Check if passRate >= 80%
6. **Improve retrieval** → Follow diagnostic recommendations
7. **Iterate** → Re-run eval after changes

## ❓ FAQ

**Q: Do I need a Pinecone index to run tests?**  
A: No - `npm run test:eval` works offline. `npm run eval` needs live index.

**Q: What if all metrics fail?**  
A: Likely issue: Previous tasks incomplete (Task 02-03). Check Pinecone index is populated.

**Q: Can I add more test cases?**  
A: Yes - Add to `testCases` array in retrieval.test.ts and re-run.

**Q: How do custom metrics?**  
A: Implement new function and add to EvalResult interface, then export it.

**Q: Why these thresholds?**  
A: Based on production best practices. Adjust if needed for your use case.

---

**Task Status**: ✅ COMPLETE AND TESTED
