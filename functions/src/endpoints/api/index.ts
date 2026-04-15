import { Router as createRouter } from 'express';
import { embedHandler } from './embed';
import { upsertHandler, sampleUpsertDataHandler } from './upsert';
import { searchHandler, sampleSearchQueriesHandler } from './search';
import { postChunk } from './chunk';
import {
  getIndexInfoHandler,
  listIndexesHandler,
  ensureIndexHandler,
  healthCheckHandler,
} from './status';
import ragRouter from './rag';
import optimizationRouter from './optimization';
import queryRouter from './query';

const router = createRouter();

/**
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/embed \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{"text": "hello world"}'
 */
router.post('/embed', embedHandler);

/**
 * Upsert documents to Pinecone index
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/upsert \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{
    "documents": [
      {
        "id": "doc-1",
        "text": "Sample document",
        "metadata": { "source": "test" }
      }
    ]
  }'
 */
router.post('/upsert', upsertHandler);

/**
 * Get sample test data for upsert
 *
 * Sample request:
 *
  curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/upsert/sample \
  -H "auth_token: some_value"
 */
router.get('/upsert/sample', sampleUpsertDataHandler);

/**
 * Search for similar documents using semantic similarity
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/search \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{
    "query": "What is machine learning?",
    "topK": 3
  }'
 */
router.post('/search', searchHandler);

/**
 * Get sample search queries for testing
 *
 * Sample request:
 *
  curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/search/sample \
  -H "auth_token: some_value"
 */
router.get('/search/sample', sampleSearchQueriesHandler);

// ===== TASK 06: CHUNKING ENDPOINTS =====

/**
 * Chunk documents using different strategies (fixed-size, sliding-window, semantic)
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/chunk \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{
    "text": "Your document text here...",
    "strategy": "compare"
  }'
 */
router.post('/chunk', postChunk);

// ===== PINECONE STATUS ENDPOINTS =====

/**
 * Quick Pinecone connection health check
 *
 * Sample request:
 *
  curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/health \
  -H "auth_token: some_value"
 */
router.get('/pinecone/health', healthCheckHandler);

/**
 * Get detailed Pinecone index information
 *
 * Sample request:
 *
  curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/info \
  -H "auth_token: some_value"
 */
router.get('/pinecone/info', getIndexInfoHandler);

/**
 * List all Pinecone indexes
 *
 * Sample request:
 *
  curl -X GET http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/indexes \
  -H "auth_token: some_value"
 */
router.get('/pinecone/indexes', listIndexesHandler);

/**
 * Ensure Pinecone index exists (create if not exists)
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/pinecone/ensure \
  -H "auth_token: some_value"
 */
router.post('/pinecone/ensure', ensureIndexHandler);

// ===== RAG ENDPOINTS =====

/**
 * Ask a question and get an answer grounded in the knowledge base
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/rag/ask \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{
    "question": "What is machine learning?"
  }'
 */
router.use('/rag', ragRouter);

// ===== TASK 08: RETRIEVAL OPTIMIZATION ENDPOINTS =====

/**
 * Optimized retrieval with query expansion, fusion, and reranking
 * Use for improved quality when baseline search is insufficient
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/optimization/retrieve \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{
    "question": "What is machine learning?",
    "useExpansion": true,
    "useFusion": true,
    "useReranking": true,
    "topK": 3
  }'
 */
router.use('/optimization', optimizationRouter);

// ===== V2 TASK 09: QUERY UNDERSTANDING & DECOMPOSITION ENDPOINTS =====

/**
 * Enhanced semantic search with query understanding
 * Rewrites, classifies, decomposes, and expands queries before retrieval
 *
 * Sample request:
 *
  curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/query/enhanced-search \
  -H "Content-Type: application/json" \
  -H "auth_token: some_value" \
  -d '{
    "question": "Tell me about that programming thing",
    "useExpansion": true,
    "decomposeLargeQueries": true,
    "maxExpansions": 2,
    "topK": 10
  }'
 */
router.use('/query', queryRouter);

export default router;
