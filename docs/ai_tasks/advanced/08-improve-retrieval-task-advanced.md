# Task 08 — Improve Retrieval [ENHANCED]

## Goal

Optimize the retrieval component of your RAG system using advanced techniques to significantly improve answer quality and reduce hallucination.

---

## Learning Outcomes

After completing this task, you'll understand:
- **Query expansion** — Generating multiple search queries from one question
- **Multi-retriever fusion** — Combining results from different search methods
- **Reranking** — Using semantic similarity to reorder results
- **Hybrid search** — Combining semantic + keyword search
- **A/B testing framework** — Measuring improvement systematically
- **Iterative optimization** — Progressive refinement based on metrics
- **Cost-quality trade-offs** — Speed vs accuracy decisions
- **Production monitoring** — Tracking retrieval quality in deployment

---

## Requirements

**Input:**
- User question
- Vector index (from Tasks 02-03)
- Evaluation metrics (from Task 07)

**Output:**
- Improved retrieved documents (better relevance)
- Quality metrics showing improvement
- Cost metrics (time, tokens, API calls)
- Recommendation for production deployment

**Success criteria:**
- nDCG score increases 10-20%
- Cost increase < 20%
- Latency < 2 seconds end-to-end

---

## Why Retrieval Improvement Matters

### The Problem: Standard Search Has Limitations

```
Standard vector search:
1. User asks: "How do machines learn?"
2. Query embedding: "how do machines learn" → [0.12, -0.34, ...]
3. Search index: Find 3 most similar
4. Results: Some relevant, some not
5. Problem: Question worded differently might miss key documents

Result: Answer only uses available documents, may lack key context
```

### The Solution: Multiple Retrieval Strategies

```
Improved retrieval:
1. User asks: "How do machines learn?"
2. Expand query into 3 variants:
   - "machine learning fundamentals"
   - "how computers learn from data"
   - "neural network training"
3. Search with each variant
4. Combine and rerank results
5. Result: Gets documents from multiple angles

Improvement: +15% better retrieval, same cost
```

---

## Technique 1: Query Expansion

**Definition:** Generate multiple search queries to capture different phrasings

### Simple Expansion (Template-based)

```typescript
// src/services/query-expansion.ts

export async function expandQuery(question: string): Promise<string[]> {
  const queries = [question]; // Original query
  
  // Template 1: Question → Statement
  queries.push(
    question
      .replace('What ', '')
      .replace('How ', '')
      .replace('Why ', '')
      .replace('?', '')
  );
  
  // Template 2: Add synonyms
  const synonymMap: Record<string, string> = {
    'machine learning': 'AI algorithms',
    'neural networks': 'deep learning',
    'embeddings': 'vector representations',
    'retrieval': 'search',
  };
  
  let expanded = question;
  for (const [key, value] of Object.entries(synonymMap)) {
    if (question.toLowerCase().includes(key)) {
      expanded = question.replace(
        new RegExp(key, 'gi'),
        value
      );
      queries.push(expanded);
    }
  }
  
  // Template 3: Break into key phrases
  const keyPhrases = question
    .split(/[?,!]/)
    .map(p => p.trim())
    .filter(p => p.length > 5);
  queries.push(...keyPhrases);
  
  // Return unique queries
  return [...new Set(queries)];
}

// Usage
const variants = await expandQuery('How do neural networks learn from data?');
console.log('Query variants:', variants);
// Output:
// [
//   "How do neural networks learn from data?",
//   "neural networks learn from data",
//   "How do deep learning learn from data?",
//   "How do neural networks learn",
//   "from data"
// ]
```

### LLM-based Expansion (More sophisticated)

```typescript
export async function expandQueryWithLLM(
  question: string,
  client: OpenAI
): Promise<string[]> {
  const prompt = `Given this question, generate 3 alternative phrasings that would help find relevant documents:

Question: "${question}"

