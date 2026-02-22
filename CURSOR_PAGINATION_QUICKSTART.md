# 游标分页快速开始指南

## 🚀 如何使用游标分页

### 方式 1: 访问新页面（最简单）

直接访问已创建好的游标分页页面：

```
http://localhost:3000/favorites-cursor
```

这个页面已经完整实现了游标分页功能，包括：
- ✅ 每页显示 3 条数据
- ✅ "加载更多"按钮
- ✅ 性能监控日志
- ✅ 错误处理

### 方式 2: 在现有页面中使用

#### 步骤 1: 导入 Hook

```typescript
// 在你的页面组件中
import { useFavoritesCursor } from '@/app/hooks/useFavoritesCursor';
```

#### 步骤 2: 使用 Hook

```tsx
'use client';

import { useFavoritesCursor } from '@/app/hooks/useFavoritesCursor';

export default function MyPage() {
  const {
    favorites,      // 已加载的数据（累积）
    isLoading,      // 首次加载状态
    isLoadingMore,  // 加载更多状态
    hasMore,        // 是否还有更多
    error,          // 错误信息
    loadMore,       // 加载更多函数
    refresh,        // 刷新函数
  } = useFavoritesCursor({ 
    limit: 3,        // 每页 3 条
    autoLoad: true   // 自动加载第一页
  });

  return (
    <div>
      {/* 显示列表 */}
      {favorites.map(fav => (
        <div key={fav.id}>{fav.recipe.name}</div>
      ))}
      
      {/* 加载更多按钮 */}
      {hasMore && (
        <button onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? '加载中...' : '加载更多'}
        </button>
      )}
    </div>
  );
}
```

### 方式 3: 直接调用 API

如果你不想使用 React Hook，可以直接调用 API：

```typescript
// 第一页（不需要 cursor）
const response1 = await fetch('/api/favorites-cursor?limit=3');
const data1 = await response1.json();
console.log(data1.favorites);        // [A, B, C]
console.log(data1.pagination.nextCursor); // "xyz123..."

// 第二页（使用上一页返回的 nextCursor）
const response2 = await fetch(`/api/favorites-cursor?limit=3&cursor=${data1.pagination.nextCursor}`);
const data2 = await response2.json();
console.log(data2.favorites);        // [D, E, F]
console.log(data2.pagination.hasMore); // true/false
```

## 📝 完整示例：修改现有页面

### 修改 `/app/favorites/page.tsx`

你可以在现有的收藏页面中添加一个切换开关，让用户选择使用哪种分页方式：

```tsx
'use client';

import { useState } from 'react';
import { useFavorites } from '../hooks/useFavorites';
import { useFavoritesCursor } from '../hooks/useFavoritesCursor';

export default function FavoritesPage() {
  // 切换开关：true = 游标分页，false = OFFSET 分页
  const [useCursorPagination, setUseCursorPagination] = useState(false);

  // OFFSET 分页（原有方式）
  const offsetPagination = useFavorites({ 
    page: 1, 
    limit: 10 
  });

  // 游标分页（新方式）
  const cursorPagination = useFavoritesCursor({ 
    limit: 3 
  });

  // 根据开关选择使用哪种分页
  const pagination = useCursorPagination ? cursorPagination : offsetPagination;

  return (
    <div>
      {/* 分页方式切换开关 */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={useCursorPagination}
            onChange={(e) => setUseCursorPagination(e.target.checked)}
          />
          <span className="ml-2">
            使用游标分页 {useCursorPagination && '✅'}
          </span>
        </label>
      </div>

      {/* 渲染列表 */}
      {pagination.favorites.map(fav => (
        <div key={fav.id}>{fav.recipe.name}</div>
      ))}

      {/* 加载更多按钮（游标分页） */}
      {useCursorPagination && pagination.hasMore && (
        <button onClick={pagination.loadMore}>
          加载更多
        </button>
      )}

      {/* 分页器（OFFSET 分页） */}
      {!useCursorPagination && (
        <div>
          页码: {pagination.pagination?.page} / {pagination.pagination?.pages}
        </div>
      )}
    </div>
  );
}
```

