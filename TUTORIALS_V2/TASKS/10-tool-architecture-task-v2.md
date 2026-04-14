---
notes: V2 Task - Build tool abstraction layer making retrieval pluggable with other tools
prerequisites: V1 Tasks 01-08 completed, V2 Task 01 (query understanding) recommended
---

# V2 Tutorial 02 — Tool-Based Architecture & Abstraction

## What You'll Learn

In this tutorial, you'll discover:

- **Tool abstraction patterns** — Making tools pluggable and composable
- **Tool interface design** — What makes a good tool contract
- **Tool registry and discovery** — Dynamic tool management
- **Retrieval as a tool** — Refactoring existing RAG into tool interface
- **Adding new tools** — Implementing calculator and web search tools
- **Tool dispatcher** — Executing tools by name with error handling
- **Tool composition** — Combining multiple tools in sequences
- **Production patterns** — Tool versioning, monitoring, reliability

---

## The Core Problem: Retrieval is One Tool Among Many

### The Linear RAG Assumption

Current v1 system assumes a fixed pipeline:

```
Query → Retrieve → Generate Answer
         ↑
      (always)
```

**Problems:**

- Not all questions need retrieval (math: 2+2=4)
- Some questions need different tools (web search for real-time)
- System can't handle diverse query types efficiently
- Adding new capabilities requires changing core pipeline

### The Real-World Need

```
User: "How many countries are in the EU?"
Would benefit from: Web search tool
Current system: Wastes API calls retrieving local docs

User: "What is 5 factorial?"
Would benefit from: Calculator tool
Current system: Tries to retrieve docs, hallucination risk

User: "Compare these three papers"
Would benefit from: Multiple retrieval calls
Current system: Single retrieval, incomplete comparison
```

---

## The Solution: Tool-Based Architecture

### Architecture Overview

```
      Query
        ↓
   Tool Registry (available tools)
        ↓
   Tool Selector (which tool for this query?)
        ↓
   Tool Dispatcher
   /    |     \
[Retrieval] [Calculator] [WebSearch] [Other...]
   \    |     /
     Tool Results
        ↓
   Aggregator (combine results)
        ↓
     Answer
```

---

## Implementation Guide

### Layer 1: Tool Interface & Base Class

**Purpose:** Define the contract all tools must follow

**Implementation Approach:**

