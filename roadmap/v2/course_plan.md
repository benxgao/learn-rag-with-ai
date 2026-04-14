---
version: v2
focus: Agentic RAG Foundations (80% coverage)
num_tasks: 5
progression: foundational → incremental depth
---

# V2 Course Plan: From RAG to Agentic Systems

## Overview

This v2 course extends the RAG foundation (Tasks 01-08) into **Agentic RAG** by introducing decision-making, tool abstraction, and feedback loops. After completing these 5 tasks, you'll have built the core pieces of an adaptive retrieval system that can reason about _when_ and _how_ to retrieve information.

**Key Paradigm Shift:**

```
Task 01-08: query → retrieve → generate

V2 focus:   query → understand → plan → (tools/memory/reflection) → generate
```

---

## V2 Task 09: Query Understanding & Decomposition

**Time Estimate:** 4-5 hours

### Learning Objectives

- Understand that not all queries need direct retrieval
- Learn to rewrite queries for better semantic matching
- Decompose complex multi-part questions into sub-queries
- Implement iterative query refinement

### Functional Features to Build

1. **Query Rewriting Engine**
   - Input: User question (possibly vague or poorly phrased)
   - Process: LLM rewrites it for clarity and semantic strength
   - Output: Improved query sent to retriever
   - Example: "What's the fastest animal?" → "Which animal species has the highest top speed?"

2. **Query Decomposition**
   - Input: Complex multi-hop questions
   - Process: Automatically break into 2-3 sub-queries
   - Output: List of atomic retrieval tasks
   - Example: "Compare machine learning and deep learning, and explain their differences"
     - Sub-query 1: "What is machine learning?"
     - Sub-query 2: "What is deep learning?"
     - Sub-query 3: "Key differences between machine learning and deep learning"

3. **Semantic Query Expansion**
   - Generate synonym and related-concept queries
   - Retrieve with multiple query variants
   - Combine + deduplicate results
   - Example: "autonomous vehicles" also searches for "self-driving cars", "driverless vehicles"

### Implementation Guidelines

- Use LLM prompt calls for query rewriting and decomposition
- Score decomposed queries by complexity/importance
- Track which sub-query contributed to final answer

### Knowledge Domains Covered

- ✅ Query understanding & decomposition
- ✅ Multi-step retrieval concepts (foundation)
- ✅ Prompt engineering for specific tasks

### Deliverables

- Query rewriter module
- Decomposition logic
- Expansion strategy
- Test cases for various query types

---

## V2 Task 10: Tool-Based Architecture & Abstraction

**Time Estimate:** 5-6 hours

### Learning Objectives

- Abstract retrieval into a "tool" interface
- Understand that retrieval is just ONE tool among many
- Learn to design a tool registry and dispatcher
- Implement at least 2 different tools with common interface

### Functional Features to Build

1. **Tool Interface & Registry**
   - Define common `Tool` interface with: name, description, inputs, execute()
   - Build tool registry (discover available tools dynamically)
   - Implement tool metadata (capabilities, cost, latency expectations)

2. **Vector Retrieval Tool**
   - Refactor existing retrieval into a tool
   - Input: query + top_k
   - Output: ranked documents with metadata
   - Track: retrieval time, docs returned

3. **Additional Tool (Choose One)**
   - **Option A:** Calculator/Math Solver
     - Input: mathematical expression or problem
     - Output: computed result with explanation
   - **Option B:** Web Search Simulator
     - Input: search query
     - Output: mock search results with URLs and snippets
   - **Option C:** Knowledge Base Lookup
     - Input: structured query (e.g., "price of X product")
     - Output: structured data response

4. **Tool Dispatcher**
   - Execute tools given tool_name + inputs
   - Handle tool failures gracefully
   - Log tool calls for debugging

### Implementation Guidelines

- Create abstract `BaseTool` class
- Make tools pluggable (easily add new tools later)
- Include tool versioning/stability tracking
- Tool response format should be standardized

### Knowledge Domains Covered

- ✅ Tool abstraction layer
- ✅ System modularity
- ✅ Interface design patterns

### Deliverables

- Tool base class + interface
- Refactored retrieval as a tool
- At least 1 additional tool implementation
- Tool registry and dispatcher
- Unit tests for tool invocation

---

## V2 Task 11: Decision-Making Planner (Rule-Based)

**Time Estimate:** 5-6 hours

### Learning Objectives

- Introduce planning layer BEFORE tool execution
- Understand conditional tool routing (when to use which tool)
- Learn to design decision trees for query handling
- Build confidence in agent decision-making

### Functional Features to Build

