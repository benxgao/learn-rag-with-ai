---
description: Action Steps of Task 01
reference: [Task 01](../../basic/01-openai-embedding-basic.md)
---

**Phase 1: Install Dependencies & Setup (5 min)**
- [x] Install OpenAI SDK: `cd functions && npm install openai`
- [x] Create `.env` file with `OPENAI_API_KEY` placeholder
- [x] Verify environment variables are loaded properly

**Phase 2: Create OpenAI Adapter (10 min)**
- [x] Create `/functions/src/adapters/openai.ts`


- [x] Implement basic OpenAI client initialization
- [x] Add embedding function with error handling

**Phase 3: Create Embedding Service (10 min)**
- [x] Create `/functions/src/services/embedding.ts`
- [x] Implement `createEmbedding(text: string): Promise<number[]>`
- [x] Add input validation and rate limit protection

**Phase 4: Create Embed Endpoint (10 min)**



- [x] Create `/functions/src/endpoints/embed.ts`
- [x] Add to main exports in `/functions/src/index.ts`
- [x] Test with curl command

**Phase 5: Test & Document (5 min)**
- [x] Test the endpoint with sample text
- [x] Verify embedding vector length
- [x] Update tutorial documentation