```typescript
// services/tools/base.ts

export interface ToolInput {
  [key: string]: string | number | boolean | object;
}

export interface ToolOutput {
  success: boolean;
  data: any;
  error?: string;
  metadata: {
    executionTimeMs: number;
    tokensUsed?: number;
    resultCount?: number;
  };
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: "retrieval" | "computation" | "search" | "knowledge" | "other";
  inputSchema: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "array" | "object";
      required: boolean;
      description: string;
    };
  };
  outputSchema: {
    type: "object";
    properties: {
      [key: string]: {
        type: string;
        description: string;
      };
    };
  };
  costEstimate?: {
    perCall: number; // USD
    currency: string;
  };
  latencyEstimate?: number; // milliseconds
  reliability: number; // 0.0-1.0
  enabled: boolean;
}

export abstract class BaseTool {
  protected definition: ToolDefinition;

  constructor(definition: ToolDefinition) {
    this.definition = definition;
  }

  // Get tool metadata
  getDefinition(): ToolDefinition {
    return this.definition;
  }

  // Validate tool input against schema
  validateInput(input: ToolInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const schema = this.definition.inputSchema;

    for (const [key, fieldDef] of Object.entries(schema)) {
      if (fieldDef.required && !(key in input)) {
        errors.push(`Missing required field: ${key}`);
      }
      if (key in input && typeof input[key] !== fieldDef.type) {
        errors.push(
          `Field ${key} has wrong type. Expected ${fieldDef.type}, got ${typeof input[key]}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Abstract method to implement
  abstract execute(input: ToolInput): Promise<ToolOutput>;

  // Standard error wrapper
  protected wrapError(error: unknown): ToolOutput {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      metadata: { executionTimeMs: 0 },
    };
  }

  // Standard success wrapper
  protected wrapSuccess(
    data: any,
    executionTimeMs: number,
    metadata?: Partial<ToolOutput["metadata"]>,
  ): ToolOutput {
    return {
      success: true,
      data,
      metadata: {
        executionTimeMs,
        ...metadata,
      },
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

### Layer 2: Retrieval Tool (Refactored)

**Purpose:** Wrap existing RAG retrieval as a tool

**Implementation Approach:**

```typescript
// services/tools/retrieval.ts

export class RetrievalTool extends BaseTool {
  private retrievalService: Retrieval Service;
  private embeddingService: EmbeddingService;

  constructor(
    retrievalService: RetrievalService,
    embeddingService: EmbeddingService
  ) {
    super({
      id: 'retrieval-v1',
      name: 'Vector Retrieval',
      description: 'Search knowledge base using semantic similarity',
      version: '1.0.0',
      category: 'retrieval',
      inputSchema: {
        query: {
          type: 'string',
          required: true,
          description: 'Search query'
        },
        topK: {
          type: 'number',
          required: false,
          description: 'Number of results to return (default: 5)'
        },
        scoreThreshold: {
          type: 'number',
          required: false,
          description: 'Minimum similarity score (default: 0.3)'
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            description: 'Retrieved documents with scores'
          },
          totalResults: {
            type: 'number',
            description: 'Total documents retrieved'
          },
          averageScore: {
            type: 'number',
            description: 'Average similarity score'
          }
        }
      },
      latencyEstimate: 1200,
      costEstimate: {
        perCall: 0.001,
        currency: 'USD'
      },
      reliability: 0.99,
      enabled: true
    });

    this.retrievalService = retrievalService;
    this.embeddingService = embeddingService;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: validation.errors.join('; '),
          metadata: { executionTimeMs: 0 }
        };
      }

      const query = input.query as string;
      const topK = (input.topK as number) || 5;
      const scoreThreshold = (input.scoreThreshold as number) || 0.3;

      // Execute retrieval
      const results = await this.retrievalService.search({
        query,
        topK,
        scoreThreshold
      });

      const executionTime = Date.now() - startTime;
      const averageScore = results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0;

      return this.wrapSuccess(
        {
          results: results.map(r => ({
            id: r.id,
            content: r.content,
            score: r.score,
            source: r.source
          })),
          totalResults: results.length,
          averageScore: averageScore
        },
        executionTime,
        { resultCount: results.length }
      );
    } catch (error) {
      return this.wrapError(error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple test query
      await this.execute({ query: 'test', topK: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
```

### Layer 3: Additional Tools (Calculator & Web Search)

**Calculator Tool:**

```typescript
// services/tools/calculator.ts

export class CalculatorTool extends BaseTool {
  constructor() {
    super({
      id: "calculator-v1",
      name: "Calculator",
      description: "Solve mathematical expressions and problems",
      version: "1.0.0",
      category: "computation",
      inputSchema: {
        expression: {
          type: "string",
          required: true,
          description:
            'Mathematical expression (e.g., "2+2", "sqrt(16)", "5!")',
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          result: { type: "number", description: "Calculation result" },
          expression: { type: "string", description: "Original expression" },
        },
      },
      latencyEstimate: 50,
      costEstimate: {
        perCall: 0.0,
        currency: "USD",
      },
      reliability: 1.0,
      enabled: true,
    });
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: validation.errors.join("; "),
          metadata: { executionTimeMs: 0 },
        };
      }

      const expression = input.expression as string;

      // Sanitize and validate expression
      if (!this.isValidExpression(expression)) {
        return {
          success: false,
          data: null,
          error: "Invalid expression: contains disallowed operations",
          metadata: { executionTimeMs: Date.now() - startTime },
        };
      }

      // Use a math library (e.g., mathjs)
      const result = eval(this.sanitizeExpression(expression));

      return this.wrapSuccess(
        {
          result,
          expression,
        },
        Date.now() - startTime,
      );
    } catch (error) {
      return this.wrapError(error);
    }
  }

  private isValidExpression(expr: string): boolean {
    // Whitelist allowed characters/functions
    const allowedPattern = /^[0-9+\-*/(). \w.sqrt]{1,100}$/;
    return allowedPattern.test(expr);
  }

  private sanitizeExpression(expr: string): string {
    // Replace function names
    return expr
      .replace(/sqrt/g, "Math.sqrt")
      .replace(/sin/g, "Math.sin")
      .replace(/cos/g, "Math.cos")
      .replace(/pow/g, "Math.pow");
  }
}
```

**Web Search Tool (Mock):**

```typescript
// services/tools/web-search.ts

export class WebSearchTool extends BaseTool {
  // Simulated search results for demo purposes
  private mockResults = {
    "current time": [{ title: "World Clock", snippet: "Current time UTC..." }],
    "weather today": [{ title: "Weather Forecast" }],
    "latest news": [{ title: "News Headlines" }],
  };

  constructor() {
    super({
      id: "web-search-v1",
      name: "Web Search",
      description: "Search the web for current information (mock)",
      version: "1.0.0",
      category: "search",
      inputSchema: {
        query: {
          type: "string",
          required: true,
          description: "Search query",
        },
        resultCount: {
          type: "number",
          required: false,
          description: "Number of results (default: 3)",
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          results: { type: "array", description: "Search results" },
        },
      },
      latencyEstimate: 800,
      costEstimate: {
        perCall: 0.002,
        currency: "USD",
      },
      reliability: 0.95,
      enabled: true,
    });
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: validation.errors.join("; "),
          metadata: { executionTimeMs: 0 },
        };
      }

      const query = (input.query as string).toLowerCase();
      const resultCount = (input.resultCount as number) || 3;

      // Mock implementation: check if query matches known patterns
      const mockResults = this.mockResults[query] || [
        {
          title: "Search Result",
          url: `https://example.com/search?q=${query}`,
          snippet: `Results for "${query}": This is a mock search result`,
        },
      ];

      const results = mockResults.slice(0, resultCount).map((r, idx) => ({
        rank: idx + 1,
        title: r.title,
        url: r.url || "https://example.com",
        snippet: r.snippet,
      }));

      return this.wrapSuccess({ results }, Date.now() - startTime, {
        resultCount: results.length,
      });
    } catch (error) {
      return this.wrapError(error);
    }
  }
}
```

### Layer 4: Tool Registry & Discovery

**Purpose:** Manage all available tools, enable/disable, and provide discovery

**Implementation Approach:**

```typescript
// services/tools/registry.ts

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  // Register a tool
  register(tool: BaseTool): void {
    const def = tool.getDefinition();
    if (this.tools.has(def.id)) {
      this.logger.warn(`Tool already registered: ${def.id}, overwriting`);
    }
    this.tools.set(def.id, tool);
    this.logger.info(`Tool registered: ${def.id} (${def.name})`);
  }

  // Get tool by ID
  getTool(toolId: string): BaseTool | undefined {
    return this.tools.get(toolId);
  }

  // Get all available tools
  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.getDefinition().enabled,
    );
  }

  // Get tools by category
  getToolsByCategory(category: string): BaseTool[] {
    return this.getAllTools().filter(
      (t) => t.getDefinition().category === category,
    );
  }

  // List tool definitions (metadata only)
  listToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map((t) => t.getDefinition());
  }

  // Health check all tools
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [id, tool] of this.tools) {
      try {
        const healthy = await tool.healthCheck();
        results.set(id, healthy);
      } catch (error) {
        this.logger.error(`Health check failed for tool ${id}`, error);
        results.set(id, false);
      }
    }
    return results;
  }

  // Enable/disable tool
  setToolEnabled(toolId: string, enabled: boolean): void {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    const def = tool.getDefinition();
    def.enabled = enabled;
    this.logger.info(`Tool ${toolId} ${enabled ? "enabled" : "disabled"}`);
  }
}
```

### Layer 5: Tool Dispatcher

**Purpose:** Execute tools with error handling and monitoring

**Implementation Approach:**

```typescript
// services/tools/dispatcher.ts

