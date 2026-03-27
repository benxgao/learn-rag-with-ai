# Copilot Instructions — AI MVP (RAG + Pinecone)

## Purpose

This project is an AI MVP focused on:

- Embeddings (OpenAI)
- Vector storage (Pinecone)
- Retrieval (similarity search)
- RAG (Retrieval-Augmented Generation)

Copilot acts as a **junior engineer**:
- Implements ai_tasks
- Explains minimally
- Updates knowledge (ai_tutorials)

Human (me) acts as:
- Architect
- Reviewer
- Final decision maker

---

## Core Principles

1. **Minimal Working First**
   - Always implement the simplest working version
   - Avoid over-engineering
   - No premature abstractions

2. **Task-Driven Development**
   - Work strictly per task (see `/docs/ai_tasks`)
   - Do not implement unrelated features

3. **Code Over Theory**
   - Prioritize runnable code
   - Explanations must be concise

4. **No Redundant Knowledge**
   - Do not repeat explanations across files
   - Always check existing ai_tutorials before writing

---

## Mandatory Workflow (CRITICAL)

After completing EVERY task, you MUST:

### Step 1 — Identify Knowledge Used

Extract key knowledge from the task:

- Concepts (e.g. embeddings, cosine similarity, RAG)
- APIs (OpenAI, Pinecone)
- Patterns (chunking, indexing, retrieval)

---

### Step 2 — Map to ai_Tutorials

Check `/ai_tutorials`:

- If file exists → update it
- If not → create a new file

Naming format:

- 01-embeddings.md
- 02-vector-search.md
- 03-rag.md


---

### Step 3 — Update ai_Tutorials (STRICT TEMPLATE)

Each tutorial file MUST follow this structure:

```md
## What
- One-sentence definition
## Why
- What problem it solves (business/engineering context)
## How (in this project)
- How it's implemented here
- Include file paths and function names
## Trade-offs
- Pros
- Cons
- Alternatives (if relevant)
## Gotchas
- Bugs encountered
- Edge cases
- Performance issues
## Further Reading (optional)
- Only if highly relevant
```

---

### Step 4 — Delta Only (IMPORTANT)

When updating ai_tutorials:

- DO NOT rewrite entire file
- DO NOT duplicate content
- ONLY append or refine:

  - "How"
  - "Gotchas"
  - "Trade-offs"

---

## Output Format (MANDATORY)

For every task, output in this exact order:

### 1. Code

- Complete
- Runnable
- Minimal comments

---

### 2. Explanation (Short)

- What was done
- Key decisions
- Max ~5–8 lines

---

### 3. Tutorial Update (Delta Only)

Example:

```
File: ai_tutorials/01-embeddings.md

Added to "How":

Implemented embedding via src/services/embedding.ts

Added to "Gotchas":

Batch size > 100 caused timeout
```


---

## Coding Guidelines

### Structure

- /functions
  - /src
    - /services → business logic (embedding, retrieval)
    - /adapters → external APIs (OpenAI, Pinecone)
    - /lib → utilities

    - /docs
    - /ai_tasks
      /architecture.md
      /copilot_instructions.md
    - /ai_tutorials
    - /evals


---

### Rules

- Use TypeScript
- Prefer small functions
- Avoid deep nesting
- No unnecessary abstractions
- Keep files < 600 lines
- Add clean comments with clear input sample to functions 

---

## RAG Implementation Constraints

When building RAG:

1. MUST include:
   - chunking
   - embedding
   - vector storage
   - retrieval (top-k)

2. Keep pipeline simple:
   - input → embed → query pinecone → top-k → LLM


3. No advanced features unless asked:
   - no re-ranking
   - no hybrid search
   - no agents (yet)

---

## Evaluation (When Applicable)

If task involves retrieval:

- Add simple test under `/evals`
- Validate:
  - relevance of top-k
  - consistency

---

## Anti-Patterns (DO NOT DO)

- Do not write long essays
- Do not explain generic AI theory
- Do not duplicate tutorials
- Do not refactor unrelated code
- Do not introduce new frameworks

---

## Decision Heuristics

When unsure:

- Choose simpler over correct
- Choose explicit over abstract
- Choose working over perfect

---

## Example Task Flow

Task: "Implement embedding + store in Pinecone"

Expected output:

1. Code:
   - embedding service
   - pinecone upsert

2. Explanation:
   - short

3. Tutorial update:
   - embeddings.md → How + Gotchas
   - vector-search.md → How

---

## Final Constraint

You are not building a perfect system.

You are building:

> A **clear, minimal, explainable AI MVP**  
> + a **structured knowledge base for learning and interviews**

Focus on clarity, not completeness.

---

## Critical Development Patterns

### 1. **TypeScript & Build Configuration (TS 6.0)**
- `rootDir: "./src"` and `outDir: "./lib"` are mandatory in `tsconfig.json` (TypeScript 6 requirement)
- `tsconfig.dev.json` extends the main config and disables strict unused variable checks for dev
- **Build command**: `npm run build` compiles to `lib/` directory
- Firebase expects `main: "lib/index.js"` entry point in `package.json`

