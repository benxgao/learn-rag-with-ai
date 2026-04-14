---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 05 — Simple RAG [advanced]

## Goal

Build a complete Retrieval-Augmented Generation (RAG) pipeline that combines semantic search with LLM generation, creating a system that answers questions grounded in your document collection.

---

## Learning Outcomes

After completing this task, you'll understand:

- **Full RAG pipeline architecture** — Five stages from question to answer
- **Why RAG reduces hallucination** — Grounding LLM in retrieved documents
- **Prompt construction patterns** — System prompts, context assembly, instruction clarity
- **Context windows and token limits** — Managing constraints in LLM context
- **End-to-end system integration** — Combining embedding, retrieval, and generation
- **Error handling in multi-stage systems** — Failures at retrieval vs generation
- **Real-world RAG trade-offs** — Speed, cost, accuracy, context quality

---

## Key Knowledge

### 5.1 Five-Stage RAG Pipeline
1. **Embed** query → 2. **Retrieve** top-K docs → 3. **Assemble** context → 4. **Prompt** construct → 5. **Generate** answer. Failure at any stage breaks the chain.

### 5.2 Why Grounding Reduces Hallucination
LLM trained to predict next token. Without docs, it generates plausible-sounding fiction. With docs in context, it learns to copy from them instead of hallucinate.

### 5.3 Context Window Constraints
GPT-3.5: 4K tokens. GPT-4: 8-128K tokens. Estimate: retrieved docs + prompt overhead + answer space. Budget carefully or truncate retrieved context.

### 5.4 Prompt Engineering Impact
Same question + same context, different prompts → 30% quality variance. Use system prompt to set persona, include explicit instructions like "Only use provided documents."

---

## Requirements

**Input:**

- `question`: string (natural language question, e.g., "What is machine learning?")

**Process (5 stages):**

1. **Embedding** — Convert question to vector
2. **Retrieval** — Find similar documents (top-K)
3. **Context Assembly** — Format documents as readable context
4. **Prompt Construction** — Create prompt with context + question
5. **Generation** — Call LLM with full prompt, get answer

**Output:**

- `answer`: string (generated response grounded in documents)
- `sources`: array of (id, text, score) — Which documents were used
- `tokensUsed`: number — For cost tracking

---

## Why RAG Works

### The Problem: LLM Hallucination

```
Pure LLM (no RAG):
Q: "What does your system do?"
A: "I build AI robots and cure diseases"
   ↓ WRONG! The model made this up (hallucinated)

Risk: False information presented with confidence
```

### The Solution: Ground in Documents

```
RAG System:
Q: "What does your system do?"
   ↓ Search documents
Retrieved: ["Your system embeds text and searches vectors"]
   ↓ Create prompt with retrieved text
Prompt: "Based on: '...embeds text and searches vectors'
         Answer: What does your system do?"
   ↓ LLM respects context
A: "Your system embeds text and searches vectors"
   ✓ CORRECT! Answer is grounded in documents
```

**Result:** LLM respects the constraint of using only provided documents.

---

## Implementation

**File:** `/src/services/rag.ts`

**Core Interface:**

```typescript
export interface RAGResult {
  question: string;
  answer: string;
  sources: Array<{ id: string; text: string; score: number }>;
  tokensUsed: number;
}

export async function ask(question: string): Promise<RAGResult>;
```

---

## Implementation Guide

### Step 1: Create RAG service

```typescript
// src/services/rag.ts
import { querySimilar, RetrievalResult } from "./retrieval";
import { getOpenAIClient } from "../adapters/openai";

export interface RAGResult {
  question: string;
  answer: string;
  sources: Array<{ id: string; text: string; score: number }>;
  tokensUsed: number;
  duration: number; // milliseconds
}

/**
 * Stage 1 & 2: Retrieve relevant documents
 */
function assembleContext(sources: RetrievalResult[]): string {
  return sources
    .map((doc, i) => `${i + 1}. ${doc.text}`)
    .join(
      "\
\
",
    );
}

/**
 * Stage 3: Build system prompt with context and rules
 */
function buildSystemPrompt(context: string): string {
  return `You are a helpful AI assistant answering questions based on provided documents.

RELEVANT DOCUMENTS:
${context}

RULES:
1. Answer ONLY using the provided documents
2. If the answer is not in the documents, clearly state: \"I don't have enough information to answer this.\"
3. Be concise and direct (1-2 paragraphs)
4. Cite which document the answer comes from when possible
5. Do not add information from your training data

