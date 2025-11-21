# LangGraph 多 Agent 系统开发任务清单

## 项目概述
使用 LangGraph 框架构建一个多 Agent 系统，实现"根据现有原料完成菜系和酒品搭配推荐"功能。

---

## Epic 1: Agent 定义
独立定义 Agent 1 和 Agent 2 的功能和输入/输出接口

### Epic 1.1: 定义 Agent 1 (菜品推荐 Agent) 的接口
- [ ] **任务描述**: 定义 Agent 1 的输入输出接口规范
- [ ] **输入定义**:
  - 菜系类型（Cuisine Type）: `string | null` - 可选，如 "川菜"、"日料"、"西餐" 等
  - 现有原料列表（Ingredients）: `string[]` - 必需，如 ["牛肉", "土豆", "洋葱"]
- [ ] **输出定义**:
  - 菜品推荐列表: `DishRecommendation[]`
  - 每个推荐包含:
    - `id`: string - 唯一标识
    - `name`: string - 菜品名称
    - `description`: string - 菜品描述
    - `cuisine`: string - 所属菜系
    - `requiredIngredients`: string[] - 所需食材列表
    - `cookingTime`: number - 烹饪时间（分钟）
    - `difficulty`: number - 难度等级（1-5）
    - `steps`: string[] - 烹饪步骤
- [ ] **创建类型定义文件**: `app/types/foodPairing.ts`

### Epic 1.2: 定义 Agent 2 (酒品搭配 Agent) 的接口
- [ ] **任务描述**: 定义 Agent 2 的输入输出接口规范
- [ ] **输入定义**:
  - Agent 1 输出的菜品推荐列表: `DishRecommendation[]`
  - 用户输入的酒原料（Drink Ingredients）: `string[]` - 可选，如 ["威士忌", "柠檬", "糖浆"]
- [ ] **输出定义**:
  - 完整推荐方案: `CompletePairingRecommendation`
  - 包含:
    - `dishes`: `DishRecommendation[]` - 推荐的菜品列表
    - `beverages`: `BeverageRecommendation[]` - 推荐的酒品列表
    - `pairingReasons`: `PairingReason[]` - 每个搭配的详细理由
    - `overallSuggestion`: string - 整体搭配建议
- [ ] **更新类型定义文件**: 在 `app/types/foodPairing.ts` 中添加相关类型

---

## Epic 2: LangGraph 架构设计
设计状态（State）、节点（Nodes）和边缘（Edges），创建清晰的决策点

### Epic 2.1: 定义 LangGraph 状态模式（State Schema）
- [ ] **任务描述**: 使用 Zod 定义 LangGraph 的状态结构
- [ ] **状态字段设计**:
  - `userInput`: 
    - `cuisine`: `string | null`
    - `foodIngredients`: `string[]`
    - `drinkIngredients`: `string[]`
  - `agent1Output`: `DishRecommendation[] | null` - Agent 1 的输出结果
  - `agent2Output`: `CompletePairingRecommendation | null` - Agent 2 的输出结果
  - `error`: `string | null` - 错误信息
  - `metadata`: 
    - `timestamp`: `string`
    - `executionTime`: `number`
- [ ] **创建状态定义文件**: `app/services/langgraph/foodPairingState.ts`

### Epic 2.2: 实现 LangGraph 节点
- [ ] **任务描述**: 实现两个核心节点函数
- [ ] **节点 1: 菜品推荐节点 (dishRecommenderNode)**
  - 接收状态中的 `userInput.cuisine` 和 `userInput.foodIngredients`
  - 调用 LLM 生成菜品推荐
  - 解析并验证输出格式
  - 更新状态中的 `agent1Output`
- [ ] **节点 2: 酒品搭配节点 (beveragePairingNode)**
  - 接收状态中的 `agent1Output` 和 `userInput.drinkIngredients`
  - 调用 LLM 生成酒品搭配建议
  - 生成搭配理由
  - 更新状态中的 `agent2Output`
- [ ] **创建节点实现文件**: `app/services/langgraph/foodPairingNodes.ts`

### Epic 2.3: 设计并实现边缘路由逻辑
- [ ] **任务描述**: 定义节点间的数据流转路径
- [ ] **路由设计**:
  - **入口边**: `START` → `dishRecommenderNode`
  - **中间边**: `dishRecommenderNode` → `beveragePairingNode`
  - **出口边**: `beveragePairingNode` → `END`
- [ ] **决策点设计**:
  - 在 `dishRecommenderNode` 后添加验证：如果推荐为空，直接跳转到错误处理
  - 在 `beveragePairingNode` 后添加验证：如果搭配失败，返回部分结果
