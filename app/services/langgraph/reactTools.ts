/**
 * ReAct Agent 工具集
 * 
 * 本文件定义了 ReAct Agent 可以使用的工具函数
 * 每个工具代表一个可执行的操作
 */

import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { env } from '../../lib/env';
import type {
  DishRecommendation,
  BeverageRecommendation,
  PairingReason,
  CompletePairingRecommendation,
} from '../../types/foodPairing';

/**
 * LLM 客户端实例
 */
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
});

const LLM_MODEL = env.LLM_MODEL || 'gpt-4';

/**
 * 工具类型定义
 */
export type ToolName = 'search_dishes' | 'generate_recommendations' | 'evaluate_pairing' | 'finalize_result';

/**
 * 工具接口
 */
export interface Tool {
  name: ToolName;
  description: string;
  execute: (input: any) => Promise<any>;
}

/**
 * 工具 1: 搜索菜品
 * 根据原料和菜系搜索合适的菜品
 */
async function searchDishes(input: {
  cuisine?: string | null;
  ingredients: string[];
}): Promise<DishRecommendation[]> {
  console.log('🔍 [工具] 搜索菜品:', input);

  const cuisinePart = input.cuisine
    ? `\n菜系要求：${input.cuisine}`
    : '\n菜系要求：不限，可根据原料自由选择';

  const prompt = `基于以下原料，推荐3-5个适合的菜品：

原料列表：${input.ingredients.join('、')}${cuisinePart}

请为每个推荐提供以下信息（JSON格式）：
{
  "id": "唯一标识符",
  "name": "菜品名称",
  "description": "简短描述",
  "cuisine": "所属菜系",
  "requiredIngredients": ["食材1 用量", "食材2 用量", ...],
  "cookingTime": 分钟数,
  "difficulty": 1-5,
  "steps": ["步骤1", "步骤2", ...],
  "source": "来源（可选）",
  "tags": ["标签1", "标签2"]
}

请确保：
1. 配方中的食材尽量使用用户提供的原料
2. 难度等级：1=简单，2=容易，3=中等，4=困难，5=专家
3. 烹饪步骤要详细清晰
4. 返回有效的JSON数组格式`;

  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的厨师和美食顾问，擅长根据现有原料和菜系推荐合适的菜品。请提供详细、准确的菜品信息。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('搜索菜品失败：LLM 返回内容为空');
  }

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((dish: any) => ({
        id: dish.id || randomUUID(),
        name: dish.name || '未知菜品',
        description: dish.description || '',
        cuisine: dish.cuisine || input.cuisine || '通用',
        requiredIngredients: Array.isArray(dish.requiredIngredients)
          ? dish.requiredIngredients
          : [],
        cookingTime: dish.cookingTime || 30,
        difficulty: dish.difficulty || 3,
        steps: Array.isArray(dish.steps) ? dish.steps : [],
        source: dish.source,
        tags: Array.isArray(dish.tags) ? dish.tags : [],
      }));
    }
  } catch (error) {
    console.error('解析菜品搜索结果失败:', error);
  }

  return [];
}

/**
 * 工具 2: 生成推荐
 * 根据菜品生成酒品搭配推荐
 */
async function generateRecommendations(input: {
  dishes?: DishRecommendation[];
  drinkIngredients?: string[];
}): Promise<{
  beverages: BeverageRecommendation[];
  pairingReasons: PairingReason[];
}> {
  // 输入验证：确保 dishes 存在且是数组
  if (!input || !input.dishes || !Array.isArray(input.dishes) || input.dishes.length === 0) {
    throw new Error('生成酒品推荐失败：缺少有效的菜品列表。请先使用 search_dishes 工具搜索菜品。');
  }

  console.log('🍷 [工具] 生成酒品推荐:', { dishCount: input.dishes.length });

  const dishesInfo = input.dishes
    .map(
      (dish, index) =>
        `${index + 1}. ${dish.name} (${dish.cuisine}) - ${dish.description}`
    )
    .join('\n');

  const ingredientsPart =
    input.drinkIngredients && input.drinkIngredients.length > 0
      ? `\n用户提供的酒原料：${input.drinkIngredients.join('、')}`
      : '\n用户未提供酒原料，请根据菜品自由推荐合适的酒品';

  const prompt = `基于以下推荐的菜品，为每个菜品推荐1-2个合适的酒品搭配：

推荐菜品：
${dishesInfo}${ingredientsPart}

请为每个推荐提供以下信息（JSON格式）：
{
  "beverages": [
    {
      "id": "唯一标识符",
      "name": "酒品名称",
      "description": "简短描述",
      "ingredients": ["原料1 用量", "原料2 用量", ...],
      "steps": ["步骤1", "步骤2", ...],
      "category": "分类",
      "glassType": "杯型",
      "technique": "调制技巧",
      "garnish": "装饰",
      "difficulty": 1-5,
      "estimatedTime": 分钟数
    }
  ],
  "pairingReasons": [
    {
      "id": "唯一标识符",
      "dishId": "菜品ID",
      "beverageId": "酒品ID",
      "reason": "详细的搭配理由",
      "pairingType": "搭配类型（如：互补、对比、平衡）",
      "score": 1-10
    }
  ]
}

请确保：
1. 每个菜品至少推荐1个酒品
2. 搭配理由要详细说明为什么这个酒品适合这个菜品
3. 如果用户提供了酒原料，尽量使用这些原料
4. 返回有效的JSON格式`;

  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的调酒师和美食搭配顾问，擅长根据菜品推荐合适的酒品搭配。请提供详细的搭配理由和完整的酒品配方信息。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('生成推荐失败：LLM 返回内容为空');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const beverages: BeverageRecommendation[] = (
        Array.isArray(parsed.beverages) ? parsed.beverages : []
      ).map((beverage: any) => ({
        id: beverage.id || randomUUID(),
        name: beverage.name || '未知酒品',
        description: beverage.description || '',
        ingredients: Array.isArray(beverage.ingredients)
          ? beverage.ingredients
          : [],
        steps: Array.isArray(beverage.steps) ? beverage.steps : [],
        category: beverage.category,
        glassType: beverage.glassType,
        technique: beverage.technique,
        garnish: beverage.garnish,
        difficulty: beverage.difficulty || 3,
        estimatedTime: beverage.estimatedTime || 5,
        source: beverage.source,
        tags: Array.isArray(beverage.tags) ? beverage.tags : [],
      }));

      const pairingReasons: PairingReason[] = (
        Array.isArray(parsed.pairingReasons) ? parsed.pairingReasons : []
      ).map((reason: any) => ({
        id: reason.id || randomUUID(),
        dishId: reason.dishId || '',
        beverageId: reason.beverageId || '',
        reason: reason.reason || '',
        pairingType: reason.pairingType,
        score: reason.score,
      }));

      return { beverages, pairingReasons };
    }
  } catch (error) {
    console.error('解析推荐结果失败:', error);
  }

  return { beverages: [], pairingReasons: [] };
}