Respond in clear, natural language.`;
}

/**
 * Complete RAG pipeline
 *
 * Process:
 * 1. Retrieve: Find relevant documents (top-3)
 * 2. Assemble: Format context from documents
 * 3. Construct: Build prompt with system instructions
 * 4. Generate: Call LLM with full prompt
 * 5. Return: Answer with sources and metrics
 */
export async function ask(question: string): Promise<RAGResult> {
  const startTime = Date.now();

  // Validation
  if (!question || question.trim().length === 0) {
    throw new Error("Question cannot be empty");
  }

  const trimmedQuestion = question.trim();

  try {
    console.log(`\
🔍 RAG Pipeline Started`);
    console.log(`   Question: \"${trimmedQuestion.substring(0, 60)}...\"`);

    // STAGE 1 & 2: Retrieve relevant documents
    console.log(`\
  📚 Stage 1-2: Retrieving documents...`);
    const sources = await querySimilar(trimmedQuestion, 3);

    if (sources.length === 0) {
      return {
        question: trimmedQuestion,
        answer:
          "No relevant documents found in the knowledge base. Cannot answer this question.",
        sources: [],
        tokensUsed: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(`      Found ${sources.length} relevant documents`);
    sources.forEach((s, i) => {
      console.log(
        `      [${i + 1}] Score: ${s.score.toFixed(3)} - ${s.text.substring(0, 40)}...`,
      );
    });

    // STAGE 3: Assemble context
    console.log(`\
  🧩 Stage 3: Assembling context...`);
    const context = assembleContext(sources);
    console.log(`      Context size: ${context.length} chars`);

    // STAGE 4: Construct prompt
    console.log(`\
  ✍️  Stage 4: Constructing prompt...`);
    const systemPrompt = buildSystemPrompt(context);
    console.log(`      System prompt size: ${systemPrompt.length} chars`);

    // STAGE 5: Generate answer
    console.log(`\
  🤖 Stage 5: Generating answer...`);
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: trimmedQuestion,
        },
      ],
      temperature: 0.7, // Balanced between deterministic and creative
      max_tokens: 500, // Limit answer length
      top_p: 0.95, // Nucleus sampling
    });

    const answer = response.choices[0].message.content || "";
    const tokensUsed = response.usage?.total_tokens || 0;

    const duration = Date.now() - startTime;
    console.log(`\
  ✅ RAG Pipeline Complete (${duration}ms)`);
    console.log(`     Tokens used: ${tokensUsed}`);

    return {
      question: trimmedQuestion,
      answer,
      sources: sources.map((s) => ({
        id: s.id,
        text: s.text.substring(0, 150), // Truncate for readability
        score: s.score,
      })),
      tokensUsed,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error) {
      console.error(`\
  ❌ RAG Pipeline Error: ${error.message}`);
      throw new Error(`RAG failed: ${error.message}`);
    }

    throw error;
  }
}
```

### Step 2: Create API endpoint

```typescript
// src/endpoints/api/rag.ts
import { Router, Request, Response } from "express";
import { ask } from "../../services/rag";

const router = Router();

/**
 * POST /api/rag/ask
 *
 * Request body:
 * {
 *   \"question\": \"What is machine learning?\"
 * }
 *
 * Response:
 * {
 *   \"question\": \"What is machine learning?\",
 *   \"answer\": \"Machine learning is a subset...\",
 *   \"sources\": [
 *     {
 *       \"id\": \"doc-1\",
 *       \"text\": \"Machine learning is...\",
 *       \"score\": 0.92
 *     }
 *   ],
 *   \"tokensUsed\": 145,
 *   \"duration\": 1250
 * }
 */
router.post("/ask", async (req: Request, res: Response) => {
  const { question } = req.body;

  // Validation
  if (!question) {
    return res.status(400).json({
      error: "question field required in request body",
    });
  }

  if (typeof question !== "string") {
    return res.status(400).json({
      error: "question must be a string",
    });
  }

  if (question.length > 1000) {
    return res.status(400).json({
      error: "question too long (max 1000 characters)",
    });
  }

  try {
    const result = await ask(question);
    return res.json(result);
  } catch (error) {
    console.error("RAG endpoint error:", error);

    if (error instanceof Error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: "RAG pipeline failed",
    });
  }
});

