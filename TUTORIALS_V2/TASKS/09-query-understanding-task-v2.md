---
notes: V2 Task - Build query understanding layer with rewriting, decomposition, and expansion
prerequisites: V1 Tasks 01-08 completed (embeddings, vector DB, basic RAG working)
---

# V2 Tutorial 01 — Query Understanding & Decomposition

## What You'll Learn

In this tutorial, you'll discover:

- **Why query quality matters** — Poor queries lead to poor retrieval
- **Query rewriting techniques** — Transforming vague queries into specific ones
- **Multi-hop decomposition** — Breaking complex questions into atomic parts
- **Query expansion strategies** — Searching with multiple semantic angles
- **Implementation patterns** — Building a reusable query processor
- **Integration with RAG pipeline** — Feeding improved queries to retrieval
- **Evaluation methods** — Measuring improvement from query processing

---

## The Core Problem: Raw Queries Are Often Suboptimal

### Problem 1: Vague or Poorly Phrased Queries

```
User query: "Tell me about that programming thing"
Issue: Too vague, no semantic content
Embedding: Weak vector, matches too many documents
Result: Retrieval is noisy, recall is low
```

### Problem 2: Multi-Part Questions

```
User query: "Compare supervised and unsupervised learning, and give examples"
Issue: Contains 3 sub-questions mixed together
Naive retrieval: Single query might not address all aspects
Result: Answer is incomplete or generic
```

### Problem 3: Terminology Mismatch

```
User query: "self-driving cars"
Documents use: "autonomous vehicles"
Issue: Same concept, different vocabulary
Naive retrieval: Similarity score is moderate
Result: Relevant documents ranked lower than they should be
```

### Problem 4: Question Phrasing Variations

```
User query: "What things are methods that machines learn with data?"
Better query: "What are machine learning algorithms?"
Issue: Verbose phrasing reduces semantic clarity
Result: Embedding vector is less focused
```

---

## The Solution: Query Processing Layer

### Architecture Overview

```
Raw User Query
    ↓
[1. Rewriter] → Improved query (clarity, specificity)
    ↓
[2. Classifier] → Is this multi-hop? single factual? comparison?
    ↓
[3. Decomposer] → If multi-hop: break into sub-queries
    ↓
[4. Expander] → Generate synonyms/related queries
    ↓
Multi-Query or Single-Query Variants
    ↓
Retrieval (with better queries)
```

---

## Implementation Guide

### Layer 1: Query Rewriter

**Purpose:** Transform user query into semantic-optimized form while preserving intent

**Implementation Approach:**

```typescript
// Service: services/query/rewriter.ts

interface QueryRewriteRequest {
  originalQuery: string;
  context?: string; // Optional conversation context
  maxTokensForRewrite?: number; // Default: 500
}

interface QueryRewriteResponse {
  originalQuery: string;
  rewrittenQuery: string;
  rationale: string; // Why was it rewritten this way?
  confidenceScore: number; // 0.0-1.0
}

export async function rewriteQuery(
  request: QueryRewriteRequest,
  openaiService: OpenAIService,
): Promise<QueryRewriteResponse> {
  // 1. Create a prompt template for query rewriting
  const systemPrompt = `You are a query optimization expert. 
  Your task is to rewrite user queries to be more specific, clear, and semantically rich
  for vector database retrieval.
  
  Rules:
  - Keep the original intent
  - Be specific rather than vague
  - Remove filler words
  - Use technical terms if applicable
  - Optimize for semantic search (not keyword search)
  
  Return a single rewritten query and brief rationale.`;

  const userPrompt = `Rewrite this query for semantic search optimization:
  Original: "${request.originalQuery}"
  ${request.context ? `Context: "${request.context}"` : ""}
  
  Provide:
  1. Rewritten query (on first line)
  2. Brief rationale (one sentence)`;

  // 2. Call OpenAI with structured prompt
  const response = await openaiService.createCompletion({
    model: "gpt-4-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3, // Low temperature: focused, deterministic
    maxTokens: request.maxTokensForRewrite || 500,
  });

  // 3. Parse response (rewritten query + rationale)
  const content = response.choices[0].message.content!;
  const [rewritten, rationale] = content.split("\n").filter(Boolean);

  return {
    originalQuery: request.originalQuery,
    rewrittenQuery: rewritten.trim(),
    rationale: rationale?.trim() || "",
    confidenceScore: 0.85, // Could be derived from response logprobs
  };
}
```

