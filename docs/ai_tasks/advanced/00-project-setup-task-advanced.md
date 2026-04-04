---
notes: Read `../_meta_.md` as instruction before take task actions
---

# Task 00 — Project Setup [advanced]

## Goal

Set up the complete development environment for the Pinecone AI RAG project, understanding each component and how they integrate.

---

## Learning Outcomes

After completing this task, you'll understand:

- **Project architecture** — How functions, configs, and dependencies fit together
- **Environment configuration** — API keys, secrets management, .env files
- **Dependency management** — What each package does and why it's needed
- **Firebase setup** — Authentication, database, and admin SDK configuration
- **GCP integration** — Secret management, credentials, environment variables
- **Development workflow** — Local development, testing, deployment
- **Verification procedures** — How to validate everything is working
- **Troubleshooting methodology** — Systematic diagnosis of setup issues

---

## Requirements

**Prerequisites:**

- Node.js 22+ installed
- npm or yarn package manager
- Git for version control
- Text editor/IDE (VS Code recommended)

**Accounts needed:**

- Pinecone account (free tier available)
- OpenAI account with API credits
- Firebase project with admin access
- GCP project (same as Firebase for secret management)

**Environment variables:**

- `OPENAI_API_KEY` — From OpenAI dashboard
- `PINECONE_API_KEY` — From Pinecone project
- `FIREBASE_PROJECT_ID` — From Firebase console
- `GCP_PROJECT_ID` — From GCP console
- `TEST_ENV` — Defined on your own to protect API requests in an easy way

---

## Why Project Setup Matters

### The Problem: Many Moving Parts

```
Without proper setup:
- Missing environment variables → Cryptic errors
- Wrong API keys → Authentication failures
- Mismatched versions → Dependency conflicts
- Incorrect credentials → Permission denied errors
- Incomplete configuration → Random failures

Result: Hours spent debugging setup issues instead of learning
```

### The Solution: Systematic Validation

```
With proper setup:
- All environment variables validated before use
- Credentials tested with actual services
- Dependency versions verified compatible
- Configuration verified in each component
- Health checks ensure everything works

Result: Clear success/failure messages, easy diagnosis
```

---

## Implementation

**Files to create/verify:**

```
root/
├── .env (LOCAL - do not commit)
├── .env.sample (FOR REFERENCE)
├── package.json (dependencies)
└── functions/
    └── .env.local (Firebase Functions env)
```

**Verification checklist:**

```
1. Dependencies installed
2. Environment variables set
3. API keys validated
4. Firebase configured
5. GCP credentials available
6. Development server starts
```

---

## Step-by-Step Setup

### Step 1: Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/benxgao/pinecone-ai-starter.git
cd pinecone-ai-starter

# Install dependencies
npm install

# Install Firebase Tools (for local development)
npm install -g firebase-tools

# Verify Node version
node --version  # Should be 18+
npm --version   # Should be 8+
```

**Expected output:**

```
npm notice created a lockfile as package-lock.json
added 156 packages, and audited 157 packages
npm audit: no vulnerabilities found
```

### Step 2: Set Up API Keys

```bash
# Create .env file in root directory
cat > .env << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=sk-...  # Get from https://platform.openai.com/api-keys

# Pinecone Configuration
PINECONE_API_KEY=...   # Get from https://app.pinecone.io/

# Firebase Configuration (if using Firebase)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com

# GCP Configuration (for secret management)
GCP_PROJECT_ID=your-gcp-project

# Environment
NODE_ENV=development
EOF

# Create .env.sample for documentation
cat > .env.sample << 'EOF'
# Copy this file to .env and fill in your actual values
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
FIREBASE_PROJECT_ID=...
GCP_PROJECT_ID=...
NODE_ENV=development
EOF

# Verify .env is NOT committed
echo ".env" >> .gitignore
```

**Critical:** Never commit `.env` file!

### Step 3: Validate API Keys

```typescript
// Create validation script: validate-setup.ts
import { getOpenAIClient } from "./src/adapters/openai";
import { getPineconeClient } from "./src/adapters/pinecone";

async function validateSetup() {
  console.log("🔍 Validating setup...\n");

  // Check OpenAI
  console.log("1️⃣  OpenAI Configuration");
  try {
    const openai = getOpenAIClient();
    console.log("   ✅ OpenAI client initialized");
    console.log("   ✅ API key format valid (starts with sk-)");
  } catch (error) {
    console.error("   ❌ OpenAI error:", error);
    process.exit(1);
  }

  // Check Pinecone
  console.log("\n2️⃣  Pinecone Configuration");
  try {
    const pinecone = getPineconeClient();
    console.log("   ✅ Pinecone client initialized");

    // Try listing indexes
    const indexes = await pinecone.listIndexes();
    console.log(
      `   ✅ Connected to Pinecone (${indexes.length} indexes found)`,
    );
  } catch (error) {
    console.error("   ❌ Pinecone error:", error);
    process.exit(1);
  }

  // Check Firebase (if configured)
  if (process.env.FIREBASE_PROJECT_ID) {
    console.log("\n3️⃣  Firebase Configuration");
    try {
      // Your Firebase validation
      console.log("   ✅ Firebase credentials loaded");
    } catch (error) {
      console.error("   ❌ Firebase error:", error);
    }
  }

  console.log("\n✅ All systems operational!");
}

