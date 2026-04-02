// Minimal ambient declaration for `process.env` to avoid requiring @types/node
declare const process: {
  env: { [key: string]: string | undefined };
};

export const appConfig = {
  app:{
    auth_token: process.env.TEST_ENV,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    indexName: process.env.PINECONE_INDEX_NAME,
    environment: process.env.PINECONE_ENVIRONMENT,
  },
  firebase: process.env.FIREBASE_PROJECT_ID ? {
    projectId: process.env.FIREBASE_PROJECT_ID,
  } : null,
};