Return as JSON array of 3 strings, no explanations:
["variant 1", "variant 2", "variant 3"]`;

  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 100,
  });
  
  const content = response.choices[0].message.content || '[]';
  const variants = JSON.parse(content);
  
  return [question, ...variants];
}

// Usage
const expanded = await expandQueryWithLLM(
  'How do neural networks learn?',
  client
);
// Output: Original + 3 LLM-generated variants
```

---

## Technique 2: Multi-Retriever Fusion

**Definition:** Combine results from multiple search methods

### Reciprocal Rank Fusion

```typescript
// src/services/fusion.ts

export interface RetrievalResult {
  id: string;
  text: string;
  score: number;
}

/**
 * Reciprocal Rank Fusion (RRF)
 * 
 * Formula: Score = sum(1 / (k + rank))
 * where k=60 (standard value)
 * 
 * Combines results from multiple retrievers
 * without needing to normalize scores
 */
export function reciprocalRankFusion(
  resultGroups: RetrievalResult[][]
): RetrievalResult[] {
  const k = 60; // Standard RRF constant
  const scoreMap = new Map<string, number>();
  const docMap = new Map<string, RetrievalResult>();
  
  // For each result group (from different retrievers/queries)
  resultGroups.forEach((results, groupIndex) => {
    // Score each result by its rank in this group
    results.forEach((result, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      scoreMap.set(
        result.id,
        (scoreMap.get(result.id) || 0) + rrfScore
      );
      
      // Keep first occurrence of document
      if (!docMap.has(result.id)) {
        docMap.set(result.id, result);
      }
    });
  });
  
  // Convert back to results, sorted by RRF score
  const fused = Array.from(scoreMap.entries())
    .map(([id, score]) => ({
      ...docMap.get(id)!,
      score, // Replace with RRF score
    }))
    .sort((a, b) => b.score - a.score);
  
  return fused;
}

// Usage
const query1Results = await search(expandedQueries[0], index);
const query2Results = await search(expandedQueries[1], index);
const query3Results = await search(expandedQueries[2], index);

const fusedResults = reciprocalRankFusion([
  query1Results,
  query2Results,
  query3Results,
]);

console.log('Fused results (best first):');
fusedResults.slice(0, 3).forEach((r, i) => {
  console.log(`${i + 1}. ${r.text.substring(0, 50)}... (score: ${r.score.toFixed(3)})`);
});
```

---

## Technique 3: Reranking

**Definition:** Use a more powerful model to rerank initial results

### Semantic Reranking

```typescript
// src/services/reranking.ts

import { createEmbedding } from './embedding';

/**
 * Rerank documents using semantic similarity to question
 * 
 * Process:
 * 1. Get question embedding
 * 2. Calculate similarity to each document
 * 3. Sort by semantic relevance
 * 4. Keep top-K
 */
export async function semanticRerank(
  question: string,
  candidates: RetrievalResult[],
  topK: number = 3
): Promise<RetrievalResult[]> {
  // Get question embedding for precise ranking
  const questionEmbedding = await createEmbedding(question);
  
  // Calculate similarity to each candidate
  const scored = candidates.map(candidate => {
    // Candidate already has embedding from search
    const similarity = cosineSimilarity(
      questionEmbedding,
      candidate.embedding
    );
    
    return {
      ...candidate,
      rerankedScore: similarity,
    };
  });
  
  // Sort by similarity, keep top-K
  return scored
    .sort((a, b) => b.rerankedScore - a.rerankedScore)
    .slice(0, topK);
}

// Helper: Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  
  const magnitude = Math.sqrt(
    a.reduce((sum, v) => sum + v * v, 0) *
    b.reduce((sum, v) => sum + v * v, 0)
  );
  
  return magnitude > 0 ? dotProduct / magnitude : 0;
}
```

### Cross-Encoder Reranking (More Powerful)