/**
 * 工具 3: 评估搭配
 * 评估当前搭配方案的质量
 */
async function evaluatePairing(input: {
  dishes: DishRecommendation[];
  beverages: BeverageRecommendation[];
  pairingReasons: PairingReason[];
}): Promise<{
  score: number;
  feedback: string;
  suggestions: string[];
}> {
  console.log('📊 [工具] 评估搭配质量');

  const prompt = `请评估以下菜品与酒品搭配方案的质量：

菜品数量：${input.dishes?.length || 0}
酒品数量：${input.beverages?.length || 0}
搭配理由数量：${input.pairingReasons.length}

请从以下维度评估：
1. 搭配的合理性（口味、风格是否匹配）
2. 推荐的完整性（是否每个菜品都有合适的酒品）
3. 搭配理由的详细程度
4. 整体方案的实用性

返回JSON格式：
{
  "score": 1-10的评分,
  "feedback": "评估反馈",
  "suggestions": ["改进建议1", "改进建议2", ...]
}`;

  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      {
        role: 'system',
        content: '你是一个专业的美食搭配评估专家，能够客观评估菜品与酒品搭配方案的质量。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      score: 5,
      feedback: '无法评估搭配质量',
      suggestions: [],
    };
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: parsed.score || 5,
        feedback: parsed.feedback || '评估完成',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    }
  } catch (error) {
    console.error('解析评估结果失败:', error);
  }

  return {
    score: 5,
    feedback: '评估完成，但无法解析详细结果',
    suggestions: [],
  };
}

/**
 * 工具 4: 完成结果
 * 整理并完成最终的推荐方案
 */
async function finalizeResult(input: {
  dishes: DishRecommendation[];
  beverages: BeverageRecommendation[];
  pairingReasons: PairingReason[];
}): Promise<CompletePairingRecommendation> {
  console.log('✅ [工具] 完成最终结果');

  const overallSuggestion = `为您推荐了 ${input.dishes.length} 个菜品和 ${input.beverages.length} 个酒品搭配方案。每个搭配都经过精心设计，确保口味和谐、风格匹配。请根据个人喜好选择合适的搭配。`;

  return {
    dishes: input.dishes,
    beverages: input.beverages,
    pairingReasons: input.pairingReasons,
    overallSuggestion,
    metadata: {
      timestamp: new Date().toISOString(),
      model: LLM_MODEL,
      dishCount: input.dishes.length,
      beverageCount: input.beverages.length,
      pairingCount: input.pairingReasons.length,
    },
  };
}

/**
 * 工具注册表
 */
export const TOOLS: Record<ToolName, Tool> = {
  search_dishes: {
    name: 'search_dishes',
    description: '根据原料和菜系搜索合适的菜品。输入：{ cuisine?: string, ingredients: string[] }',
    execute: searchDishes,
  },
  generate_recommendations: {
    name: 'generate_recommendations',
    description: '根据菜品生成酒品搭配推荐。输入：{ dishes: DishRecommendation[], drinkIngredients?: string[] }',
    execute: generateRecommendations,
  },
  evaluate_pairing: {
    name: 'evaluate_pairing',
    description: '评估当前搭配方案的质量。输入：{ dishes: DishRecommendation[], beverages: BeverageRecommendation[], pairingReasons: PairingReason[] }',
    execute: evaluatePairing,
  },
  finalize_result: {
    name: 'finalize_result',
    description: '整理并完成最终的推荐方案。输入：{ dishes: DishRecommendation[], beverages: BeverageRecommendation[], pairingReasons: PairingReason[] }',
    execute: finalizeResult,
  },
};

/**
 * 获取工具描述列表（用于 LLM 提示词）
 */
export function getToolsDescription(): string {
  return Object.values(TOOLS)
    .map(
      (tool) => `- ${tool.name}: ${tool.description}`
    )
    .join('\n');
}

/**
 * 执行工具
 */
export async function executeTool(toolName: ToolName, input: any): Promise<any> {
  const tool = TOOLS[toolName];
  if (!tool) {
    throw new Error(`未知工具: ${toolName}`);
  }
  return await tool.execute(input);
}

