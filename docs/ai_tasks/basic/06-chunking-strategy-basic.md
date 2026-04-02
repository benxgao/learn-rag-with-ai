# Task 06 — Chunking Strategy

## Goal

Split long text into chunks before embedding.

---

## Requirements

- Input: long text
- Output: string[]

---

## Implementation

File:
/src/lib/chunking.ts

Functions:

- chunkText(text: string): string[]

---

## Output

- Chunk a long paragraph
- Insert chunks into Pinecone

---

## Constraints

- Fixed size chunk (e.g. 500 chars)
- No overlap (yet)

---

## Tutorial Trigger

- rag.md (update How)
- embeddings.md (Gotchas)

Focus:

- why chunking matters
