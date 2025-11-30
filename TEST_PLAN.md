# 菜酒搭配套装收藏功能 - 测试计划

## 测试概述

本文档提供了菜酒搭配套装收藏功能的完整测试计划，包括功能测试、兼容性测试和边界情况测试。

---

## 测试环境准备

### 前置条件
1. ✅ 数据库已迁移（执行 `npx prisma migrate dev`）
2. ✅ Prisma 客户端已生成（执行 `npx prisma generate`）
3. ✅ 开发服务器已启动（`npm run dev`）
4. ✅ 至少有一个 Recipe 记录存在于数据库中（用于测试）

### 测试工具
- **Postman** 或 **curl** - 用于 API 测试
- **浏览器开发者工具** - 查看 Cookie 和网络请求
- **数据库客户端** - 验证数据库记录

---

## 测试场景

### 场景 1：创建新的套装收藏（基础功能）

#### 测试步骤
1. 准备测试数据：
   ```json
   {
     "dish": {
       "id": "test-dish-001",
       "name": "宫保鸡丁",
       "description": "经典川菜",
       "cuisine": "川菜",
       "requiredIngredients": ["鸡胸肉 200g", "花生米 50g", "干辣椒 10个"],
       "cookingTime": 20,
       "difficulty": 3,
       "steps": ["切鸡胸肉", "炒制", "调味"],
       "source": "测试来源"
     },
     "recipeIds": ["recipe-id-1", "recipe-id-2"],
     "name": "川菜配酒套装",
     "description": "适合川菜的经典酒品搭配"
   }
   ```

2. 发送 POST 请求到 `/api/saved-sets`
3. 验证响应状态码为 200
4. 验证响应体包含 `success: true`
5. 验证响应体包含完整的 `savedSet` 对象
6. 验证 `savedSet.dish` 包含菜品信息
7. 验证 `savedSet.recipes` 包含酒品信息（数量正确）
8. 验证数据库中创建了相应的记录：
   - `dishes` 表中有新记录
   - `saved_sets` 表中有新记录
   - `saved_set_recipes` 表中有对应数量的关联记录

#### 预期结果
- ✅ 创建成功，返回完整的套装信息
- ✅ 数据库记录正确创建
- ✅ Cookie 中设置了 `session_id`

---

### 场景 2：查询用户的套装列表

#### 测试步骤
1. 使用场景1中创建的 sessionId（从 Cookie 获取）
2. 发送 GET 请求到 `/api/saved-sets?page=1&limit=10`
3. 验证响应状态码为 200
4. 验证响应体包含 `success: true`
5. 验证响应体包含 `savedSets` 数组
6. 验证响应体包含 `pagination` 对象
7. 验证每个 `savedSet` 包含完整的 `dish` 和 `recipes` 信息

#### 测试分页功能
1. 发送 GET 请求到 `/api/saved-sets?page=1&limit=2`
2. 验证返回 2 条记录
3. 发送 GET 请求到 `/api/saved-sets?page=2&limit=2`
4. 验证返回后续的记录
5. 验证 `pagination.totalPages` 计算正确

#### 预期结果
- ✅ 返回正确的套装列表
- ✅ 分页功能正常工作
- ✅ 关联数据完整

---

### 场景 3：删除套装收藏

#### 测试步骤
1. 使用场景1中创建的套装 ID
2. 发送 DELETE 请求到 `/api/saved-sets`，请求体：
   ```json
   {
     "savedSetId": "场景1中返回的savedSet.id"
   }
   ```
3. 验证响应状态码为 200
4. 验证响应体包含 `success: true`
5. 验证数据库中：
   - `saved_sets` 表中记录已删除
   - `saved_set_recipes` 表中关联记录已级联删除
   - `dishes` 表中的记录仍然存在（不级联删除）

#### 预期结果
- ✅ 删除成功
- ✅ 级联删除正确执行
- ✅ Dish 记录保留（符合业务逻辑）

---

### 场景 4：验证单独收藏 Recipe 功能仍然正常

#### 测试步骤
1. 发送 POST 请求到 `/api/favorites`，请求体：
   ```json
   {
     "recipeId": "recipe-id-1"
   }
   ```
