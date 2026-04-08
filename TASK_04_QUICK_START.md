# Task 04 Quick Start Guide

## Setup (5 minutes)

### 1. Ensure Index is Populated
First, run Task 03 to populate Pinecone with documents:

```bash
# Start dev server
npm run dev

# In another terminal, upsert sample data
curl -X POST http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/upsert \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d '{
    "documents": [
      {
        "id": "doc-1",
        "text": "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.",
        "metadata": { "source": "ai-intro", "difficulty": "beginner" }
      },
      {
        "id": "doc-2",
        "text": "Embeddings are numerical representations of text that capture semantic meaning. They allow us to perform similarity search on documents.",
        "metadata": { "source": "embeddings-guide", "difficulty": "intermediate" }
      },
      {
        "id": "doc-3",
        "text": "Vector databases like Pinecone optimize storage and retrieval of embeddings at scale. They use advanced indexing techniques like HNSW.",
        "metadata": { "source": "vector-db", "difficulty": "intermediate" }
      }
    ]
  }'
```

Expected response: `{ "status": "success", "metrics": { "vectorsUpserted": 3 } }`

### 2. Test Search Endpoint
```bash
curl -X POST http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/search \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d '{"query": "What is machine learning?", "topK": 3}'
```

Expected response: 3 documents sorted by relevance score (0.0-1.0)

## Usage Patterns

### Pattern 1: Basic Search
```typescript
import { querySimilar } from './src/services/rag/retrieval';

const results = await querySimilar("What is machine learning?", 3);
// Returns: [{ id, text, score, metadata }, ...]
```

### Pattern 2: Quality-Filtered Search
```typescript
import { querySimilarFiltered } from './src/services/rag/retrieval';

// Only return documents with score >= 0.75
const results = await querySimilarFiltered(
  "embeddings",
  5,  // topK
  0.75  // minScore
);
```

### Pattern 3: Score Interpretation
```typescript
import { getSimilarityLabel } from './src/services/rag/retrieval';

const label = getSimilarityLabel(0.92);  // "🟢 Excellent match"
const label = getSimilarityLabel(0.65);  // "🟡 Fair match"
```

### Pattern 4: Formatted Output
```typescript
import { formatResults } from './src/services/rag/retrieval';

const formatted = formatResults(results);
console.log(formatted);
// Output:
// 1. [0.9247] 🟢 Excellent match
//    ID: doc-1
//    Text: Machine learning is...
//    Source: ai-intro
// ...
```

## API Reference

### POST /api/search
Search for documents similar to query.

**Request:**
```json
{
  "query": "What is machine learning?",
  "topK": 3,
  "minScore": 0.7,
  "formatted": false
}
```

**Response:**
```json
{
  "status": "success",
  "query": "What is machine learning?",
  "topK": 3,
  "resultCount": 3,
  "results": [
    {
      "id": "doc-1",
      "text": "Machine learning is...",
      "score": 0.924,
      "metadata": { "source": "ai-intro", "difficulty": "beginner" }
    }
  ],
  "metrics": {
    "totalTime": 245,
    "averageScore": 0.87,
    "scores": [0.924, 0.812, 0.756]
  }
}
```

### GET /api/search/sample
Get sample queries for testing.

**Response:**
```json
{
  "status": "success",
  "queryCount": 5,
  "queries": [
    {
      "text": "What is machine learning?",
      "description": "Query about fundamental ML concepts",
      "expectedTopics": ["machine learning", "AI"]
    }
  ]
}
```

## Troubleshooting

### Issue: "No results found"
**Causes:**
1. Pinecone index is empty (run `/api/upsert` first)
2. Query is too specific or unrelated to documents
3. minScore is too high

**Solutions:**
- Check index stats: `npm run test:pinecone:stats`
- Lower minScore to 0.5-0.6
- Use more general query terms