- [ ] **创建路由配置文件**: `app/services/langgraph/foodPairingGraph.ts`

### Epic 2.4: 构建完整的 LangGraph 图结构
- [ ] **任务描述**: 使用 StateGraph 创建完整的图
- [ ] **图构建步骤**:
  1. 导入 `StateGraph` 从 `@langchain/langgraph`
  2. 创建 StateGraph 实例，传入状态模式
  3. 添加节点: `addNode("dish_recommender", dishRecommenderNode)`
  4. 添加节点: `addNode("beverage_pairing", beveragePairingNode)`
  5. 设置入口点: `setEntryPoint("dish_recommender")`
  6. 添加边缘: `addEdge("dish_recommender", "beverage_pairing")`
  7. 添加边缘: `addEdge("beverage_pairing", END)`
  8. 编译图: `graph.compile()`
- [ ] **更新图构建文件**: 在 `app/services/langgraph/foodPairingGraph.ts` 中完成图构建

---

## Epic 3: 后端 API 实现
实现调用 LangGraph 模型的后端 API 接口

### Epic 3.1: 安装 LangGraph 依赖
- [ ] **任务描述**: 确保所有必要的依赖已安装
- [ ] **检查依赖**: 确认 `package.json` 中包含:
  - `@langchain/langgraph`: "^1.0.0" 或更高版本
  - `@langchain/core`: "^1.0.1" (已存在)
  - `@langchain/openai`: "^1.0.0" (已存在)
  - `zod`: "^4.1.12" (已存在)
- [ ] **安装命令**: 如果缺失，运行 `npm install @langchain/langgraph`

### Epic 3.2: 创建 LangGraph 服务文件
- [ ] **任务描述**: 创建服务层封装图构建和执行逻辑
- [ ] **服务类设计**: `FoodPairingLangGraphService`
  - `constructor()`: 初始化 LLM 客户端和状态模式
  - `buildGraph()`: 构建并返回编译后的 LangGraph 实例
  - `execute(input)`: 执行图，接收用户输入，返回完整推荐方案
  - `validateInput(input)`: 验证输入参数
- [ ] **创建服务文件**: `app/services/langgraphService.ts`

### Epic 3.3: 创建 API 路由
- [ ] **任务描述**: 创建新的 API 端点处理前端请求
- [ ] **路由设计**: `app/api/food-pairing/route.ts`
  - `POST` 方法:
    - 接收请求体: `{ cuisine?: string, foodIngredients: string[], drinkIngredients?: string[] }`
    - 调用 `FoodPairingLangGraphService.execute()`
    - 返回标准化响应: `{ success: boolean, data: CompletePairingRecommendation, error?: string }`
  - `GET` 方法: 健康检查端点
- [ ] **错误处理**: 
  - 输入验证错误 (400)
  - 服务执行错误 (500)
  - 超时处理

### Epic 3.4: 实现错误处理和响应格式化
- [ ] **任务描述**: 添加完善的错误处理和日志记录
- [ ] **错误处理策略**:
  - 捕获 LangGraph 执行异常
  - 记录详细错误日志（包含堆栈跟踪）
  - 返回用户友好的错误消息
- [ ] **响应格式化**:
  - 成功响应: `{ success: true, data: {...}, metadata: {...} }`
  - 错误响应: `{ success: false, error: string, details?: any }`
- [ ] **日志记录**: 使用 `console.log` 记录关键执行步骤

---

## Epic 5: 数据库设计与实现
设计并实现数据库模型，支持菜品推荐、酒品搭配和历史记录存储

