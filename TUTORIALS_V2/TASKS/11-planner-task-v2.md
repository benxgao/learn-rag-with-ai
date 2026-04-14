---
notes: V2 Task - Build rule-based planner that decides which tools to use and in what order
prerequisites: V1 Tasks 01-08 completed, V2 Task 01-02 (query understanding & tools)
---

# V2 Tutorial 03 — Decision-Making Planner (Rule-Based)

## What You'll Learn

In this tutorial, you'll discover:

- **Planning fundamentals** — Deciding WHEN to use tools vs resources
- **Query classification at scale** — Categorizing diverse query types
- **Rule-based planning logic** — IF-THEN decision trees
- **Plan execution** — Sequential tool orchestration
- **Confidence scoring** — Measuring intermediate results
- **Plan debugging** — Understanding why decisions were made
- **Fallback strategies** — What to do when plan fails
- **Production patterns** — Cost and latency optimization

---

## The Core Problem: Need a Decision Layer

### Without a Planner

```
Every query uses the same fixed pipeline
Query → Retrieve → Generate

Problems:
- Calculator adds overhead for math questions
- Retrieval adds latency/cost for calculation queries
- Web search never used (always local retrieval)
- System can't adapt to query type
```

### With a Planner

```
Query → Classify → Route to appropriate tools → Generate

Benefits:
- Math questions use calculator (fast, accurate)
- Factual questions use retrieval (grounded)
- Real-time questions use web search (current)
- Multi-part questions use multiple tools (comprehensive)
```

---

## The Solution: Rule-Based Planning Layer

### Architecture Overview

```
Raw Query
   ↓
[0. Preprocess] → Clean, standardize query
   ↓
[1. Classify] → Map to QueryType
   ↓
[2. Assess] → Gather metadata (length, entities, intent)
   ↓
[3. Plan] → Apply rule base to generate execution plan
   ↓
Execution Plan
(ordered list of tool calls with parameters)
   ↓
[4. Execute] → Run plan step-by-step
   ↓
[5. Monitor] → Track confidence, success
   ↓
Results + Metadata
```

---

## Implementation Guide

### Layer 1: Query Preprocessor

**Purpose:** Standardize and clean queries before classification

**Implementation Approach:**

```typescript
// services/planning/preprocessor.ts

export interface PreprocessedQuery {
  original: string;
  cleaned: string;
  length: number;
  wordCount: number;
  hasNumbers: boolean;
  hasListRequests: boolean; // "list", "enumerate", etc.
  isFollowUp: boolean;
  conversationContext?: string;
}

export async function preprocessQuery(
  query: string,
  conversationContext?: string,
): Promise<PreprocessedQuery> {
  // Remove extra whitespace
  const cleaned = query.trim().replace(/\s+/g, " ");

  // Detect patterns
  const hasNumbers = /\d+/.test(cleaned);
  const hasListRequests = /list|enumerate|show|give me|examples?/i.test(
    cleaned,
  );
  const isFollowUp =
    /^(what|explain|tell me|more|also|furthermore|additionally)/i.test(cleaned);

  return {
    original: query,
    cleaned,
    length: cleaned.length,
    wordCount: cleaned.split(/\s+/).length,
    hasNumbers,
    hasListRequests,
    isFollowUp,
    conversationContext,
  };
}
```

### Layer 2: Query Classifier (Expanded)

**Purpose:** Map query to detailed classification with confidence

**Implementation Approach:**