export interface ToolExecutionRequest {
  toolId: string;
  input: ToolInput;
  timeout?: number; // milliseconds, default 30000
}

export interface ToolExecutionResult {
  toolId: string;
  status: "success" | "failure" | "timeout";
  output: ToolOutput;
  error?: string;
  timestamp: number;
  duration: number;
}

export class ToolDispatcher {
  private registry: ToolRegistry;
  private logger: Logger;
  private executionHistory: ToolExecutionResult[] = [];

  constructor(registry: ToolRegistry, logger: Logger) {
    this.registry = registry;
    this.logger = logger;
  }

  // Execute single tool
  async dispatch(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const timeout = request.timeout || 30000;

    try {
      const tool = this.registry.getTool(request.toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${request.toolId}`);
      }

      const def = tool.getDefinition();
      if (!def.enabled) {
        throw new Error(`Tool is disabled: ${request.toolId}`);
      }

      // Execute with timeout
      const output = await Promise.race([
        tool.execute(request.input),
        new Promise<ToolOutput>((_, reject) =>
          setTimeout(
            () => reject(new Error("Tool execution timeout")),
            timeout,
          ),
        ),
      ]);

      const result: ToolExecutionResult = {
        toolId: request.toolId,
        status: output.success ? "success" : "failure",
        output,
        timestamp: startTime,
        duration: Date.now() - startTime,
      };

      this.executionHistory.push(result);
      this.logger.info(
        `Tool executed: ${request.toolId} (${result.duration}ms) - ${result.status}`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const status =
        error instanceof Error && error.message.includes("timeout")
          ? "timeout"
          : "failure";

      const result: ToolExecutionResult = {
        toolId: request.toolId,
        status,
        output: {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : String(error),
          metadata: { executionTimeMs: duration },
        },
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime,
        duration,
      };

      this.executionHistory.push(result);
      this.logger.error(`Tool execution failed: ${request.toolId}`, error);

      return result;
    }
  }

  // Execute multiple tools in parallel
  async dispatchMultiple(
    requests: ToolExecutionRequest[],
  ): Promise<ToolExecutionResult[]> {
    return Promise.all(requests.map((req) => this.dispatch(req)));
  }

  // Get execution history
  getHistory(limit: number = 100): ToolExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  // Get tool stats
  getToolStats(toolId: string): {
    callCount: number;
    successCount: number;
    failureCount: number;
    averageDuration: number;
  } {
    const relevant = this.executionHistory.filter((e) => e.toolId === toolId);

    return {
      callCount: relevant.length,
      successCount: relevant.filter((e) => e.status === "success").length,
      failureCount: relevant.filter((e) => e.status !== "success").length,
      averageDuration:
        relevant.reduce((sum, e) => sum + e.duration, 0) / relevant.length || 0,
    };
  }
}
```

### Layer 6: New Endpoint — Tool Discovery & Execution

**New Endpoint: `/api/tools/`**

```typescript
// endpoints/api/tools.ts

const router = Router();

// GET /api/tools/
// List all available tools
router.get("/", (req: Request, res: Response) => {
  const tools = toolRegistry.listToolDefinitions();
  res.json({ tools, count: tools.length });
});

// GET /api/tools/health
// Health check all tools
router.get("/health", async (req: Request, res: Response) => {
  const health = await toolRegistry.healthCheckAll();
  const allHealthy = Array.from(health.values()).every((h) => h);
  res.status(allHealthy ? 200 : 503).json({
    healthy: allHealthy,
    tools: Object.fromEntries(health),
  });
});

// POST /api/tools/execute
// Execute a tool
router.post("/execute", async (req: Request, res: Response) => {
  const { toolId, input } = req.body;

  if (!toolId || !input) {
    return res.status(400).json({
      error: "toolId and input required",
    });
  }

  const result = await toolDispatcher.dispatch({
    toolId,
    input,
    timeout: 30000,
  });

  res.status(result.status === "success" ? 200 : 400).json(result);
});

// POST /api/tools/batch
// Execute multiple tools in parallel
router.post("/batch", async (req: Request, res: Response) => {
  const { requests } = req.body;

  if (!Array.isArray(requests)) {
    return res.status(400).json({
      error: "requests must be an array",
    });
  }

  const results = await toolDispatcher.dispatchMultiple(requests);
  res.json({ results, total: results.length });
});
```

---

## Integration: Update Main RAG Endpoint

The existing RAG `/api/rag/ask` endpoint can now use tools:

```typescript
// Updated: endpoints/api/rag.ts

router.post("/ask", async (req: Request, res: Response) => {
  const { question } = req.body;

  // Step 1: Classify query to determine which tool(s) needed
  const classification = await classifyQueryType(question);

  let retrievalResults = [];

  if (classification === "calculator") {
    // Use calculator tool
    const calcResult = await toolDispatcher.dispatch({
      toolId: "calculator-v1",
      input: { expression: question },
    });
    retrievalResults = [{ content: calcResult.output.data }];
  } else if (classification === "web_search") {
    // Use web search tool
    const searchResult = await toolDispatcher.dispatch({
      toolId: "web-search-v1",
      input: { query: question },
    });
    retrievalResults = searchResult.output.data.results.map((r) => ({
      content: `${r.title}: ${r.snippet}`,
    }));
  } else {
    // Default: use retrieval tool
    const retrievalResult = await toolDispatcher.dispatch({
      toolId: "retrieval-v1",
      input: { query: question, topK: 5 },
    });
    retrievalResults = retrievalResult.output.data.results;
  }

  // Step 2-5: Same as before (format, build prompt, generate)
  // ...
});
```

---

## Key Design Principles

1. **Uniformity:** All tools follow same interface
2. **Composability:** Tools can be combined
3. **Observability:** Every execution is logged and monitorable
4. **Extensibility:** New tools added without changing core dispatcher
5. **Reliability:** Timeout protection, health checks, graceful degradation

---

## Testing & Validation

### Unit Tests

```typescript
// Test tool interface compliance
// Test dispatcher timeout handling
// Test registry enable/disable
// Test error handling in each tool
```

### Integration Tests

```typescript
// Test tool discovery endpoint
// Test batch tool execution
// Test health check endpoint
// Test tool stats tracking
```

---

## Deliverables Checklist

- [ ] BaseTool abstract class with interface
- [ ] ToolDefinition type with schema
- [ ] ToolRegistry for tool management
- [ ] ToolDispatcher with timeout handling
- [ ] RetrievalTool (refactored from v1)
- [ ] CalculatorTool implementation
- [ ] WebSearchTool (mock) implementation
- [ ] `/api/tools/` endpoints (list, health, execute, batch)
- [ ] Integration with existing RAG endpoint
- [ ] Execution history & stats tracking
- [ ] Type definitions in `types/tools.ts`
- [ ] Comprehensive tests
- [ ] Documentation with examples
