Agentic RAG is not just a “next step” after RAG—it is a **shift in paradigm**:

> from _static retrieval pipeline_ → to _adaptive reasoning system with retrieval as a tool_

Given you already have:

- basic chunking
- embeddings / retrieval
- basic evaluation

The correct progression is not “more RAG techniques”, but:

> **introducing control loops, decision-making, and system decomposition**

---

# 1. Core mental model upgrade

Traditional RAG:

```text
query → retrieve → generate
```

Agentic RAG:

```text
query
  ↓
planner → (decide what to do)
  ↓
tools (retrieve / search / calc / call APIs)
  ↓
memory (store intermediate results)
  ↓
reflection (check correctness)
  ↓
final answer
```

Key shift:

- retrieval is no longer mandatory
- it is **conditionally invoked**

---

# 2. Knowledge domains you need to add

## 2.1 Query understanding & decomposition

You need to learn:

- query rewriting
- multi-hop decomposition
- intent classification

Core ideas:

- one query → multiple sub-queries
- retrieval becomes iterative

Example:

```text
"Compare GDP of NZ and AU last 10 years"

→ split:
1. NZ GDP data
2. AU GDP data
3. comparison logic
```

---

## 2.2 Planner design (the “agent brain”)

Types of planners:

- rule-based (if/else)
- LLM-based planner
- graph/workflow-based (LangGraph style)

What to learn:

- when to retrieve vs not
- when to stop
- when to retry

---

## 2.3 Tool abstraction layer

RAG becomes just one tool among many:

Tools:

- vector search
- web search
- SQL
- APIs
- calculator

Key concept:

> unify everything into a **tool interface**

---

## 2.4 Memory systems (critical upgrade)

You need 3 layers:

### Short-term memory

- current conversation
- intermediate reasoning steps

### Long-term memory

- user data
- past queries

### Retrieval memory

- your vector DB (classic RAG)

Insight:

> RAG = just one type of memory

---

## 2.5 Reflection / self-correction

This is where most systems fail.

Patterns:

- answer critique
- retrieval validation
- hallucination detection

Example loop:

```text
generate answer
→ check: "is this grounded in retrieved docs?"
→ if not → retrieve again
```

---

## 2.6 Multi-step retrieval (advanced RAG)

Instead of:

- retrieve once

You do:

- retrieve → refine query → retrieve again

Techniques:

- query expansion
- reranking
- fusion

---

## 2.7 Evaluation for agent systems

Your current eval is likely:

- relevance
- correctness

Now you need:

- step-level evaluation
- tool usage accuracy
- reasoning trace quality

New metrics:

- “did it choose the right tool?”
- “did it over-retrieve?”

---

## 2.8 Failure modes (important)

Agentic RAG introduces new risks:

- infinite loops
- tool overuse (cost explosion)
- wrong planning
- cascading errors

You need:

- guardrails
- max step limits
- cost tracking

---

# 3. Suggested 8-course task roadmap (practical, build-focused)

These extend your current repo naturally.

---

## Task 1 — Query Rewriting Layer

Build:

- LLM-based query optimizer before retrieval

Learn:

- prompt design
- query expansion

Output:

```text
user query → optimized query → retrieval
```

---

## Task 2 — Multi-Hop RAG

Build:

- break query into sub-queries
- retrieve per step

Learn:

- decomposition patterns

---

## Task 3 — Tool-based Architecture

Refactor:

- turn retrieval into a “tool”

Add:

- at least one more tool (e.g. web search mock)

---

## Task 4 — Simple Planner (rule-based)

Implement:

```text
if question is factual → retrieve
if math → calculator
else → direct answer
```

Goal:

- introduce decision layer

---

## Task 5 — LLM Planner (core upgrade)

Replace rules with:

- LLM deciding:
  - which tool to use
  - in what order

---

## Task 6 — Reflection Loop

Add:

- answer validation step
- retry mechanism

Example:

```text
if confidence < threshold → re-retrieve
```

---

## Task 7 — Memory System

Add:

- conversation history store
- retrieval from past interactions

---

## Task 8 — Full Agentic RAG Pipeline

Combine:

- planner
- tools
- memory
- reflection

Result:

```text
mini agent system (not just RAG)
```

---

# 4. What most people miss (your differentiation)

If you want this course to stand out:

### Emphasize:

- decision-making, not APIs
- failure analysis, not happy path
- cost + latency trade-offs

---

### Avoid:

- just adding LangChain / frameworks
- “more techniques list”

---

# 5. Strong positioning for your next module

Instead of:

> Advanced RAG

Use:

- “From RAG to Agents”
- “Building Systems That Decide When to Retrieve”
- “Beyond Retrieval: Adaptive AI Systems”

---

# 6. Final insight

The industry direction is clear:

```text
RAG (2023)
→ Advanced RAG (2024)
→ Agentic RAG (2025–)
→ Autonomous systems
```

If you structure your course along that evolution path, it becomes:

> not just a tutorial, but a **map of the field**