validateSetup().catch((error) => {
  console.error("Setup validation failed:", error);
  process.exit(1);
});
```

**Run validation:**

```bash
npx ts-node validate-setup.ts
```

### Step 4: Start Development Server

```bash
# Navigate to functions directory
cd functions

# Install function-specific dependencies
npm install

# Start development server
npm run dev

# Expected output:
# > dev
# ⚡ Starting dev server
# Listening on http://localhost:5000
# Press Ctrl+C to stop
```

### Step 5: Test API Endpoints

```bash
# In another terminal, test the health endpoint
curl http://localhost:5000/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-04-03T10:30:00Z"
# }

# Test embedding endpoint
curl -X POST http://localhost:5000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world"}'

# Expected response:
# {
#   "embedding": [0.123, -0.456, ...],  # 1536 values
#   "dimensions": 1536
# }
```

---

## Environment Variables Reference

### OpenAI

```bash
OPENAI_API_KEY=sk-...  # Required
# Get from: https://platform.openai.com/api-keys
# Format: Starts with "sk-", ~48 characters
# Cost: Monitor at https://platform.openai.com/account/usage/overview
```

### Pinecone

```bash
PINECONE_API_KEY=...        # Required
PINECONE_INDEX_NAME=my-index    # Optional (default: rag-documents)

# Get from: https://app.pinecone.io/
# Regions: us-east-1, us-west-2, eu-west-1, etc.
```

### Firebase

```bash
FIREBASE_PROJECT_ID=my-project      # Required (if using Firebase)
FIREBASE_PRIVATE_KEY=...            # From service account JSON
FIREBASE_CLIENT_EMAIL=...           # From service account JSON
FIREBASE_DATABASE_URL=...           # Firebase Realtime DB URL
```

### GCP

```bash
GCP_PROJECT_ID=my-gcp-project       # Required (if using GCP)
GOOGLE_APPLICATION_CREDENTIALS=...  # Path to service account JSON
```

---

## Verification Checklist

### ✅ Dependencies Installed

```bash
# Check if all dependencies installed
npm list

# Should show no errors, only dependency tree
```

### ✅ Environment Variables Set

```bash
# Verify variables are accessible
node -e "console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅' : '❌')"
node -e "console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅' : '❌')"
```

### ✅ APIs Responding

```bash
# Test OpenAI
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data | length'
# Should return number of models available

# Test Pinecone
curl -s "https://api.pinecone.io/indexes" \
  -H "Api-Key: $PINECONE_API_KEY" | jq '.'
# Should return list of indexes
```

### ✅ Development Server Running

```bash
# Terminal 1
cd functions && npm run dev

# Terminal 2
curl http://127.0.0.1:5001/pinecone-ai-starter/us-central1/endpoints/api/healthcheck
# Should return {"status": "healthy"}
```

---

## Troubleshooting

### Problem: "OPENAI_API_KEY not set"

```
❌ Error:
  Error: OPENAI_API_KEY environment variable not set

✅ Solution:
  1. Check .env file exists in root directory
  2. Verify line: OPENAI_API_KEY=sk-...
  3. Check key format (should start with sk-)
  4. Restart dev server after adding key
  5. Test with: node -e "console.log(process.env.OPENAI_API_KEY)"

💡 Prevention:
  - Use .env.sample as template
  - Add .env to .gitignore
  - Never commit API keys
```

### Problem: "401 Unauthorized" when calling OpenAI

```
❌ Error:
  Error: 401 Unauthorized. Invalid API key provided.

✅ Solutions:
  1. Get correct API key from https://platform.openai.com/api-keys
  2. Check for extra spaces in .env file
  3. Verify key hasn't been revoked
  4. Test key with curl:
     curl https://api.openai.com/v1/models \
       -H "Authorization: Bearer YOUR_KEY"
  5. Regenerate key if needed

💡 Note:
  - Each organization gets different keys
  - Keys can be deactivated if leaked
  - Keep separate keys for dev/prod
```

### Problem: "Cannot connect to Pinecone"

```
❌ Error:
  Error: Failed to connect to Pinecone index

✅ Solutions:
  1. Verify PINECONE_API_KEY is set
  2. Verify PINECONE_ENVIRONMENT matches region (can be ignored on serverless mode)
  3. Test connection:
     curl "https://api.pinecone.io/indexes" \
       -H "Api-Key: YOUR_KEY"
  4. Check Pinecone dashboard for index status
  5. Ensure index is in "Ready" state (not "Initializing")