1. **Query Classifier**
   - Classify incoming query into categories:
     - Factual retrieval (needs vector search)
     - Calculation (needs math tool)
     - Structured lookup (needs knowledge base)
     - Multi-part (needs decomposition + multiple tools)
   - Use rule-based logic or simple LLM classification

2. **Rule-Based Planner**
   - Input: classified query
   - Logic: IF-THEN rules determine tool sequence
   - Output: execution plan (ordered list of tool calls)
   - Example rules:

     ```
     IF query_type == "multi_part" AND complexity > threshold
       THEN [decompose, then retrieve_per_part, then synthesize]

     IF query_type == "calculation"
       THEN [use_calculator]

     IF query_type == "factual"
       THEN [retrieve, optionally expand if low_confidence]
     ```

3. **Plan Executor**
   - Execute each step in the plan sequentially
   - Store intermediate results
   - Check conditions before proceeding to next step
   - Handle failures with fallback strategies
   - Example: If retrieval returns no results, try expanded query

4. **Confidence Scoring**
   - Assess confidence at each stage
   - Feed forward to next stage decision
   - Track: question difficulty, answer quality signals
   - Use for deciding whether to use additional tools

### Implementation Guidelines

- Keep rule set explicit and maintainable
- Log all plan generation + execution steps
- Include debug mode showing decision reasoning
- Make adding new rules straightforward

### Knowledge Domains Covered

- ✅ Planner design (rule-based, the "agent brain")
- ✅ Decision-making and routing
- ✅ Conditional logic in agentic systems

### Deliverables

- Query classifier
- Rule-based planner implementation
- Plan executor
- Confidence scoring module
- Rule configuration + documentation
- Test suite for various query types

---

## V2 Task 12: Reflection & Self-Correction Loop

**Time Estimate:** 5-6 hours

### Learning Objectives

- Validate system outputs before returning to user
- Detect hallucinations and low-quality retrievals
- Implement automatic retry logic
- Understand repair strategies

### Functional Features to Build

1. **Answer Grounding Checker**
   - Input: Generated answer + retrieved documents
   - Process: Verify answer is actually supported by the docs
   - Output: Confidence score (is answer grounded?)
   - Detect: Unsupported claims, extrapolations, hallucinations
   - Example: If answer mentions "Year 2025" but docs only have 2024 data → flag

2. **Retrieval Quality Validator**
   - Check if retrieved docs are actually relevant
   - Measure: Semantic similarity between query and retrieved docs
   - Flag: Low-quality retrievals for refinement
   - Threshold: "If avg relevance < X, try again with expanded query"

3. **Automatic Retry Strategy**
   - Trigger: Low confidence on retrieval or answer grounding
   - Retry 1: Expand query with synonyms
   - Retry 2: Decompose and search sub-components
   - Retry 3: Search with relaxed filters
   - Max retries: 2-3 (avoid infinite loops)

4. **Confidence Feedback Loop**
   - Calculate overall system confidence (1.0 = high confidence)
   - Factor in: answer grounding, retrieval quality, source count
   - User sees confidence level in response
   - Optional: "I'm X% confident in this answer"

5. **Failure Analysis Logging**
   - Why did retrieval fail? (no results, low relevance, etc.)
   - Why did answer grounding fail? (missing source, extrapolation, etc.)
   - Learn from failures to improve rules/queries

### Implementation Guidelines

- Use LLM-based validation (ask it "Is this answer supported by X?")
- Include edge cases: multi-part questions, calculations
- Make retry thresholds configurable
- Log all validation steps for debugging

### Knowledge Domains Covered

- ✅ Reflection & self-correction
- ✅ Hallucination detection
- ✅ Quality assurance in agentic systems
- ✅ Failure diagnosis

### Deliverables

- Answer grounding validator
- Retrieval quality checker
- Retry orchestration logic
- Confidence scorer
- Failure analysis logging
- Evaluation metrics (how often retries help?)

---

## V2 Task 13: Multi-Step Retrieval & Conversation Memory

**Time Estimate:** 6-7 hours

### Learning Objectives

- Iterate on retrieval based on intermediate results
- Store and use conversation context
- Build a simple memory system
- Handle multi-turn interactions gracefully

### Functional Features to Build

1. **Query Refinement Motor**
   - After initial retrieval: Analyze what was found
   - Decide: Is result sufficient or does query need refinement?
   - Refinement strategies:
     - Adjust specificity (broaden if too narrow, narrow if too broad)
     - Add context from previous turns
     - Use synonyms if first attempt failed
   - Output: Refined query + second retrieval attempt

