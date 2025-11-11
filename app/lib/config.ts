import { env } from './env';

export const config = {
  database: {
    url: env.DATABASE_URL,
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
  },
  milvus: {
    host: env.MILVUS_HOST,
    port: env.MILVUS_PORT,
    user: env.MILVUS_USER,
    password: env.MILVUS_PASSWORD,
  },
  llm: {
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    model: env.LLM_MODEL,
  },
  app: {
    url: env.NEXT_PUBLIC_APP_URL,
    nodeEnv: env.NODE_ENV,
  },
  mcp: {
    serverUrl: env.MCP_SERVER_URL,
  },
  pdf: {
    path: env.PDF_PATH,
  },
  redis: {
    url: env.REDIS_URL,
  },
  log: {
    level: env.LOG_LEVEL,
  },
};