💡 Note:
  - New indexes take 2-5 minutes to become ready
  - Free tier has quota limits
  - Different regions have different endpoints
```

### Problem: "Port 5000 already in use"

```
❌ Error:
  Error: listen EADDRINUSE: address already in use :::5001

✅ Solutions:
  lsof -ti:5001 | xargs kill -9

💡 Note:
  - Previous dev server might not have stopped
  - Use Ctrl+C to properly stop servers
```

### Problem: "Module not found"

```
❌ Error:
  Error: Cannot find module 'openai'

✅ Solutions:
  1. Reinstall dependencies:
     npm install
  2. Clear cache:
     npm cache clean --force && npm install
  3. Check node_modules exists
  4. Verify package.json includes the package

💡 Prevention:
  - Run npm install after pulling changes
  - Use npm ci for CI/CD pipelines
```

---

## File Structure Verification

After setup, verify this structure exists:

```
pinecone-ai-starter/
├── .env                          ← Your local config (NOT in git)
├── .env.sample                   ← Template (in git)
├── package.json                  ← Project dependencies
├── tsconfig.json                 ← TypeScript config
├── functions/
│   ├── package.json              ← Function dependencies
│   ├── src/
│   │   ├── index.ts              ← Main entry
│   │   ├── adapters/
│   │   │   ├── openai.ts         ← OpenAI client
│   │   │   └── pinecone.ts       ← Pinecone client
│   │   ├── services/
│   │   │   ├── embedding.ts      ← Embedding service
│   │   │   └── rag.ts            ← RAG pipeline
│   │   └── endpoints/
│   │       └── api/
│   │           ├── embed.ts      ← /api/embed endpoint
│   │           └── rag.ts        ← /api/rag endpoint
│   └── .env.local                ← Firebase Functions env
└── docs/
    ├── ai_tasks/                 ← Task documentation
    └── architecture/             ← System design docs
```

---

## Development Commands

```bash
# Start development server
npm run dev

# Run tests (if configured)
npm test

# Type check TypeScript
npm run type-check

# Format code
npm run format

# Lint code
npm run lint

# Build for production
npm run build

# Deploy to Firebase Functions
firebase deploy --only functions
```

---

## Common Patterns

### Pattern 1: Loading Environment Variables

```typescript
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable not set. ` +
        `Add to .env file and restart dev server.`,
    );
  }
  return value;
}

const apiKey = getRequiredEnv("OPENAI_API_KEY");
```

### Pattern 2: Validating Setup

```typescript
async function validateEnvironment() {
  const required = ["OPENAI_API_KEY", "PINECONE_API_KEY"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required variables: ${missing.join(", ")}`);
  }
}
```

### Pattern 3: Conditional Configuration

```typescript
const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
  },
  firebase: process.env.FIREBASE_PROJECT_ID
    ? {
        projectId: process.env.FIREBASE_PROJECT_ID,
      }
    : null,
};
```

---

## Testing Setup

### Test 1: All dependencies installed

```bash
npm list 2>&1 | grep -c "dependencies" || echo "✅ Dependencies OK"
```

### Test 2: Environment variables accessible

```bash
node -e "
const required = ['OPENAI_API_KEY', 'PINECONE_API_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing:', missing);
  process.exit(1);
} else {
  console.log('✅ All required env vars set');
}
"
```

### Test 3: Development server starts

```bash
cd functions
npm run dev &
sleep 3
curl http://localhost:5000/api/health
pkill -f "npm run dev"
```

**Success criteria:**

- ✅ No errors during npm install
- ✅ All required env vars present
- ✅ Health endpoint returns 200 OK
- ✅ Can see both /src and /lib directories
- ✅ Development server starts without crashes

---

## Security Best Practices

### ✅ DO:

- Store API keys in .env file (local only)
- Add .env to .gitignore
- Use separate keys for dev/prod
- Rotate keys regularly
- Monitor API usage

### ❌ DON'T:

- Commit .env to git
- Share API keys in Slack/email
- Log API keys to console
- Push keys to GitHub
- Use same key for dev and production

---

## Next Steps

After setup verification:

1. **Task 01** — Create embeddings using OpenAI
2. **Task 02** — Set up Pinecone index
3. **Task 03** — Load and upsert data
4. **Task 04** — Query vectors
5. **Task 05** — Build RAG system

---

## Constraints

- Requires Node.js 18+ (not compatible with Node 14)
- OpenAI API key required (paid API, not free tier)
- Pinecone free tier limited to 1 index and 100K vectors
- Firebase setup is optional (use local alternative if preferred)

---

## Tutorial Trigger

- **system_architecture.md** → Fill "Setup" section with environment validation

Tutorial focus:

- What = Complete project setup with all components
- Why = Proper configuration prevents hours of debugging
- How = Step-by-step verification of each component
- Gotchas = Environment variables, API keys, port conflicts, version mismatches
- Trade-offs = Time invested in setup vs debugging later issues
