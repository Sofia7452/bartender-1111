/**
 * LangGraph 状态模式定义
 * 
 * 本文件定义了菜品与酒品搭配推荐系统的 LangGraph 状态结构
 * 使用 Zod 进行状态验证和类型安全
 */

import { z } from 'zod';
import type {
  DishRecommendation,
  CompletePairingRecommendation
} from '../../types/foodPairing';

/**
 * 用户输入状态 Schema
 */
const UserInputSchema = z.object({
  /** 菜系类型，可选 */
  cuisine: z.string().nullable().optional(),
  /** 食品原料列表 */
  foodIngredients: z.array(z.string()).min(1, '至少需要一个食品原料'),
  /** 酒原料列表，可选 */
  drinkIngredients: z.array(z.string()).optional(),
});

/**
 * 元数据状态 Schema
 */
const MetadataSchema = z.object({
  /** 时间戳 */
  timestamp: z.string(),
  /** 执行时间（毫秒） */
  executionTime: z.number().optional(),
  /** 使用的模型 */
  model: z.string().optional(),
}).optional();

/**
 * ReAct Agent 状态 Schema
 * 支持思考-行动-观察循环
 */
const ReActStateSchema = z.object({
  /** 思考（Thought）：Agent 的推理过程 */
  thought: z.string().nullable().optional(),
  /** 行动（Action）：要执行的操作 */
  action: z.string().nullable().optional(),
  /** 行动输入（Action Input）：行动的参数 */
  actionInput: z.any().nullable().optional(),
  /** 观察（Observation）：行动的结果 */
  observation: z.string().nullable().optional(),
  /** ReAct 循环次数 */
  reactIteration: z.number().default(0),
  /** 是否完成 */
  isFinished: z.boolean().default(false),
}).optional();

/**
 * LangGraph 状态 Schema
 * 使用 Zod 定义状态结构，确保类型安全
 */
export const FoodPairingStateSchema = z.object({
  /** 用户输入 */
  userInput: UserInputSchema,
  /** Agent 1 的输出结果（菜品推荐列表） */
  agent1Output: z.array(z.any()).nullable().optional(),
  /** Agent 2 的输出结果（完整搭配推荐） */
  agent2Output: z.any().nullable().optional(),
  /** 错误信息 */
  error: z.string().nullable().optional(),
  /** 元数据 */
  metadata: MetadataSchema,
  /** ReAct Agent 状态 */
  reactState: ReActStateSchema,
});

/**
 * LangGraph 状态类型
 * 从 Zod Schema 推断出的 TypeScript 类型
 */
export type FoodPairingState = z.infer<typeof FoodPairingStateSchema>;

/**
 * 状态初始值
 * 用于初始化 LangGraph 状态
 */
export function createInitialState(input: {
  cuisine?: string | null;
  foodIngredients: string[];
  drinkIngredients?: string[];
}): FoodPairingState {
  return {
    userInput: {
      cuisine: input.cuisine ?? null,
      foodIngredients: input.foodIngredients,
      drinkIngredients: input.drinkIngredients ?? [],
    },
    agent1Output: null,
    agent2Output: null,
    error: null,
    metadata: {
      timestamp: new Date().toISOString(),
      executionTime: undefined,
      model: undefined,
    },
    reactState: {
      thought: null,
      action: null,
      actionInput: null,
      observation: null,
      reactIteration: 0,
      isFinished: false,
    },
  };
}

/**
 * 状态验证函数
 * 验证状态是否符合 Schema 定义
 */
export function validateState(state: unknown): FoodPairingState {
  return FoodPairingStateSchema.parse(state);
}

