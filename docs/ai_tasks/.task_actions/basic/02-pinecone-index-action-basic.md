---
description: Action Steps of Task 02
reference: [Task 02](../../basic/02-pinecone-index-basic.md)
---

**Phase 1: Install Dependencies & Setup (2 min)**
- [x] Create a new Pinecone index database and grab API key
- [x] Install Pinecone SDK: `cd functions && npm install @pinecone-database/pinecone`
- [x] Append `.env` with `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`

**Phase 2: Create Pinecone Adapter (10 min)**
- [x] Create `/functions/src/adapters/pinecone.ts`
- [x] Export `getIndex(): Promise<Index>`
- [x] Load env vars & init client inside try/catch with logger

**Phase 3: Add Index Stats Logging (3 min)**
- [x] Call `describeIndexStats()` after connect
- [x] Log dimensions & total vector count

**Phase 4: Create Healthcheck Endpoint (5 min)**
- [x] Create `/functions/src/endpoints/healthcheck.ts`
- [x] Use `getIndex()` and return `{ pinecone: ok }`
- [x] Export handler in `/functions/src/index.ts`

**Phase 5: Test & Document (5 min)**
- [x] `npm run dev`
- [x] `curl http://localhost:5001/<project>/us-central1/healthcheck`
- [x] Append delta to `docs/tutorials/02-vector-search.md`"
