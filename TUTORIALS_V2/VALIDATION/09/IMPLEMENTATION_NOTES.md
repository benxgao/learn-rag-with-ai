## What Was Built

A complete 4-layer query understanding system that transforms raw user queries
into optimized semantic queries before retrieval. The system provides full
visibility into the query transformation process at each layer.

## Architecture Overview

```
Raw User Query
    ↓
[1. Rewriter] → Improves clarity & specificity (LLM call)
    ↓
[2. Classifier] → Categorizes into 5 query types (LLM call)
    ↓
[3. Decomposer] → Breaks multi-hop queries into sub-queries (LLM call)
    ↓
[4. Expander] → Generates semantic variants (LLM call)
    ↓
Enhanced Retrieval
```

## Core Files Created

### Types

- `functions/src/types/query.ts`
  - QueryType enum (SINGLE_FACTUAL, MULTI_HOP, DESCRIPTIVE, PROCEDURAL, ANALYTICAL)
  - QueryRewriteResponse (originalQuery, rewrittenQuery, rationale, confidenceScore)
  - QueryClassification (query, classification, confidence, reasoning)
  - DecomposedQuery (originalQuery, subQueries[], synthesis, complexity)
  - QueryVariant (query, strategy, similarity)
  - ExpandedQuery (originalQuery, variants[], totalVariants)
  - QueryProcessingStep (tracks transformations: step, input, output, metadata, durationMs)
  - QueryProcessingResult (aggregates all processing results)
  - EnhancedSearchRequest/Response (API contract with step-by-step transformations)

### Services

- `functions/src/services/query/rewriter.ts`
  - rewriteQuery(): Optimizes queries for semantic search using gpt-3.5-turbo
  - Temperature: 0.3 (low for consistent, focused rewrites)
  - Extracts: rewritten query + rationale + confidence score
  - Fallback: Returns original query if rewriting fails
- `functions/src/services/query/classifier.ts`
  - classifyQuery(): Categorizes query into 5 types
  - Temperature: 0.2 (low for deterministic classification)
  - Returns: QueryType + confidence + reasoning
  - Fallback: Defaults to DESCRIPTIVE if classification fails
- `functions/src/services/query/decomposer.ts`
  - decomposeQuery(): Breaks multi-hop queries into 2-4 independent sub-queries
  - Temperature: 0.4 (moderate for creative decomposition)
  - Returns: SubQuery array with id, query, sequenceNumber, importance, expectedDocCount
  - Synthesis guidelines for combining results
  - Complexity score (0.0-1.0)
  - Fallback: No decomposition for single-part queries
- `functions/src/services/query/expander.ts`
  - expandQuery(): Generates 2-3 semantic variants per query
  - Temperature: 0.6 (higher for creative variants)
  - Strategies: synonym, expansion, specific, general
  - Similarity scores for each variant (decreasing)
  - Fallback: Empty variants if expansion fails
- `functions/src/services/query/index.ts` (Orchestrator)
  - processQuery(): Sequences all 4 layers and tracks transformations
  - Returns: QueryProcessingResult with:
    - All processed queries ready for retrieval
    - Complete transformation history (for API visibility)
    - Total processing time and per-layer durations
  - Graceful error handling at each layer
  - Structured logging for debugging

### Endpoints

- `functions/src/endpoints/api/query.ts`
  - POST /api/query/enhanced-search
  - Request: question, context, useExpansion, decomposeLargeQueries, maxExpansions, topK
  - Response includes:
    - originalQuery: User's input
    - transformationSteps: Array showing step-by-step transformation
      - step: "rewrite" | "classification" | "decompose" | "expand"
      - input: Query at this step
      - output: Result (rewritten query, type, sub-queries, variants, or "NO_DECOMPOSITION_NEEDED")
      - metadata: Rationale, confidence, reasoning, synthesis, complexity, etc.
      - durationMs: Time taken at this step
    - processedQueries: Final list of queries sent to retrieval with source tracking
    - retrievalResults: Ranked results (deduplicated, ranked by consistency)
    - metadata: Timing breakdown (rewrite, classification, decompose, expand, retrieval, deduplication, ranking, total)