## 🧪 测试游标分页

### 1. 准备测试数据

首先，确保你有足够的测试数据（至少 10 条收藏）：

```bash
# 启动开发服务器
npm run dev

# 访问主页，添加一些收藏
http://localhost:3000
```

### 2. 测试游标分页页面

```bash
# 访问游标分页页面
http://localhost:3000/favorites-cursor
```

**测试步骤**：
1. 页面加载时应该显示前 3 条数据
2. 点击"加载更多"按钮
3. 应该追加显示接下来的 3 条数据
4. 继续点击，直到显示"已加载全部"

### 3. 查看性能日志

打开浏览器控制台（F12），查看性能日志：

```
📋 [游标分页] 获取收藏列表，sessionId: xxx, limit: 3, cursor: 无
⏱️ [CursorPagination] 收藏列表查询 耗时: 12.34ms
✅ [游标分页] 查询完成，返回 3 条数据，hasMore: true
⏱️ [Performance] API 总耗时: 45.67ms
```

### 4. 对比性能

同时打开两个页面，对比性能：

```bash
# OFFSET 分页（旧版）
http://localhost:3000/favorites

# 游标分页（新版）
http://localhost:3000/favorites-cursor
```

观察控制台的性能日志，游标分页应该更快（尤其是数据量大时）。

## 🔧 API 端点说明

### 游标分页 API

#### 1. 收藏列表

```http
GET /api/favorites-cursor?cursor={cursor}&limit={limit}
```

**参数**：
- `cursor` (可选): Base64 编码的游标字符串
- `limit` (可选，默认3，最大50): 每页数量

**响应**：
```json
{
  "success": true,
  "favorites": [...],
  "pagination": {
    "nextCursor": "MjAyNC0wMS0yNlQxMDowMDowMC4wMDBa",  // 下一页游标
    "prevCursor": "MjAyNC0wMS0yNlQxMTowMDowMC4wMDBa",  // 上一页游标
    "hasMore": true,                                    // 是否还有下一页
    "count": 3                                          // 当前页数据量
  }
}
```

#### 2. 套装列表

```http
GET /api/saved-sets-cursor?cursor={cursor}&limit={limit}
```

参数和响应格式同上。

### 使用 Postman/curl 测试

```bash
# 第一页
curl "http://localhost:3000/api/favorites-cursor?limit=3"

# 复制响应中的 nextCursor，用于第二页
curl "http://localhost:3000/api/favorites-cursor?limit=3&cursor=MjAyNC0wMS0yNlQxMDowMDowMC4wMDBa"
```

## 🎯 从 OFFSET 迁移到游标分页

### 对比表

| 特性 | OFFSET 分页 | 游标分页 |
|------|------------|---------|
| **API 端点** | `/api/favorites` | `/api/favorites-cursor` |
| **Hook** | `useFavorites()` | `useFavoritesCursor()` |
| **参数** | `page`, `limit` | `cursor`, `limit` |
| **返回** | 当前页数据 | 累积所有数据 |
| **分页器** | ✅ 支持跳页 | ❌ 只能顺序加载 |
| **性能** | 深分页较慢 | 始终快速 |
| **适用场景** | 后台管理 | 移动端、Feed 流 |

### 迁移步骤

#### 方案 A: 渐进式迁移（推荐）

```tsx
// 1. 保留旧代码
const { favorites: oldFavorites } = useFavorites({ page: 1, limit: 10 });

// 2. 添加新代码
const { favorites: newFavorites } = useFavoritesCursor({ limit: 3 });

// 3. 使用 Feature Flag 控制
const USE_CURSOR_PAGINATION = process.env.NEXT_PUBLIC_USE_CURSOR_PAGINATION === 'true';
const favorites = USE_CURSOR_PAGINATION ? newFavorites : oldFavorites;
```

#### 方案 B: 直接替换

```diff
- import { useFavorites } from '../hooks/useFavorites';
+ import { useFavoritesCursor } from '../hooks/useFavoritesCursor';

- const { favorites, pagination } = useFavorites({ page: 1, limit: 10 });
+ const { favorites, hasMore, loadMore } = useFavoritesCursor({ limit: 3 });

- <Pagination page={pagination.page} total={pagination.pages} />
+ {hasMore && <button onClick={loadMore}>加载更多</button>}
```