### Issue: Low similarity scores (<0.5)
**Causes:**
1. Query and documents use different languages
2. Query is about unrelated topic
3. Embedding model mismatch

**Solutions:**
- Verify documents were upserted with text-embedding-3-small
- Check document content with `/api/upsert/sample`
- Use related query keywords

### Issue: Slow response (>2 seconds)
**Causes:**
1. Network latency to OpenAI (embedding)
2. Network latency to Pinecone (search)
3. High server load

**Solutions:**
- Check network connectivity
- Use cached embeddings for common queries
- Batch queries if doing many searches

## Score Guidelines

**When to use which scores:**

| Use Case | minScore | Reason |
|----------|----------|--------|
| Production AI answers | 0.75+ | High confidence only |
| Q&A systems | 0.70-0.75 | Good quality, reasonable coverage |
| Search suggestions | 0.60-0.70 | More options, some noise OK |
| Research/exploration | 0.50+ | Comprehensive, may need filtering |
| Default (balanced) | 0.70 | Good trade-off |

## Performance Tips

1. **topK tuning**
   - Start with topK=3 (industry standard)
   - Increase if you need more context
   - Decrease if too slow or noisy

2. **minScore tuning**
   - Start with minScore=0.7
   - Increase for stricter quality
   - Decrease for more results

3. **Caching**
   - Cache embeddings for common queries
   - Reuse search results within same session
   - Consider Redis for popular queries

4. **Batching**
   - If searching many queries, batch them
   - Parallelize requests when possible
   - Monitor rate limits

## Integration with Next Tasks

### Task 05 (Evaluation)
Task 04 results feed into relevance metrics:
- Measure average similarity score
- Track result diversity
- Evaluate retrieval quality

### Task 06 (RAG)
Task 04 retrieved documents + user query → LLM answer:
```typescript
const context = await querySimilar(userQuery, 5);
const answer = await generateAnswer(userQuery, context);
```

## Code Examples

### Full Search Example
```typescript
import { 
  querySimilar, 
  getSimilarityLabel, 
  calculateMetrics 
} from './src/services/rag/retrieval';

async function search(query: string) {
  const startTime = Date.now();
  
  const results = await querySimilar(query, 3);
  
  for (const result of results) {
    console.log(`[${result.score.toFixed(2)}] ${getSimilarityLabel(result.score)}`);
    console.log(`  ${result.text.substring(0, 100)}...`);
  }
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics(query, results, 3, totalTime);
  console.log(`Average relevance: ${metrics.averageScore.toFixed(2)}`);
}
```

### Error Handling Example
```typescript
async function safeSearch(query: string) {
  try {
    const results = await querySimilar(query, 3);
    if (results.length === 0) {
      console.log("No results found. Try a different query.");
      return [];
    }
    return results;
  } catch (error) {
    if (error.message.includes("Query must be")) {
      console.log("Invalid query format");
    } else if (error.message.includes("topK")) {
      console.log("Invalid topK parameter");
    } else {
      console.log("Search error: Check Pinecone connection");
    }
    return [];
  }
}
```

## Testing

### Run All Tests
```bash
./test-search.sh
```

### Test Specific Query
```bash
curl -X POST http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/search \
  -H "Content-Type: application/json" \
  -H "auth_token: test" \
  -d '{"query": "YOUR_QUERY_HERE", "topK": 3}'
```

### Monitor Performance
```bash
# Time a single request
time curl -X POST http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/search ...

# Check OpenAI rate limits
tail -f /path/to/logs | grep "Creating embedding"

# Check Pinecone stats
npm run test:pinecone:stats
```

## Further Reading

- **Cosine Similarity**: `docs/ai_tutorials/04-query-similarity.md`
- **Full Implementation**: `TASK_04_IMPLEMENTATION.md`
- **OpenAI Embeddings**: https://platform.openai.com/docs/guides/embeddings
- **Pinecone Query**: https://docs.pinecone.io/docs/query-data
