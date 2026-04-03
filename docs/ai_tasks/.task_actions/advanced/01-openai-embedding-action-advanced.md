---
description: Action Steps of Advanced Task 01
reference: [Task 01](../../advanced/01-openai-embedding-task-advanced.md)
---

## Phase 1: Setup (5 min)

- [x] Install OpenAI SDK: `cd functions && npm install openai`
- [x] Create `.env` file in `functions/` with `OPENAI_API_KEY=sk-...`
- [x] Verify: `npm run dev` starts without errors

## Phase 2: Create OpenAI Service (10 min)

**File:** `src/services/openai/index.ts`

```typescript
import OpenAI from 'openai';
import logger from '../firebase/logger';

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
    
    logger.info('✓ OpenAI client initialized');
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

## Phase 2.5: Create OpenAI Adapter (10 min)

**File:** `src/adapters/openai.ts`

```typescript
import { getOpenAIClient } from '../services/openai';
import logger from '../services/firebase/logger';
import { EmbeddingError } from '../types/errors';

/** Description: OpenAI embedding adapter | Sample: IN "hello world" -> OUT [0.1, 0.2, ...] */
export class OpenAIAdapter {
  private model = 'text-embedding-3-small';
  private dimensions = 1536;

  /** Creates embedding vector from text input */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Text input cannot be empty');
      }

      // Rate limit protection: check text length
      if (text.length > 100000) {
        throw new Error(`Text input too long (max 100,000 characters). Got ${text.length}`);
      }

      logger.info('Creating embedding', { textLength: text.length, model: this.model });

      const response = await getOpenAIClient().embeddings.create({
        model: this.model,
        input: text.trim(),
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned from API');
      }

      if (embedding.length !== this.dimensions) {
        throw new Error(
          `Invalid embedding dimensions: ${embedding.length}. ` +
          `Expected ${this.dimensions}.`
        );
      }

      logger.info('Embedding created successfully', {
        dimensions: embedding.length,
        model: this.model
      });

      return embedding;
    } catch (error) {
      logger.error(`Error in OpenAIAdapter.createEmbedding: ${error}`);
      throw new EmbeddingError(`Failed to create embedding: ${(error as any).message}`, error);
    }
  }

  /** Get embedding model info */
  getModelInfo(): { model: string; dimensions: number } {
    return {
      model: this.model,
      dimensions: this.dimensions,
    };
  }

  /** Estimate tokens in text (rough approximation) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Estimate cost of embedding request (Pricing: $0.02 per 1M input tokens) */
  estimateCost(text: string): number {
    const tokens = this.estimateTokens(text);
    const costPerToken = 0.02 / 1_000_000;
    return tokens * costPerToken;
  }
}

// Export singleton instance
export const openAIAdapter = new OpenAIAdapter();
```

## Phase 3: Create Embedding Service (15 min)

**File:** `src/services/embedding.ts`

```typescript
import { openAIAdapter } from '../adapters/openai';
import logger from '../services/firebase/logger';

/** Description: Embedding service for text vectorization | Sample: IN "hello world" -> OUT [0.1, 0.2, ...] */
export class EmbeddingService {
  
  /** Creates embedding vector from text input with validation and error handling */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      // Input validation
      if (!text || typeof text !== 'string') {
        throw new Error('Text must be a non-empty string');
      }

      const trimmedText = text.trim();
      if (trimmedText.length === 0) {
        throw new Error('Text cannot be empty or whitespace only');
      }

      // Rate limit protection: enforce max length
      if (trimmedText.length > 100000) {
        throw new Error(`Text too long (max 100,000 characters). Got ${trimmedText.length}`);
      }

      logger.info('Creating embedding', {
        textLength: trimmedText.length,
        firstChars: trimmedText.substring(0, 50)
      });

      // Create embedding using OpenAI adapter
      const embedding = await openAIAdapter.createEmbedding(trimmedText);

      logger.info('Embedding created successfully', {
        dimensions: embedding.length,
        textLength: trimmedText.length,
        estimatedCost: openAIAdapter.estimateCost(trimmedText)
      });

