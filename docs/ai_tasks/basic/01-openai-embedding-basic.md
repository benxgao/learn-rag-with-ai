# Task 01 — OpenAI Embedding

## Goal

Generate embeddings from text using OpenAI API.

---

## Requirements

- Input: string
- Output: embedding vector (number[])

---

## Implementation

File:
/src/adapters/openai.ts  
/src/services/embedding.ts

Functions:

- createEmbedding(text: string): Promise<number[]>

---

## Output

- Call function with sample text
- Log embedding length

---

## Constraints

- Single request only (no batching yet)

---

## Tutorial Trigger\n\n- embeddings.md\n\nFocus:\n\n- What = embedding\n- How = OpenAI API usage
