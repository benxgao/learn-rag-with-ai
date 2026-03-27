# Continue Rules - Development Acceleration

This file contains development-specific configurations and shortcuts for faster iteration.

## Quick Development Commands

### Firebase Emulators
```bash
# Start all emulators (functions + hosting)
firebase emulators:start

# Functions only (faster)
npm run dev

# Watch mode for development
npm run build:watch
```

### Deployment Shortcuts
```bash
# Deploy functions only
npm run deploy

# Deploy specific function
firebase deploy --only functions:embedText

# Deploy with debug output
firebase deploy --only functions --debug
```

## Environment Variables Cache

### Required for Development
```bash
# Add to .env file
OPENAI_API_KEY=sk-...                    # OpenAI API key
PINECONE_API_KEY=...                     # Pinecone API key  
PINECONE_INDEX_NAME=rag-index           # Vector index name
PINECONE_ENVIRONMENT=us-east-1          # Pinecone region
GCP_PROJECT_NUMBER=123456789            # Google Cloud project number
```

### Optional Development Settings
```bash
# Enable debug logging
DEBUG=true

# Use local emulator (faster)
USE_EMULATOR=true

# Skip auth validation (development only)
SKIP_AUTH=true
```

## Code Generation Templates

### New Endpoint Template
```typescript
// Use this template for new endpoints
import { Request, Response } from 'express';
import { logger } from '../services/firebase/logger';

/**
 * 
 * A sample JSON data of req and res here
 * 
 * */
export const handlerName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { field1, field2 } = req.body;
    
    // Your logic here
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error in handlerName:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### New Service Template
```typescript
// Use this template for new services
import { logger } from './firebase/logger';

/**
 * Simple function introduction here:
 * - What does it do
 * 
 * A sample JSON data of req and res here
 * 
 * */
export class ServiceName {
  async methodName(param: string): Promise<Result> {
    try {
      // Your service logic
      return result;
    } catch (error) {
      logger.error('Error in ServiceName.methodName:', error);
      throw error;
    }
  }
}
```

## Testing Shortcuts

### Manual API Testing
```bash
# Test health endpoint
curl http://localhost:5001/YOUR_PROJECT/us-central1/healthcheck

# Test with JSON body
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test embedding"}'
```

### Firebase Auth Testing
```bash
# Get test token from Firebase Console
# Project Settings → Users → Test User → Copy ID Token

# Test protected endpoint
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/protected \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": "test"}'
```

## Performance Optimization

### Build Optimization
```bash
# Incremental builds (faster)
npm run build:watch

# Clean build (when things break)
rm -rf lib && npm run build

# Check bundle size
npm run build && ls -la lib/
```

### Local Development Speed
```bash
# Skip linting during development
ESLINT_NO_DEV_ERRORS=true npm run dev

# Use functions shell for quick testing
npm run shell
```

## Debugging Tips

### Firebase Functions Logs
```bash
# View recent logs
firebase functions:log --limit=50

# Tail logs in real-time
firebase functions:log --tail

# Filter by function name
firebase functions:log --only embedText
```

### Common Issues
```bash
# Port already in use
lsof -ti:5001 | xargs kill -9

# Clear Firebase cache
rm -rf .firebase/

# Reset emulators
firebase emulators:exec --project demo-project "echo 'Emulators reset'"
```

## API Rate Limits (Development)

### OpenAI (Free Tier)
- 3 requests per minute
- 200 requests per day

### Pinecone (Free Tier)  
- 100K vector operations/month
- 1GB storage
- 10 queries/second

### Firebase (Spark Plan)
- 125K invocations/month free
- 40K GB-seconds/month free

## Project Structure Quick Reference

```
functions/src/
├── adapters/          # External API integrations
│   ├── openai.ts     # OpenAI API client
│   └── pinecone.ts   # Pinecone client
├── endpoints/        # API route handlers
│   ├── embed.ts      # Phase 1: Embedding
│   ├── search.ts     # Phase 4: Semantic search
│   └── rag.ts        # Phase 5: RAG pipeline
├── services/         # Business logic
│   ├── embedding.ts  # Embedding service
│   ├── vectorStore.ts # Vector storage
│   └── rag.ts        # RAG orchestration
└── utils/            # Helper functions
    ├── validation.ts # Input validation
    └── errors.ts     # Error handling
```

## Quick Environment Setup

### One-time Setup Script
```bash
#!/bin/bash
# Save as setup.sh
npm install
cp .env.sample .env
echo "Setup complete! Edit .env with your API keys."
echo "Then run: npm run dev"
```

### Daily Development Flow
```bash
# 1. Start development
npm run dev

# 2. Test your changes
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/embed \
  -d '{"text": "hello world"}'

# 3. Check logs
firebase functions:log --tail

# 4. Deploy when ready
npm run deploy
```