      return embedding;
    } catch (error) {
      logger.error(`Error in EmbeddingService.createEmbedding: ${error}`);
      throw error; // Re-throw to let caller handle
    }
  }

  /** Get embedding model information */
  getModelInfo(): { model: string; dimensions: number } {
    return openAIAdapter.getModelInfo();
  }

  /** Create embedding with detailed metrics (tokens, cost, duration) */
  async createEmbeddingWithMetrics(
    text: string
  ): Promise<{
    embedding: number[];
    tokens: number;
    cost: number;
    duration: number;
  }> {
    const startTime = Date.now();
    const tokens = openAIAdapter.estimateTokens(text);
    const cost = openAIAdapter.estimateCost(text);
    
    logger.info('📝 Embedding text with metrics', {
      textPreview: text.substring(0, 50),
      tokens,
      estimatedCost: cost
    });
    
    const embedding = await this.createEmbedding(text);
    const duration = Date.now() - startTime;
    
    logger.info('✓ Embedding created with metrics', { duration, tokens, cost });
    
    return { embedding, tokens, cost, duration };
  }

  /** Batch create embeddings (processes sequentially with rate limiting) */
  async createEmbeddingsBatch(
    texts: string[],
    delayMs: number = 100
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    logger.info('Starting batch embedding', { count: texts.length, delayMs });
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      embeddings.push(await this.createEmbedding(text));
      
      // Rate limiting: space out requests
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    logger.info('Batch embedding completed', { count: embeddings.length });
    return embeddings;
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
```

## Phase 4: Create API Endpoint (10 min)

**File:** `src/endpoints/api/embed.ts`

```typescript
import { Request, Response } from 'express';
import logger from '../../services/firebase/logger';
import { embeddingService } from '../../services/embedding';

/** Sample: REQ {text: string} | RES {success: boolean, embedding: number[], dimensions: 1536, estimatedCost: number} */
export const embedHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;

    // Validation
    if (!text) {
      res.status(400).json({
        error: 'text field required in request body',
      });
      return;
    }

    if (typeof text !== 'string') {
      res.status(400).json({
        error: 'text must be a string',
      });
      return;
    }

    if (text.length > 100000) {
      res.status(400).json({
        error: 'text exceeds 100,000 character limit',
      });
      return;
    }

    logger.info('Embed request received', { 
      textLength: text.length,
      textPreview: text.substring(0, 50)
    });

    // Create embedding
    const embedding = await embeddingService.createEmbedding(text);
    const modelInfo = embeddingService.getModelInfo();

    res.json({
      success: true,
      text: text.substring(0, 100), // Echo back (truncated)
      embedding,
      dimensions: embedding.length,
      model: modelInfo.model,
      estimatedCost: (embedding.length / 4 / 1_000_000) * 0.02, // Rough estimate
    });

  } catch (error) {
    logger.error(`Error in embedHandler: ${error}`);
    res.status(500).json({
      error: (error as any).message || 'Internal server error'
    });
  }
};
```

**Update:** `src/endpoints/api/index.ts`

Import and use the handler:
```typescript
import { embedHandler } from './embed';
import { Router } from 'express';

const router = Router();

router.post('/embed', embedHandler);

export default router;
```

**Update:** `src/endpoints/index.ts`

Add to main router:
```typescript
import apiRouter from './api';
// ...
router.use('/api', apiRouter);
```


## Phase 5: Test (10 min)

**Test 1: Basic functionality**

```bash
cd functions
npm run dev

# In another terminal:
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Embeddings are vector representations of text"}'

# Expected response:
# {
#   "success": true,
#   "text": "Embeddings are vector representations of text",
#   "embedding": [0.1234, -0.5678, ...],
#   "dimensions": 1536,
#   "model": "text-embedding-3-small",
#   "estimatedCost": 0.000001
# }
```

**Test 2: Multiple texts (verify consistency)**

```bash
# Same text should produce same embedding
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "What is machine learning?"}'

curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "What is machine learning?"}'

# Both should have identical embedding vectors
```

**Test 3: Batch embeddings (advanced feature)**

```bash
# Test with multiple different texts
curl -X POST http://localhost:5000/api/embed -d '{"text": "AI"}' -H "Content-Type: application/json"
curl -X POST http://localhost:5000/api/embed -d '{"text": "Machine learning is a subset of artificial intelligence"}' -H "Content-Type: application/json"
curl -X POST http://localhost:5000/api/embed -d '{"text": "How do neural networks learn from data?"}' -H "Content-Type: application/json"
```

**Test 4: Error cases**

```bash
# Missing text
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 error "text field required in request body"

# Empty text
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": ""}'
# Expected: 500 error "Text cannot be empty or whitespace only"

# Text too long
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$(printf 'x%.0s' {1..100001})\"}"
# Expected: 400 error "text exceeds 100,000 character limit"
```

**Success criteria:**
- ✅ Returns 1536-dimensional array
- ✅ All values between -1 and 1
- ✅ Same text → same embedding (deterministic)
- ✅ Different text → different embedding (varied)
- ✅ Error messages are helpful and descriptive
- ✅ Response time < 500ms per request
- ✅ Logs show embedding creation metrics


## Phase 6: Documentation & Advanced Features (10 min)

**Update tutorial:** `docs/ai_tutorials/01-embeddings.md`

Add sections:
- "How OpenAI Integration Works" - Explain singleton pattern, connection pooling
- "Error Handling Patterns" - Document validation and error transformation
- "Rate Limiting & Cost Tracking" - Explain token estimation, cost calculation
- "Batch Processing" - Show example of `createEmbeddingsBatch()` usage

**Advanced features already implemented:**

1. **Metrics Tracking** - Use `createEmbeddingWithMetrics()` to get token count, cost, and duration
   ```typescript
   const { embedding, tokens, cost, duration } = 
     await embeddingService.createEmbeddingWithMetrics(text);
   ```

2. **Batch Processing** - Process multiple texts with rate limiting
   ```typescript
   const embeddings = await embeddingService.createEmbeddingsBatch(
     ["text1", "text2", "text3"],
     100 // 100ms delay between requests
   );
   ```

3. **Model Info** - Get model details
   ```typescript
   const { model, dimensions } = embeddingService.getModelInfo();
   // { model: 'text-embedding-3-small', dimensions: 1536 }
   ```

4. **Comprehensive Logging** - All operations logged via Firebase logger
   - Embedding creation start/completion
   - Token estimates and cost
   - Error details with stack traces

**Checklist:**
- [ ] Verify OpenAI adapter is initialized before first request
- [ ] Test batch embedding with 5+ texts
- [ ] Check logs show token estimation and cost tracking
- [ ] Verify error messages are specific to failure type
- [ ] Update tutorial with integration examples