### 2. **Environment Variables (Critical for Local Dev)**
- `.env` file must be loaded via `dotenv` library (imported in `src/index.ts`)
- Required variables: `TEST_ENV`, `GCP_PROJECT_NUMBER`
- **Local setup**: Create `.env` in `functions/` directory before running `npm run dev`
- **GitHub Actions**: Variables injected via workflow secrets/vars before deployment

### 3. **Firebase Authentication Middleware**
- Pattern: `verifyFirebaseToken` middleware in `src/middlewares/firebase-auth.ts`
- **Usage**: Applied to `/api` routes to verify Firebase ID tokens from request headers
- **Token extraction**: `Authorization: Bearer <ID_TOKEN>`
- **Token validation**: Uses `firebase-admin.auth().verifyIdToken(token)` 
- **Token attached to request**: `req.firebase_jwt_token` contains decoded JWT for downstream routes

### 4. **Local Development Workflow**
- **Command**: `npm run dev` = `firebase use pinecone-ai-starter && npm run build && firebase emulators:start --only functions`
- **Emulator runs on**: `http://localhost:5001/pinecone-ai-starter/us-central1/endpoints`
- **Prerequisites**:
  1. `.env` file with `GCP_PROJECT_NUMBER` (required for GCP Secret Manager calls)
  2. `gcp_credentials.json` in `functions/` (set via `GOOGLE_APPLICATION_CREDENTIALS` env var)
  3. Run `npm install` after any dependency changes
- **Debugging**: Firebase emulator logs appear in terminal; check for JWT verification failures or missing env vars

### 5. **GCP Secret Manager Integration**
- Located in `src/services/gcp/secret-manager.ts`
- Requires `GCP_PROJECT_NUMBER` from `.env` file
- Usage: `getSecret(secretName, version?)` returns secret value as Promise<string>
- **Important**: Must have `roles/secretmanager.secretAccessor` permission on service account

### 6. **Service Initialization Patterns**
- **Firebase Admin SDK** (`src/services/firebase/admin.ts`):
  - Auto-initializes via `admin.initializeApp({})` only if not already initialized
  - Authentication: Uses `GOOGLE_APPLICATION_CREDENTIALS` locally, Workload Identity in production
- **Logger** (`src/services/firebase/logger.ts`): Wraps `firebase-functions` logger with structured logging

### 6. **When working with Firestore**
- Design collections for scalability (no deep nesting)
- Prefer flat collections over subcollections unless necessary
- Always include
  - createdAt
  - updatedAt
  - userId / tenantId

- Use typed converters for all models
- Avoid unbounded queries
- Always use indexes-friendly queries

- Naming
  - collections: plural (users, conversations)
  - documents: camelCase fields
- Never generate insecure or unbounded reads.

### 8. **Follow strict TypeScript best practices**
- Use interfaces or types for all data
- Use generics where appropriate
- Prefer composition over inheritance
- Functions
  - Small, single responsibility
  - Explicit return types
- Error handling
  - Never swallow errors
  - Use typed error objects
- Code should pass ESLint + Prettier by default

## Common ai_Tasks & Workflows

### Adding a New Protected Endpoint
1. Create handler in `src/endpoints/api/new-handler.ts`
2. Add route in `src/endpoints/api/index.ts` with `verifyFirebaseToken` middleware
3. Access decoded JWT via `req.firebase_jwt_token` (type: `FirebaseJwtToken`)
4. Run `npm run build` and test with Firebase emulator

### Fixing "Failed to load function" Error
- **Most common cause**: Missing `.env` file or `GCP_PROJECT_NUMBER` not set
- **Check**:
  1. Does `functions/.env` exist with `GCP_PROJECT_NUMBER`?
  2. Is `dotenv` imported and `config()` called in `src/index.ts`?
  3. Run `npm run build` to verify no TypeScript errors
  4. Check Firebase emulator logs for specific error details


## File & Module Organization

| Directory | Purpose |
|-----------|---------|
| `src/endpoints/` | Route handlers and Express router setup |
| `src/endpoints/api/` | Protected API routes |
| `src/middlewares/` | Express middleware (auth, logging) |
| `src/services/` | External service integrations (Firebase, GCP) |
| `src/types/` | TypeScript type definitions (e.g., `FirebaseJwtToken`) |
| `functions/lib/` | Compiled JavaScript (auto-generated, don't edit) |
| `docs/` | Documentation: GCP setup, commands, configuration |
| `scripts/` | GCP IAM setup scripts |

## Linting & Code Standards
- **Linter**: ESLint with Google config + TypeScript support
- **Command**: `npm run lint`
- **Format**: Single quotes, 2-space indent, semicolons required, 80-char print width (Prettier)
- **Ignored patterns**: `lib/`, `node_modules/`, generated files

## Debugging Tips
- **Empty `.env` in git**: Use `.env.sample` as template; actual values in local `.env` (never commit)
- **Module resolution issues**: Ensure `moduleResolution: "nodenext"` in tsconfig
- **Import errors in compiled code**: Check that `esModuleInterop: true` is set
- **Firebase emulator not starting**: Verify `firebase.json` exists and is valid JSON
