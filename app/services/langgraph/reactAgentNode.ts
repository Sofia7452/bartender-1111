/**
 * ReAct Agent 节点实现
 * 
 * 本文件实现了基于 ReAct (Reasoning + Acting) 模式的 Agent 节点
 * ReAct 模式通过思考-行动-观察循环来完成任务
 */

import { END } from '@langchain/langgraph';
import OpenAI from 'openai';
import { env } from '../../lib/env';
import type { FoodPairingState } from './foodPairingState';
import { TOOLS, getToolsDescription, executeTool, type ToolName } from './reactTools';
import type {
  DishRecommendation,
  BeverageRecommendation,
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
 * 最大 ReAct 循环次数
 */
const MAX_REACT_ITERATIONS = 5;

/**
 * ReAct Agent 节点
 * 
 * 实现思考-行动-观察循环：
 * 1. Thought（思考）：分析当前情况，决定下一步行动
 * 2. Action（行动）：执行选定的工具
 * 3. Observation（观察）：获取行动结果，评估是否需要继续
 */
export async function reactAgentNode(
  state: FoodPairingState
): Promise<Partial<FoodPairingState>> {
  console.log('🤖 开始执行 ReAct Agent 节点...');
  const startTime = Date.now();

  try {
    const reactState = state.reactState || {
      thought: null,
      action: null,
      actionInput: null,
      observation: null,
      reactIteration: 0,
      isFinished: false,
    };

    // 如果已经完成，直接返回
    if (reactState.isFinished) {
      console.log('✅ ReAct Agent 已完成任务');
      return state;
    }

    // 检查是否超过最大循环次数
    if (reactState.reactIteration >= MAX_REACT_ITERATIONS) {
      console.warn('⚠️ 达到最大 ReAct 循环次数，强制完成');
      return {
        reactState: {
          ...reactState,
          isFinished: true,
          thought: '已达到最大循环次数，完成任务',
        },
        error: 'ReAct Agent 达到最大循环次数',
      };
    }

    const currentIteration = reactState.reactIteration + 1;
    console.log(`🔄 ReAct 循环第 ${currentIteration} 次迭代`);

    // 构建 ReAct 提示词
    const prompt = buildReActPrompt(state, reactState);

    // 调用 LLM 进行思考并决定行动
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: `你是一个智能的菜品与酒品搭配推荐 Agent，使用 ReAct (Reasoning + Acting) 模式来完成任务。

你的工作流程：
1. 思考（Thought）：分析当前情况，决定下一步需要做什么
2. 行动（Action）：选择一个工具来执行
3. 观察（Observation）：获取工具执行结果，评估是否需要继续

可用工具：
${getToolsDescription()}

请按照以下格式输出：
Thought: [你的思考过程]
Action: [工具名称]
Action Input: [工具的输入参数，JSON格式]

如果任务已完成，使用 finalize_result 工具来整理最终结果。`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 返回内容为空');
    }

    // 解析 ReAct 输出
    const { thought, action, actionInput } = parseReActOutput(content);

    console.log(`💭 思考: ${thought}`);
    console.log(`🎯 行动: ${action}`);
    console.log(`📥 行动输入:`, actionInput);

    // 执行工具
    let observation: string;
    let updatedState: Partial<FoodPairingState> = {};

    try {
      // 对于 generate_recommendations 工具，如果 actionInput 中没有 dishes，从状态中获取
      if (action === 'generate_recommendations' && actionInput) {
        const dishes = (state.agent1Output as DishRecommendation[]) || [];
        if (!actionInput.dishes && dishes.length > 0) {
          console.log('📝 从状态中获取菜品列表，补充到工具输入中');
          actionInput.dishes = dishes;
        }
      }

      const toolResult = await executeTool(action as ToolName, actionInput);
      observation = JSON.stringify(toolResult, null, 2);
      console.log(`👀 观察: 工具执行成功`);

      // 根据工具结果更新状态
      if (action === 'search_dishes') {
        updatedState.agent1Output = toolResult as DishRecommendation[];
      } else if (action === 'generate_recommendations') {
        const { beverages, pairingReasons } = toolResult as {
          beverages: BeverageRecommendation[];
          pairingReasons: any[];
        };
        const dishes = (state.agent1Output as DishRecommendation[]) || [];
        updatedState.agent2Output = {
          dishes,
          beverages,
          pairingReasons,
        } as Partial<CompletePairingRecommendation>;
      } else if (action === 'finalize_result') {
        updatedState.agent2Output = toolResult as CompletePairingRecommendation;
        updatedState.reactState = {
          ...reactState,
          thought,
          action,
          actionInput,
          observation: '任务完成',
          reactIteration: currentIteration,
          isFinished: true,
        };
        return updatedState;
      }
    } catch (error: any) {
      observation = `工具执行失败: ${error.message}`;
      console.error(`❌ 工具执行失败:`, error);
    }

    // 更新 ReAct 状态
    const newReactState = {
      ...reactState,
      thought,
      action,
      actionInput,
      observation,
      reactIteration: currentIteration,
      isFinished: action === 'finalize_result',
    };

    const executionTime = Date.now() - startTime;
    console.log(`✅ ReAct 迭代 ${currentIteration} 完成，耗时 ${executionTime}ms`);

    return {
      ...updatedState,
      reactState: newReactState,
      metadata: {
        timestamp: state.metadata?.timestamp || new Date().toISOString(),
        executionTime: (state.metadata?.executionTime || 0) + executionTime,
        model: LLM_MODEL,
      },
    };
  } catch (error: any) {
    console.error('❌ ReAct Agent 节点执行失败:', error);
    const errorMessage = error?.message || 'ReAct Agent 执行失败';
    return {
      error: errorMessage,
      reactState: {
        ...state.reactState,
        reactIteration: state.reactState?.reactIteration || 0,
        isFinished: true,
        observation: errorMessage,
      },
    };
  }
}

