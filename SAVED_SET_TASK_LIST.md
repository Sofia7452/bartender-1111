# 菜酒搭配套装收藏功能 - 任务清单

## 功能概述
设计并实现数据库和业务逻辑，允许用户将一整套菜品和酒品搭配作为一个集合（SavedSet）进行收藏。

## 现有实体分析
- **Recipe（酒品）**：已存在数据库模型，支持单独收藏（通过 `UserFavorite` 表）
- **Dish（菜品）**：目前仅为 TypeScript 接口（`DishRecommendation`），未持久化到数据库

## 数据关系设计图

```
SavedSet (套装)
  ├── 1:1 → Dish (一个套装包含一个菜品)
  └── N:M → Recipe (一个套装包含多个酒品，通过 SavedSetRecipe 中间表)
            ↑
            │
      SavedSetRecipe (中间表)
            │
            └── N:1 → Recipe (一个酒品可以属于多个套装)
```

**关系说明**：
- `SavedSet` 与 `Dish`：**一对一关系**（一个套装固定包含一个菜品）
- `SavedSet` 与 `Recipe`：**多对多关系**（通过 `SavedSetRecipe` 中间表实现）
  - 一个套装可以包含多个酒品
  - 一个酒品可以被多个套装使用
- `SavedSetRecipe` 是中间表，存储 `savedSetId` 和 `recipeId` 的关联关系

---

## 任务清单

### 1. [x] 数据库架构设计与修改 (Database Schema Design)

#### 1.1 [x] 创建 Dish 数据库模型
- 在 `prisma/schema.prisma` 中新增 `Dish` 模型
- 字段设计参考 `DishRecommendation` 接口：
  - `id`: UUID (主键)
  - `name`: 菜品名称
  - `description`: 菜品描述
  - `cuisine`: 所属菜系
  - `requiredIngredients`: JSON (string[]) - 所需食材列表
  - `cookingTime`: Int - 烹饪时间（分钟）
  - `difficulty`: Int - 难度等级（1-5）
  - `steps`: JSON (string[]) - 烹饪步骤列表
  - `source`: String? - 来源信息（可选）
  - `tags`: JSON (string[]?) - 分类标签（可选）
  - `createdAt`: DateTime
  - `updatedAt`: DateTime
- 添加适当的索引和映射表名

#### 1.2 [x] 创建 SavedSet 模型
- 在 `prisma/schema.prisma` 中新增 `SavedSet` 模型
- 字段设计：
  - `id`: UUID (主键)
  - `sessionId`: String - 用户会话ID（与现有收藏逻辑保持一致）
  - `dishId`: UUID - 关联的菜品ID（外键）
  - `name`: String? - 套装名称（可选，用于用户自定义命名）
  - `description`: String? - 套装描述（可选）
  - `createdAt`: DateTime
  - `updatedAt`: DateTime
- **关系设计**：
  - 与 `Dish` 的一对一关系（一个套装包含一个菜品）：`dish: Dish @relation(...)`
  - 与 `Recipe` 的多对多关系（通过 `SavedSetRecipe` 中间表）：`recipes: SavedSetRecipe[]`
  - **注意**：SavedSet 不直接关联 Recipe，而是通过 SavedSetRecipe 中间表实现多对多关系
- 添加 `@@unique([sessionId, dishId])` 约束（同一用户同一菜品只能创建一个套装）

#### 1.3 [x] 创建 SavedSetRecipe 中间表（多对多关系）
- 在 `prisma/schema.prisma` 中新增 `SavedSetRecipe` 模型
- 字段设计：
  - `id`: UUID (主键)
  - `savedSetId`: UUID - 关联的套装ID（外键）
  - `recipeId`: UUID - 关联的酒品ID（外键）
  - `createdAt`: DateTime
- 建立与 `SavedSet` 和 `Recipe` 的多对多关系
- 添加 `@@unique([savedSetId, recipeId])` 约束（防止重复添加同一酒品到同一套装）
- 添加索引优化查询性能

#### 1.4 [x] 更新现有模型的关系定义
- 在 `Dish` 模型中添加 `savedSets: SavedSet[]` 关系（一对多：一个菜品可以被多个套装使用）
- 在 `Recipe` 模型中添加 `savedSetRecipes: SavedSetRecipe[]` 关系（通过中间表关联到 SavedSet）
- 在 `SavedSet` 模型中添加：
  - `dish: Dish @relation(...)` - 与 Dish 的一对一关系
  - `recipes: SavedSetRecipe[]` - 与 Recipe 的多对多关系（通过中间表）
- 在 `SavedSetRecipe` 模型中添加：
  - `savedSet: SavedSet @relation(...)` - 关联到 SavedSet
  - `recipe: Recipe @relation(...)` - 关联到 Recipe
- 确保所有外键关系正确配置 `onDelete` 级联策略：
  - SavedSet 删除时，级联删除 SavedSetRecipe 记录
  - SavedSetRecipe 删除时，不影响 SavedSet 和 Recipe

#### 1.5 [x] 生成并执行数据库迁移
- 运行 `npx prisma migrate dev --name add_saved_set_models` 生成迁移文件
- 检查迁移 SQL 文件确保正确性
- 执行迁移并验证数据库结构

---

### 2. [ ] 核心业务逻辑实现 (Core Business Logic Implementation)

#### 2.1 [x] 创建 SavedSet 服务层函数
- 在 `app/services/` 目录下创建或更新服务文件（如 `savedSetService.ts`）
- 实现 `saveDish(dishData: DishRecommendation)` 函数：
  - 检查 Dish 是否已存在（根据 id 或 name+cuisine 组合）
  - 如果不存在则创建，存在则返回现有记录
