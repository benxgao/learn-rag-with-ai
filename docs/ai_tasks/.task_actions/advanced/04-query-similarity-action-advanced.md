# Quick Test Steps for /api/search (Postman)

1. Populate index (if you haven't yet)  
   POST `http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/upsert`  
   Headers: `Content-Type: application/json`, `auth_token: test`  
   Body: use the 3-doc sample from Task-03 docs.

2. Search
   POST `http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/search`  
   Headers: same as above  
   Body:
   ```json
   { "query": "What is machine learning?", "topK": 3 }
   ```
3. Get sample queries
   GET http://localhost:5001/pinecone-ai-starter/us-central1/endpoints/api/search/sample
