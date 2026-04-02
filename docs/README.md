# Documentation Structure

This directory contains all learning materials and architecture documentation for the RAG system.

## Folder Overview

### `ai_tasks/` — Core Learning Curriculum
The hands-on learning path split into two difficulty levels:

#### `ai_tasks/basic/` — Fundamentals Track
For developers new to RAG and vector databases. Covers core concepts with minimal setup complexity.
- `00-project-setup-basic.md` - Environment and project initialization
- `01-openai-embedding-basic.md` - Text-to-vector generation
- `02-pinecone-index-basic.md` - Vector database setup
- `03-upsert-data-basic.md` - Loading data into Pinecone
- `04-query-similarity-basic.md` - Semantic search queries
- `05-simple-rag-basic.md` - Basic RAG pipeline
- `06-chunking-strategy-basic.md` - Text splitting optimization
- `07-eval-retrieval-basic.md` - Retrieval quality metrics
- `08-improve-retrieval-basic.md` - Retrieval enhancement techniques

#### `ai_tasks/advanced/` — Production Track
For developers ready for enterprise patterns, optimization, and complex scenarios.
- `00-project-setup-task-advanced.md` - Advanced project structure
- `01-openai-embedding-task-advanced.md` - Embedding optimization
- `02-pinecone-index-task-advanced.md` - Index configuration & scaling
- `03-upsert-data-task-advanced.md` - Batch operations & error handling
- `04-query-similarity-task-advanced.md` - Advanced search strategies
- `05-simple-rag-task-advanced.md` - Production RAG patterns
- `06-chunking-strategy-task-advanced.md` - Smart chunking algorithms
- `07-eval-retrieval-task-advanced.md` - Comprehensive evaluation
- `08-improve-retrieval-task-advanced.md` - Reranking & refinement

#### `ai_tasks/.task_actions/` — Implementation Guides
Step-by-step action plans referenced by task files.
- `basic/` - Action sequences for basic tasks
- `advanced/` - Action sequences for advanced tasks

#### `ai_tasks/_meta.md` — Task Rules
Shared guidelines for all tasks.

### `ai_tutorials/` — Reference Guides
Technical deep-dives updated after completing each task.
- `01-embeddings.md` - Vector embeddings concepts
- `02-vector-search.md` - Semantic search techniques
- `03-rag.md` - RAG architecture & patterns

### `architecture/` — System Design
Technical decision documentation.
- `system_architecture.md` - Overall system design
- `api_design.md` - API specifications
- `product_features.md` - Feature specifications
- `pinecone.md` - Pinecone-specific patterns

### `ops/` — Operations & Deployment
Operational procedures and deployment guides.
- `commands.md` - Common CLI commands
- `checklist.md` - Deployment checklist
- `gcp.md` - GCP-specific setup

## How to Use

1. **Starting a Learning Path**
   - Choose `basic/` for foundational knowledge
   - Choose `advanced/` for production-ready patterns
   - Follow tasks sequentially (00 → 08)

2. **During a Task**
   - Read the task file for context and learning outcomes
   - Check `.task_actions/` folder for specific implementation steps
   - Implement code following the action plan

3. **After Completing a Task**
   - Review the corresponding `ai_tutorials/` file
   - Update with new learnings (delta only)
   - Proceed to next task

## Task Structure Template

Each task file includes:
- **Learning Outcomes**: What you'll understand
- **Problem Statement**: Why this matters
- **Concepts**: Key ideas explained
- **Implementation**: Step-by-step guide
- **Code Examples**: Real TypeScript code
- **Testing**: Validation approaches
- **Next Steps**: Path to the next task

## Choosing Your Path

### Pick Basic If:
- You're new to RAG systems
- Learning vector databases for the first time
- Want quick wins and immediate results
- Building proof-of-concept

### Pick Advanced If:
- You've completed the basic path
- Building production systems
- Need optimization techniques
- Want enterprise patterns

## Cross-References
- Tasks reference `ai_tutorials/` for deeper learning
- Action files reference task files for context
- Architecture docs inform all task implementations


