---
description: Action Steps of Advanced Task 01
reference: [Task 01](../../advanced/01-openai-embedding-task-advanced.md)
---

## Phase 1: Setup (5 min)

- [x] Install OpenAI SDK: `cd functions && npm install openai`
- [x] Create `.env` file in `functions/` with `OPENAI_API_KEY=sk-...`
- [x] Verify: `npm run dev` starts without errors

## Phase 2: Create OpenAI Adapter (10 min)

**File:** `src/adapters/openai.ts`

```typescript
import OpenAI from 'openai';

/**
 * Singleton OpenAI client
 * 
 * Why singleton?
 * - Connection pooling: Reuses HTTP connections
 * - Rate limit awareness: Single point for tracking limits
 * - Cost tracking: Centralized token counting
 * - Thread-safe: One client per process
 */
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable not set. ' +
        'Add to .env file: OPENAI_API_KEY=sk-...'
      );
    }
    
    if (!apiKey.startsWith('sk-')) {
      throw new Error(
        'OPENAI_API_KEY looks invalid. ' +
        'Should start with "sk-". Check your .env file.'
      );
    }
    
    client = new OpenAI({
      apiKey,
      timeout: 30000, // 30 second timeout
      maxRetries: 2,  // Retry on transient failures
    });
    
    console.log('✓ OpenAI client initialized');
  }
  
  return client;
}

/**
 * Reset client (useful for testing)
 */
export function resetOpenAIClient(): void {
  client = null;
}
```

## Phase 3: Create Embedding Service (15 min)

**File:** `src/services/embedding.ts`

```typescript
import { getOpenAIClient } from '../adapters/openai';

/**
 * Create embedding for text using OpenAI
 */
export async function createEmbedding(text: string): Promise<number[]> {
  // Validation
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }
  
  const trimmedText = text.trim();
  
  if (trimmedText.length > 100000) {
    throw new Error(
      `Text too long: ${trimmedText.length} chars. Max 100,000 chars.`
    );
  }
  
  try {
    const client = getOpenAIClient();
    
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: trimmedText,
      encoding_format: 'float',
    });
    
    // Extract embedding from response
    const embedding = response.data[0].embedding;
    
    if (!embedding || embedding.length === 0) {
      throw new Error('Empty embedding returned from API');
    }
    
    if (embedding.length !== 1536) {
      throw new Error(
        `Invalid embedding dimensions: ${embedding.length}. ` +
        'Expected 1536.'
      );
    }
    
    return embedding;
  } catch (error) {
    // Transform error into helpful message
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        throw new Error(
          'Rate limited by OpenAI. Wait 60 seconds before retrying. ' +
          'Upgrade plan at https://platform.openai.com/account/billing/overview'
        );
      }
      
      if (error.message.includes('401')) {
        throw new Error(
          'Authentication failed. Invalid OPENAI_API_KEY. ' +
          'Check your .env file and API key at ' +
          'https://platform.openai.com/api-keys'
        );
      }
      
      if (error.message.includes('timeout')) {
        throw new Error(
          'Request timeout. OpenAI API took too long. ' +
          'Try again or contact OpenAI support.'
        );
      }
    }
    
    throw error;
  }
}

/**
 * Estimate tokens in text (rough approximation)
 * Rule of thumb: 4 characters ≈ 1 token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost of embedding request
 * Pricing: $0.02 per 1M input tokens
 */
export function estimateCost(text: string): number {
  const tokens = estimateTokens(text);
  const costPerToken = 0.02 / 1_000_000;
  return tokens * costPerToken;
}

/**
 * Create embedding with detailed logging and cost tracking
 */
export async function createEmbeddingWithMetrics(
  text: string
): Promise<{
  embedding: number[];
  tokens: number;
  cost: number;
  duration: number;
}> {
  const startTime = Date.now();
  const tokens = estimateTokens(text);
  const cost = estimateCost(text);
  
  console.log(`📝 Embedding text: ${text.substring(0, 50)}...`);
  console.log(`   Tokens: ~${tokens}`);
  console.log(`   Cost: ~$${cost.toFixed(6)}`);
  
  const embedding = await createEmbedding(text);
  const duration = Date.now() - startTime;
  
  console.log(`✓ Embedding created in ${duration}ms`);
  
  return { embedding, tokens, cost, duration };
}

/**
 * Batch create embeddings (processes sequentially with rate limiting)
 */
export async function createEmbeddingsBatch(
  texts: string[],
  delayMs: number = 100
): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    embeddings.push(await createEmbedding(text));
    
    // Rate limiting: space out requests
    if (texts.indexOf(text) < texts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return embeddings;
}
```

## Phase 4: Create API Endpoint (10 min)

**File:** `src/endpoints/api/embed.ts`

```typescript
import { Router, Request, Response } from 'express';
import { createEmbedding, estimateCost } from '../../services/embedding';

const router = Router();

/**
 * POST /api/embed
 * 
 * Request: { "text": "What is machine learning?" }
 * Response: { "text": "...", "embedding": [...], "dimensions": 1536, "estimatedCost": 0.000001 }
 */
router.post('/', async (req: Request, res: Response) => {
  const { text } = req.body;
  
  // Validation
  if (!text) {
    return res.status(400).json({
      error: 'text field required in request body',
    });
  }
  
  if (typeof text !== 'string') {
    return res.status(400).json({
      error: 'text must be a string',
    });
  }
  
  if (text.length > 100000) {
    return res.status(400).json({
      error: 'text exceeds 100,000 character limit',
    });
  }
  
  try {
    const embedding = await createEmbedding(text);
    
    return res.json({
      text: text.substring(0, 100), // Echo back (truncated)
      embedding,
      dimensions: embedding.length,
      estimatedCost: estimateCost(text),
    });
  } catch (error) {
    console.error('Embedding error:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        error: error.message,
      });
    }
    
    return res.status(500).json({
      error: 'Failed to create embedding',
    });
  }
});

export default router;
```

**Update:** `src/endpoints/index.ts`

Add to exports:
```typescript
import embedRouter from './api/embed';
// ...
router.use('/api', embedRouter);
```

## Phase 5: Test (10 min)

**Test 1: Basic functionality**

```bash
npm run dev

# In another terminal:
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Embeddings are vector representations of text"}'

# Expected: 1536-dimensional array, cost ~$0.000001
```

**Test 2: Multiple texts**

```bash
curl -X POST http://localhost:5000/api/embed -d '{"text": "AI"}'
curl -X POST http://localhost:5000/api/embed -d '{"text": "Machine learning is a subset of artificial intelligence"}'
curl -X POST http://localhost:5000/api/embed -d '{"text": "How do neural networks learn from data?"}'
```

**Test 3: Error cases**

```bash
# Missing text
curl -X POST http://localhost:5000/api/embed -d '{}'

# Empty text
curl -X POST http://localhost:5000/api/embed -d '{"text": ""}'

# Very long text
curl -X POST http://localhost:5000/api/embed -d '{"text": "'$(printf 'x%.0s' {1..100001})'"}' 
```

**Success criteria:**
- ✅ Returns 1536-dimensional array
- ✅ All values between -1 and 1
- ✅ Same text → same embedding
- ✅ Error messages are helpful
- ✅ Response time < 500ms

## Phase 6: Documentation (5 min)

- [ ] Update tutorial file: `docs/ai_tutorials/01-embeddings.md`
  - Add "How" section with OpenAI integration patterns
  - Include error handling examples
  - Document rate limiting considerations