```typescript
// services/planning/classifier.ts

export enum QueryType {
  CALCULATION = "calculation", // Math: 2+2, 5 factorial
  VERIFICATION = "verification", // Is X true?
  FACTUAL_SIMPLE = "factual_simple", // What is X?
  FACTUAL_COMPARISON = "factual_comparison", // Compare X vs Y
  FACTUAL_MULTI = "factual_multi", // What, describe, explain
  PROCEDURAL = "procedural", // How to...
  LIST_REQUEST = "list_request", // List, enumerate
  CURRENT_INFO = "current_info", // Real-time (weather, news)
  AMBIGUOUS = "ambiguous", // Unclear intent
}

export interface QueryClassification {
  type: QueryType;
  confidence: number;
  reasoning: string;
  suggestedTools: string[]; // Tool IDs to use
  metadata: {
    isComplex: boolean;
    requiresMultipleTools: boolean;
    estimatedComplexity: number; // 0.0-1.0
  };
}

export class QueryClassifier {
  private openaiService: OpenAIService;

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
  }

  async classify(processed: PreprocessedQuery): Promise<QueryClassification> {
    // Try rule-based classification first (fast path)
    const ruleResult = this.classifyByRules(processed);
    if (ruleResult && ruleResult.confidence > 0.8) {
      return ruleResult;
    }

    // Fall back to LLM classification
    return this.classifyByLLM(processed);
  }

  private classifyByRules(
    processed: PreprocessedQuery,
  ): QueryClassification | null {
    const { cleaned, hasNumbers } = processed;

    // Rule 1: Mathematical expressions
    if (this.isMathExpression(cleaned)) {
      return {
        type: QueryType.CALCULATION,
        confidence: 0.95,
        reasoning: "Contains mathematical operators or functions",
        suggestedTools: ["calculator-v1"],
        metadata: {
          isComplex: false,
          requiresMultipleTools: false,
          estimatedComplexity: 0.2,
        },
      };
    }

    // Rule 2: Verification questions
    if (
      /is\s|are\s|does\s|do\s|did\s|will\s|can\s/i.test(cleaned) &&
      cleaned.endsWith("?")
    ) {
      return {
        type: QueryType.VERIFICATION,
        confidence: 0.85,
        reasoning: "Question about truth/falsehood of a claim",
        suggestedTools: ["retrieval-v1"],
        metadata: {
          isComplex: false,
          requiresMultipleTools: false,
          estimatedComplexity: 0.3,
        },
      };
    }

    // Rule 3: List requests
    if (
      /^(list|enumerate|show|give me|what are)(.*(examples|types|kinds))?/i.test(
        cleaned,
      )
    ) {
      return {
        type: QueryType.LIST_REQUEST,
        confidence: 0.9,
        reasoning: "Explicit request for enumerated items",
        suggestedTools: ["retrieval-v1"],
        metadata: {
          isComplex: false,
          requiresMultipleTools: false,
          estimatedComplexity: 0.4,
        },
      };
    }

    // Rule 4: Comparison queries
    if (/\bvs\b|versus|compare|difference|similar|comparison/i.test(cleaned)) {
      return {
        type: QueryType.FACTUAL_COMPARISON,
        confidence: 0.9,
        reasoning: "Comparison or contrast between concepts/items",
        suggestedTools: ["retrieval-v1"],
        metadata: {
          isComplex: true,
          requiresMultipleTools: true,
          estimatedComplexity: 0.6,
        },
      };
    }

    // Rule 5: Procedural/how-to
    if (/how\s(do|to|can)|steps?\s(to|for)|process\s(for|of)/i.test(cleaned)) {
      return {
        type: QueryType.PROCEDURAL,
        confidence: 0.9,
        reasoning: "Instructions or step-by-step procedure requested",
        suggestedTools: ["retrieval-v1"],
        metadata: {
          isComplex: true,
          requiresMultipleTools: false,
          estimatedComplexity: 0.5,
        },
      };
    }

    // Rule 6: Current information (weather, news, etc.)
    const currentKeywords = [
      "today",
      "now",
      "current",
      "latest",
      "weather",
      "news",
      "stock",
    ];
    if (currentKeywords.some((kw) => new RegExp(kw, "i").test(cleaned))) {
      return {
        type: QueryType.CURRENT_INFO,
        confidence: 0.85,
        reasoning: "Query asks for real-time or current information",
        suggestedTools: ["web-search-v1", "retrieval-v1"],
        metadata: {
          isComplex: false,
          requiresMultipleTools: true,
          estimatedComplexity: 0.4,
        },
      };
    }

    return null; // Uncertain, use LLM
  }

  private isMathExpression(query: string): boolean {
    // Check for math operators and functions
    const mathPatterns = [
      /\d\s*[\+\-\*\/\^]\s*\d/, // 2+2, 5*3
      /sqrt|factorial|sin|cos|tan|log|exp|pow/i, // Math functions
      /\d+\!/, // Factorial: 5!
    ];
    return mathPatterns.some((p) => p.test(query));
  }

  private async classifyByLLM(
    processed: PreprocessedQuery,
  ): Promise<QueryClassification> {
    const prompt = `Classify this query strictly into ONE category:

Categories:
- CALCULATION: Pure math (2+2, sqrt(16), 5!)
- VERIFICATION: Yes/no truth claims
- FACTUAL_SIMPLE: "What is X?"
- FACTUAL_COMPARISON: "Compare X vs Y"
- FACTUAL_MULTI: "Describe/Explain/Analyze X"
- PROCEDURAL: "How to X"
- LIST_REQUEST: "List/enumerate/examples"
- CURRENT_INFO: Real-time (weather, news, stocks)
- AMBIGUOUS: Unclear

Query: "${processed.cleaned}"

Respond with ONLY:
[CATEGORY] [confidence_0.0_to_1.0] [reasoning]`;

    const response = await this.openaiService.createCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 100,
    });

    const content = response.choices[0].message.content!;
    const [typeStr, confStr, ...reasoningParts] = content.trim().split(/\s+/);

    const type = (typeStr as QueryType) || QueryType.AMBIGUOUS;
    const confidence = parseFloat(confStr) || 0.5;
    const reasoning = reasoningParts.join(" ");

    return {
      type,
      confidence,
      reasoning,
      suggestedTools: this.getDefaultToolsForType(type),
      metadata: {
        isComplex: this.isComplexType(type),
        requiresMultipleTools: this.requiresMultipleTools(type),
        estimatedComplexity: confidence,
      },
    };
  }

  private getDefaultToolsForType(type: QueryType): string[] {
    const toolMap: { [key in QueryType]: string[] } = {
      [QueryType.CALCULATION]: ["calculator-v1"],
      [QueryType.VERIFICATION]: ["retrieval-v1"],
      [QueryType.FACTUAL_SIMPLE]: ["retrieval-v1"],
      [QueryType.FACTUAL_COMPARISON]: ["retrieval-v1"],
      [QueryType.FACTUAL_MULTI]: ["retrieval-v1"],
      [QueryType.PROCEDURAL]: ["retrieval-v1"],
      [QueryType.LIST_REQUEST]: ["retrieval-v1"],
      [QueryType.CURRENT_INFO]: ["web-search-v1", "retrieval-v1"],
      [QueryType.AMBIGUOUS]: ["retrieval-v1"],
    };
    return toolMap[type] || ["retrieval-v1"];
  }

  private isComplexType(type: QueryType): boolean {
    return [
      QueryType.FACTUAL_COMPARISON,
      QueryType.PROCEDURAL,
      QueryType.FACTUAL_MULTI,
    ].includes(type);
  }

  private requiresMultipleTools(type: QueryType): boolean {
    return [
      QueryType.FACTUAL_COMPARISON,
      QueryType.CURRENT_INFO,
      QueryType.FACTUAL_MULTI,
    ].includes(type);
  }
}
```

### Layer 3: Rule-Based Planner

**Purpose:** Generate execution plan based on query classification

**Implementation Approach:**