2. 验证响应状态码为 200
3. 验证响应体包含 `success: true`
4. 发送 GET 请求到 `/api/favorites`
5. 验证返回的收藏列表包含刚才收藏的 Recipe
6. 验证数据库中 `user_favorites` 表有对应记录

#### 预期结果
- ✅ 单独收藏功能正常工作
- ✅ 不影响套装收藏功能
- ✅ 两个功能可以共存

---

### 场景 5：验证同一用户同一 Dish 不能创建重复套装

#### 测试步骤
1. 使用场景1中创建的 dish 和相同的 sessionId
2. 再次发送 POST 请求创建套装（使用相同的 dish.id）
3. 验证响应状态码为 409（Conflict）
4. 验证响应体包含 `success: false`
5. 验证响应体包含错误信息："该套装已收藏，同一用户同一菜品只能创建一个套装"

#### 预期结果
- ✅ 正确阻止重复创建
- ✅ 返回适当的错误码和错误信息

---

### 场景 6：验证删除套装时级联删除关联记录

#### 测试步骤
1. 创建一个套装（包含多个 Recipe）
2. 记录 `saved_set_recipes` 表中的记录数量
3. 删除该套装
4. 验证 `saved_set_recipes` 表中所有关联记录已删除
5. 验证 `saved_sets` 表中记录已删除
6. 验证 `recipes` 表中的记录仍然存在（不级联删除）

#### 预期结果
- ✅ 级联删除正确执行
- ✅ Recipe 记录保留（符合业务逻辑）

---

### 场景 7：验证数据验证逻辑

#### 测试步骤

**7.1 验证 dish 对象必需字段**
1. 发送 POST 请求，缺少 `dish.id`：
   ```json
   {
     "dish": {
       "name": "测试菜品"
     },
     "recipeIds": ["recipe-id-1"]
   }
   ```
2. 验证响应状态码为 400
3. 验证错误信息包含 "菜品ID不能为空"

**7.2 验证 recipeIds 数组**
1. 发送 POST 请求，`recipeIds` 为空数组：
   ```json
   {
     "dish": { ... },
     "recipeIds": []
   }
   ```
2. 验证响应状态码为 400
3. 验证错误信息包含 "酒品ID列表不能为空"

**7.3 验证 UUID 格式**
1. 发送 DELETE 请求，使用无效的 UUID：
   ```json
   {
     "savedSetId": "invalid-uuid"
   }
   ```
2. 验证响应状态码为 400
3. 验证错误信息包含 "套装ID格式错误"

#### 预期结果
- ✅ 所有验证逻辑正常工作
- ✅ 返回清晰的错误信息

---

### 场景 8：验证 recipeIds 自动去重

#### 测试步骤
1. 发送 POST 请求，`recipeIds` 包含重复的 ID：
   ```json
   {
     "dish": { ... },
     "recipeIds": ["recipe-id-1", "recipe-id-1", "recipe-id-2"]
   }
   ```
2. 验证创建成功
3. 验证 `saved_set_recipes` 表中只有 2 条记录（去重后）
4. 验证日志中包含去重警告信息

#### 预期结果
- ✅ 自动去重功能正常工作
- ✅ 数据库中无重复记录

---

### 场景 9：验证权限控制

#### 测试步骤
1. 使用 sessionId-A 创建一个套装
2. 使用 sessionId-B 尝试删除该套装
3. 验证响应状态码为 403（Forbidden）
4. 验证响应体包含错误信息："无权删除此套装"

#### 预期结果
- ✅ 权限控制正常工作
- ✅ 用户只能删除自己的套装

---

### 场景 10：验证边界情况

#### 测试步骤

**10.1 测试分页边界**
1. 发送 GET 请求到 `/api/saved-sets?page=0`
2. 验证响应状态码为 400
3. 发送 GET 请求到 `/api/saved-sets?limit=100`
4. 验证 limit 自动限制为 50

**10.2 测试不存在的资源**
1. 发送 DELETE 请求，使用不存在的 savedSetId
2. 验证响应状态码为 404
3. 验证错误信息包含 "不存在"

**10.3 测试不存在的 Recipe**
1. 发送 POST 请求，使用不存在的 recipeId
2. 验证响应状态码为 404
3. 验证错误信息包含 "部分酒品不存在"

#### 预期结果
- ✅ 所有边界情况正确处理
- ✅ 返回适当的错误码和错误信息