2. **Conversation Memory Module**
   - Store:
     - User messages (full conversation history)
     - Retrieved documents per turn (what was found)
     - Intermediate reasoning (why did we choose this tool?)
     - Previous answers (for reference in later queries)
   - Retrieve: Relevant context from memory for current query
   - Limit: Keep only recent N turns (memory window)

3. **Context Injection**
   - When generating answer: Include context from conversation history
   - Example: If user asks "What about other applications?" → remember previous topic
   - Inject into prompt: "Context from conversation: User previously asked about X"
   - Track: What's new vs what's follow-up

4. **Multi-Turn Query Resolution**
   - Handle: "Explain that more", "Compare with...", "Any other examples?"
   - Mechanism: Use previous query + document context to answer follow-ups
   - Avoid: Redundant retrievals on simple follow-up questions
   - Optimize: Do smart retrieval only when truly needed

5. **Iterative Improvement on Single Query**
   - First retrieval: baseline
   - Analyze results: What's missing?
   - Second retrieval: targeted (e.g., search for "limitations" if first retrieval only found "benefits")
   - Combine: Merge results from multiple retrieval passes
   - Example: "Tell me pros AND cons" → retrieve both separately, then combine

### Implementation Guidelines

- Use vector DB for fast memory lookup (embed past queries)
- Implement memory window size limit (sliding window)
- Make memory queryable: "What have we discussed about X?"
- Include memory decay (older items less prioritized)
- Fallback: If memory lookup fails, do full retrieval

### Knowledge Domains Covered

- ✅ Memory systems (short-term conversation memory)
- ✅ Multi-step retrieval
- ✅ Iterative query refinement
- ✅ Context propagation
- ✅ Multi-turn conversation handling

### Deliverables

- Memory storage + retrieval
- Query refinement logic
- Multi-turn conversation handler
- Context injection mechanism
- Iterative retrieval orchestrator
- Example multi-turn conversations demonstrating improvement

---

## Integration & Testing

### End-to-End Workflows to Test

**Scenario 1: Complex Multi-Part Query**

```
User: "What are the differences between supervised and unsupervised learning,
       and give me examples of each?"

Expected Flow:
1. [Task 1] Rewriter + Decomposer: Break into 3 sub-queries
2. [Task 2] Plan: Decide to use retrieval tool for each
3. [Task 3] Planner: Execute retrieval for each sub-query
4. [Task 4] Reflection: Check all 3 parts are well-grounded
5. Synthesize: Combine into cohesive answer
```

**Scenario 2: Follow-up Question**

```
First query: "Explain neural networks"
Second query: "What are the limitations?"

Expected Flow:
1. [Task 5] Memory: Recall previous answer about neural networks
2. [Task 1] Query rewriter: Understand this is specific follow-up
3. [Task 2-3] Plan: Targeted retrieval for limitations only
4. [Task 4] Reflection: Validate against first answer + new docs
5. Return grounded answer with context
```

**Scenario 3: Query Refinement**

```
User: "Machine learning frameworks"

Expected Flow:
1. Initial retrieval: Returns 5 docs
2. [Task 5] Analyze: Are results comprehensive? Specific enough?
3. Refined query: "Top Python machine learning frameworks 2024"
4. Second retrieval: More targeted results
5. Combine + return best 5-7 docs
```

### Evaluation Checklist

- [ ] Each task builds on previous without requiring all previous tasks
- [ ] Can measure success per task (e.g., decomposition accuracy, retry success rate)
- [ ] Integration scenarios pass end-to-end
- [ ] Memory doesn't grow infinitely
- [ ] Retries eventually terminate (no infinite loops)
- [ ] Confidence scores are useful (correlate with actual accuracy)

---

## Reference: Connection to Existing V1 Tasks

| V1 Task                   | V2 Foundation                                     |
| ------------------------- | ------------------------------------------------- |
| 01 Embeddings             | Used by all tasks (retrieval tool)                |
| 02 Vector DB              | Task 2 (retrieval tool), Task 5 (memory storage)  |
| 03 Upsert                 | Prerequisite (data loading)                       |
| 04 Similarity             | Task 2 (retrieval tool implementation)            |
| 05 RAG                    | Foundation (generation layer)                     |
| 06 Chunking               | Prerequisite (document preparation)               |
| 07 Eval                   | Task 4 (answer validation), implicit in all tasks |
| 08 Retrieval Optimization | Task 5 (query refinement)                         |

---

## Success Criteria: End of V2

After completing all 5 tasks, you should be able to:

✅ **Understand** when retrieval is needed vs not
✅ **Decompose** complex queries into simpler components  
✅ **Route** queries to appropriate tools
✅ **Validate** answers against source documents
✅ **Refine** failing queries automatically
✅ **Remember** conversation context across turns
✅ **Plan** multi-step operations (tasks)
✅ **Detect** hallucination attempts
✅ **Build** scalable agentic systems beyond simple RAG

