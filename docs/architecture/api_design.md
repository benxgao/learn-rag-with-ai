# API Roadmap — RAG MVP (8-Phase Implementation)

This document maps API endpoints to the 8-phase RAG MVP implementation tasks.

---

## Phase Overview

| Phase | Task | Purpose | API Endpoint |
|-------|------|---------|--------------|
| 1 | 01-openai-embedding | Generate text embeddings | `POST /embed` |
| 2 | 02-pinecone-index | Initialize vector DB | `POST /index/init` |
| 3 | 03-upsert-data | Store vectors | `POST /index/upsert` |
| 4 | 04-query-similarity | Semantic search | `POST /search` |
| 5 | 05-simple-rag | Full RAG pipeline | `POST /rag/query` |
| 6 | 06-chunking-strategy | Text chunking | `POST /chunk` |
| 7 | 07-eval-retrieval | Retrieval evaluation | `POST /eval/retrieval` |
| 8 | 08-improve-retrieval | Enhanced search | `POST /search/enhanced` |

---

## Phase 1: Text Embedding

**POST** `/embed`

Generate embeddings for input text using OpenAI.

**Request:**
```json
{
  "text": "string (required)"
}
```

**Response:**
```json
{
  "embedding": [0.023, -0.045, ...],
  "dimensions": 1536,
  "model": "text-embedding-3-small"
}
```

---

## Phase 2: Vector Database Setup

**POST** `/index/init`

Initialize Pinecone index connection.

**Request:**
```json
{
  "indexName": "string (optional, default from env)"
}
```

**Response:**
```json
{
  "status": "connected",
  "indexName": "rag-index",
  "dimension": 1536,
  "metric": "cosine"
}
```

---

## Phase 3: Vector Storage

**POST** `/index/upsert`

Store embedded vectors in Pinecone.

**Request:**
```json
{
  "vectors": [
    {
      "id": "string (required)",
      "text": "string (required)",
      "metadata": {
        "source": "string",
        "chunkIndex": 0
      }
    }
  ],
  "namespace": "string (optional)"
}
```

**Response:**
```json
{
  "upsertedCount": 1,
  "namespace": "default"
}
```

---

## Phase 4: Semantic Search

**POST** `/search`

Query similar vectors using cosine similarity.

**Request:**
```json
{
  "query": "string (required)",
  "topK": 3,
  "namespace": "string (optional)"
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "chunk-001",
      "score": 0.89,
      "text": "Matching content...",
      "metadata": {}
    }
  ]
}
```

---

## Phase 5: Simple RAG

**POST** `/rag/query`

Complete RAG pipeline: embed → search → generate.

**Request:**
```json
{
  "query": "string (required)",
  "topK": 3,
  "systemPrompt": "string (optional)"
}
```

**Response:**
```json
{
  "answer": "Generated response...",
  "context": [
    {
      "id": "chunk-001",
      "text": "Retrieved content...",
      "score": 0.89
    }
  ],
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 45
  }
}
```

---

## Phase 6: Text Chunking

**POST** `/chunk`

Split text into chunks for better retrieval.

**Request:**
```json
{
  "text": "string (required)",
  "strategy": "fixed|semantic|recursive (default: fixed)",
  "chunkSize": 500,
  "overlap": 50
}
```

**Response:**
```json
{
  "chunks": [
    {
      "text": "Chunk content...",
      "index": 0,
      "tokenCount": 125
    }
  ],
  "totalChunks": 5,
  "strategy": "fixed"
}
```

---

## Phase 7: Retrieval Evaluation

**POST** `/eval/retrieval`

Evaluate retrieval quality with test queries.

**Request:**
```json
{
  "testCases": [
    {
      "query": "What is RAG?",
      "expectedChunkIds": ["chunk-001", "chunk-002"]
    }
  ],
  "topK": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "query": "What is RAG?",
      "precision": 0.8,
      "recall": 1.0,
      "retrievedIds": ["chunk-001", "chunk-003", "chunk-002"],
      "expectedIds": ["chunk-001", "chunk-002"]
    }
  ],
  "averagePrecision": 0.8,
  "averageRecall": 1.0
}
```

---

## Phase 8: Enhanced Retrieval

**POST** `/search/enhanced`

Improved search with reranking or hybrid search.

**Request:**
```json
{
  "query": "string (required)",
  "topK": 10,
  "rerank": true,
  "finalK": 3
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "chunk-001",
      "vectorScore": 0.89,
      "rerankScore": 0.95,
      "text": "Most relevant content...",
      "method": "vector+rerank"
    }
  ],
  "method": "vector+rerank"
}
```

---

## Implementation Notes

### Dependencies
- OpenAI API for embeddings
- Pinecone for vector storage
- Firebase Functions for hosting

### Environment Variables
```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=rag-index
PINECONE_ENVIRONMENT=us-east-1
```

### Error Handling
All endpoints return consistent error format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field: text",
    "details": {}
  }
}
```

### Rate Limiting
- 100 requests/minute per IP
- 1000 requests/day per API key

### Authentication
Endpoints are public for MVP. Add Firebase Auth later if needed.

---

## Development Progress

### Completed Phases
- [ ] Phase 1: Embedding generation
- [ ] Phase 2: Vector DB setup  
- [ ] Phase 3: Vector storage
- [ ] Phase 4: Semantic search
- [ ] Phase 5: Simple RAG
- [ ] Phase 6: Text chunking
- [ ] Phase 7: Retrieval evaluation
- [ ] Phase 8: Enhanced retrieval

### Next Steps
1. Implement Phase 1 (embedding) endpoint
2. Add Pinecone adapter
3. Create vector storage service
4. Build semantic search functionality
5. Integrate RAG pipeline