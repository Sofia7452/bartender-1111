# ReAct Agent 模式说明

## 概述

本项目已集成 ReAct (Reasoning + Acting) Agent 模式，这是一种结合推理和行动的智能 Agent 架构。ReAct Agent 通过**思考-行动-观察**循环来完成任务，能够更智能地处理复杂的推荐任务。

## ReAct 模式工作原理

### 核心循环

1. **思考（Thought）**：Agent 分析当前情况，决定下一步需要做什么
2. **行动（Action）**：执行选定的工具（如搜索菜品、生成推荐等）
3. **观察（Observation）**：获取行动结果，评估是否需要继续
4. **循环**：重复上述过程直到任务完成

### 工作流程

```
START → ReAct Agent → [思考] → [行动] → [观察] → [判断]
                                    ↓
                              [继续循环] 或 [完成任务] → END
```

## 工具集

ReAct Agent 可以使用以下工具：

### 1. `search_dishes`
- **功能**：根据原料和菜系搜索合适的菜品
- **输入**：`{ cuisine?: string, ingredients: string[] }`
- **输出**：`DishRecommendation[]`

### 2. `generate_recommendations`
- **功能**：根据菜品生成酒品搭配推荐
- **输入**：`{ dishes: DishRecommendation[], drinkIngredients?: string[] }`
- **输出**：`{ beverages: BeverageRecommendation[], pairingReasons: PairingReason[] }`

### 3. `evaluate_pairing`
- **功能**：评估当前搭配方案的质量
- **输入**：`{ dishes: DishRecommendation[], beverages: BeverageRecommendation[], pairingReasons: PairingReason[] }`
- **输出**：`{ score: number, feedback: string, suggestions: string[] }`

### 4. `finalize_result`
- **功能**：整理并完成最终的推荐方案
- **输入**：`{ dishes: DishRecommendation[], beverages: BeverageRecommendation[], pairingReasons: PairingReason[] }`
- **输出**：`CompletePairingRecommendation`

## 使用方法

### 默认使用 ReAct 模式

```typescript
import { getFoodPairingService } from './services/langgraphService';

// 默认使用 ReAct 模式
const service = getFoodPairingService();

const result = await service.execute({
  cuisine: '川菜',
  foodIngredients: ['牛肉', '土豆', '洋葱'],
  drinkIngredients: ['威士忌', '柠檬'],
});
```

### 使用传统模式

如果需要使用传统的两阶段模式（先推荐菜品，再推荐酒品），可以这样：

```typescript
import { FoodPairingLangGraphService } from './services/langgraphService';

// 使用传统模式
const service = new FoodPairingLangGraphService(false);

const result = await service.execute({
  cuisine: '川菜',
  foodIngredients: ['牛肉', '土豆', '洋葱'],
  drinkIngredients: ['威士忌', '柠檬'],
});
```

## 状态结构

ReAct Agent 的状态包含以下字段：

```typescript
{
  // 用户输入
  userInput: {
    cuisine?: string | null;
    foodIngredients: string[];
    drinkIngredients?: string[];
  },
  
  // Agent 输出
  agent1Output: DishRecommendation[] | null,
  agent2Output: CompletePairingRecommendation | null,
  
  // ReAct 状态
  reactState: {
    thought: string | null,        // 当前思考
    action: string | null,          // 当前行动
    actionInput: any,               // 行动输入
    observation: string | null,     // 观察结果
    reactIteration: number,         // 循环次数
    isFinished: boolean,            // 是否完成
  },
  
  // 错误和元数据
  error: string | null,
  metadata: {
    timestamp: string,
    executionTime?: number,
    model?: string,
  }
}
```

## 配置参数

### 最大循环次数

默认最大 ReAct 循环次数为 5 次，可以在 `reactAgentNode.ts` 中修改：

```typescript
const MAX_REACT_ITERATIONS = 5; // 可根据需要调整
```

## 优势

1. **更智能的决策**：Agent 可以根据当前状态动态决定下一步行动
2. **更好的错误处理**：如果某个工具执行失败，Agent 可以尝试其他方法
3. **可扩展性**：可以轻松添加新工具，Agent 会自动学习使用
4. **透明度**：可以查看 Agent 的思考过程，便于调试和优化

## 与传统模式的对比

| 特性 | ReAct 模式 | 传统模式 |
|------|-----------|---------|
| 决策方式 | 动态决策 | 固定流程 |
| 灵活性 | 高 | 中 |
| 可扩展性 | 高 | 低 |
| 执行时间 | 可能较长（多轮循环） | 较快（固定流程） |
| 适用场景 | 复杂任务、需要动态调整 | 简单任务、固定流程 |

## 文件结构

```
app/services/langgraph/
├── foodPairingState.ts      # 状态定义（已扩展支持 ReAct）
├── foodPairingGraph.ts      # 图结构（支持两种模式）
├── foodPairingNodes.ts      # 传统节点实现
├── reactTools.ts            # ReAct 工具集
└── reactAgentNode.ts        # ReAct Agent 节点实现
```

## 注意事项

1. ReAct 模式可能会产生更多的 LLM 调用，因此成本可能更高
2. 如果任务简单，传统模式可能更快
3. 可以通过观察 `reactState` 来了解 Agent 的决策过程
4. 如果达到最大循环次数仍未完成，会返回部分结果或错误

## 未来改进

1. 添加更多工具（如搜索数据库、调用外部 API 等）
2. 实现工具缓存机制，减少重复调用
3. 添加工具执行历史记录
4. 支持自定义工具注册
5. 优化提示词，提高 Agent 决策质量