At this point, you're ready for V3 advanced topics: LLM-based planning, sophisticated memory, multi-agent systems.

---

## V2 Course Tasks Created

### 09-query-understanding-task-v2.md

**Query Understanding & Decomposition** (4-5 hours)

- Query rewriter service with LLM integration
- Query classifier (9 query types with rule-based + LLM fallback)
- Query decomposer for multi-part questions
- Query expander for semantic variants
- New endpoint: `/api/query/enhanced-search`
- Reuses: OpenAI, Pinecone/Vector DB, Firebase logging
- New modules: `services/query/`, `types/query.ts`

### 10-tool-architecture-task-v2.md

**Tool-Based Architecture & Abstraction** (5-6 hours)

- `BaseTool` abstract class with unified interface
- `ToolRegistry` for dynamic tool management
- `ToolDispatcher` with timeout/retry handling
- RetrievalTool (refactored from v1 RAG)
- CalculatorTool and WebSearchTool (mock) implementations
- New endpoints: `/api/tools/` (list, health, execute, batch)
- Reuses: All v1 services (Firebase, OpenAI, Pinecone)
- New modules: `services/tools/`, `types/tools.ts`

### 11-planner-task-v2.md

**Decision-Making Planner (Rule-Based)** (5-6 hours)

- `QueryPreprocessor` for query normalization
- `QueryClassifier` with 9 query types
- `RuleBasedPlanner` generating execution plans
- `PlanExecutor` with retry/exponential backoff
- New endpoint: `/api/planning/plan`
- Decision tree visualization (calculation, verification, comparison, etc.)
- Reuses: Query classifier logic, tool dispatcher
- New modules: `services/planning/`, `types/planning.ts`

### 12-reflection-task-v2.md

**Reflection & Self-Correction Loop** (5-6 hours)

- `GroundingValidator` for hallucination detection
- `RetrievalValidator` for document relevance checking
- `ConfidenceScorer` combining multiple quality signals
- `RetryManager` with 5 retry strategies
- `ReflectionOrchestrator` coordinating validation/correction
- New endpoint: `/api/reflection/validate`
- Automatic retry on low confidence
- Reuses: LLM calls, retrieval, dispatcher
- New modules: `services/reflection/`, `types/reflection.ts`

### 13-memory-task-v2.md

**Multi-Step Retrieval & Conversation Memory** (6-7 hours)

- `MemoryStore` for persistent conversation storage
- `ContextInjector` for query enrichment with history
- `IterativeRetrieval` for multi-pass refinement
- `MultiTurnHandler` for follow-up question routing
- New endpoints: `/api/conversation/` (start, ask, history, summary)
- Memory decay and window management
- Reuses: Firebase, vector DB for semantic lookup, tool dispatcher
- New modules: `services/memory/`, `types/memory.ts`

---

## Key Design Principles Applied

✅ **Compatibility with V1**

- All services reuse existing adapters (OpenAI, Pinecone, Firebase)
- New modules follow existing code patterns (services/, endpoints/, types/)
- Express router patterns consistent with v1 endpoints
- Type definitions extend existing ones

✅ **Progressive Complexity**

- Each task can be completed independently or sequentially
- Earlier tasks (1-3) form foundation for reflection/memory (4-5)
- Clear dependencies documented (prerequisites)

✅ **Production-Ready Patterns**

- Error handling with retries and timeouts
- Logging at key decision points
- Type-safe interfaces throughout
- Execution history and metrics tracking
- Cost/performance estimation

✅ **Actionable Implementation Guides**

- Each task has 4-5 implementation layers with code examples
- Clear API signatures and request/response formats
- Integration examples showing how to use new features
- Testing strategies for validation

---

## Module Structure Summary

```
functions/src/
├── services/
│   ├── query/           [NEW - Task 09]
│   ├── tools/           [NEW - Task 10]
│   ├── planning/        [NEW - Task 11]
│   ├── reflection/      [NEW - Task 12]
│   └── memory/          [NEW - Task 13]
│
├── endpoints/api/
│   ├── query.ts         [NEW]
│   ├── tools.ts         [NEW]
│   ├── planning.ts      [NEW]
│   ├── reflection.ts    [NEW]
│   └── conversation.ts  [NEW]
│
└── types/
    ├── query.ts         [NEW]
    ├── tools.ts         [NEW]
    ├── planning.ts      [NEW]
    ├── reflection.ts    [NEW]
    └── memory.ts        [NEW]
```