export default router;
```

### Step 3: Integrate into main API

```typescript
// src/endpoints/api/index.ts
import { Router } from "express";
import embedRouter from "./embed";
import searchRouter from "./search";
import ragRouter from "./rag";

const router = Router();

router.use("/embed", embedRouter);
router.use("/search", searchRouter);
router.use("/rag", ragRouter);

export default router;
```

---

## Testing

### Test 1: Basic RAG pipeline

```bash
# Ensure sample data is seeded (Task 03)
SEED_DATA=true npm run dev

# In another terminal, test RAG
curl -X POST http://localhost:5000/api/rag/ask \\
  -H \"Content-Type: application/json\" \\
  -d '{\"question\": \"What is machine learning?\"}'

# Expected response:
# {
#   \"question\": \"What is machine learning?\",
#   \"answer\": \"Based on the provided documents, machine learning...\",
#   \"sources\": [
#     {
#       \"id\": \"doc-1\",
#       \"text\": \"Machine learning is a subset...\",
#       \"score\": 0.92
#     }
#   ],
#   \"tokensUsed\": 145,
#   \"duration\": 1250
# }
```

### Test 2: Various question types

```bash
# Test A: Direct topic match
curl -X POST http://localhost:5000/api/rag/ask \\
  -d '{\"question\": \"What are embeddings?\"}'

# Test B: Semantic variation (different wording, same topic)
curl -X POST http://localhost:5000/api/rag/ask \\
  -d '{\"question\": \"How are texts converted to vectors?\"}'

# Test C: Multi-topic question
curl -X POST http://localhost:5000/api/rag/ask \\
  -d '{\"question\": \"How do embeddings and vector databases work together?\"}'

# Test D: Off-topic question (should get \"no information\" response)
curl -X POST http://localhost:5000/api/rag/ask \\
  -d '{\"question\": \"What is the capital of France?\"}'
```

**Success criteria:**

- ✅ Answer generated without errors
- ✅ Answer is grounded in retrieved documents
- ✅ Sources are correctly attributed
- ✅ Response time < 3 seconds (embedding ~500ms + LLM ~1500ms + overhead)
- ✅ Off-topic questions get \"insufficient information\" response
- ✅ tokensUsed is reasonable (typically 100-200)

---

## RAG Pipeline Architecture

### Visual Flow

```
┌──────────────────────────────────────┐
│ INPUT: Question (natural language)   │
│ \"What is machine learning?\"          │
└────────────┬─────────────────────────┘
             │
      ┌──────▼──────┐
   1. │  EMBEDDING  │  Convert question to 1536-dim vector
      │ ~100-200ms  │
      └──────┬──────┘
             │
      ┌──────▼──────┐
   2. │ RETRIEVAL   │  Find top-3 similar documents
      │ ~50-100ms   │
      └──────┬──────┘
             │
      ┌──────▼──────┐
   3. │CONTEXT      │  Format documents with rankings:
      │ASSEMBLY     │  \"1. [doc-1, score 0.92]
      │ ~1ms        │   2. [doc-2, score 0.81]
      └──────┬──────┘  3. [doc-3, score 0.75]\"
             │
      ┌──────▼──────────┐
   4. │ PROMPT          │  Build instruction + context + question:
      │ CONSTRUCTION    │  \"System: Answer only from documents
      │ ~1ms            │   Context: [3 documents]
      └──────┬──────────┘   User: [original question]\"
             │
      ┌──────▼──────┐
   5. │ GENERATION  │  Call LLM with full prompt
      │ ~1-2 sec    │
      └──────┬──────┘
             │
