---
notes: V2 Task - Build conversation memory and iterative retrieval refinement system
prerequisites: V1 Tasks 01-08 completed, V2 Task 01-04 (all previous tasks)
---

# V2 Tutorial 05 — Multi-Step Retrieval & Conversation Memory

## What You'll Learn

In this tutorial, you'll discover:

- **Conversation memory patterns** — Storing and retrieving context
- **Iterative query refinement** — Improving searches based on results
- **Multi-turn interactions** — Handling follow-up questions naturally
- **Memory decay** — Balancing recent vs older context
- **Context windowing** — Managing memory size efficiently
- **Query enrichment** — Using memory to improve current query
- **Retrieval fusion** — Combining multiple retrieval passes
- **Production memory patterns** — Scalable storage and lookup

---

## The Core Problem: Each Query in Isolation

### Without Memory

```
Turn 1: User → "Explain machine learning"
       Response: [generated from retrieval]

Turn 2: User → "What about deep learning?"
       System thinks: This is a new standalone query
       Result: Doesn't connect to previous context
```

### Without Iterative Refinement

```
Query: "applications"
First retrieval: 5 documents returned
Issue: Are these comprehensive?
Without refinement: Accept as-is (may miss important docs)
```

---

## The Solution: Memory + Iterative Retrieval

### Architecture Overview

```
User Query (current turn)
     ↓
[1. Memory Lookup] → Find relevant context from previous turns
     ↓
[2. Context Injection] → Enrich current query with history
     ↓
[3. Initial Retrieval] → First search pass
     ↓
[4. Analyze Results] → Are they complete/good enough?
     ↓
[5. Iterative Refinement] → If needed, search again with refined query
     ↓
[6. Result Fusion] → Combine multi-pass results
     ↓
[7. Memory Store] → Save current turn for future reference
     ↓
Final Answer + Enhanced Context
```

---

## Implementation Guide

### Layer 1: Memory Store (Conversation History)

**Purpose:** Persistent storage of conversation turns and context

**Implementation Approach:**

