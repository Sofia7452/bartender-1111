/**
 * LangGraph 节点实现
 * 
 * 本文件实现了菜品与酒品搭配推荐系统的两个核心节点：
 * 1. 菜品推荐节点 (dishRecommenderNode)
 * 2. 酒品搭配节点 (beveragePairingNode)
 */

import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { env } from '../../lib/env';
import type { FoodPairingState } from './foodPairingState';
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
 * 节点 1: 菜品推荐节点
 * 根据用户输入的菜系和原料，生成菜品推荐列表
 */
export async function dishRecommenderNode(
  state: FoodPairingState
): Promise<Partial<FoodPairingState>> {
  console.log('🍽️ 开始执行菜品推荐节点...');
  const startTime = Date.now();

  try {
    const { cuisine, foodIngredients } = state.userInput;

    // 构建提示词
    const prompt = buildDishRecommendationPrompt(cuisine, foodIngredients);

    // 调用 LLM 生成推荐
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的厨师和美食顾问，擅长根据现有原料和菜系推荐合适的菜品。请提供详细、准确的菜品信息，包括所需食材、烹饪步骤等。',
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
      throw new Error('LLM 返回内容为空');
    }

    // 解析推荐结果
    const dishes = parseDishRecommendations(content, cuisine || '通用');

    if (dishes.length === 0) {
      throw new Error('未能生成有效的菜品推荐');
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ 菜品推荐完成，生成了 ${dishes.length} 个推荐，耗时 ${executionTime}ms`);

    // 更新状态
    return {
      agent1Output: dishes,
      metadata: {
        ...state.metadata,
        executionTime: (state.metadata?.executionTime || 0) + executionTime,
        model: LLM_MODEL,
      },
    };
  } catch (error: any) {
    console.error('❌ 菜品推荐节点执行失败:', error);
    const errorMessage =
      error?.message || '菜品推荐失败，请检查输入参数和 LLM 配置';
    return {
      error: errorMessage,
      agent1Output: null,
    };
  }
}

/**
 * 节点 2: 酒品搭配节点
 * 根据 Agent 1 输出的菜品推荐和用户输入的酒原料，生成酒品搭配建议
 */
export async function beveragePairingNode(
  state: FoodPairingState
): Promise<Partial<FoodPairingState>> {
  console.log('🍷 开始执行酒品搭配节点...');
  const startTime = Date.now();

  try {
    const dishes = state.agent1Output as DishRecommendation[] | null;
    const drinkIngredients = state.userInput.drinkIngredients || [];

    if (!dishes || dishes.length === 0) {
      throw new Error('缺少菜品推荐数据，无法进行酒品搭配');
    }

    // 构建提示词
    const prompt = buildBeveragePairingPrompt(dishes, drinkIngredients);

    // 调用 LLM 生成推荐
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的调酒师和美食搭配顾问，擅长根据菜品推荐合适的酒品搭配。请提供详细的搭配理由和完整的酒品配方信息。',
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
      throw new Error('LLM 返回内容为空');
    }

    // 解析推荐结果
    const pairingResult = parseBeveragePairing(content, dishes);

    const executionTime = Date.now() - startTime;
    console.log(
      `✅ 酒品搭配完成，生成了 ${pairingResult.beverages.length} 个酒品推荐，${pairingResult.pairingReasons.length} 个搭配理由，耗时 ${executionTime}ms`
    );

    // 更新状态
    return {
      agent2Output: pairingResult,
      metadata: {
        ...state.metadata,
        executionTime: (state.metadata?.executionTime || 0) + executionTime,
        model: LLM_MODEL,
      },
    };
  } catch (error: any) {
    console.error('❌ 酒品搭配节点执行失败:', error);
    const errorMessage =
      error?.message || '酒品搭配失败，请检查输入参数和 LLM 配置';
    return {
      error: errorMessage,
      agent2Output: null,
    };
  }
}

/**
 * 构建菜品推荐提示词
 */
function buildDishRecommendationPrompt(
  cuisine: string | null | undefined,
  ingredients: string[]
): string {
  const cuisinePart = cuisine
    ? `\n菜系要求：${cuisine}`
    : '\n菜系要求：不限，可根据原料自由选择';
  return `基于以下原料，推荐3-5个适合的菜品：

原料列表：${ingredients.join('、')}${cuisinePart}

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
}

/**
 * 构建酒品搭配提示词
 */
function buildBeveragePairingPrompt(
  dishes: DishRecommendation[],
  drinkIngredients: string[]
): string {
  const dishesInfo = dishes
    .map(
      (dish, index) =>
        `${index + 1}. ${dish.name} (${dish.cuisine}) - ${dish.description}`
    )
    .join('\n');

  const ingredientsPart =
    drinkIngredients.length > 0
      ? `\n用户提供的酒原料：${drinkIngredients.join('、')}`
      : '\n用户未提供酒原料，请根据菜品自由推荐合适的酒品';

  return `基于以下推荐的菜品，为每个菜品推荐1-2个合适的酒品搭配：

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
  ],
  "overallSuggestion": "整体搭配建议和说明"
}

请确保：
1. 每个菜品至少推荐1个酒品
2. 搭配理由要详细说明为什么这个酒品适合这个菜品
3. 如果用户提供了酒原料，尽量使用这些原料
4. 返回有效的JSON格式`;
}

/**
 * 解析菜品推荐结果
 */
function parseDishRecommendations(
  content: string,
  defaultCuisine: string
): DishRecommendation[] {
  try {
    // 尝试直接解析JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((dish: any) => ({
        id: dish.id || randomUUID(),
        name: dish.name || '未知菜品',
        description: dish.description || '',
        cuisine: dish.cuisine || defaultCuisine,
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
    console.error('解析菜品推荐失败:', error);
  }

  // 如果解析失败，返回空数组
  return [];
}

/**
 * 解析酒品搭配结果
 */
function parseBeveragePairing(
  content: string,
  dishes: DishRecommendation[]
): CompletePairingRecommendation {
  try {
    // 尝试直接解析JSON
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

      return {
        dishes,
        beverages,
        pairingReasons,
        overallSuggestion:
          parsed.overallSuggestion ||
          '请根据个人口味选择合适的搭配方案。',
        metadata: {
          timestamp: new Date().toISOString(),
          model: LLM_MODEL,
          dishCount: dishes.length,
          beverageCount: beverages.length,
          pairingCount: pairingReasons.length,
        },
      };
    }
  } catch (error) {
    console.error('解析酒品搭配结果失败:', error);
  }

  // 如果解析失败，返回默认结果
  return {
    dishes,
    beverages: [],
    pairingReasons: [],
    overallSuggestion: '抱歉，未能生成有效的酒品搭配推荐。',
    metadata: {
      timestamp: new Date().toISOString(),
      model: LLM_MODEL,
      dishCount: dishes.length,
      beverageCount: 0,
      pairingCount: 0,
    },
  };
}