### Tests

- `functions/src/__tests__/query.test.ts`
  - 15 integration tests covering:
    - Single query through all layers
    - Multi-hop decomposition
    - Transformation step tracking and timing
    - Query classification correctness
    - Expansion enabling/disabling
    - Options handling (useExpansion, decomposeLargeQueries, maxExpansions)
    - Error handling and graceful fallbacks
    - Step structure validation (required fields, metadata quality)
  - All tests passing ✅

## Key Features

### 1. Query Rewriting

Transforms vague/unclear queries into specific, semantic-rich queries
Examples:

- "Tell me about that programming thing"
  → "What are the fundamental concepts of programming?"
- "fastest animal thing"
  → "Which animal species has the highest maximum speed?"
- "ML vs DL"
  → "Key differences between machine learning and deep learning"

### 2. Query Classification

Categorizes queries to determine processing strategy:

- SINGLE_FACTUAL: "What is X?" → Direct answers
- MULTI_HOP: "Compare X and Y" → Need multiple queries
- DESCRIPTIVE: "Explain X" → Comprehensive explanations
- PROCEDURAL: "How do I X?" → Step-by-step instructions
- ANALYTICAL: "Why Z?" → Root cause analysis

### 3. Query Decomposition

Breaks complex queries into independent, retrievable sub-queries:
Input: "Compare supervised and unsupervised learning, and give examples"
Output:
QUERY_1: What is supervised learning?
QUERY_2: What is unsupervised learning?
QUERY_3: Examples of supervised learning
QUERY_4: Examples of unsupervised learning

### 4. Query Expansion

Generates semantic variants for broader coverage:
Input: "machine learning models"
Output: - "ML algorithms" (synonym) - "Neural network architectures" (expansion) - "Deep learning techniques" (specific)

### 5. Step-by-Step Transformation Visibility

API response includes detailed history of how query was transformed:

- See exactly what the rewriter produced and why
- Understand how the query was classified
- View decomposition logic if applied
- Track which variants were generated and their strategies
- Measure latency at each step for optimization

### 6. Intelligent Retrieval

Enhanced retrieval with:

- Deduplication: Remove duplicate docs across multiple query results
- Consistency-based ranking: Docs retrieved by multiple queries ranked higher
- Top-K filtering: Return only most relevant results
- Source tracking: Know which query(ies) retrieved each document

## Integration with Existing V1 Code

### Reused Components

✅ OpenAI client singleton (adapters/openai/)

- Uses getOpenAIClient() for all LLM calls
- Model: gpt-3.5-turbo (cost/speed optimized)
  ✅ Retrieval service (services/rag/retrieval.ts)
- querySimilar(query: string, topK: number) for each processed query
- Embedding + Pinecone search already handled
  ✅ Firebase logging (services/firebase/logger)
- Structured logging for debugging and observability
- Info, warn, error levels
  ✅ Error handling patterns
- Graceful fallbacks at each layer
- Consistent error responses

### No Breaking Changes

- Existing /api/rag/ask endpoint unchanged
- Existing /api/search endpoint unchanged
- New /api/query/enhanced-search is independent addition
- All new code is isolated in services/query/ directory

## Performance Characteristics

### Latency per Layer (typical)

- Rewriter: 400-600ms (1 LLM call)
- Classifier: 250-400ms (1 LLM call)
- Decomposer: 600-1000ms (1 LLM call)
- Expander: 300-600ms (1 LLM call)
- **Total query processing: <3 seconds** ✅

### Retrieval Performance

- Rewritten query: 1 embedding + 1 Pinecone search (~500ms)
- Per decomposed query: 1 embedding + 1 Pinecone search (~500ms each)
- Per expanded variant: 1 embedding + 1 Pinecone search (~500ms each)
- **Total retrieval depends on # queries**: 500ms + 500ms per additional query