### Epic 5.1: 设计数据库模型（Prisma Schema）
- [ ] **任务描述**: 在 Prisma Schema 中设计新的数据模型
- [ ] **模型设计**:
  - **Dish 模型**: 存储菜品推荐
    - `id`: UUID (主键)
    - `name`: String - 菜品名称
    - `description`: String? - 菜品描述
    - `cuisine`: String? - 所属菜系
    - `requiredIngredients`: Json - 所需食材列表 (string[])
    - `cookingTime`: Int - 烹饪时间（分钟）
    - `difficulty`: Int - 难度等级（1-5）
    - `steps`: Json - 烹饪步骤 (string[])
    - `source`: String? - 来源
    - `createdAt`: DateTime
    - `updatedAt`: DateTime
  - **Beverage 模型**: 存储酒品推荐
    - `id`: UUID (主键)
    - `name`: String - 酒品名称
    - `description`: String? - 酒品描述
    - `ingredients`: Json - 原料列表 (string[])
    - `steps`: Json - 制作步骤 (string[])
    - `category`: String? - 分类（如：鸡尾酒、红酒等）
    - `glassType`: String? - 杯型
    - `technique`: String? - 调制技巧
    - `garnish`: String? - 装饰
    - `difficulty`: Int - 难度等级
    - `estimatedTime`: Int - 预估时间
    - `createdAt`: DateTime
    - `updatedAt`: DateTime
  - **FoodPairingHistory 模型**: 存储完整的搭配推荐历史
    - `id`: UUID (主键)
    - `sessionId`: String - 会话ID
    - `cuisine`: String? - 用户输入的菜系
    - `foodIngredients`: Json - 食品原料 (string[])
    - `drinkIngredients`: Json - 酒原料 (string[])
    - `recommendedDishes`: Json - 推荐的菜品列表 (DishRecommendation[])
    - `recommendedBeverages`: Json - 推荐的酒品列表 (BeverageRecommendation[])
    - `pairingReasons`: Json - 搭配理由列表 (PairingReason[])
    - `overallSuggestion`: String? - 整体搭配建议
    - `metadata`: Json? - 元数据（执行时间、模型信息等）
    - `createdAt`: DateTime
  - **DishFavorite 模型**: 扩展收藏功能，支持收藏菜品
    - `id`: UUID (主键)
    - `sessionId`: String - 会话ID
    - `dishId`: UUID - 菜品ID
    - `createdAt`: DateTime
    - 关联: `dish Dish @relation(...)`
  - **BeverageFavorite 模型**: 扩展收藏功能，支持收藏酒品
    - `id`: UUID (主键)
    - `sessionId`: String - 会话ID
    - `beverageId`: UUID - 酒品ID
    - `createdAt`: DateTime
    - 关联: `beverage Beverage @relation(...)`
- [ ] **更新文件**: `prisma/schema.prisma`

### Epic 5.2: 创建数据库迁移
- [ ] **任务描述**: 生成并应用 Prisma 迁移
- [ ] **迁移步骤**:
  1. 运行 `npx prisma migrate dev --name add_food_pairing_models` 生成迁移文件
  2. 检查生成的 SQL 迁移文件，确保字段和索引正确
  3. 验证迁移文件中的外键约束和索引
  4. 应用迁移到数据库
- [ ] **索引优化**:
  - `FoodPairingHistory`: 在 `sessionId` 和 `createdAt` 上创建复合索引
  - `DishFavorite`: 在 `sessionId` 和 `dishId` 上创建唯一索引
  - `BeverageFavorite`: 在 `sessionId` 和 `beverageId` 上创建唯一索引
- [ ] **验证迁移**: 运行 `npx prisma generate` 更新 Prisma Client

### Epic 5.3: 创建数据库服务层
- [ ] **任务描述**: 创建数据库操作服务，封装 Prisma 操作
- [ ] **服务类设计**: `FoodPairingDatabaseService`
  - `saveDish(dishData)`: 保存菜品到数据库，如果已存在则更新
  - `saveBeverage(beverageData)`: 保存酒品到数据库，如果已存在则更新
  - `savePairingHistory(historyData)`: 保存完整的搭配推荐历史
  - `getPairingHistory(sessionId, page, limit)`: 获取用户的推荐历史（分页）
  - `addDishFavorite(sessionId, dishId)`: 收藏菜品
  - `removeDishFavorite(sessionId, dishId)`: 取消收藏菜品
  - `addBeverageFavorite(sessionId, beverageId)`: 收藏酒品
  - `removeBeverageFavorite(sessionId, beverageId)`: 取消收藏酒品
  - `getDishFavorites(sessionId)`: 获取收藏的菜品列表
  - `getBeverageFavorites(sessionId)`: 获取收藏的酒品列表
- [ ] **创建服务文件**: `app/services/foodPairingDatabaseService.ts`

### Epic 5.4: 在 API 中集成数据库操作
- [ ] **任务描述**: 在 API 路由中集成数据库服务，实现数据持久化
- [ ] **API 集成点**:
  - **POST /api/food-pairing**: 
    - 执行 LangGraph 后，将推荐的菜品和酒品保存到数据库
    - 保存完整的搭配历史到 `FoodPairingHistory` 表
    - 返回结果中包含数据库生成的 ID
  - **GET /api/food-pairing/history**: 新增端点，获取用户的推荐历史
  - **POST /api/food-pairing/favorites/dish**: 新增端点，收藏菜品
  - **DELETE /api/food-pairing/favorites/dish**: 新增端点，取消收藏菜品
  - **POST /api/food-pairing/favorites/beverage**: 新增端点，收藏酒品
  - **DELETE /api/food-pairing/favorites/beverage**: 新增端点，取消收藏酒品