**Rewriter Examples:**

| Original                   | Rewritten                                                                      |
| -------------------------- | ------------------------------------------------------------------------------ |
| "fastest animal thing"     | "Which animal species has the highest maximum speed?"                          |
| "ML vs DL"                 | "Key differences between machine learning and deep learning"                   |
| "how do transformers work" | "How do transformer neural networks process sequences and generate attention?" |
| "pros of microservices"    | "What are the advantages and benefits of microservices architecture?"          |

### Layer 2: Query Classifier

**Purpose:** Categorize query type to determine processing strategy

**Implementation Approach:**

```typescript
// Service: services/query/classifier.ts

export enum QueryType {
  SINGLE_FACTUAL = "single_factual", // "What is X?"
  MULTI_HOP = "multi_hop", // "Compare X and Y" / "How do X relate to Y?"
  DESCRIPTIVE = "descriptive", // "Explain X" / "Tell me about X"
  PROCEDURAL = "procedural", // "How do I..." / "Steps to..."
  ANALYTICAL = "analytical", // "Why does X happen?" / "What causes X?"
}

export interface QueryClassification {
  query: string;
  classification: QueryType;
  confidence: number;
  reasoning: string;
}

export async function classifyQuery(
  query: string,
  openaiService: OpenAIService,
): Promise<QueryClassification> {
  const prompt = `Classify this query into ONE category:
  - SINGLE_FACTUAL: Direct factual questions ("What is X?")
  - MULTI_HOP: Comparison or multi-part ("Compare X and Y", "How do X and Y relate?")
  - DESCRIPTIVE: Explanations ("Explain X", "Tell me about X")
  - PROCEDURAL: Step-by-step ("How do I X?", "Steps to X")
  - ANALYTICAL: Analysis ("Why Z?", "What causes Z?")
  
  Query: "${query}"
  
  Respond with ONLY: [CATEGORY] [confidence_0_to_1] [one sentence reasoning]`;

  const response = await openaiService.createCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    maxTokens: 100,
  });

  // Parse: "MULTI_HOP 0.95 This query needs two separate searches"
  const [category, conf, ...reasoningParts] =
    response.choices[0].message.content!.split(/\s+/);

  return {
    query,
    classification: category as QueryType,
    confidence: parseFloat(conf),
    reasoning: reasoningParts.join(" "),
  };
}
```

### Layer 3: Query Decomposer

**Purpose:** Break multi-hop queries into independent sub-queries

**Implementation Approach:**

```typescript
// Service: services/query/decomposer.ts

export interface SubQuery {
  id: string;
  query: string;
  sequenceNumber: number;
  dependency?: string; // ID of sub-query this depends on
  importance: number; // 0.0-1.0, for prioritization
  expectedDocCount: number;
}

export interface DecomposedQuery {
  originalQuery: string;
  subQueries: SubQuery[];
  synthesis: string; // Guidelines for combining results
  complexity: number; // 0.0-1.0
}

export async function decomposeQuery(
  query: string,
  classification: QueryClassification,
  openaiService: OpenAIService,
): Promise<DecomposedQuery> {
  if (classification.classification === QueryType.SINGLE_FACTUAL) {
    // No decomposition needed
    return {
      originalQuery: query,
      subQueries: [
        {
          id: "0",
          query: query,
          sequenceNumber: 0,
          importance: 1.0,
          expectedDocCount: 5,
        },
      ],
      synthesis: "Direct answer",
      complexity: 0.1,
    };
  }

  const prompt = `Break this query into 2-4 independent, atomic sub-queries.
  Each sub-query should be retrievable independently.
  
  Original: "${query}"
  
  Format your response as:
  QUERY_1: <sub-query 1>
  QUERY_2: <sub-query 2>
  [optional QUERY_3, QUERY_4]
  
  SYNTHESIS: How to combine results
  COMPLEXITY: [0.1-1.0]
  
  Example for "Compare Python and JavaScript for web development":
  QUERY_1: What are the advantages of Python for web development?
  QUERY_2: What are the advantages of JavaScript for web development?
  QUERY_3: Comparison matrix between Python and JavaScript frameworks
  SYNTHESIS: Present advantages separately, then comparative analysis
  COMPLEXITY: 0.6`;

  const response = await openaiService.createCompletion({
    model: "gpt-4-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    maxTokens: 600,
  });

  // Parse response and structure sub-queries
  const content = response.choices[0].message.content!;
  const lines = content.split("\n").filter((l) => l.trim());
  const subQueries: SubQuery[] = [];
  let synthesis = "";
  let complexity = 0.5;

  let sequenceNum = 0;
  for (const line of lines) {
    if (line.startsWith("QUERY_")) {
      const queryText = line.split(":")[1].trim();
      subQueries.push({
        id: `${sequenceNum}`,
        query: queryText,
        sequenceNumber: sequenceNum,
        importance: 1.0 - sequenceNum * 0.1, // First query most important
        expectedDocCount: 5,
      });
      sequenceNum++;
    } else if (line.startsWith("SYNTHESIS:")) {
      synthesis = line.split(":")[1].trim();
    } else if (line.startsWith("COMPLEXITY:")) {
      complexity = parseFloat(line.split(":")[1].trim());
    }
  }

  return {
    originalQuery: query,
    subQueries,
    synthesis,
    complexity,
  };
}
```

