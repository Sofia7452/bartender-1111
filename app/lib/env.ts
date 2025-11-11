// 简化的环境变量配置
export interface Env {
  DATABASE_URL: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  MILVUS_HOST: string;
  MILVUS_PORT: number;
  MILVUS_USER?: string;
  MILVUS_PASSWORD?: string;
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  LLM_MODEL: string;
  NEXT_PUBLIC_APP_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  MCP_SERVER_URL?: string;
  PDF_PATH?: string;
  REDIS_URL?: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
}

// 获取环境变量（运行时验证）
export function getEnv(): Env {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/bartender_db',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_NAME: process.env.DB_NAME || 'bartender_db',
    DB_USERNAME: process.env.DB_USERNAME || 'username',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    MILVUS_HOST: process.env.MILVUS_HOST || 'localhost',
    MILVUS_PORT: parseInt(process.env.MILVUS_PORT || '19530'),
    MILVUS_USER: process.env.MILVUS_USER,
    MILVUS_PASSWORD: process.env.MILVUS_PASSWORD,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    LLM_MODEL: process.env.LLM_MODEL || 'gpt-3.5-turbo',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    MCP_SERVER_URL: process.env.MCP_SERVER_URL,
    PDF_PATH: process.env.PDF_PATH,
    REDIS_URL: process.env.REDIS_URL,
    LOG_LEVEL: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  };

  // 基本验证
  if (!env.OPENAI_API_KEY) {
    console.warn('警告: OPENAI_API_KEY 未设置');
  }
  if (!env.DATABASE_URL || env.DATABASE_URL.includes('username:password')) {
    console.warn('警告: 数据库配置未正确设置');
  }

  return env;
}

// 为了向后兼容
export const env = getEnv();
