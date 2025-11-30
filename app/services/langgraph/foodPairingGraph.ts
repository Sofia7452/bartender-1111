/**
 * LangGraph 图构建和边缘路由逻辑
 * 
 * 本文件定义了节点间的数据流转路径和决策点
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import type { FoodPairingState } from './foodPairingState';
import { FoodPairingStateSchema } from './foodPairingState';
import { dishRecommenderNode, beveragePairingNode } from './foodPairingNodes';

/**
 * 决策点 1: 验证菜品推荐结果
 * 在 dishRecommenderNode 后检查是否有有效的推荐结果
 * 
 * @param state 当前状态
 * @returns 下一个节点的名称
 */
export function shouldContinueToBeveragePairing(
  state: FoodPairingState
): string {
  // 检查是否有错误
  if (state.error) {
    console.log('⚠️ 检测到错误，终止流程:', state.error);
    return END;
  }

  // 检查是否有有效的菜品推荐
  const dishes = state.agent1Output;
  if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
    console.log('⚠️ 未生成有效的菜品推荐，终止流程');
    return END;
  }

  console.log(`✅ 菜品推荐验证通过，共 ${dishes.length} 个推荐，继续到酒品搭配节点`);
  return 'beverage_pairing';
}

/**
 * 决策点 2: 验证酒品搭配结果
 * 在 beveragePairingNode 后检查搭配是否成功
 * 
 * @param state 当前状态
 * @returns 下一个节点的名称（始终返回 END，但可以记录状态）
 */
export function shouldFinishPairing(state: FoodPairingState): string {
  // 检查是否有错误
  if (state.error) {
    console.log('⚠️ 检测到错误，但返回部分结果:', state.error);
    // 即使有错误，如果有部分结果，也返回
    return END;
  }

  // 检查是否有有效的搭配结果
  const pairingResult = state.agent2Output;
  if (!pairingResult) {
    console.log('⚠️ 未生成有效的酒品搭配，返回部分结果（仅菜品推荐）');
    return END;
  }

  console.log('✅ 酒品搭配完成，返回完整推荐方案');
  return END;
}

/**
 * 构建 LangGraph 图结构
 * 
 * 图结构：
 * START → dish_recommender → [条件判断] → beverage_pairing → [条件判断] → END
 * 
 * 步骤：
 * 1. 创建 StateGraph 实例
 * 2. 添加节点：dish_recommender 和 beverage_pairing
 * 3. 设置入口点：从 START 到 dish_recommender
 * 4. 添加条件边：从 dish_recommender 到 beverage_pairing 或 END
 * 5. 添加条件边：从 beverage_pairing 到 END
 * 6. 编译图
 * 
 * @returns 编译后的图实例
 */
export function buildFoodPairingGraph() {
  console.log('🔧 开始构建 LangGraph 图结构...');

  // 步骤 1: 创建状态图
  // LangGraph 使用 StateGraph 来管理状态流转
  // 使用 Zod Schema 定义状态结构
  const graph = new StateGraph(FoodPairingStateSchema);

  // 步骤 2: 添加节点
  // 节点 1: 菜品推荐节点
  graph.addNode('dish_recommender', dishRecommenderNode);
  // 节点 2: 酒品搭配节点
  graph.addNode('beverage_pairing', beveragePairingNode);

  // 步骤 3: 设置入口点
  // 从 START 节点进入，首先执行 dish_recommender 节点
  // 使用 addEdge 而不是 setEntryPoint（LangGraph API 变更）
  graph.addEdge(START, 'dish_recommender');

  // 步骤 4: 添加条件边 - 从 dish_recommender 到下一个节点
  // 根据 shouldContinueToBeveragePairing 的返回值决定路由
  graph.addConditionalEdges(
    'dish_recommender', // 源节点
    shouldContinueToBeveragePairing, // 路由函数
    {
      // 路由映射：返回值 -> 目标节点
      beverage_pairing: 'beverage_pairing', // 如果返回 'beverage_pairing'，继续到酒品搭配节点
      [END]: END, // 如果返回 END，直接结束流程
    }
  );

  // 步骤 5: 添加条件边 - 从 beverage_pairing 到 END
  // 无论成功或失败，都结束流程
  graph.addConditionalEdges(
    'beverage_pairing', // 源节点
    shouldFinishPairing, // 路由函数
    {
      [END]: END, // 始终返回 END
    }
  );

  // 步骤 6: 编译图
  // 编译后的图可以执行，接收初始状态并返回最终状态
  const compiledGraph = graph.compile();

  console.log('✅ LangGraph 图结构构建完成');
  console.log('📊 图结构：START → dish_recommender → [条件判断] → beverage_pairing → [条件判断] → END');

  return compiledGraph;
}

/**
 * 图结构说明
 * 
 * 节点流程：
 * 1. START → dish_recommender (菜品推荐节点)
 *    - 输入：用户输入的菜系和食品原料
 *    - 输出：菜品推荐列表
 *    - 决策：如果推荐为空或出错，直接结束；否则继续
 * 
 * 2. dish_recommender → beverage_pairing (酒品搭配节点)
 *    - 输入：Agent 1 的菜品推荐 + 用户输入的酒原料
 *    - 输出：完整的搭配推荐方案
 *    - 决策：无论成功或失败，都结束流程
 * 
 * 3. beverage_pairing → END
 *    - 返回最终结果（成功或部分结果）
 */