```typescript
/**
 * Cross-encoder reranking
 * 
 * More sophisticated: Uses a model trained on question-document pairs
 * Score ranges from 0-1 (relevance probability)
 * 
 * Note: Requires separate model API (e.g., Cohere, Jina, or local)
 */
export async function crossEncoderRerank(
  question: string,
  candidates: RetrievalResult[],
  topK: number = 3
): Promise<RetrievalResult[]> {
  // Example using Cohere API
  const response = await fetch('https://api.cohere.ai/v1/rerank', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: question,
      documents: candidates.map(c => c.text),
      model: 'rerank-english-v2.0',
      top_k: topK,
    }),
  });
  
  const data = await response.json();
  
  // Map results back to original format
  return data.results.map((result: any) => ({
    ...candidates[result.index],
    rerankedScore: result.relevance_score,
  }));
}
```

---

## Technique 4: Hybrid Search

**Definition:** Combine semantic search with keyword/BM25 search

### Simple Hybrid (Semantic + Keyword)

```typescript
// src/services/hybrid-search.ts

export interface HybridSearchOptions {
  semanticWeight: number;  // 0-1 (default 0.7)
  keywordWeight: number;   // 0-1 (default 0.3)
}

/**
 * Hybrid search combines:
 * 1. Semantic similarity (vector search)
 * 2. Keyword matching (BM25 or simple word matching)
 * 
 * Benefits:
 * - Semantic: Understands meaning
 * - Keyword: Catches exact terms
 * - Combined: Best of both worlds
 */
export async function hybridSearch(
  question: string,
  index: PineconeIndex,
  options: HybridSearchOptions = {
    semanticWeight: 0.7,
    keywordWeight: 0.3,
  }
): Promise<RetrievalResult[]> {
  // 1. Semantic search
  const questionEmbedding = await createEmbedding(question);
  const semanticResults = await index.query({
    vector: questionEmbedding,
    topK: 10,
    includeMetadata: true,
  });
  
  // 2. Keyword search (simple word matching)
  const keywords = question
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  const allDocs = await index.describe(); // Get all docs for keyword search
  const keywordScores = new Map<string, number>();
  
  allDocs.forEach(doc => {
    let score = 0;
    keywords.forEach(keyword => {
      if (doc.metadata.text.toLowerCase().includes(keyword)) {
        score += 1;
      }
    });
    if (score > 0) {
      keywordScores.set(doc.id, score / keywords.length);
    }
  });
  
  // 3. Combine scores
  const combined = new Map<string, number>();
  
  // Add semantic scores
  semanticResults.forEach((result, index) => {
    const score = (1 - index / semanticResults.length); // Rank-based
    combined.set(
      result.id,
      score * options.semanticWeight
    );
  });
  
  // Add keyword scores
  keywordScores.forEach((score, id) => {
    const current = combined.get(id) || 0;
    combined.set(
      id,
      current + score * options.keywordWeight
    );
  });
  
  // 4. Return top results by combined score
  return Array.from(combined.entries())
    .map(([id, score]) => ({
      id,
      score,
      text: allDocs.find(d => d.id === id)?.metadata.text || '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// Usage
const hybridResults = await hybridSearch(
  'neural networks',
  index,
  { semanticWeight: 0.7, keywordWeight: 0.3 }
);
```

---

## Complete Optimization Pipeline

### Combining All Techniques

```typescript
// src/services/optimized-retrieval.ts

export async function optimizedRetrieve(
  question: string,
  index: PineconeIndex,
  evaluator: RetrieverEvaluator
): Promise<RetrievalResult[]> {
  console.log('🔄 Optimized Retrieval Pipeline');
  console.log(`   Question: "${question}"`);
  
  // Step 1: Expand query
  console.log('\n1️⃣  Query Expansion');
  const variants = await expandQuery(question);
  console.log(`   Generated ${variants.length} variants`);
  
  // Step 2: Multi-retriever search
  console.log('\n2️⃣  Multi-Retriever Search');
  const resultGroups = [];
  for (const variant of variants) {
    const results = await index.query({
      vector: await createEmbedding(variant),
      topK: 5,
    });
    resultGroups.push(results);
  }
  console.log(`   Retrieved from ${variants.length} queries`);
  
  // Step 3: Fusion
  console.log('\n3️⃣  Result Fusion');
  const fused = reciprocalRankFusion(resultGroups);
  console.log(`   Fused to ${fused.length} unique documents`);
  
  // Step 4: Reranking
  console.log('\n4️⃣  Semantic Reranking');
  const reranked = await semanticRerank(question, fused, 5);
  console.log(`   Reranked top 5 documents`);
  
  // Step 5: Evaluation
  console.log('\n5️⃣  Quality Evaluation');
  const quality = await evaluator.evaluate(question, reranked);
  console.log(`   nDCG: ${quality.ndcg.toFixed(3)}`);
  console.log(`   MRR: ${quality.mrr.toFixed(3)}`);
  
  return reranked;
}
```