- 实现 `createSavedSet(sessionId, dishId, recipeIds[], name?, description?)` 函数：
  - 验证 dishId 和 recipeIds 的有效性
  - 检查是否已存在相同的套装（根据 sessionId 和 dishId）
  - 创建 SavedSet 记录
  - 批量创建 SavedSetRecipe 关联记录
  - 返回完整的套装数据（包含 Dish 和 Recipe 详情）

#### 2.2 [x] 实现套装收藏 API 端点
- 在 `app/api/` 目录下创建 `saved-sets/route.ts` 文件
- 实现 `POST /api/saved-sets` 接口：
  - 接收请求体：`{ dish: DishRecommendation, recipeIds: string[], name?: string, description?: string }`
  - 获取或生成 sessionId（复用现有逻辑）
  - 调用服务层函数保存 Dish 和创建 SavedSet
  - 返回成功响应，包含完整的套装信息
- 实现 `GET /api/saved-sets` 接口：
  - 根据 sessionId 查询用户的所有套装
  - 包含关联的 Dish 和 Recipe 详情
  - 支持分页参数（page, limit）
- 实现 `DELETE /api/saved-sets` 接口：
  - 接收 `{ savedSetId: string }`
  - 验证 sessionId 权限（只能删除自己的套装）
  - 删除 SavedSet 及其关联的 SavedSetRecipe 记录（级联删除）

#### 2.3 [x] 验证并维护单独收藏逻辑完整性
- 检查 `app/api/favorites/route.ts` 中的现有逻辑
- 确保新增的 SavedSet 功能不影响现有的 Recipe 单独收藏功能
- 确保新增的 Dish 模型不影响现有的业务逻辑
- 验证 UserFavorite 表的功能仍然正常工作

---

### 3. [ ] 类型定义更新 (Type Definition Update)

#### 3.1 [x] 更新 Prisma 客户端类型
- 运行 `npx prisma generate` 生成最新的 Prisma 客户端类型
- 验证新生成的类型包含 `Dish`、`SavedSet`、`SavedSetRecipe` 模型

#### 3.2 [x] 创建或更新 TypeScript 类型文件
- 在 `app/types/` 目录下创建或更新 `savedSet.ts` 文件
- 定义 `SavedSet` 接口类型（包含关联的 Dish 和 Recipe 数组）
- 定义 API 请求和响应的类型：
  - `CreateSavedSetRequest`
  - `CreateSavedSetResponse`
  - `GetSavedSetsResponse`
  - `DeleteSavedSetRequest`
- 确保类型定义与 Prisma 模型和 API 接口保持一致

---

### 4. [ ] API 接口完善与错误处理 (API Enhancement & Error Handling)

#### 4.1 [ ] 完善 API 错误处理
- 在 `POST /api/saved-sets` 中添加完整的错误处理：
  - 请求体验证错误（400）
  - Dish 或 Recipe 不存在错误（404）
  - 重复收藏错误（409）
  - 数据库操作错误（500）
- 在 `GET /api/saved-sets` 中添加错误处理
- 在 `DELETE /api/saved-sets` 中添加权限验证和错误处理

#### 4.2 [ ] 添加 API 文档注释
- 为所有 API 端点添加详细的 JSDoc 注释
- 说明请求参数、响应格式、错误码等
- 添加使用示例

#### 4.3 [ ] 实现数据验证逻辑
- 验证 `recipeIds` 数组不为空
- 验证所有 `recipeIds` 对应的 Recipe 记录存在
- 验证 `dish` 数据的完整性和有效性

---

### 5. [ ] 基本功能验证 (Basic Functionality Validation Plan)

#### 5.1 [ ] 设计测试场景
- 场景 1：创建新的套装收藏（包含一个 Dish 和多个 Recipe）
- 场景 2：查询用户的套装列表
- 场景 3：删除套装收藏
- 场景 4：验证单独收藏 Recipe 功能仍然正常
- 场景 5：验证同一用户同一 Dish 不能创建重复套装
- 场景 6：验证删除套装时级联删除关联的 SavedSetRecipe 记录

#### 5.2 [ ] 执行手动测试
- 使用 Postman 或 curl 测试所有 API 端点
- 验证数据库中的数据正确性
- 验证 sessionId 的隔离性（不同用户的数据互不干扰）

#### 5.3 [ ] 兼容性验证
- 确认现有的 `/api/favorites` 端点仍然正常工作
- 确认现有的 Recipe 收藏功能不受影响
- 确认前端页面（如 `app/favorites/page.tsx`）仍然正常显示

---

## 注意事项

1. **数据一致性**：确保 Dish 数据在创建 SavedSet 时正确持久化
2. **级联删除**：配置正确的外键级联策略，避免孤立数据
3. **性能优化**：为常用查询字段添加索引（sessionId, dishId, recipeId）
4. **向后兼容**：确保新功能不影响现有功能
5. **错误处理**：所有 API 都应返回友好的错误信息

---

## 执行顺序

请严格按照以下顺序执行任务：
1. 先完成步骤 1（数据库架构设计）
2. 然后完成步骤 2（核心业务逻辑）
3. 接着完成步骤 3（类型定义）
4. 再完成步骤 4（API 完善）
5. 最后完成步骤 5（功能验证）

每个子任务完成后，请标记为完成并等待确认后再继续下一个子任务。