- [ ] **错误处理**: 
  - 数据库连接错误
  - 唯一约束冲突（重复收藏）
  - 数据验证错误
- [ ] **更新文件**: 
  - `app/api/food-pairing/route.ts` - 集成保存逻辑
  - 创建 `app/api/food-pairing/history/route.ts`
  - 创建 `app/api/food-pairing/favorites/dish/route.ts`
  - 创建 `app/api/food-pairing/favorites/beverage/route.ts`

### Epic 5.5: 更新类型定义以匹配数据库模型
- [ ] **任务描述**: 确保 TypeScript 类型定义与 Prisma 模型一致
- [ ] **类型更新**:
  - 在 `app/types/foodPairing.ts` 中添加数据库模型对应的类型
  - 确保 `DishRecommendation` 类型与 `Dish` 模型字段匹配
  - 确保 `BeverageRecommendation` 类型与 `Beverage` 模型字段匹配
  - 添加 `FoodPairingHistory` 类型定义
- [ ] **类型导出**: 确保所有类型都正确导出，供其他模块使用
- [ ] **更新文件**: `app/types/foodPairing.ts`

---

## Epic 4: 前端集成
修改 app/page.tsx 文件，将现有的"获取推荐按钮"连接到新的后端 API

### Epic 4.1: 更新前端状态管理
- [ ] **任务描述**: 添加新的状态变量以支持多 Agent 系统输入
- [ ] **新增状态**:
  - `cuisine`: `string` - 菜系选择
  - `drinkIngredients`: `string[]` - 酒原料列表
  - `pairingResult`: `CompletePairingRecommendation | null` - 搭配结果
  - `isPairingLoading`: `boolean` - 加载状态
  - `pairingError`: `string | null` - 错误信息
- [ ] **更新文件**: `app/page.tsx`

### Epic 4.2: 修改获取推荐按钮的处理函数
- [ ] **任务描述**: 更新 `handleGetRecommendations` 函数
- [ ] **函数改造**:
  - 收集所有输入: `cuisine`, `ingredients` (食品原料), `drinkIngredients`
  - 调用新的 API: `POST /api/food-pairing`
  - 处理响应: 更新 `pairingResult` 状态
  - 错误处理: 更新 `pairingError` 状态
- [ ] **更新文件**: `app/page.tsx` 中的 `handleGetRecommendations` 函数

### Epic 4.3: 更新 UI 组件
- [ ] **任务描述**: 添加必要的输入组件
- [ ] **UI 组件更新**:
  - 添加菜系输入框（如果 `pairingEnabled` 为 true，已有部分实现）
  - 确保酒原料输入区域可见（可能需要新增或修改现有组件）
  - 更新"获取推荐"按钮的禁用逻辑，确保所有必需输入都已填写
- [ ] **更新文件**: `app/page.tsx` 中的 JSX 部分

### Epic 4.4: 实现结果展示逻辑
- [ ] **任务描述**: 更新推荐结果的展示组件
- [ ] **展示内容**:
  - 菜品推荐列表（使用现有的 `RecipeCard` 组件或创建新的 `DishCard` 组件）
  - 酒品推荐列表（创建 `BeverageCard` 组件）
  - 搭配理由展示（创建 `PairingReasonCard` 组件）
  - 整体搭配建议（文本展示）
- [ ] **布局设计**: 
  - 使用网格布局展示菜品和酒品
  - 搭配理由以卡片形式展示在推荐下方
- [ ] **更新文件**: `app/page.tsx` 中的结果展示部分

---

## 技术参考

### LangGraph 文档
- API 文档: https://docs.langchain.com/oss/javascript/langgraph/graph-api
- 多 Agent 实现思路: https://github.com/datawhalechina/hello-agents/blob/main/docs/chapter6/第六章%20框架开发实践.md

### 项目现有技术栈
- Next.js 16.0.1
- TypeScript 5
- LangChain 1.0.1
- React 19.2.0

---

## 执行说明

**重要**: 请严格按照"一次只解决一个子任务"的原则执行。完成每个子任务后，请：
1. 在任务清单中将该任务标记为完成（[x]）
2. 停止并等待用户输入 **"Go"** 或 **"继续"** 指令
3. 收到指令后，继续下一个子任务