### Memory Usage

- Minimal: Query strings and processing results are small
- No buffering of large datasets

## Error Handling & Resilience

### Graceful Degradation

- Rewriter fails → Return original query
- Classifier fails → Default to DESCRIPTIVE
- Decomposer fails → Return original query as single sub-query
- Expander fails → Return no variants (skip expansion)
- Retrieval fails for a query → Skip that query, continue with others
- ANY layer fails → Still return valid API response with fallback values

### Logging & Debugging

- All transformations logged with timestamps
- Step duration captured for performance monitoring
- Error details logged with context
- Query examples logged for analysis

## API Usage Examples

### Example 1: Simple Query

```
POST /api/query/enhanced-search
{
  "question": "What is machine learning?",
  "useExpansion": true,
  "topK": 5
}
Response: {
  "originalQuery": "What is machine learning?",
  "transformationSteps": [
    {
      "step": "rewrite",
      "input": "What is machine learning?",
      "output": "Definition and overview of machine learning",
      "metadata": { "rationale": "...", "confidenceScore": 0.92 },
      "durationMs": 450
    },
    {
      "step": "classification",
      "input": "Definition and overview of machine learning",
      "output": "SINGLE_FACTUAL",
      "metadata": { "confidence": 0.95, "reasoning": "..." },
      "durationMs": 320
    },
    {
      "step": "decompose",
      "output": "NO_DECOMPOSITION_NEEDED",
      "metadata": { "reason": "Single-part query", "complexity": 0.1 },
      "durationMs": 0
    },
    {
      "step": "expand",
      "output": [
        { "query": "ML algorithms", "strategy": "synonym" },
        { "query": "Statistical learning", "strategy": "expansion" }
      ],
      "metadata": { "variantCount": 2, "totalQueriesToExecute": 3 },
      "durationMs": 520
    }
  ],
  "processedQueries": [
    { "query": "Definition and overview of machine learning", "source": "rewritten" },
    { "query": "ML algorithms", "source": "expanded" },
    { "query": "Statistical learning", "source": "expanded" }
  ],
  "retrievalResults": [
    { "id": "doc_1", "text": "Machine learning is...", "score": 0.94, "sourceQueries": ["rewritten"] },
    ...
  ],
  "metadata": {
    "totalQueriesExecuted": 3,
    "totalDocumentsRetrieved": 15,
    "uniqueDocumentsInResults": 10,
    "processingTimeMs": {
      "rewrite": 450,
      "classification": 320,
      "decompose": 0,
      "expand": 520,
      "retrieval": 1200,
      "deduplication": 50,
      "ranking": 100,
      "total": 2640
    }
  }
}
```

### Example 2: Complex Multi-Part Query

```
POST /api/query/enhanced-search
{
  "question": "Compare Python and JavaScript for web development",
  "useExpansion": false,
  "decomposeLargeQueries": true,
  "topK": 10
}
Response includes:
- Rewrite: Makes query more specific
- Classification: MULTI_HOP (comparison query)
- Decomposition: Breaks into 3 sub-queries
  * Advantages of Python for web development
  * Advantages of JavaScript for web development
  * Comparison framework and tools
- No expansion (useExpansion: false)
- Retrieval: All 3 queries executed
- Results: Ranked by consistency (docs retrieved by multiple queries ranked higher)
```

## Testing Status

### Unit Tests ✅

All 15 integration tests passing:

- ✅ Single query processing through all layers
- ✅ Transformation step tracking
- ✅ Timing capture per layer
- ✅ Query classification correctness
- ✅ Expansion handling
- ✅ Multi-hop decomposition
- ✅ Options configuration
- ✅ Error handling and fallbacks
- ✅ Step structure validation
- ✅ Metadata quality validation

### Build Status ✅

- TypeScript compilation: PASS
- All imports resolved
- No type errors

## Future Enhancements