### Layer 4: Query Expander

**Purpose:** Generate semantic variants and synonyms for more comprehensive retrieval

**Implementation Approach:**

```typescript
// Service: services/query/expander.ts

export interface ExpandedQuery {
  originalQuery: string;
  variants: Array<{
    query: string;
    strategy: "synonym" | "expansion" | "specific" | "general";
    similarity: number; // 0.0-1.0 to original
  }>;
  totalVariants: number;
}

export async function expandQuery(
  query: string,
  maxVariants: number = 3,
): Promise<ExpandedQuery> {
  const prompt = `Generate ${maxVariants} semantic variants of this query
  using different strategies (synonyms, related concepts, broader/narrower scope).
  
  Original: "${query}"
  
  For each variant, specify the strategy used (synonym/expansion/specific/general).
  
  Format:
  VARIANT_1: [query variant] | [strategy]
  VARIANT_2: [query variant] | [strategy]
  ...
  
  Example for "machine learning models":
  VARIANT_1: ML algorithms | synonym
  VARIANT_2: Neural network architectures | expansion
  VARIANT_3: Deep learning techniques | specific`;

  const response = await openaiService.createCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    maxTokens: 400,
  });

  const variants = response.choices[0].message
    .content!.split("\n")
    .filter((l) => l.includes("VARIANT_"))
    .map((line, idx) => {
      const [queryPart, strategy] = line.split("|");
      const variantQuery = queryPart.split(":")[1]?.trim() || "";
      return {
        query: variantQuery,
        strategy: (strategy.trim() as any) || "synonym",
        similarity: 0.9 - idx * 0.05, // Decreasing similarity
      };
    });

  return {
    originalQuery: query,
    variants,
    totalVariants: variants.length,
  };
}
```

---

## Integration: Enhanced Retrieval Endpoint

**New Endpoint: `/api/query/enhanced-search`**

This endpoint combines all query processing layers:

