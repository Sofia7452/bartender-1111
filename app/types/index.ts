// 基础类型定义
export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
  source?: string;
  createdAt: Date;
}

export interface UserFavorite {
  id: string;
  sessionId: string;
  recipeId: string;
  recipe: Recipe;
  createdAt: Date;
}

export interface RecommendationHistory {
  id: string;
  sessionId: string;
  ingredients: string[];
  recommendedRecipes: Recipe[];
  createdAt: Date;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  milvusId?: string;
  metadata?: any;
  createdAt: Date;
}

// PDF处理相关类型
export interface PDFDocument {
  id: string;
  title: string;
  content: string;
  chunks: TextChunk[];
  metadata: {
    filePath: string;
    fileSize: number;
    lastModified: Date;
    pageCount: number;
  };
}

export interface TextChunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  metadata: {
    recipeName?: string;
    ingredients?: string[];
    steps?: string[];
  };
}

// LLM配置类型
export interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

// 数据库配置类型
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