```typescript
// services/memory/store.ts

export interface ConversationTurn {
  id: string;
  timestamp: number;
  userQuery: string;
  rewrittenQuery?: string;
  systemResponse: string;
  retrievedDocuments: Array<{
    id: string;
    content: string;
    score: number;
  }>;
  confidence: number;
  metadata: {
    queryType?: string;
    processingTimeMs: number;
    tokens Used?: number;
  };
}

export interface ConversationMemory {
  conversationId: string;
  userId: string;
  turns: ConversationTurn[];
  metadata: {
    createdAt: number;
    lastUpdatedAt: number;
    totalTokensUsed: number;
  };
}

export class MemoryStore {
  private firebaseService: FirebaseService;
  private vectorStore: VectorStore; // For semantic lookup
  private logger: Logger;
  private localCache: Map<string, ConversationMemory> = new Map();

  constructor(
    firebaseService: FirebaseService,
    vectorStore: VectorStore,
    logger: Logger
  ) {
    this.firebaseService = firebaseService;
    this.vectorStore = vectorStore;
    this.logger = logger;
  }

  // Create new conversation
  async createConversation(
    userId: string,
    conversationId?: string
  ): Promise<ConversationMemory> {
    const id = conversationId || `conv-${Date.now()}`;
    const conversation: ConversationMemory = {
      conversationId: id,
      userId,
      turns: [],
      metadata: {
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
        totalTokensUsed: 0
      }
    };

    await this.firebaseService.setDocument('conversations', id, conversation);
    this.localCache.set(id, conversation);

    this.logger.info(`Created conversation: ${id}`);
    return conversation;
  }

  // Add turn to conversation
  async addTurn(
    conversationId: string,
    turn: ConversationTurn
  ): Promise<void> {
    let conversation = this.localCache.get(conversationId);

    if (!conversation) {
      conversation = await this.firebaseService.getDocument(
        'conversations',
        conversationId
      );
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
    }

    // Enforce memory window (keep last 20 turns)
    if (conversation.turns.length >= 20) {
      conversation.turns = conversation.turns.slice(-19);
    }

    conversation.turns.push(turn);
    conversation.metadata.lastUpdatedAt = Date.now();
    if (turn.metadata.tokensUsed) {
      conversation.metadata.totalTokensUsed += turn.metadata.tokensUsed;
    }

    // Save to Firebase
    await this.firebaseService.setDocument('conversations', conversationId, conversation);
    this.localCache.set(conversationId, conversation);

    // Index turn for semantic search
    await this.indexTurn(conversationId, turn);

    this.logger.info(`Added turn to conversation: ${conversationId}`);
  }

  // Get conversation
  async getConversation(conversationId: string): Promise<ConversationMemory | null> {
    let conversation = this.localCache.get(conversationId);

    if (!conversation) {
      conversation = await this.firebaseService.getDocument(
        'conversations',
        conversationId
      );
      if (conversation) {
        this.localCache.set(conversationId, conversation);
      }
    }

    return conversation || null;
  }

  // Get recent turns
  getRecentTurns(
    conversation: ConversationMemory,
    count: number = 5
  ): ConversationTurn[] {
    return conversation.turns.slice(-count);
  }

  // Index turn for semantic search
  private async indexTurn(
    conversationId: string,
    turn: ConversationTurn
  ): Promise<void> {
    // Embed the user query for later retrieval
    // This enables: "What did we discuss about X?"
    const embeddingId = `${conversationId}_turn_${turn.id}`;

    await this.vectorStore.upsert({
      id: embeddingId,
      text: `${turn.userQuery} ${turn.systemResponse}`,
      metadata: {
        conversationId,
        turnId: turn.id,
        timestamp: turn.timestamp,
        queryType: turn.metadata.queryType
      }
    });
  }

  // Search memory for relevant context
  async searchMemory(
    conversationId: string,
    query: string,
    topK: number = 3
  ): Promise<ConversationTurn[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return [];
    }

    // Search indexed turns
    const results = await this.vectorStore.search(
      query,
      topK,
      {
        conversationId
      }
    );

    // Map back to turns
    const relevantTurns: ConversationTurn[] = [];
    for (const result of results) {
      const turnId = result.metadata?.turnId;
      const turn = conversation.turns.find(t => t.id === turnId);
      if (turn) {
        relevantTurns.push(turn);
      }
    }

    return relevantTurns;
  }

  // Clear old conversations (cleanup)
  async clearOldConversations(olderThanDays: number): Promise<number> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    // Implementation: query and delete from Firebase
    this.logger.info(`Cleared conversations older than ${olderThanDays} days`);
    return 0; // Number cleared
  }
}
```

### Layer 2: Context Injector

**Purpose:** Enrich current query with relevant memory context

**Implementation Approach:**