```typescript
// services/planning/planner.ts

export interface ToolStep {
  stepId: string;
  toolId: string;
  input: Record<string, any>;
  retries: number;
  timeout: number;
  description: string;
  dependsOn?: string[]; // Other step IDs
}

export interface ExecutionPlan {
  queryId: string;
  originalQuery: string;
  classification: QueryClassification;
  steps: ToolStep[];
  expectedDuration: number; // milliseconds
  expectedCost: number; // USD
  synthesisStrategy: string; // How to combine results
  metadata: {
    planId: string;
    createdAt: number;
    version: number;
  };
}

export class RuleBasedPlanner {
  private classifier: QueryClassifier;

  constructor(classifier: QueryClassifier) {
    this.classifier = classifier;
  }

  async generatePlan(processed: PreprocessedQuery): Promise<ExecutionPlan> {
    // Step 1: Classify query
    const classification = await this.classifier.classify(processed);

    // Step 2: Generate steps based on type
    const steps = this.generateSteps(classification, processed);

    // Step 3: Calculate metadata
    const expectedDuration = this.calculateDuration(steps);
    const expectedCost = this.calculateCost(steps);

    return {
      queryId: `query-${Date.now()}`,
      originalQuery: processed.original,
      classification,
      steps,
      expectedDuration,
      expectedCost,
      synthesisStrategy: this.getSynthesisStrategy(
        classification.type,
        steps.length,
      ),
      metadata: {
        planId: `plan-${Date.now()}`,
        createdAt: Date.now(),
        version: 1,
      },
    };
  }

  private generateSteps(
    classification: QueryClassification,
    processed: PreprocessedQuery,
  ): ToolStep[] {
    const steps: ToolStep[] = [];
    let stepNum = 0;

    switch (classification.type) {
      case QueryType.CALCULATION:
        steps.push({
          stepId: `step-${stepNum++}`,
          toolId: "calculator-v1",
          input: { expression: processed.cleaned },
          retries: 2,
          timeout: 5000,
          description: "Solve mathematical expression",
        });
        break;

      case QueryType.FACTUAL_COMPARISON:
        // Multi-step: retrieve for both sides
        const entities = this.extractComparableEntities(processed.cleaned);
        for (const entity of entities) {
          steps.push({
            stepId: `step-${stepNum++}`,
            toolId: "retrieval-v1",
            input: { query: entity, topK: 5 },
            retries: 2,
            timeout: 8000,
            description: `Retrieve information about "${entity}"`,
          });
        }
        break;

      case QueryType.PROCEDURAL:
        steps.push({
          stepId: `step-${stepNum++}`,
          toolId: "retrieval-v1",
          input: {
            query: processed.cleaned,
            topK: 7,
          },
          retries: 2,
          timeout: 8000,
          description: "Retrieve procedural steps",
        });
        break;

      case QueryType.CURRENT_INFO:
        // Try web search first, fall back to retrieval
        steps.push({
          stepId: `step-${stepNum++}`,
          toolId: "web-search-v1",
          input: { query: processed.cleaned, resultCount: 5 },
          retries: 1,
          timeout: 10000,
          description: "Search web for current information",
        });
        steps.push({
          stepId: `step-${stepNum++}`,
          toolId: "retrieval-v1",
          input: { query: processed.cleaned, topK: 3 },
          retries: 0,
          timeout: 5000,
          description: "Retrieve from knowledge base as fallback",
          dependsOn: [], // Could run in parallel
        });
        break;

      case QueryType.LIST_REQUEST:
        steps.push({
          stepId: `step-${stepNum++}`,
          toolId: "retrieval-v1",
          input: {
            query: processed.cleaned,
            topK: 10,
          },
          retries: 1,
          timeout: 8000,
          description: "Retrieve list items",
        });
        break;

      default: // FACTUAL_SIMPLE, VERIFICATION, AMBIGUOUS
        steps.push({
          stepId: `step-${stepNum++}`,
          toolId: "retrieval-v1",
          input: {
            query: processed.cleaned,
            topK: 5,
          },
          retries: 2,
          timeout: 8000,
          description: "Standard retrieval",
        });
    }

    return steps;
  }

  private extractComparableEntities(query: string): string[] {
    // Simple extraction: split by "vs" or "vs."
    const vs = query.match(/(.+?)\s+(vs|versus|compare with)\s+(.+)/i);
    if (vs) {
      return [vs[1].trim(), vs[3].trim()];
    }

    // Fallback: use whole query
    return [query];
  }

  private calculateDuration(steps: ToolStep[]): number {
    // Sum of all step timeouts (simplified)
    return steps.reduce((sum, s) => sum + s.timeout, 0);
  }

  private calculateCost(steps: ToolStep[]): number {
    // Estimate based on tool costs (placeholder)
    let cost = 0;
    for (const step of steps) {
      if (step.toolId === "retrieval-v1") {
        cost += 0.001 * (step.input.topK || 5);
      } else if (step.toolId === "web-search-v1") {
        cost += 0.002 * (step.input.resultCount || 3);
      }
      // calculator-v1 is free
    }
    return cost;
  }

  private getSynthesisStrategy(type: QueryType, stepCount: number): string {
    switch (type) {
      case QueryType.FACTUAL_COMPARISON:
        return "Combine retrieval results from all queries; present side-by-side";
      case QueryType.CURRENT_INFO:
        return "Prioritize web search results; supplement with retrieval if needed";
      case QueryType.LIST_REQUEST:
        return "Deduplicate; sort by relevance; present as enumerated list";
      case QueryType.PROCEDURAL:
        return "Extract step-by-step instructions; maintain sequence order";
      default:
        return "Synthesize results into coherent answer";
    }
  }
}
```

