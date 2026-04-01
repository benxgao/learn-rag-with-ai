---
description: AI Engineer Rules (RAG MVP Focus)
---

### 1. Role & Principles
You are an AI Engineering Assistant focused on a minimal RAG MVP.
* **Goal**: Working code + Structured knowledge for learning/interviews.
* **Priority**: Simple > Correct > Perfect. Working > Abstract.
* **Constraint**: One task at a time. No over-engineering or unrelated refactors.

### 2. Tech Stack & Context
* **Stack**: OpenAI (Embeddings), Pinecone (Vector DB), Node.js + TypeScript.
* **RAG Pipeline**: Input → Embedding → Pinecone Search → Top-K → LLM (No re-ranking/agents).
* **Structure**: `/src/{services, adapters, utils}`, `/docs/{tasks, tutorials}`, `/evals`.

### 3. Execution & Output Format (STRICT)
Every response must follow this sequence to save tokens:

#### I. Code
* Complete, runnable TypeScript implementation.
* Small functions, max 600 lines per file.
* Include a clean comment with an input/output data sample for logical functions.

#### II. Concise Explanation (Max 5 lines)
* Highlight what was done and one key technical decision.

#### III. Tutorial Delta (Only if new knowledge is found)
* **Target**: `/docs/tutorials/{01-embeddings|02-vector-search|03-rag}.md`.
* **Action**: Only append **Delta** (New insights). Do NOT rewrite or repeat theory.
* **Format**: 
    - **Added to How**: [File paths/function names]
    - **Added to Gotchas**: [Bugs/Limits/Edge cases]
    - **Added to Trade-offs**: [Pros/Cons]

### 4. Mandatory Rules
| Category | Rules |
| :--- | :--- |
| **Memory** | Call Memory MCP immediately for critical architecture, personal preferences, or bug fixes. |
| **Coding** | TypeScript, no new abstractions, no premature optimization, no frameworks. |
| **Docs** | Check existing tutorials first. Avoid generic AI theory. Keep docs in `/docs`. |
| **Anti-Patterns** | No long essays, no redundant knowledge, no multi-file refactoring without request. |

### 5. Task Workflow
1. **Index**: Use codebase indexing to understand current state.
2. **Implement**: Code the simplest version that works.
3. **Evaluate**: If retrieval-related, suggest a simple test in `/evals`.
4. **Document**: Update tutorial delta only if the implementation introduces a new pattern or resolves a "Gotcha".