```typescript
// services/memory/context-injector.ts

export interface EnrichedQuery {
  originalQuery: string;
  enrichedQuery: string;
  contextSummary: string;
  relevantTurns: ConversationTurn[];
}

export class ContextInjector {
  private memoryStore: MemoryStore;
  private openaiService: OpenAIService;

  constructor(memoryStore: MemoryStore, openaiService: OpenAIService) {
    this.memoryStore = memoryStore;
    this.openaiService = openaiService;
  }

  async enrichQuery(
    conversationId: string,
    currentQuery: string,
  ): Promise<EnrichedQuery> {
    const conversation = await this.memoryStore.getConversation(conversationId);

    if (!conversation || conversation.turns.length === 0) {
      // No context available
      return {
        originalQuery: currentQuery,
        enrichedQuery: currentQuery,
        contextSummary: "",
        relevantTurns: [],
      };
    }

    // Search memory for relevant context
    const relevantTurns = await this.memoryStore.searchMemory(
      conversationId,
      currentQuery,
      3,
    );

    // Check if this is a follow-up
    const isFollowUp = this.isFollowUp(currentQuery);

    let enrichedQuery = currentQuery;
    let contextSummary = "";

    if (isFollowUp && relevantTurns.length > 0) {
      // This is a follow-up (e.g., "Explain that more", "What about...")
      // Use previous context to add specificity

      const lastTurn = conversation.turns[conversation.turns.length - 1];
      const contextualInfo = `
        Previous discussion: "${lastTurn.userQuery}"
        User previously learned: "${lastTurn.systemResponse.substring(0, 200)}..."`;

      enrichedQuery = `${currentQuery}\n${contextualInfo}`;
      contextSummary = `Follow-up to: "${lastTurn.userQuery}"`;
    } else if (relevantTurns.length > 0) {
      // Standalone question, but provide context for better search

      const context = relevantTurns
        .map((t) => `Previous: "${t.userQuery}"`)
        .join("; ");

      enrichedQuery = `${currentQuery}\nContext: ${context}`;
      contextSummary = `Related to previous discussions about: ${relevantTurns
        .map((t) => t.userQuery)
        .join(", ")}`;
    }

    return {
      originalQuery: currentQuery,
      enrichedQuery,
      contextSummary,
      relevantTurns,
    };
  }

  private isFollowUp(query: string): boolean {
    const followUpPatterns = [
      /^(explain|clarify|elaborate|expand|more)/i,
      /^(what about|how about|tell me more)/i,
      /^(any other|other|more|else)/i,
      /^(compare|contrast|difference)/i,
      /^(examples?|use cases?|applications?)/i,
    ];

    return followUpPatterns.some((pattern) => pattern.test(query));
  }
}
```

### Layer 3: Iterative Retrieval Refinement

**Purpose:** Improve retrieval via multi-pass queries and analysis

**Implementation Approach:**

```typescript
// services/memory/iterative-retrieval.ts

export interface RetrievalPass {
  passNumber: number;
  query: string;
  results: RetrievalResult[];
  completeness: number; // 0.0-1.0
  needsRefinement: boolean;
}

export interface IterativeRetrievalResult {
  passes: RetrievalPass[];
  finalResults: RetrievalResult[];
  totalPasses: number;
  completenessScore: number;
}

export class IterativeRetrieval {
  private dispatcher: ToolDispatcher;
  private openaiService: OpenAIService;
  private logger: Logger;

  constructor(
    dispatcher: ToolDispatcher,
    openaiService: OpenAIService,
    logger: Logger,
  ) {
    this.dispatcher = dispatcher;
    this.openaiService = openaiService;
    this.logger = logger;
  }

  async refineRetrieval(
    query: string,
    maxPasses: number = 3,
  ): Promise<IterativeRetrievalResult> {
    const passes: RetrievalPass[] = [];
    const allResults: Set<string> = new Set(); // Deduplicate by ID
    let currentQuery = query;

    for (let passNum = 0; passNum < maxPasses; passNum++) {
      this.logger.info(
        `Retrieval pass ${passNum + 1}/${maxPasses}: "${currentQuery}"`,
      );

      // Execute retrieval
      const result = await this.dispatcher.dispatch({
        toolId: "retrieval-v1",
        input: { query: currentQuery, topK: 5 },
      });

      const documents =
        result.status === "success" ? result.output.data.results || [] : [];

      // Track unique documents
      documents.forEach((doc) => allResults.add(doc.id));

      // Assess completeness
      const completeness = this.assessCompleteness(documents, query);

      // Determine if refinement needed
      const needsRefinement =
        completeness < 0.7 && passNum < maxPasses - 1 && documents.length > 0;

      passes.push({
        passNumber: passNum + 1,
        query: currentQuery,
        results: documents,
        completeness,
        needsRefinement,
      });

      if (!needsRefinement) {
        break;
      }

      // Refine query for next pass
      currentQuery = await this.generateRefinedQuery(query, documents, passes);
    }

    // Deduplicate and rank final results
    const finalResults = this.mergePasses(passes);

    return {
      passes,
      finalResults,
      totalPasses: passes.length,
      completenessScore: passes[passes.length - 1]?.completeness || 0,
    };
  }

  private assessCompleteness(documents: any[], query: string): number {
    // Simple heuristic: more relevant docs = more complete
    // In production: use LLM to check if all aspects of query are covered

    if (documents.length === 0) return 0;
    if (documents.length < 2) return 0.3;
    if (documents.length < 5) return 0.6;
    return 0.9;
  }

  private async generateRefinedQuery(
    originalQuery: string,
    previousResults: any[],
    previousPasses: RetrievalPass[],
  ): Promise<string> {
    const passHistory = previousPasses
      .map(
        (p) => `Pass ${p.passNumber}: "${p.query}" (${p.results.length} docs)`,
      )
      .join("\n");

    const prompt = `For a retrieval system, improve this query based on previous results:

