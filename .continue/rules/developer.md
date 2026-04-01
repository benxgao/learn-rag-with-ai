---
description: Backend Developer Rules (Firebase + RAG)
---

### 1. Development Lifecycle
| Action | Command | Note |
| :--- | :--- | :--- |
| **Start** | `npm run dev` | Functions only (fastest) |
| **All Emulators** | `firebase emulators:start` | Full stack local test |
| **Debug Deploy** | `firebase deploy --only functions --debug` | When CI/CD fails |
| **Log Tail** | `firebase functions:log --tail` | Real-time debugging |
| **Clean Fix** | `lsof -ti:5001 \| xargs kill -9 && rm -rf .firebase/` | Port/Cache reset |

### 2. Environment Context (Read-only)
* **Required**: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `PINECONE_ENVIRONMENT`, `GCP_PROJECT_NUMBER`.
* **Dev Flags**: `DEBUG=true`, `USE_EMULATOR=true`, `SKIP_AUTH=true`.
* **Rate Limits**: 
    - OpenAI: 3 RPM (Free). 
    - Pinecone: 10 QPS, 100k ops/mo.
    - Firebase: 125k invocations/mo.

### 3. Code Generation Patterns (MANDATORY)

#### A. Endpoint Pattern (Express)
* **Location**: `src/endpoints/`
* **Requirement**: Use `logger` from `../services/firebase/logger`.
* **Template**: 
```ts
/** Sample: REQ {field1: string} \| RES {success: boolean, data: any} */
export const handlerName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data } = req.body;
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error in handlerName:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```


#### B. Service Pattern (Class-based)

* **Location**: `src/services/` 
* **Requirement**: Async methods, explicit Error throwing, logger integration.
* **Template**: 
```ts
/** Description: [Brief] \| Sample: IN {param: string} -> OUT {Result} */
export class ServiceName {
  async methodName(param: string): Promise<Result> {
    try { return result; } 
    catch (error) { logger.error('Error in ServiceName.methodName:', error); throw error; }
  }
}
```

### 4. Testing Shortcuts

* Health Check: curl http://localhost:5001/YOUR_PROJECT/us-central1/healthcheck
* Embed Test: curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/embed -H "Content-Type: application/json" -d '{"text": "test"}'
* Auth Test: Use Authorization: Bearer YOUR_TEST_TOKEN header.

### 5. Project Directory Map

* adapters/: External APIs (OpenAI, Pinecone clients).
* endpoints/: Route handlers (Phase 1: Embed, Phase 4: Search, Phase 5: RAG).
* services/: Business logic & Orchestration.
* utils/: Validation & Error handling.
