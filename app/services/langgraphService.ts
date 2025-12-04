/**
 * LangGraph 服务
 * 
 * 本文件封装了 LangGraph 图构建和执行逻辑，提供高级 API 供业务层调用
 */

import { buildFoodPairingGraph } from './langgraph/foodPairingGraph';
import { createInitialState, validateState, type FoodPairingState } from './langgraph/foodPairingState';
import type { CompletePairingRecommendation, DishRecommenderInput } from '../types/foodPairing';
import { z } from 'zod';

/**
 * 用户输入验证 Schema
 */
const UserInputValidationSchema = z.object({
  cuisine: z.string().nullable().optional(),
  foodIngredients: z.array(z.string()).min(1, '至少需要一个食品原料'),
  drinkIngredients: z.array(z.string()).optional(),
});

/**
 * FoodPairingLangGraphService
 * 
 * 提供菜品与酒品搭配推荐的 LangGraph 服务
 * 支持 ReAct 模式和传统模式
 */
export class FoodPairingLangGraphService {
  private graph: ReturnType<typeof buildFoodPairingGraph> | null = null;
  private useReAct: boolean;

  /**
   * 构造函数
   * 初始化服务，延迟构建图（首次使用时构建）
   * 
   * @param useReAct 是否使用 ReAct 模式，默认为 true
   */
  constructor(useReAct: boolean = true) {
    this.useReAct = useReAct;
    // 图将在首次使用时构建（懒加载）
    console.log(`📦 FoodPairingLangGraphService 初始化完成 (模式: ${useReAct ? 'ReAct' : '传统'})`);
  }

  /**
   * 构建并返回编译后的 LangGraph 实例
   * 使用单例模式，确保图只构建一次
   * 
   * @returns 编译后的图实例
   */
  private buildGraph() {
    if (!this.graph) {
      console.log(`🔧 首次使用，构建 LangGraph 图... (模式: ${this.useReAct ? 'ReAct' : '传统'})`);
      this.graph = buildFoodPairingGraph(this.useReAct);
    }
    return this.graph;
  }

  /**
   * 验证输入参数
   * 
   * @param input 用户输入
   * @throws {Error} 如果输入无效
   */
  validateInput(input: {
    cuisine?: string | null;
    foodIngredients: string[];
    drinkIngredients?: string[];
  }): void {
    try {
      UserInputValidationSchema.parse({
        cuisine: input.cuisine ?? null,
        foodIngredients: input.foodIngredients,
        drinkIngredients: input.drinkIngredients ?? [],
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`输入验证失败: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * 执行图，接收用户输入，返回完整推荐方案
   * 
   * @param input 用户输入
   * @returns 完整的搭配推荐方案
   * @throws {Error} 如果执行失败
   */
  async execute(input: {
    cuisine?: string | null;
    foodIngredients: string[];
    drinkIngredients?: string[];
  }): Promise<CompletePairingRecommendation> {
    const startTime = Date.now();
    console.log('🚀 开始执行 LangGraph 推荐流程...');
    console.log('📥 输入参数:', {
      cuisine: input.cuisine,
      foodIngredients: input.foodIngredients,
      drinkIngredients: input.drinkIngredients,
    });

    try {
      // 1. 验证输入
      this.validateInput(input);

      // 2. 创建初始状态
      const initialState = createInitialState({
        cuisine: input.cuisine,
        foodIngredients: input.foodIngredients,
        drinkIngredients: input.drinkIngredients,
      });

      // 3. 获取图实例（懒加载）
      const graph = this.buildGraph();

      // 4. 执行图
      console.log('🔄 执行 LangGraph...');
      const finalState = await graph.invoke(initialState);

      // 5. 验证最终状态
      const validatedState = validateState(finalState);

      // 6. 检查错误
      if (validatedState.error) {
        console.error('❌ 执行过程中发生错误:', validatedState.error);
        throw new Error(validatedState.error);
      }

      // 7. 提取结果
      const pairingResult = validatedState.agent2Output as CompletePairingRecommendation | null;

      if (!pairingResult) {
        // 如果没有完整的搭配结果，尝试返回部分结果（仅菜品推荐）
        const dishes = validatedState.agent1Output as any[] | null;
        if (dishes && dishes.length > 0) {
          console.warn('⚠️ 未生成完整的搭配推荐，返回部分结果（仅菜品推荐）');
          return {
            dishes,
            beverages: [],
            pairingReasons: [],
            overallSuggestion: '抱歉，未能生成完整的酒品搭配推荐，但为您推荐了以下菜品。',
            metadata: {
              timestamp: new Date().toISOString(),
              dishCount: dishes.length,
              beverageCount: 0,
              pairingCount: 0,
            },
          };
        }
        throw new Error('未能生成有效的推荐结果');
      }

      const executionTime = Date.now() - startTime;
      console.log(`✅ LangGraph 执行完成，耗时 ${executionTime}ms`);
      console.log(`📊 结果统计: ${pairingResult.dishes.length} 个菜品, ${pairingResult.beverages.length} 个酒品, ${pairingResult.pairingReasons.length} 个搭配理由`);

      return pairingResult;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // 记录详细错误日志（包含堆栈跟踪）
      console.error(`❌ LangGraph 执行失败，耗时 ${executionTime}ms`);
      console.error('错误详情:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        cause: error?.cause,
      });

      // 提供更友好的错误信息
      if (error instanceof Error) {
        // 保留原始错误信息，但确保有友好的消息
        const friendlyMessage = error.message || '执行失败，请稍后重试';
        const enhancedError = new Error(friendlyMessage);
        enhancedError.stack = error.stack;
        enhancedError.cause = error.cause;
        throw enhancedError;
      }
      throw new Error(`执行失败: ${error?.message || '未知错误'}`);
    }
  }

  /**
   * 获取服务状态信息
   * 
   * @returns 服务状态
   */
  getStatus(): {
    graphBuilt: boolean;
    serviceReady: boolean;
  } {
    return {
      graphBuilt: this.graph !== null,
      serviceReady: true,
    };
  }
}

/**
 * 单例实例
 * 可以在整个应用中共享使用
 */
let serviceInstance: FoodPairingLangGraphService | null = null;

/**
 * 获取服务单例实例
 * 
 * @returns FoodPairingLangGraphService 实例
 */
export function getFoodPairingService(): FoodPairingLangGraphService {
  if (!serviceInstance) {
    serviceInstance = new FoodPairingLangGraphService();
  }
  return serviceInstance;
}