### Layer 4: Plan Executor

**Purpose:** Execute generated plan step-by-step with monitoring

**Implementation Approach:**

```typescript
// services/planning/executor.ts

export interface ExecutionState {
  planId: string;
  currentStepId: string;
  completedSteps: Map<string, ToolExecutionResult>;
  failedSteps: Array<{
    stepId: string;
    error: string;
    attempt: number;
  }>;
  confidenceScore: number;
  startTime: number;
}

export class PlanExecutor {
  private dispatcher: ToolDispatcher;
  private logger: Logger;

  constructor(dispatcher: ToolDispatcher, logger: Logger) {
    this.dispatcher = dispatcher;
    this.logger = logger;
  }

  async executePlan(plan: ExecutionPlan): Promise<{
    results: Map<string, ToolExecutionResult>;
    confidence: number;
    totalDuration: number;
    errors: Array<{ step: string; error: string }>;
  }> {
    const startTime = Date.now();
    const state: ExecutionState = {
      planId: plan.metadata.planId,
      currentStepId: "",
      completedSteps: new Map(),
      failedSteps: [],
      confidenceScore: 1.0,
      startTime,
    };

    for (const step of plan.steps) {
      state.currentStepId = step.stepId;

      // Execute step with retries
      let result: ToolExecutionResult | null = null;

      for (let attempt = 0; attempt <= step.retries; attempt++) {
        this.logger.info(
          `Executing step ${step.stepId} (attempt ${attempt + 1}/${step.retries + 1})`,
        );

        result = await this.dispatcher.dispatch({
          toolId: step.toolId,
          input: step.input,
          timeout: step.timeout,
        });

        if (result.status === "success") {
          break;
        }

        if (attempt < step.retries) {
          this.logger.warn(
            `Step ${step.stepId} failed, retrying (${attempt + 1}/${step.retries})`,
          );
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 500 * Math.pow(2, attempt)),
          );
        }
      }

      if (result) {
        state.completedSteps.set(step.stepId, result);

        if (result.status !== "success") {
          state.failedSteps.push({
            stepId: step.stepId,
            error: result.error || "Unknown error",
            attempt: step.retries + 1,
          });

          // Adjust confidence
          state.confidenceScore *= 0.8; // Penalty for failed step
        }
      } else {
        state.failedSteps.push({
          stepId: step.stepId,
          error: "No result returned",
          attempt: step.retries + 1,
        });
        state.confidenceScore *= 0.7;
      }
    }

    const totalDuration = Date.now() - startTime;

    this.logger.info(
      `Plan execution completed: ${plan.metadata.planId}, ` +
        `confidence: ${state.confidenceScore.toFixed(2)}, ` +
        `duration: ${totalDuration}ms`,
    );

    return {
      results: state.completedSteps,
      confidence: Math.max(0, state.confidenceScore),
      totalDuration,
      errors: state.failedSteps.map((f) => ({
        step: f.stepId,
        error: f.error,
      })),
    };
  }
}
```