---

## 兼容性验证

### 验证现有功能不受影响

#### 测试步骤
1. **验证现有收藏页面**
   - 访问 `/favorites` 页面
   - 验证页面正常加载
   - 验证可以查看收藏的 Recipe 列表
   - 验证可以取消收藏

2. **验证现有组件**
   - 验证 `RecipeCard` 组件正常工作
   - 验证收藏按钮功能正常

3. **验证现有 API**
   - 测试 `/api/favorites` POST（添加收藏）
   - 测试 `/api/favorites` GET（获取列表）
   - 测试 `/api/favorites` DELETE（取消收藏）
   - 验证所有功能正常

#### 预期结果
- ✅ 所有现有功能正常工作
- ✅ 无回归问题

---

## 数据库验证

### 验证数据库结构

#### 测试步骤
1. 连接数据库
2. 验证以下表存在：
   - `dishes`
   - `saved_sets`
   - `saved_set_recipes`
3. 验证表结构正确：
   - 所有字段类型正确
   - 所有索引存在
   - 所有外键约束正确
   - 所有唯一约束正确

#### 预期结果
- ✅ 数据库结构完整正确

---

## 性能测试建议

### 测试场景
1. **批量创建测试**
   - 创建 100 个套装
   - 验证响应时间在可接受范围内

2. **大量关联测试**
   - 创建一个包含 20 个 Recipe 的套装
   - 验证创建和查询性能

3. **分页性能测试**
   - 查询包含大量套装的列表
   - 验证分页查询性能

---

## 测试检查清单

### 功能测试
- [ ] 场景 1：创建新的套装收藏
- [ ] 场景 2：查询用户的套装列表
- [ ] 场景 3：删除套装收藏
- [ ] 场景 4：验证单独收藏 Recipe 功能
- [ ] 场景 5：验证重复创建限制
- [ ] 场景 6：验证级联删除
- [ ] 场景 7：验证数据验证逻辑
- [ ] 场景 8：验证 recipeIds 自动去重
- [ ] 场景 9：验证权限控制
- [ ] 场景 10：验证边界情况

### 兼容性测试
- [ ] 验证现有收藏页面
- [ ] 验证现有组件
- [ ] 验证现有 API

### 数据库验证
- [ ] 验证数据库结构
- [ ] 验证数据完整性

---

## 测试结果记录

### 测试日期
_________

### 测试人员
_________

### 测试结果
- 通过场景：_________
- 失败场景：_________
- 问题记录：_________

---

## 注意事项

1. **测试数据清理**：测试完成后，建议清理测试数据，避免影响生产环境
2. **SessionId 管理**：测试时注意 Cookie 中的 sessionId，确保使用正确的 sessionId
3. **数据库备份**：重要测试前建议备份数据库
4. **日志查看**：测试时查看服务器日志，确认无异常错误

---

## 快速测试命令（curl 示例）

### 创建套装
```bash
curl -X POST http://localhost:3000/api/saved-sets \
  -H "Content-Type: application/json" \
  -d '{
    "dish": {
      "id": "test-dish-001",
      "name": "宫保鸡丁",
      "description": "经典川菜",
      "cuisine": "川菜",
      "requiredIngredients": ["鸡胸肉 200g"],
      "cookingTime": 20,
      "difficulty": 3,
      "steps": ["切鸡胸肉", "炒制"]
    },
    "recipeIds": ["recipe-id-1"],
    "name": "测试套装"
  }' \
  -c cookies.txt
```

### 获取套装列表
```bash
curl -X GET "http://localhost:3000/api/saved-sets?page=1&limit=10" \
  -b cookies.txt
```

### 删除套装
```bash
curl -X DELETE http://localhost:3000/api/saved-sets \
  -H "Content-Type: application/json" \
  -d '{"savedSetId": "saved-set-id"}' \
  -b cookies.txt
```

---

## 测试完成标准

所有测试场景通过，且满足以下条件：
1. ✅ 所有功能测试场景通过
2. ✅ 兼容性测试通过（现有功能不受影响）
3. ✅ 数据库验证通过
4. ✅ 无严重错误或异常
5. ✅ 性能在可接受范围内

---

**测试计划创建日期**：2024-11-30  
**测试计划版本**：1.0

