# 事务修复说明文档

## 📋 修复概述

本次修复针对 `/api/favorites` POST 接口的数据一致性问题，通过引入 Prisma 事务机制，确保"创建 Recipe"和"创建 UserFavorite"两个操作的原子性。

## 🐛 原有问题

### 问题描述

在 `app/api/favorites/route.ts` 的 POST 方法中，当需要创建新的 Recipe 时，存在以下操作流程：

1. 创建 Recipe 记录
2. 创建 UserFavorite 收藏记录

**潜在风险**：如果步骤 1 成功但步骤 2 失败（如网络中断、数据库连接断开、服务器崩溃），会导致：

- ✗ 数据库中存在孤儿 Recipe 记录（没有被任何收藏引用）
- ✗ 用户认为收藏失败，但 Recipe 已被创建
- ✗ 数据不一致，影响系统稳定性

### 问题根因

**未使用事务保证多步数据库操作的原子性**，违反了 ACID 原则中的原子性（Atomicity）要求。

## ✅ 修复方案

### 核心改动

引入 **Prisma 事务**（`prisma.$transaction`），确保相关数据库操作要么全部成功，要么全部失败。

### 详细修改

#### 1. 调整执行顺序

**优化前**：先验证 Recipe 是否存在 → 检查是否已收藏

**优化后**：先检查是否已收藏 → 验证 Recipe 是否存在

```typescript
// 3. 检查是否已收藏（防止重复收藏 - 提前检查避免不必要的事务）
const existingFavorite = await prisma.userFavorite.findUnique({
  where: {
    sessionId_recipeId: {
      sessionId,
      recipeId
    }
  }
});

if (existingFavorite) {
  // 提前返回，避免后续不必要的数据库查询
  return NextResponse.json(...)
}
```

**优化理由**：
- 如果已收藏，立即返回，避免后续所有操作
- 减少数据库查询次数，提升性能

#### 2. 新增事务处理（Recipe 不存在场景）

当 Recipe 不存在且提供了 `recipeData` 时，使用事务同时创建 Recipe 和 UserFavorite：

```typescript
// 5. 使用事务确保原子性
if (!recipe && recipeData) {
  const result = await prisma.$transaction(async (tx) => {
    // 创建 Recipe 记录
    const newRecipe = await tx.recipe.create({
      data: {
        id: recipeId,
        name: recipeData.name || '未知配方',
        // ... 其他字段
      }
    });

    // 创建 UserFavorite 收藏记录
    const newFavorite = await tx.userFavorite.create({
      data: {
        sessionId,
        recipeId
      }
    });

    return { recipe: newRecipe, favorite: newFavorite };
  });

  recipe = result.recipe;
  savedFavorite = result.favorite;
}
```

**关键特性**：
- 🔒 **原子性**：两个操作同时成功或同时失败
- 🔄 **自动回滚**：任何一步失败，事务自动回滚
- 📊 **数据一致性**：不会产生孤儿记录

#### 3. 保持单操作场景（Recipe 已存在）

当 Recipe 已存在时，只需创建 UserFavorite，无需事务（单操作本身就是原子的）：

```typescript
// 6. Recipe 已存在，直接创建 UserFavorite（无需事务）
else if (recipe) {
  savedFavorite = await prisma.userFavorite.create({
    data: {
      sessionId,
      recipeId
    }
  });
}
```

**设计原则**：只在必要时使用事务，避免过度使用影响性能。

#### 4. 增强错误处理

针对事务和非事务场景，分别提供细粒度的错误处理：

```typescript
catch (error) {
  // 处理唯一约束冲突（并发情况）
  if (error instanceof Error) {
    if (error.message.includes('duplicate key') || 
        error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { success: false, error: '该配方已收藏' },
        { status: 409 }
      );
    }
  }
  
  // 通用错误
  return NextResponse.json(
    { 
      success: false, 
      error: '创建配方或收藏失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    { status: 500 }
  );
}
```

## 📊 修复效果对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| **数据一致性** | ❌ 可能产生孤儿 Recipe | ✅ 保证数据一致性 |
| **事务保护** | ❌ 无事务保护 | ✅ 使用 Prisma 事务 |
| **错误恢复** | ❌ 部分成功部分失败 | ✅ 自动回滚 |
| **并发安全** | ⚠️ 重复收藏检查滞后 | ✅ 提前检查 + 唯一约束 |
| **性能优化** | ⚠️ 无优化 | ✅ 提前检查减少不必要查询 |
| **错误信息** | ⚠️ 通用错误 | ✅ 细粒度错误信息 |

## 🎯 符合的最佳实践

### 1. ACID 原则

- **Atomicity（原子性）**：事务内的所有操作要么全部成功，要么全部失败
- **Consistency（一致性）**：事务执行前后，数据库状态保持一致
- **Isolation（隔离性）**：Prisma 默认的事务隔离级别保证并发安全
- **Durability（持久性）**：事务提交后，数据永久保存

### 2. Prisma 事务最佳实践

✅ **正确使用场景**：
- 多个数据库写操作之间有依赖关系
- 必须保证"全部成功或全部失败"的原子性
- 涉及创建主记录和关联记录

✅ **避免过度使用**：
- 单一操作无需事务（本身就是原子的）
- 只读操作无需事务

### 3. 项目规范遵循

- ✅ 中文注释，清晰说明事务使用原因
- ✅ 详细的错误日志记录
- ✅ 开发环境提供详细错误信息
- ✅ 生产环境隐藏敏感错误细节
- ✅ 使用 emoji 提升日志可读性

## 🧪 测试建议

### 功能测试

1. **正常流程**：
   - Recipe 不存在 + 提供 recipeData → 成功创建
   - Recipe 已存在 → 成功创建收藏
   - Recipe 不存在 + 未提供 recipeData → 返回 404 错误

2. **边界情况**：
   - 重复收藏 → 返回 409 错误
   - 并发请求 → 只有一个成功，其他返回 409

3. **异常场景**：
   - 数据库连接中断 → 事务回滚，无孤儿记录
   - 网络超时 → 事务回滚，无孤儿记录

### 性能测试

- 对比修复前后的响应时间
- 验证提前检查是否减少了不必要的数据库查询

## 🔍 扩展思考

### 其他可能需要事务的场景

根据项目代码审查，以下场景已正确使用事务：

✅ **`app/services/savedSetService.ts` - `createSavedSet`**
- 创建 SavedSet + 批量创建 SavedSetRecipe
- 已使用事务保护

### 无需事务的场景

以下场景为单一操作，无需事务：

- ✅ 单独的查询操作
- ✅ 单独的创建操作（如单独创建 User）
- ✅ 单独的更新操作
- ✅ 单独的删除操作（带级联删除的除外）

## 📚 相关文档

- [Prisma Transactions 官方文档](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [项目 Cursor 规则](/.cursorrules)
- [数据库 Schema](../prisma/schema.prisma)

## ✅ 验证结果

- ✅ 无 TypeScript 类型错误
- ✅ 无 Linter 错误
- ✅ 符合项目代码规范
- ✅ 注释清晰完整
- ✅ 错误处理完善

---

**修复时间**：2026-01-26  
**修复人员**：Cursor AI Agent  
**审核状态**：待测试验证