┌────────────▼─────────────────────────┐
│ OUTPUT:                              │
│ - Answer (grounded in documents)     │
│ - Sources (which docs were used)     │
│ - Metrics (tokens, time)             │
└──────────────────────────────────────┘
```

### Stage Breakdown

**Stage 1: Embedding (100-200ms)**

- Convert question to vector using OpenAI embedding model
- Same model used for document embeddings
- Output: 1536-dimensional vector

**Stage 2: Retrieval (50-100ms)**

- Call Pinecone with question vector
- Get top-K similar documents (K=3)
- Each result includes: id, text, similarity score

**Stage 3: Context Assembly (1ms)**

- Format retrieved documents nicely
- Preserve relevance ordering
- Keep scores for reference

**Stage 4: Prompt Construction (1ms)**

- Create system prompt with rules
- Insert retrieved documents
- Add user question

**Stage 5: Generation (1-2 seconds)**

- Call GPT-3.5-turbo with full prompt
- Model respects system prompt constraint
- Returns generated answer

---

## Prompt Engineering Patterns

### Pattern 1: Basic System Prompt

```typescript
const basicPrompt = `You are a helpful assistant.
Answer the question using only the provided context.
If you cannot answer from context, say \"I don't know.\"`;
```

### Pattern 2: Context-First Prompt

```typescript
const contextFirstPrompt = `You have access to the following documents:

${context}

Based ONLY on these documents, answer the question.
Do not use outside knowledge.`;
```

### Pattern 3: Role-Based Prompt

```typescript
const roleBasedPrompt = `You are a technical documentation assistant.
Your role: Answer technical questions using only provided documentation.
Style: Clear, concise, professional.
Constraint: Never add information not in the documents.`;
```

### Pattern 4: Examples-Based Prompt (Few-shot)

```typescript
const examplesPrompt = `${context}

Example Q&A:
Q: Simple question?
A: Direct answer from documents.

Q: Complex question?
A: Answer citing specific sections.

Now answer this question: ${question}`;
```

---

## Cost Analysis

### Per-Request Breakdown

```
Embedding question (~50 tokens):
  Cost: 50 * ($0.02 / 1M) = $0.000001

LLM Generation (~200 tokens prompt + 150 answer):
  Input: 200 * ($0.50 / 1M) = $0.0001
  Output: 150 * ($1.50 / 1M) = $0.000225
  Total: $0.000325

Total per request: ~$0.00033

For 1000 requests/month: $0.33
```

**Conclusion:** Cost is negligible. Focus on quality, not cost optimization.

---

## Common Issues & Solutions

| Problem                           | Cause               | Solution                                |
| --------------------------------- | ------------------- | --------------------------------------- |
| \"No relevant documents\"         | Retrieved 0 results | Check sample data seeded, adjust topK   |
| \"Answer doesn't match question\" | Poor retrieval      | Use evaluation (Task 07) to diagnose    |
| \"LLM ignoring context\"          | Bad system prompt   | Add explicit \"ONLY\" language          |
| \"Timeout (>3s)\"                 | Slow LLM call       | OK for RAG, consider async for UX       |
| \"No sources returned\"           | Missing metadata    | Ensure docs have metadata during upsert |
| \"Hallucinated facts\"            | Weak system prompt  | Strengthen constraint language          |

---

## Advanced Patterns

### Pattern 1: Multi-Query Expansion

```typescript
export async function askWithQueryExpansion(question: string) {
  // Generate alternative queries
  const variations = await generateQueryVariations(question);

  // Retrieve for each variation
  const allResults = [];
  for (const query of variations) {
    const results = await querySimilar(query, 3);
    allResults.push(...results);
  }

  // Deduplicate and rerank
  const unique = deduplicate(allResults);
  const ranked = rerank(unique);

  // Use top-3 for RAG
  return ask(question, ranked.slice(0, 3));
}
```

### Pattern 2: Streaming Responses

```typescript
export async function askStreaming(
  question: string,
  onChunk: (chunk: string) => void,
) {
  const sources = await querySimilar(question, 3);
  const context = assembleContext(sources);
  const prompt = buildSystemPrompt(context);

  const client = getOpenAIClient();

  const stream = client.chat.completions.create({
    model: "gpt-3.5-turbo",
    stream: true,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: question },
    ],
  });

  for await (const event of stream) {
    const chunk = event.choices[0].delta.content;
    if (chunk) onChunk(chunk);
  }
}
```

---

## Constraints

- Simple context concatenation (no re-ranking)
- Fixed topK=3 (can be tuned)
- No query expansion (Task 08)
- Fixed temperature=0.7
- Max answer 500 tokens

---

## Next Steps

**After this task:**

1. Task 06: Improve chunking to get better retrieval results
2. Task 07: Evaluate retrieval quality with metrics
3. Task 08: Optimize with advanced techniques

**To improve quality:**

- Use evaluation metrics (Task 07)
- Adjust topK based on results
- Experiment with system prompts
- Add domain-specific instructions

---

## Tutorial Trigger

- **rag.md** → Fill with complete RAG pipeline breakdown

Tutorial focus:

- What = RAG explained: why it works, when to use it
- How = Full pipeline implementation, prompt engineering
- Gotchas = Hallucination risks, context limits, chunking impact
- Trade-offs = Speed vs quality, cost vs accuracy, context size limits
