/**
 * Query Understanding API - Quick Reference Guide
 * Task 09: V2 Course - Complete Implementation
 */

/**
 * ENDPOINT: POST /api/query/enhanced-search
 * 
 * A complete query understanding and enhanced retrieval system that transforms
 * raw user queries into optimized semantic queries before searching.
 * 
 * ============================================================================
 * QUICK START
 * ============================================================================
 * 
 * // Simple usage with defaults
 * const response = await fetch('http://localhost:5001/project/region/api/query/enhanced-search', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'auth_token': 'YOUR_TOKEN'
 *   },
 *   body: JSON.stringify({
 *     question: "Tell me about machine learning"
 *   })
 * });
 * 
 * const result = await response.json();
 * 
 * // Access results
 * console.log(result.originalQuery);        // Original user input
 * console.log(result.transformationSteps);  // See how query was processed
 * console.log(result.processedQueries);     // List of queries sent to retrieval
 * console.log(result.retrievalResults);     // Top results (ranked by consistency)
 * console.log(result.metadata);             // Timing and statistics
 * 
 * ============================================================================
 * REQUEST PARAMETERS
 * ============================================================================
 * 
 * question (string, REQUIRED)
 *   - The user's question or query
 *   - Max 1000 characters
 *   - Examples:
 *     * "What is machine learning?"
 *     * "Compare Python and JavaScript"
 *     * "Tell me about neural networks"
 * 
 * context (string, OPTIONAL)
 *   - Additional context for the query
 *   - Useful for multi-turn conversations
 *   - Example: "We were discussing AI earlier..."
 *   - Default: undefined
 * 
 * useExpansion (boolean, OPTIONAL)
 *   - Whether to generate query variants
 *   - Disable for faster results or when baseline search is sufficient
 *   - Default: true
 * 
 * decomposeLargeQueries (boolean, OPTIONAL)
 *   - Whether to break complex queries into sub-queries
 *   - Disable for simple fact queries
 *   - Default: true
 * 
 * maxExpansions (number, OPTIONAL)
 *   - Number of semantic variants to generate per query
 *   - Range: 1-5 (recommended 2-3)
 *   - Higher = more retrieval calls but broader coverage
 *   - Default: 2
 * 
 * topK (number, OPTIONAL)
 *   - Number of results to return
 *   - Range: 1-50
 *   - Default: 10
 * 
 * ============================================================================
 * RESPONSE STRUCTURE
 * ============================================================================
 * 
 * {
 *   "originalQuery": string,
 *   "transformationSteps": [
 *     {
 *       "step": "rewrite" | "classification" | "decompose" | "expand",
 *       "input": string | string[],
 *       "output": string | string[] | object[] | "NO_DECOMPOSITION_NEEDED",
 *       "metadata": {
 *         // Varies by step (see examples below)
 *       },
 *       "durationMs": number
 *     },
 *     ...
 *   ],
 *   "processedQueries": [
 *     {
 *       "query": string,
 *       "source": "rewritten" | "decomposed" | "expanded",
 *       "subQueryId"?: string
 *     },
 *     ...
 *   ],
 *   "retrievalResults": [
 *     {
 *       "id": string,
 *       "text": string,
 *       "score": number (0.0-1.0),
 *       "sourceQueries": string[],
 *       "metadata"?: object
 *     },
 *     ...
 *   ],
 *   "metadata": {
 *     "totalQueriesExecuted": number,
 *     "totalDocumentsRetrieved": number,
 *     "uniqueDocumentsInResults": number,
 *     "processingTimeMs": {
 *       "rewrite": number,
 *       "classification": number,
 *       "decompose": number,
 *       "expand": number,
 *       "retrieval": number,
 *       "deduplication": number,
 *       "ranking": number,
 *       "total": number
 *     }
 *   }
 * }
 * 
 * ============================================================================
 * TRANSFORMATION STEPS EXPLAINED
 * ============================================================================
 * 
 * ### Step 1: REWRITE
 * Optimizes the query for semantic search
 * 
 * Output metadata:
 * {
 *   "rationale": "Why the query was rewritten",
 *   "confidenceScore": 0.0-1.0  // How confident in the rewrite
 * }
 * 
 * Example:
 * Input:  "Tell me about that programming thing"
 * Output: "What are the fundamental concepts of programming?"
 * 
 * ### Step 2: CLASSIFICATION
 * Categorizes query type to aid processing strategy
 * 
 * Output: One of 5 QueryType values
 * - "single_factual": Direct fact questions (What is X?)
 * - "multi_hop": Comparisons or multi-part (Compare X and Y)
 * - "descriptive": Explanations (Explain X, Tell me about X)
 * - "procedural": Step-by-step (How do I X?)
 * - "analytical": Analysis (Why Z?, What causes Z?)
 * 
 * Output metadata:
 * {
 *   "confidence": 0.0-1.0,
 *   "reasoning": "Why query was classified this way"
 * }
 * 
 * ### Step 3: DECOMPOSE
 * Breaks complex queries into independent sub-queries (if needed)
 * 
 * Output: Either "NO_DECOMPOSITION_NEEDED" or array of sub-queries:
 * {
 *   "step": "decompose",
 *   "output": [
 *     {
 *       "id": "0",
 *       "query": "What is supervised learning?",
 *       "sequenceNumber": 0,
 *       "importance": 1.0,
 *       "expectedDocCount": 5
 *     },
 *     ...
 *   ]
 * }
 * 
 * Output metadata:
 * {
 *   "complexity": 0.0-1.0,        // Complexity score of original query
 *   "synthesis": "How to combine results",
 *   "subQueryCount": number
 * }
 * 
 * Example:
 * Input: "Compare Python and JavaScript for web development"
 * Output:
 *   QUERY_1: Advantages of Python for web development
 *   QUERY_2: Advantages of JavaScript for web development
 *   QUERY_3: Comparison matrix between frameworks
 * 
 * ### Step 4: EXPAND
 * Generates semantic variants for broader retrieval coverage
 * 
 * Output: Array of query variants:
 * {
 *   "step": "expand",
 *   "output": [
 *     {
 *       "query": "ML algorithms",
 *       "strategy": "synonym",
 *       "similarity": 0.9
 *     },
 *     {
 *       "query": "Neural network architectures",
 *       "strategy": "expansion",
 *       "similarity": 0.85
 *     }
 *   ]
 * }
 * 
 * Strategies:
 * - "synonym": Similar terms (ML = Machine Learning)
 * - "expansion": Related concepts (includes more ideas)
 * - "specific": Narrower scope (add constraints)
 * - "general": Broader scope (remove constraints)
 * 
 * ============================================================================
 * CURL EXAMPLES
 * ============================================================================
 * 
 * ### Example 1: Simple Fact Query
 * 
 * curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/api/query/enhanced-search \
 *   -H "Content-Type: application/json" \
 *   -H "auth_token: your_token" \
 *   -d '{
 *     "question": "What is artificial intelligence?"
 *   }'
 * 
 * Response:
 * - Simple rewrite for clarity
 * - Classified as SINGLE_FACTUAL
 * - No decomposition needed
 * - 1-2 expanded variants generated
 * - Total queries executed: 2-3
 * - Total time: ~2-3 seconds
 * 
 * ### Example 2: Multi-Part Query
 * 
 * curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/api/query/enhanced-search \
 *   -H "Content-Type: application/json" \
 *   -H "auth_token: your_token" \
 *   -d '{
 *     "question": "Compare supervised and unsupervised learning, and give examples",
 *     "useExpansion": false,
 *     "topK": 15
 *   }'
 * 
 * Response:
 * - Query rewritten for specificity
 * - Classified as MULTI_HOP
 * - Decomposed into 3-4 sub-queries
 * - No expansion (useExpansion: false)
 * - Total queries executed: 4
 * - Total time: ~3-4 seconds
 * - Results: 15 top documents ranked by consistency
 * 
 * ### Example 3: With Context (Multi-turn)
 * 
 * curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/api/query/enhanced-search \
 *   -H "Content-Type: application/json" \
 *   -H "auth_token: your_token" \
 *   -d '{
 *     "question": "How does it work?",
 *     "context": "We were discussing neural networks earlier",
 *     "maxExpansions": 3,
 *     "topK": 5
 *   }'
 * 
 * Response:
 * - Rewriter uses context: "How do neural networks work?"
 * - Classification: DESCRIPTIVE
 * - 3 expanded variants generated
 * - Total queries executed: 4
 * 
 * ============================================================================
 * PROCESSING TIMESTAMPS & OPTIMIZATION
 * ============================================================================
 * 
 * // Access timing information to optimize client behavior
 * 
 * const result = await fetch(...).then(r => r.json());
 * const timing = result.metadata.processingTimeMs;
 * 
 * console.log(`Rewriting:       ${timing.rewrite}ms`);
 * console.log(`Classification:  ${timing.classification}ms`);
 * console.log(`Decomposition:   ${timing.decompose}ms`);
 * console.log(`Expansion:       ${timing.expand}ms`);
 * console.log(`Retrieval:       ${timing.retrieval}ms`);
 * console.log(`Deduplication:   ${timing.deduplication}ms`);
 * console.log(`Ranking:         ${timing.ranking}ms`);
 * console.log(`TOTAL:           ${timing.total}ms`);
 * 
 * // Optimization strategies:
 * if (timing.total > 5000) {
 *   // Query processing took too long
 *   // Next time: disable decomposition or expansion for this type of query
 * }
 * 
 * if (timing.expand > 1000) {
 *   // Expansion took a while
 *   // Next time: reduce maxExpansions or disable useExpansion
 * }
 * 
 * ============================================================================
 * ERROR HANDLING
 * ============================================================================
 * 
 * // 400 Bad Request: Missing or invalid question
 * {
 *   "error": "question field required in request body (must be non-empty string)"
 * }
 * 
 * // 400 Bad Request: Question too long
 * {
 *   "error": "question too long (max 1000 characters)"
 * }
 * 
 * // 500 Internal Server Error
 * {
 *   "error": "Enhanced search failed: [error details]"
 * }
 * 
 * ### Graceful Degradation
 * Even if some layers fail, the API returns valid results:
 * - Rewriter fails → Returns original query
 * - Classifier fails → Defaults to DESCRIPTIVE
 * - Decomposer fails → No sub-queries generated
 * - Expander fails → No variants generated
 * - Retrieval fails for a query → Skips that query, continues with others
 * 
 * When any layer fails, the transformation step still appears in response
 * with metadata explaining what happened.
 * 
 * ============================================================================
 * BEST PRACTICES
 * ============================================================================
 * 
 * 1. START WITH DEFAULTS
 *    const response = await fetch(url, {
 *      body: JSON.stringify({ question: userInput })
 *    });
 *    // Use default expansion and decomposition
 * 
 * 2. ADJUST FOR YOUR USE CASE
 *    - Fast fact lookup? Disable expansion: useExpansion: false
 *    - Complex comparison? Keep decomposition enabled
 *    - Mobile/bandwidth-constrained? Reduce topK and maxExpansions
 * 
 * 3. MONITOR TIMING
 *    - Track avg processing times
 *    - Set up alerts if total > 5 seconds
 *    - Adjust parameters if certain steps are slow
 * 
 * 4. USE TRANSFORMATION STEPS FOR DEBUGGING
 *    - If results not good, check transformationSteps
 *    - See exactly how query was rewritten
 *    - Understand classification reasoning
 *    - Review which queries were executed
 * 
 * 5. IMPLEMENT CACHING (future enhancement)
 *    - Cache results for identical questions
 *    - Use queryHash as cache key
 *    - TTL: 24 hours or per-domain decision
 * 
 * 6. TRACK METRICS
 *    - Which query types have best results?
 *    - Which expansion strategies work best?
 *    - How much does decomposition help?
 *    - A/B test vs basic /ask endpoint
 * 
 * ============================================================================
 * COMPARISON WITH /api/rag/ask
 * ============================================================================
 * 
 * /api/query/enhanced-search (TASK 09 - NEW)
 * ✅ Step-by-step transformation visibility
 * ✅ Intelligent multi-query execution
 * ✅ Consistency-based ranking
 * ✅ Detailed timing information
 * ✅ Complex query decomposition
 * ✅ Query expansion for better recall
 * ⚠️  Higher latency (~3-5 seconds typical)
 * ⚠️  More API calls
 * 
 * /api/rag/ask (EXISTING)
 * ✅ Fast single-query execution
 * ✅ Built-in answer generation
 * ✅ Simple low-latency pattern
 * ❌ Limited for complex queries
 * ❌ No visibility into retrieval process
 * ❌ Basic ranking (score only)
 * 
 * RECOMMENDATION:
 * - Use /api/query/enhanced-search for complex, important queries
 * - Use /api/rag/ask for simple fact lookups needing quick answers
 * - Implement both in your application based on query complexity
 * 
 * ============================================================================
 * INTEGRATION WITH DOWNSTREAM TASKS
 * ============================================================================
 * 
 * This enhanced-search endpoint is designed to integrate with:
 * 
 * TASK 10: Tool Architecture
 * - Use enhanced retrieval for tool selection input
 * 
 * TASK 11: Planner
 * - Use transformation steps as planning hints
 * - Decomposed queries become plan steps
 * 
 * TASK 12: Reflection
 * - Track when transformations improve/degrade results
 * - Learn optimal parameters per query type
 * 
 * TASK 13: Memory
 * - Store effective transformations for pattern learning
 * - Cache successful query rewrites
 * 
 */

