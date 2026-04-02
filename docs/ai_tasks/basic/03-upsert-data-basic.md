# Task 03 — Upsert Data

## Goal

Store embedded vectors into Pinecone.

---

## Requirements

- Input: text
- Process:
  - embed text
  - upsert into Pinecone

---

## Implementation

File:
/src/services/vectorStore.ts

Functions:

- upsertText(id: string, text: string)

---

## Output

- Insert 3–5 sample texts

---

## Constraints

- No batching
- No metadata (yet)

---

## Tutorial Trigger

- embeddings.md (update How)
- vector-search.md (update How)

Focus:

- embedding + storage pipeline