Original query: "${originalQuery}"

${passHistory}

The most recent retrieval returned ${previousResults.length} documents covering: [topics]

Generate ONE refined query to get different/complementary documents.
The refined query should:
1. Target aspects not yet well-covered
2. Use different terminology/approach
3. Broaden or narrow scope as appropriate

Respond with ONLY the refined query (one line).`;

    const response = await this.openaiService.createCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      maxTokens: 100,
    });

    return response.choices[0].message.content?.trim() || originalQuery;
  }

  private mergePasses(passes: RetrievalPass[]): RetrievalResult[] {
    const merged = new Map<string, RetrievalResult>();

    // Combine all results, keeping highest score version
    for (const pass of passes) {
      for (const doc of pass.results) {
        if (!merged.has(doc.id) || doc.score > merged.get(doc.id)!.score) {
          merged.set(doc.id, doc);
        }
      }
    }

    // Sort by score
    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
  }
}
```

### Layer 4: Multi-Turn Query Handler

**Purpose:** Intelligently route follow-up questions vs new questions

**Implementation Approach:**

```typescript
// services/memory/multi-turn-handler.ts

export enum QueryMode {
  FOLLOW_UP = 'follow_up',
  CLARIFICATION = 'clarification',
  NEW_TOPIC = 'new_topic',
  EXPANSION = 'expansion'
}

export interface MultiTurnAnalysis {
  mode: QueryMode;
  isFollowUp: boolean;
  relevantPreviousTurns: ConversationTurn[];
  suggestedApproach: string;
}

export class MultiTurnHandler {
  private memoryStore: MemoryStore;
  private openaiService: OpenAIService;
  private contextInjector: ContextInjector;

  constructor(
    memoryStore: MemoryStore,
    openaiService: OpenAIService,
    contextInjector: ContextInjector
  ) {
    this.memoryStore = memoryStore;
    this.openaiService = openaiService;
    this.contextInjector = contextInjector;
  }

  async analyzeMultiTurnQuery(
    conversationId: string,
    currentQuery: string
  ): Promise<MultiTurnAnalysis> {
    const conversation = await this.memoryStore.getConversation(conversationId);

    if (!conversation || conversation.turns.length === 0) {
      // First turn
      return {
        mode: QueryMode.NEW_TOPIC,
        isFollowUp: false,
        relevantPreviousTurns: [],
        suggestedApproach: 'Full retrieval with query rewriting'
      };
    }

    // Analyze relationship to previous turns
    const lastTurn = conversation.turns[conversation.turns.length - 1];
    const relevantTurns = await this.memoryStore.searchMemory(
      conversationId,
      currentQuery,
      3
    );

    // Determine mode
    const mode = this.determineMode(currentQuery, lastTurn);

    // Suggest approach based on mode
    const approach = this.suggestApproach(mode, relevantTurns);

    return {
      mode,
      isFollowUp: mode !== QueryMode.NEW_TOPIC,
      relevantPreviousTurns: relevantTurns,
      suggestedApproach: approach
    };
  }

  private determineMode(
    currentQuery: string,
    lastTurn: ConversationTurn
  ): QueryMode {
    // Follow-up keywords
    if (/^(explain|clarify|elaborate|expand)/i.test(currentQuery)) {
      return QueryMode.EXPANSION;
    }

    // Clarification keywords
    if (/^(what do you mean|could you|i don't|unclear)/i.test(currentQuery)) {
      return QueryMode.CLARIFICATION;
    }

    // Check semantic similarity to last turn
    // If very similar: clarification
    // If somewhat related: expansion
    // If different: new topic

    return QueryMode.NEW_TOPIC; // Simplified
  }

  private suggestApproach(
    mode: QueryMode,
    relevantTurns: ConversationTurn[]
  ): string {
    switch (mode) {
      case QueryMode.FOLLOW_UP:
        return `Use context from previous turn + targeted retrieval (top_k=3)`;

      case QueryMode.CLARIFICATION:
        return `Use previous documents; focus on specific aspects`;

      case QueryMode.EXPANSION:
        return `Multi-pass iterative retrieval to get complementary docs`;

      case QueryMode.NEW_TOPIC:
        return `Full query processing: rewrite, decompose, retrieve`;

      default:
        return 'Standard retrieval';
    }
  }

  async handleMultiTurnQuery(
    conversationId: string,
    currentQuery: string,
    analysis: MultiTurnAnalysis
  ): Promise<{ query: string; documents: any[] }> {
    switch (analysis.mode) {
      case QueryMode.FOLLOW_UP:
        // Use last turn's documents + new search
        const conversation = await this.memoryStore.getConversation(conversationId);
        const lastTurn = conversation!.turns[conversation!.turns.length - 1];

        const newResults = await this.dispatcher.dispatch({
          toolId: 'retrieval-v1',
          input: { query: currentQuery, topK: 3 }
        });

        return {
          query: currentQuery,
          documents: [
            ...lastTurn.retrievedDocuments.slice(0, 2),
            ...newResults.output.data.results
          ]
        };

      case QueryMode.EXPANSION:
        // Iterative retrieval
        const iterative = new IterativeRetrieval(...);
        const refinedResult = await iterative.refineRetrieval(currentQuery, 2);

        return {
          query: currentQuery,
          documents: refinedResult.finalResults
        };

      default:
        // Full processing
        return {
          query: currentQuery,
          documents: [] // Standard retrieval
        };
    }
  }
}
```

