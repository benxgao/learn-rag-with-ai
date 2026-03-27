# Task 04 — Query Similarity

## Goal

Retrieve top-k similar vectors from Pinecone.

---

## Requirements

- Input: query text
- Process:
  - embed query
  - search Pinecone
- Output:
  - top-k results

---

## Implementation

File:
/src/services/retrieval.ts

Functions:

- querySimilar(text: string, topK: number)

---

## Output

- Query example
- Print top results

---

## Constraints

- topK = 3 (fixed)

---

## Tutorial Trigger

- vector-search.md

Focus:

- similarity search
- cosine similarity concept
