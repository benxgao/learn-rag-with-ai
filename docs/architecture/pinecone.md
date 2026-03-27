Below is a **Copilot-friendly project structure + function signatures** g:

* Firebase (entry + optional metadata)
* Pinecone (vector store)
* OpenAI (embedding + LLM)
* Minimal Firestore (optional metadata / logs)

It is intentionally explicit and comment-heavy so Copilot can infer implementations.

---

# Project Structure (functions/src)

```
functions/src/
│
├── index.ts                # Firebase entry point (HTTP functions)
│
├── config/
│   └── env.ts              # Load environment variables
│
├── services/
│   ├── embedding.ts        # OpenAI embedding logic
│   ├── llm.ts              # OpenAI completion logic
│   ├── pinecone.ts         # Pinecone client + operations
│   ├── firestore.ts        # Firestore interactions (optional)
│
├── core/
│   ├── chunking.ts         # Text splitting logic
│   ├── rag.ts              # RAG prompt construction
│
├── api/
│   ├── ingest.ts           # /ingest handler
│   ├── query.ts            # /query handler
│   ├── search.ts           # /search handler (optional)
│
└── types/
    └── index.ts            # Shared TypeScript types
```

---

# index.ts (Entry Point)

```ts
import * as functions from "firebase-functions";
import { ingestHandler } from "./api/ingest";
import { queryHandler } from "./api/query";
import { searchHandler } from "./api/search";

/**
 * Main HTTP endpoints exposed via Firebase Functions
 */
export const ingest = functions.https.onRequest(ingestHandler);
export const query = functions.https.onRequest(queryHandler);
export const search = functions.https.onRequest(searchHandler);
```

---

# config/env.ts

```ts
/**
 * Centralized environment config
 * Loaded from Firebase environment or .env
 */
export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY!,
  PINECONE_INDEX: process.env.PINECONE_INDEX!,
};
```

---

# services/embedding.ts

```ts
import OpenAI from "openai";
import { ENV } from "../config/env";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

/**
 * Generate embedding vector from input text
 * Used for both document chunks and user queries
 */
export async function embed(text: string): Promise<number[]> {
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}
```

---

# services/llm.ts

```ts
import OpenAI from "openai";
import { ENV } from "../config/env";

const client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

/**
 * Generate final answer using RAG prompt
 */
export async function generate(prompt: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content || "";
}
```

---

# services/pinecone.ts

```ts
import { Pinecone } from "@pinecone-database/pinecone";
import { ENV } from "../config/env";

const pc = new Pinecone({ apiKey: ENV.PINECONE_API_KEY });
const index = pc.index(ENV.PINECONE_INDEX);

/**
 * Upsert embedding vectors into Pinecone
 */
export async function upsertVectors(vectors: {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}[]): Promise<void> {
  await index.upsert(vectors);
}

/**
 * Query similar vectors from Pinecone
 */
export async function queryVectors(
  vector: number[],
  topK: number
): Promise<any[]> {
  const res = await index.query({
    vector,
    topK,
    includeMetadata: true,
  });

  return res.matches || [];
}

/**
 * Delete vectors by document id
 */
export async function deleteByDocId(docId: string): Promise<void> {
  await index.delete({
    filter: { doc_id: docId },
  });
}
```

---

# services/firestore.ts (Optional)

```ts
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Store document metadata (optional)
 */
export async function saveDocumentMeta(docId: string, data: any) {
  await db.collection("documents").doc(docId).set(data);
}

/**
 * Log query for analytics/debugging
 */
export async function logQuery(query: string, response: string) {
  await db.collection("queries").add({
    query,
    response,
    createdAt: Date.now(),
  });
}
```

---

# core/chunking.ts

```ts
/**
 * Split long text into smaller chunks
 * Keep chunk size aligned with embedding limits
 */
export function chunkText(text: string, chunkSize = 800): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}
```

---

# core/rag.ts

```ts
/**
 * Build RAG prompt from query + retrieved chunks
 */
export function buildPrompt(query: string, chunks: string[]): string {
  const context = chunks.join("\n---\n");

  return `
You are an AI assistant. Use the context below to answer.

Context:
---
${context}
---

Question:
${query}

Answer:
`;
}
```

---

# api/ingest.ts

```ts
import { Request, Response } from "express";
import { chunkText } from "../core/chunking";
import { embed } from "../services/embedding";
import { upsertVectors } from "../services/pinecone";

/**
 * Ingest endpoint
 * - chunk document
 * - generate embeddings
 * - store in Pinecone
 */
export async function ingestHandler(req: Request, res: Response) {
  const { documents } = req.body;

  let totalChunks = 0;

  for (const doc of documents) {
    const chunks = chunkText(doc.text);

    const vectors = await Promise.all(
      chunks.map(async (chunk, i) => ({
        id: `${doc.id}_chunk_${i}`,
        values: await embed(chunk),
        metadata: {
          text: chunk,
          doc_id: doc.id,
        },
      }))
    );

    await upsertVectors(vectors);
    totalChunks += chunks.length;
  }

  res.json({ status: "ok", chunks_indexed: totalChunks });
}
```

---

# api/query.ts

```ts
import { Request, Response } from "express";
import { embed } from "../services/embedding";
import { queryVectors } from "../services/pinecone";
import { buildPrompt } from "../core/rag";
import { generate } from "../services/llm";

/**
 * Query endpoint (RAG)
 * - embed query
 * - retrieve similar chunks
 * - build prompt
 * - generate answer
 */
export async function queryHandler(req: Request, res: Response) {
  const { query, top_k = 5 } = req.body;

  const queryVector = await embed(query);

  const matches = await queryVectors(queryVector, top_k);

  const chunks = matches.map((m) => m.metadata.text);

  const prompt = buildPrompt(query, chunks);

  const answer = await generate(prompt);

  res.json({
    answer,
    matches,
  });
}
```

---

# api/search.ts (Optional)

```ts
import { Request, Response } from "express";
import { embed } from "../services/embedding";
import { queryVectors } from "../services/pinecone";

/**
 * Raw vector search endpoint (no LLM)
 */
export async function searchHandler(req: Request, res: Response) {
  const { query, top_k = 5 } = req.body;

  const vector = await embed(query);

  const matches = await queryVectors(vector, top_k);

  res.json({ matches });
}
```

---

# types/index.ts

```ts
/**
 * Document input type
 */
export interface DocumentInput {
  id: string;
  text: string;
}

/**
 * Pinecone match type
 */
export interface VectorMatch {
  score: number;
  metadata: {
    text: string;
    doc_id: string;
  };
}
```

---

# Minimal Flow (for Copilot reasoning)

```
INGEST:
text → chunk → embed → Pinecone

QUERY:
query → embed → Pinecone search → build prompt → LLM → answer
```

---