---

## A/B Testing Framework

### Setup

```typescript
// src/services/ab-testing.ts

export interface ABTestResult {
  variant: string; // 'baseline' or 'improved'
  nDCG: number;
  MRR: number;
  latency: number;
  cost: number;
}

export async function runABTest(
  questions: string[],
  index: PineconeIndex,
  evaluator: RetrieverEvaluator
): Promise<Map<string, ABTestResult[]>> {
  const results = new Map<string, ABTestResult[]>();
  
  for (const question of questions) {
    const baselineStart = Date.now();
    
    // Baseline: Standard retrieval
    const baseline = await standardRetrieve(question, index);
    const baselineTime = Date.now() - baselineStart;
    const baselineQuality = await evaluator.evaluate(question, baseline);
    
    results.set(question, [
      {
        variant: 'baseline',
        nDCG: baselineQuality.ndcg,
        MRR: baselineQuality.mrr,
        latency: baselineTime,
        cost: baseline.length * 0.000001, // Rough estimate
      },
    ]);
    
    // Improved: Optimized retrieval
    const improvedStart = Date.now();
    const improved = await optimizedRetrieve(question, index, evaluator);
    const improvedTime = Date.now() - improvedStart;
    const improvedQuality = await evaluator.evaluate(question, improved);
    
    results.get(question)?.push({
      variant: 'improved',
      nDCG: improvedQuality.ndcg,
      MRR: improvedQuality.mrr,
      latency: improvedTime,
      cost: improved.length * 0.000001,
    });
  }
  
  return results;
}

// Analyze results
export function analyzeResults(
  results: Map<string, ABTestResult[]>
): { improvement: number; costIncrease: number } {
  let totalBaselineNDCG = 0;
  let totalImprovedNDCG = 0;
  let totalBaselineCost = 0;
  let totalImprovedCost = 0;
  let count = 0;
  
  results.forEach(variantResults => {
    const baseline = variantResults.find(r => r.variant === 'baseline');
    const improved = variantResults.find(r => r.variant === 'improved');
    
    if (baseline && improved) {
      totalBaselineNDCG += baseline.nDCG;
      totalImprovedNDCG += improved.nDCG;
      totalBaselineCost += baseline.cost;
      totalImprovedCost += improved.cost;
      count++;
    }
  });
  
  const avgBaselineNDCG = totalBaselineNDCG / count;
  const avgImprovedNDCG = totalImprovedNDCG / count;
  const avgBaselineCost = totalBaselineCost / count;
  const avgImprovedCost = totalImprovedCost / count;
  
  return {
    improvement: ((avgImprovedNDCG - avgBaselineNDCG) / avgBaselineNDCG) * 100,
    costIncrease: ((avgImprovedCost - avgBaselineCost) / avgBaselineCost) * 100,
  };
}
```

### Running Test

```bash
# Run A/B test
node -e "
const results = await runABTest(testQuestions, index, evaluator);
const analysis = analyzeResults(results);

console.log('📊 A/B Test Results:');
console.log(\`Quality improvement: +\${analysis.improvement.toFixed(1)}%\`);
console.log(\`Cost increase: +\${analysis.costIncrease.toFixed(1)}%\`);

if (analysis.improvement > 10 && analysis.costIncrease < 20) {
  console.log('✅ Recommended for production');
} else {
  console.log('⚠️  Need further optimization');
}
"
```