## 🐛 常见问题

### Q1: 点击"加载更多"没反应？

**检查清单**：
1. 打开浏览器控制台，查看是否有错误
2. 检查 `hasMore` 是否为 `true`
3. 检查 `isLoadingMore` 是否为 `false`
4. 检查后端 API 是否正常运行

```typescript
// 添加调试日志
console.log({
  hasMore,
  isLoadingMore,
  nextCursor,
  currentCount: favorites.length
});
```

### Q2: 数据重复显示？

**可能原因**：
- 数据在加载过程中被修改了
- 游标字段不唯一

**解决方案**：
```typescript
// 在 Hook 中使用去重
const uniqueFavorites = Array.from(
  new Map(favorites.map(f => [f.id, f])).values()
);
```

### Q3: 如何重置列表？

```typescript
const { clear, refresh } = useFavoritesCursor();

// 清空列表（不发请求）
clear();

// 刷新列表（重新加载第一页）
refresh();
```

### Q4: 如何实现无限滚动？

```typescript
import { useEffect, useRef } from 'react';

function InfiniteScrollList() {
  const { favorites, hasMore, loadMore, isLoadingMore } = useFavoritesCursor();
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
        loadMore();
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div>
      {favorites.map(fav => (
        <div key={fav.id}>{fav.recipe.name}</div>
      ))}
      
      {/* 触发器：滚动到这里时自动加载更多 */}
      {hasMore && <div ref={loadMoreRef}>加载中...</div>}
    </div>
  );
}
```

## 📊 性能监控

### 在生产环境中监控

```typescript
// 添加到你的监控服务（如 Sentry, DataDog）
import { withPerformanceMonitor } from '@/app/lib/cursorPagination';

const { result, duration } = await withPerformanceMonitor(
  '收藏列表查询',
  async () => {
    // 你的查询逻辑
  }
);

// 发送到监控服务
analytics.track('cursor_pagination_query', {
  duration,
  itemCount: result.length,
  hasMore: result.length > limit,
});
```

## 🎓 下一步

1. ✅ **测试功能**：访问 `/favorites-cursor` 页面
2. ✅ **查看日志**：打开控制台观察性能日志
3. ✅ **对比性能**：同时打开新旧页面对比
4. ✅ **添加索引**：运行数据库迁移添加索引（见下文）
5. ✅ **迁移页面**：将现有页面迁移到游标分页

## 📦 添加数据库索引（重要！）

游标分页的性能优势**依赖于数据库索引**，请务必添加：

```bash
# 1. 修改 Prisma Schema
# 在 prisma/schema.prisma 中添加索引（见下文）

# 2. 生成迁移
npx prisma migrate dev --name add_cursor_pagination_indexes

# 3. 应用迁移
npx prisma migrate deploy
```

**Prisma Schema 修改**：

```prisma
model UserFavorite {
  id        String   @id @default(uuid())
  sessionId String
  recipeId  String
  createdAt DateTime @default(now())
  recipe    Recipe   @relation(fields: [recipeId], references: [id])

  @@unique([sessionId, recipeId])
  @@index([sessionId, createdAt(sort: Desc)]) // 👈 添加这行
}

model SavedSet {
  id          String   @id @default(uuid())
  sessionId   String
  dishId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  dish        Dish     @relation(fields: [dishId], references: [id])
  recipes     SavedSetRecipe[]

  @@unique([sessionId, dishId])
  @@index([sessionId, createdAt(sort: Desc)]) // 👈 添加这行
}
```

没有索引的游标分页**不会比 OFFSET 分页快**！

## 🚀 快速开始命令

```bash
# 1. 启动开发服务器
npm run dev

# 2. 访问游标分页页面
open http://localhost:3000/favorites-cursor

# 3. 添加数据库索引
npx prisma migrate dev --name add_cursor_pagination_indexes

# 4. 查看性能对比
# 打开浏览器控制台，观察性能日志
```

就这么简单！🎉