### Layer 5: New Endpoint — Conversation Management

**New Endpoint: `/api/conversation/`**

```typescript
// endpoints/api/conversation.ts

// POST /api/conversation/start
// Start new conversation
router.post("/start", async (req: Request, res: Response) => {
  const userId = req.firebase_jwt_token.uid;

  try {
    const conversation = await memoryStore.createConversation(userId);
    res.json({ conversationId: conversation.conversationId });
  } catch (error) {
    res.status(500).json({ error: "Failed to start conversation" });
  }
});

// POST /api/conversation/{id}/ask
// Ask a question in existing conversation
router.post("/:conversationId/ask", async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { question } = req.body;

  try {
    // Step 1: Analyze multi-turn nature
    const analysis = await multiTurnHandler.analyzeMultiTurnQuery(
      conversationId,
      question,
    );

    // Step 2: Enrich query with context
    const enriched = await contextInjector.enrichQuery(
      conversationId,
      question,
    );

    // Step 3: Handle based on mode
    let documents = [];
    const queryToUse =
      analysis.mode === QueryMode.NEW_TOPIC ? enriched.enrichedQuery : question;

    if (analysis.mode === QueryMode.EXPANSION) {
      const iterativeResult = await iterativeRetrieval.refineRetrieval(
        queryToUse,
        2,
      );
      documents = iterativeResult.finalResults;
    } else {
      const result = await toolDispatcher.dispatch({
        toolId: "retrieval-v1",
        input: { query: queryToUse, topK: 5 },
      });
      documents = result.output.data.results;
    }

    // Step 4: Generate answer
    const answer = await generateAnswer(question, documents);

    // Step 5: Add to memory
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      timestamp: Date.now(),
      userQuery: question,
      rewrittenQuery: enriched.enrichedQuery,
      systemResponse: answer,
      retrievedDocuments: documents,
      confidence: 0.85,
      metadata: {
        processingTimeMs: Date.now() - startTime,
      },
    };

    await memoryStore.addTurn(conversationId, turn);

    res.json({
      conversationId,
      question,
      answer,
      sources: documents,
      metadata: {
        turnNumber: (await getConversation(conversationId)).turns.length,
        contextSummary: enriched.contextSummary,
        multiTurnMode: analysis.mode,
      },
    });
  } catch (error) {
    logger.error("Conversation ask failed", error);
    res.status(500).json({ error: "Failed to process question" });
  }
});

// GET /api/conversation/{id}
// Get full conversation history
router.get("/:conversationId", async (req: Request, res: Response) => {
  const conversation = await memoryStore.getConversation(
    req.params.conversationId,
  );

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  res.json(conversation);
});

// GET /api/conversation/{id}/summary
// Get conversation summary
router.get("/:conversationId/summary", async (req: Request, res: Response) => {
  const conversation = await memoryStore.getConversation(
    req.params.conversationId,
  );

  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Generate summary of all turns
  const summary = conversation.turns.map((t) => `Q: ${t.userQuery}`).join("\n");

  res.json({
    conversationId: req.params.conversationId,
    turnCount: conversation.turns.length,
    summary,
    topics: extractTopics(conversation.turns),
  });
});
```