/**
 * 构建 ReAct 提示词
 */
function buildReActPrompt(
  state: FoodPairingState,
  reactState: NonNullable<FoodPairingState['reactState']>
): string {
  const { cuisine, foodIngredients, drinkIngredients } = state.userInput;
  const dishes = state.agent1Output as DishRecommendation[] | null;
  const pairingResult = state.agent2Output as CompletePairingRecommendation | null;

  let prompt = `任务：根据用户输入的原料和菜系，推荐合适的菜品和酒品搭配方案。

用户输入：
- 菜系：${cuisine || '不限'}
- 食品原料：${foodIngredients.join('、')}
- 酒原料：${drinkIngredients?.join('、') || '未提供'}

当前状态：`;

  if (dishes && dishes.length > 0) {
    prompt += `\n- 已找到 ${dishes.length} 个菜品推荐`;
  } else {
    prompt += `\n- 尚未搜索菜品`;
  }

  if (pairingResult) {
    prompt += `\n- 已生成 ${pairingResult.beverages.length} 个酒品推荐`;
  } else {
    prompt += `\n- 尚未生成酒品推荐`;
  }

  if (reactState.thought) {
    prompt += `\n\n之前的思考：${reactState.thought}`;
  }
  if (reactState.action) {
    prompt += `\n之前的行动：${reactState.action}`;
  }
  if (reactState.observation) {
    prompt += `\n之前的观察：${reactState.observation}`;
  }

  prompt += `\n\n请继续思考下一步应该做什么，并选择相应的工具。`;

  return prompt;
}

/**
 * 解析 ReAct 输出
 */
function parseReActOutput(content: string): {
  thought: string;
  action: string;
  actionInput: any;
} {
  let thought = '';
  let action = '';
  let actionInput: any = null;

  // 提取 Thought
  const thoughtMatch = content.match(/Thought:\s*([\s\S]+?)(?:\n\s*Action:|$)/);
  if (thoughtMatch) {
    thought = thoughtMatch[1].trim();
  }

  // 提取 Action
  const actionMatch = content.match(/Action:\s*([\s\S]+?)(?:\n\s*Action Input:|$)/);
  if (actionMatch) {
    action = actionMatch[1].trim();
  }

  // 提取 Action Input
  const actionInputMatch = content.match(/Action Input:\s*(\{[\s\S]*\}|[\s\S]+?)(?:\n|$)/);
  if (actionInputMatch) {
    try {
      const inputStr = actionInputMatch[1].trim();
      if (inputStr.startsWith('{')) {
        actionInput = JSON.parse(inputStr);
      } else {
        actionInput = inputStr;
      }
    } catch (error) {
      console.warn('解析 Action Input 失败，使用原始字符串');
      actionInput = actionInputMatch[1].trim();
    }
  }

  return { thought, action, actionInput };
}

/**
 * 判断 ReAct Agent 是否应该继续
 */
export function shouldContinueReAct(state: FoodPairingState): string {
  const reactState = state.reactState;

  if (!reactState) {
    return 'react_agent';
  }

  if (reactState.isFinished) {
    console.log('✅ ReAct Agent 已完成任务');
    return END;
  }

  if (reactState.reactIteration >= MAX_REACT_ITERATIONS) {
    console.warn('⚠️ ReAct Agent 达到最大循环次数');
    return END;
  }

  // 如果还没有完成，继续循环
  return 'react_agent';
}