### Performance Optimization

1. **Query Result Caching**
   - Cache rewriter/decomposer outputs for identical queries
   - Redis-backed for distributed deployments
   - Expected 2-3x speedup for repeat queries
2. **Batch LLM Calls**
   - Group sub-queries into single LLM call for decomposer
   - Reduce latency from ~1s to ~600ms
3. **Early Termination**
   - Skip decomposer for queries with low multi-hop probability
   - Save ~600ms for simple queries
4. **Adaptive Expansion**
   - Generate fewer variants for simple queries
   - More variants for complex queries with low initial recall

### Quality Enhancement

1. **Reliability Scoring**
   - Track which transformations improve final answer quality
   - Use scores to tune layer parameters
2. **Confidence-Based Routing**
   - Skip layers with low confidence scores
   - Example: Skip decomposition if classifier confidence < 0.7
3. **Multi-Turn Conversation**
   - Pass conversation history as context to rewriter
   - Better query understanding in chatbot scenarios
4. **A/B Testing Framework**
   - Compare enhanced-search vs basic /ask endpoint
   - Measure improvement in recall, precision, user satisfaction

### Monitoring & Observability

1. **Metrics Dashboard**
   - Per-layer latency tracking
   - Success/failure rates
   - Query transformation patterns
2. **Cost Tracking**
   - Monitor LLM API calls and costs
   - Optimize model selection (gpt-3.5-turbo vs gpt-4)

## Validation Checklist ✅

- [x] Type definitions in query.ts complete with all 5 phases
- [x] Rewriter service implemented (gpt-3.5-turbo, temp 0.3)
- [x] Classifier service implemented (5 query types)
- [x] Decomposer service implemented (multi-hop handling)
- [x] Expander service implemented (semantic variants)
- [x] Query orchestrator implemented (sequences all layers)
- [x] Enhanced search endpoint created (/api/query/enhanced-search)
- [x] Endpoint registered in API router
- [x] API response includes transformation steps (step-by-step visibility)
- [x] Deduplication logic implemented
- [x] Consistency-based ranking implemented
- [x] Error handling with graceful fallbacks
- [x] Structured logging at all layers
- [x] Integration tests (15 tests, all passing)
- [x] TypeScript compilation successful
- [x] No breaking changes to existing endpoints
- [x] Proper fallback values when layers fail
- [x] Per-layer timing captured
- [x] All types properly exported

## Files Modified/Created

### Created (10 files)

1. functions/src/types/query.ts - Type definitions
2. functions/src/services/query/rewriter.ts - Query rewriting
3. functions/src/services/query/classifier.ts - Query classification
4. functions/src/services/query/decomposer.ts - Query decomposition
5. functions/src/services/query/expander.ts - Query expansion
6. functions/src/services/query/index.ts - Orchestrator
7. functions/src/endpoints/api/query.ts - Enhanced search endpoint
8. functions/src/**tests**/query.test.ts - Integration tests
9. functions/src/IMPLEMENTATION_NOTES.md - This file

### Modified (2 files)

1. functions/src/types/index.ts - Export query types
2. functions/src/endpoints/api/index.ts - Register query router

### Unchanged (Preserved compatibility)

- functions/src/endpoints/api/rag.ts
- functions/src/endpoints/api/search.ts
- functions/src/services/rag/retrieval.ts
- functions/src/services/rag/rag.ts
- functions/src/services/rag/optimization.ts
- All middleware and config files

## Summary

Task 09 - Query Understanding & Decomposition is **COMPLETE** ✅
The implementation provides a production-ready 4-layer query processing system
with:

- Full visibility into query transformations (step-by-step API response)
- Robust error handling with graceful fallbacks
- Comprehensive testing (15 tests, all passing)
- Zero breaking changes to existing code
- Efficient retrieval with deduplication and consistency-based ranking
- Structured logging for debugging and monitoring
- Ready for integration with downstream tasks (planner, reflection, memory)