---

## Integration: Enhanced RAG with Conversation Memory

Update `/api/rag/ask` to support optional conversation context:

```typescript
router.post('/ask', async (req: Request, res: Response) => {
  const { question, conversationId } = req.body;

  let enrichedQuestion = question;
  let contextMetadata = {};

  // If conversation ID provided, enrich with context
  if (conversationId) {
    const enriched = await contextInjector.enrichQuery(
      conversationId,
      question
    );
    enrichedQuestion = enriched.enrichedQuery;
    contextMetadata = {
      contextSummary: enriched.contextSummary,
      relevantPreviousTurns: enriched.relevantTurns.length
    };
  }

  // ... rest of RAG pipeline ...

  // Optionally save turn if conversation ID provided
  if (conversationId) {
    const conversationTurn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      ...
    };
    await memoryStore.addTurn(conversationId, conversationTurn);
  }

  res.json({
    ...ragResponse,
    conversationContext: contextMetadata
  });
});
```

---

## Testing & Validation

### Unit Tests

```typescript
// Test memory store CRUD
// Test context injection enrichment
// Test iterative retrieval refinement decisions
// Test multi-turn query classification
// Test memory cleanup
```

### Integration Tests

```typescript
// Multi-turn conversation flow
// Memory retrieval accuracy
// Iterative refinement effectiveness
// Context injection improving answer quality
```

---

## Deliverables Checklist

- [ ] MemoryStore for persistent conversation storage
- [ ] ContextInjector for query enrichment
- [ ] IterativeRetrieval for multi-pass refinement
- [ ] MultiTurnHandler for follow-up question routing
- [ ] `/api/conversation/start` endpoint
- [ ] `/api/conversation/{id}/ask` endpoint
- [ ] `/api/conversation/{id}` endpoint
- [ ] `/api/conversation/{id}/summary` endpoint
- [ ] Type definitions in `types/memory.ts`
- [ ] Integration with existing RAG endpoint
- [ ] Memory cleanup/garbage collection
- [ ] Comprehensive logging
- [ ] Test suite for all scenarios
- [ ] Performance optimization (cache, indexing)