### Layer 5: New Endpoint — Planning & Execution

**New Endpoint: `/api/planning/`**

```typescript
// endpoints/api/planning.ts

export interface PlanningRequest {
  question: string;
  conversationContext?: string;
  returnPlanOnly?: boolean; // true: return plan without executing
}

export interface PlanningResponse {
  queryId: string;
  plan: ExecutionPlan;
  execution?: {
    results: Array<{
      stepId: string;
      toolId: string;
      status: string;
      data: any;
    }>;
    confidence: number;
    totalDuration: number;
  };
}

router.post("/plan", async (req: Request, res: Response) => {
  const { question, conversationContext, returnPlanOnly } = req.body;

  try {
    // Preprocess
    const processed = await preprocessQuery(question, conversationContext);

    // Generate plan
    const plan = await planner.generatePlan(processed);

    if (returnPlanOnly) {
      return res.json({ plan });
    }

    // Execute plan
    const executionResult = await planExecutor.executePlan(plan);

    res.json({
      queryId: plan.queryId,
      plan,
      execution: {
        results: Array.from(executionResult.results.values()).map((r) => ({
          stepId: r.toolId,
          toolId: r.toolId,
          status: r.status,
          data: r.output.data,
        })),
        confidence: executionResult.confidence,
        totalDuration: executionResult.totalDuration,
      },
    });
  } catch (error) {
    logger.error("Planning failed", error);
    res.status(500).json({ error: "Planning failed" });
  }
});

// GET /api/planning/stats
// Get planner statistics
router.get("/stats", (req: Request, res: Response) => {
  // Return statistics about plan success rates, average durations, etc.
  res.json({ message: "Planning stats" });
});
```

---

## Decision Tree Visualization

```
┌─ Query
│
├─ Is it a math expression?
│  └─ YES → Use CALCULATOR
│
├─ Ends with "?", ~is/are/does~ prefix?
│  └─ YES → VERIFICATION → Use RETRIEVAL
│
├─ Contains "vs"/"compare"?
│  └─ YES → COMPARISON → Use MULTI-RETRIEVAL
│
├─ Starts with "how to"?
│  └─ YES → PROCEDURAL → Use RETRIEVAL (topK=7)
│
├─ Contains "list"/"enumerate"/examples?
│  └─ YES → LIST_REQUEST → Use RETRIEVAL (topK=10)
│
├─ Contains "today"/"now"/"current"/weather/news?
│  └─ YES → CURRENT_INFO → Use WEB_SEARCH + RETRIEVAL
│
└─ Else
   └─ FACTUAL_SIMPLE → Use RETRIEVAL (topK=5)
```

---

## Testing & Validation

### Unit Tests

```typescript
// Test query preprocessing
// Test classification accuracy (rule-based vs LLM)
// Test plan generation for each query type
// Test executor retry logic
// Test confidence score calculations
```

### Integration Tests

```typescript
// End-to-end planning → execution flow
// Multi-step plan execution
// Fallback/retry scenarios
// Error handling
```

---

## Deliverables Checklist

- [ ] QueryPreprocessor for query normalization
- [ ] QueryClassifier with rule-based + LLM fallback
- [ ] RuleBasedPlanner generating execution plans
- [ ] PlanExecutor with retry/timeout handling
- [ ] `/api/planning/plan` endpoint
- [ ] `/api/planning/stats` endpoint
- [ ] Type definitions in `types/planning.ts`
- [ ] Integration with tool dispatcher
- [ ] Decision tree visualization/documentation
- [ ] Comprehensive logging and debugging
- [ ] Test suite for all components
- [ ] Performance benchmarks