---

## Monitoring & Iteration

### Production Monitoring

```typescript
// src/services/retrieval-monitoring.ts

export interface RetrievalMetrics {
  timestamp: Date;
  question: string;
  retrievalTime: number;
  qualityScore: number;
  documentsRetrieved: number;
  answerSatisfactory: boolean; // From user feedback
}

/**
 * Log retrieval metrics for monitoring
 */
export async function logRetrievalMetrics(
  metrics: RetrievalMetrics
): Promise<void> {
  // Store in database or logging service
  await database.retrieval_metrics.insert({
    ...metrics,
    timestamp: new Date(),
  });
}

/**
 * Get recent performance
 */
export async function getRecentPerformance(
  hours: number = 24
): Promise<{
  avgQualityScore: number;
  satisfactionRate: number;
  p95Latency: number;
}> {
  const recent = await database.retrieval_metrics
    .where('timestamp', '>', new Date(Date.now() - hours * 3600 * 1000))
    .get();
  
  const qualityScores = recent.map(m => m.qualityScore);
  const satisfactory = recent.filter(m => m.answerSatisfactory).length;
  const latencies = recent.map(m => m.retrievalTime).sort((a, b) => a - b);
  
  return {
    avgQualityScore: qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length,
    satisfactionRate: (satisfactory / recent.length) * 100,
    p95Latency: latencies[Math.floor(latencies.length * 0.95)],
  };
}
```

---

## Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| "Query expansion too slow" | Latency > 3s | Reduce number of variants or use pre-generated |
| "Fusion not helping" | Same results | Ensure variants are sufficiently different |
| "Reranking too expensive" | Cost up 50% | Use semantic instead of cross-encoder |
| "Latency regression" | Slower than baseline | Reduce topK or number of retrievers |
| "Quality not improving" | nDCG flat or down | Tune weights, check expansion quality |

---

## Decision Tree

```
Does baseline retrieval work well (nDCG > 0.85)?
├─ YES: Stop here, optimization not needed
└─ NO: Continue...
   
   Is the problem missed documents?
   ├─ YES: Try query expansion
   │       Did quality improve?
   │       ├─ YES: Deploy
   │       └─ NO: Add fusion + reranking
   │
   └─ NO: Is the problem low-quality results?
       ├─ YES: Try reranking
       │       Too expensive?
       │       ├─ YES: Use semantic ranking
       │       └─ NO: Use cross-encoder
       │
       └─ NO: Try hybrid search
           Combination helps?
           ├─ YES: Deploy with A/B test
           └─ NO: Reassess chunking strategy
```

---

## Constraints

- Query expansion can increase latency
- Reranking adds cost (extra API calls or models)
- Fusion requires multiple retrievals
- A/B testing requires baseline metrics

---

## Next Steps

1. **After this task:** You have a complete optimized RAG system
2. **Monitor:** Track quality metrics in production
3. **Iterate:** Use feedback to further improve
4. **Scale:** Deploy confident changes to all users

---

## Success Checklist

- ✅ Query expansion working (generates diverse variants)
- ✅ Fusion improving results (+ 5-10% nDCG)
- ✅ Reranking effective (+ 5-15% nDCG)
- ✅ Latency acceptable (< 2s total)
- ✅ Cost increase justified (< 20%)
- ✅ A/B test showing improvement
- ✅ Production monitoring in place

---

## Tutorial Trigger

- **rag.md** → Add "Advanced Optimization" section

Tutorial focus:
- What = Retrieval optimization techniques
- Why = Better retrieval = better answers = higher user satisfaction
- How = Query expansion, fusion, reranking, hybrid search
- Gotchas = Added latency/cost, diminishing returns, proper A/B testing needed
- Trade-offs = Speed vs quality, cost vs accuracy, complexity vs results
