# Task 00 — Project Setup

## Goal

Initialize a production-ready TypeScript project with essential AI/vector dependencies and local development environment.

---

## Learning Outcomes

After this task, you'll understand:
- Why each dependency is needed for RAG systems
- How to configure environment variables safely
- Local development workflow with Firebase emulators
- TypeScript setup for Cloud Functions

---

## Requirements

### Core Dependencies
- **openai** — Generate embeddings and LLM responses
- **@pinecone-database/pinecone** — Vector database operations
- **firebase-admin** — Cloud Functions SDK
- **firebase-functions** — Function deployment
- **express** — HTTP API routing
- **dotenv** — Environment variable management

### Dev Dependencies
- **typescript** — Type safety
- **firebase-tools** — Local emulation & deployment

---

## Implementation Steps

1. **Navigate to functions directory**
   ```bash
   cd functions
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.sample .env
   # Edit .env with:
   # OPENAI_API_KEY=sk-...
   # PINECONE_API_KEY=...
   # PINECONE_INDEX=my-index
   # PINECONE_ENVIRONMENT=us-east-1
   ```

3. **Verify TypeScript compilation**
   ```bash
   npm run build
   # Check: lib/ directory created successfully
   ```

4. **Start development server**
   ```bash
   npm run dev
   # Firebase emulator should start on http://localhost:5000
   ```

---

## Testing

✅ **Success criteria:**
- `npm install` completes without errors
- `npm run build` creates `lib/` directory
- `npm run dev` starts emulator (watch for: "listening at")
- No TypeScript compilation errors

---

## Common Issues

**Node version mismatch**
- Required: Node 24 (see package.json engines)
- Check: `node --version`
- Fix: Use nvm: `nvm use 24`

**Missing environment variables**
- Error: "Cannot find OPENAI_API_KEY"
- Fix: Verify .env file exists in `functions/` directory

**Port already in use**
- Error: "address already in use :5000"
- Fix: `lsof -ti:5000 | xargs kill -9`

---

## Tutorial Trigger

- NONE (skip tutorial update for setup)