```typescript
// endpoints/api/query.ts

export interface EnhancedSearchRequest {
  question: string;
  context?: string;
  useExpansion?: boolean;
  decomposeLargeQueries?: boolean;
  maxExpansions?: number;
}

export interface EnhancedSearchResponse {
  originalQuery: string;
  processedQueries: Array<{
    query: string;
    source: "rewritten" | "decomposed" | "expanded";
  }>;
  retrievalResults: RetrievalResult[];
  metadata: {
    totalQueriesExecuted: number;
    totalDocumentsRetrieved: number;
    processingTimeMs: number;
  };
}

router.post("/enhanced-search", async (req: Request, res: Response) => {
  const {
    question,
    context,
    useExpansion = true,
    decomposeLargeQueries = true,
    maxExpansions = 2,
  } = req.body;

  try {
    // Step 1: Rewrite query
    const rewritten = await rewriteQuery(
      { originalQuery: question, context },
      openaiService,
    );

    // Step 2: Classify query
    const classification = await classifyQuery(
      rewritten.rewrittenQuery,
      openaiService,
    );

    // Step 3: Decompose if multi-hop
    const decomposed = await decomposeQuery(
      rewritten.rewrittenQuery,
      classification,
      openaiService,
    );

    // Step 4: Collect all queries to execute
    const queriesToExecute = [rewritten.rewrittenQuery];

    if (decomposed.subQueries.length > 1) {
      queriesToExecute.push(
        ...decomposed.subQueries.slice(1).map((sq) => sq.query),
      );
    }

    // Step 5: Optionally expand
    if (useExpansion && queriesToExecute.length === 1) {
      const expanded = await expandQuery(queriesToExecute[0], maxExpansions);
      queriesToExecute.push(...expanded.variants.map((v) => v.query));
    }

    // Step 6: Execute all retrieval queries
    const allResults: RetrievalResult[] = [];
    for (const query of queriesToExecute) {
      const results = await retrievalService.search({
        query,
        topK: 5,
      });
      allResults.push(...results);
    }

    // Step 7: Deduplicate and rank results
    const deduplicated = deduplicateResults(allResults);
    const ranked = rankResultsByConsistency(deduplicated, queriesToExecute);

    res.json({
      originalQuery: question,
      processedQueries: queriesToExecute.map((q, i) => ({
        query: q,
        source: i === 0 ? "rewritten" : "expanded",
      })),
      retrievalResults: ranked.slice(0, 10),
      metadata: {
        totalQueriesExecuted: queriesToExecute.length,
        totalDocumentsRetrieved: allResults.length,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error("Enhanced search failed", error);
    res.status(500).json({ error: "Enhanced search failed" });
  }
});
```

---

## Key Performance Considerations

### Rewriter

- **Cost:** 1 LLM call per query
- **Latency:** ~500-800ms
- **When to use:** Always (minimal overhead for quality gain)

### Decomposer

- **Cost:** 1 LLM call, then 2-4 retrieval calls
- **Latency:** ~1-2 seconds
- **When to use:** Multi-hop queries detected automatically

### Expander

- **Cost:** 1 LLM call, then 2-3 additional retrieval calls
- **Latency:** ~1-1.5 seconds
- **When to use:** Low confidence in initial retrieval, or optional user flag

**Optimization:** Cache rewrite/decompose results for identical queries

---

## Testing & Validation

### Test Cases

```typescript
// Test 1: Vague query rewriting
Input: "Tell me about that AI thing"
Expected: More specific query about AI topic

// Test 2: Multi-part decomposition
Input: "What are supervised vs unsupervised learning and give examples?"
Expected: 3 sub-queries (supervised, unsupervised, examples)

// Test 3: Terminology expansion
Input: "self-driving cars"
Expected: Also search for "autonomous vehicles", "driverless cars"

// Test 4: Query expansion strategy validation
Input: "neural networks"
Variants should include:
  - "deep learning" (expansion)
  - "artificial neural networks" (specific)
  - "AI models" (broader scope)
```

### Evaluation Metrics

- **Rewrite Confidence:** Track LLM confidence scores
- **Decomposition Accuracy:** % of sub-queries that improve final answer
- **Expansion Effectiveness:** Did adding variants improve recall?
- **Latency Impact:** Total time overhead acceptable?

---

## Integration with Existing V1 Code

### Reuse V1 Components:

- ✅ OpenAI service for LLM calls (existing `adapters/openai/`)
- ✅ Pinecone/Vector DB for retrieval (existing `services/rag/`)
- ✅ Firebase logging (existing `services/firebase/logger`)

### New Modules to Create:

- `services/query/rewriter.ts`
- `services/query/classifier.ts`
- `services/query/decomposer.ts`
- `services/query/expander.ts`
- `endpoints/api/query.ts` (new endpoint)

### Type Definitions:

```typescript
// types/query.ts
export interface QueryProcessingResult {
  originalQuery: string;
  rewrittenQuery: string;
  classification: QueryType;
  decomposed: DecomposedQuery | null;
  expanded: ExpandedQuery | null;
  allQueriesToExecute: string[];
}
```

---

## Deliverables Checklist

- [ ] Query rewriter service with LLM integration
- [ ] Query classifier with 5+ query types
- [ ] Query decomposer for multi-hop questions
- [ ] Query expander with synonym/variant generation
- [ ] `/api/query/enhanced-search` endpoint
- [ ] Type definitions in `types/query.ts`
- [ ] Integration tests for all components
- [ ] Performance benchmarks (latency per layer)
- [ ] Documentation with usage examples
- [ ] Logging for debugging query processing
