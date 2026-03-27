# System Architecture - AI RAG API

## Core Pipeline

```
Documents → Chunk → Embed → Store → Query → Retrieve → Generate
```

## Components

### 1. Document Processing
**Location**: `src/services/document.ts`
- Text extraction (TXT, PDF, MD)
- Chunking (500-1000 tokens)
- Metadata preservation

### 2. Embedding Service
**Location**: `src/services/embedding.ts`
- OpenAI `text-embedding-3-small`
- 1536-dimensional vectors
- Batch processing support

### 3. Vector Database
**Location**: `src/adapters/pinecone.ts`
- Pinecone managed service
- Cosine similarity search
- Metadata filtering ready

### 4. RAG Service
**Location**: `src/services/rag.ts`
- Context assembly
- Prompt construction
- Source attribution

### 5. LLM Integration
**Location**: `src/adapters/openai.ts`
- GPT-3.5-turbo for responses
- Token limit management
- Streaming ready

## Data Flow

### Ingestion
```
File → Text → Chunks → Vectors → Pinecone
```

### Query
```
Question → Vector → Search → Context + LLM → Answer
```

## API Structure

```
POST /api/documents      # Upload and index
POST /api/query          # Ask questions
GET  /api/health         # System status
```

## Configuration

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_INDEX=rag-demo
PINECONE_ENVIRONMENT=us-east-1
```

## Performance Targets

- **Ingestion**: 100 docs/minute
- **Query latency**: <500ms
- **Accuracy**: >80% relevant retrieval
- **Uptime**: 99.9%

## Security

- API key authentication
- Rate limiting (100 req/min)
- Input validation
- No data persistence (vectors only)

## Scaling

- Horizontal: Multiple API instances
- Vertical: Larger Pinecone pods
- Async: Queue for bulk operations
