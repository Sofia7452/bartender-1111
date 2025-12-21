# 设计文档

## 概述

本设计文档针对收藏夹页面（/favorites）的性能优化，目标是将页面首屏加载时间从当前的 3-5 秒降低到 2 秒以内。优化策略包括：减少初始数据加载量、实现独立加载、添加客户端缓存、优化数据库查询。

当前架构基于 sessionId 的用户识别机制，不涉及跨端同步。

## 架构

### 当前架构问题

1. **数据加载策略不当**
   - 使用 `Promise.all` 等待两个 API 请求都完成
   - 每次请求 100 条数据（favorites + savedSets）
   - 即使一个请求很快，也要等待慢的请求完成

2. **无缓存机制**
   - 每次访问页面都重新请求所有数据
   - 用户在同一会话中切换页面再回来，仍然重新请求

3. **数据库查询未优化**
   - 关联查询可能产生 N+1 问题
   - 返回了不必要的字段

### 优化后的架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Favorites Page                          │
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │  Favorites       │         │  SavedSets       │        │
│  │  Section         │         │  Section         │        │
│  │                  │         │                  │        │
│  │  - 独立加载      │         │  - 独立加载      │        │
│  │  - 独立状态      │         │  - 独立状态      │        │
│  │  - 骨架屏        │         │  - 骨架屏        │        │
│  └────────┬─────────┘         └────────┬─────────┘        │
│           │                            │                   │
└───────────┼────────────────────────────┼───────────────────┘
            │                            │
            ▼                            ▼
   ┌────────────────┐          ┌────────────────┐
   │ useFavorites   │          │ useSavedSets   │
   │ Hook           │          │ Hook           │
   │                │          │                │
   │ - 客户端缓存   │          │ - 客户端缓存   │
   │ - 状态管理     │          │ - 状态管理     │
   │ - 错误处理     │          │ - 错误处理     │
   └────────┬───────┘          └────────┬───────┘
            │                            │
            ▼                            ▼
   ┌────────────────┐          ┌────────────────┐
   │ GET            │          │ GET            │
   │ /api/favorites │          │ /api/saved-sets│
   │                │          │                │
   │ - 分页查询     │          │ - 分页查询     │
   │ - 优化查询     │          │ - 优化查询     │
   └────────┬───────┘          └────────┬───────┘
            │                            │
            ▼                            ▼
   ┌─────────────────────────────────────────┐
   │         PostgreSQL Database             │
   │                                         │
   │  - UserFavorite (索引优化)             │
   │  - SavedSet (索引优化)                 │
   │  - Recipe (关联查询优化)               │
   │  - Dish (关联查询优化)                 │
   └─────────────────────────────────────────┘
```

## 组件和接口

### 1. 自定义 Hooks

#### useFavorites Hook

```typescript
interface UseFavoritesOptions {
  page?: number;
  limit?: number;
  enabled?: boolean; // 是否自动加载
}

interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

function useFavorites(options?: UseFavoritesOptions): UseFavoritesReturn
```

**职责：**
- 管理 favorites 数据的获取和状态
- 实现客户端缓存（基于 sessionId）
- 处理分页和增量加载
- 提供错误处理和重试机制

#### useSavedSets Hook

```typescript
interface UseSavedSetsOptions {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface UseSavedSetsReturn {
  savedSets: SavedSetItem[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

function useSavedSets(options?: UseSavedSetsOptions): UseSavedSetsReturn
```

**职责：**
- 管理 savedSets 数据的获取和状态
- 实现客户端缓存（基于 sessionId）
- 处理分页和增量加载
- 提供错误处理和重试机制

### 2. 缓存管理器

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  sessionId: string;
}

interface CacheOptions {
  ttl?: number; // 缓存过期时间（毫秒），默认 5 分钟
}

class FavoritesCache {
  private cache: Map<string, CacheEntry<any>>;
  private ttl: number;

  constructor(options?: CacheOptions);
  
  get<T>(key: string, sessionId: string): T | null;
  set<T>(key: string, data: T, sessionId: string): void;
  invalidate(key: string): void;
  invalidateAll(): void;
  isValid(key: string, sessionId: string): boolean;
}
```

**职责：**
- 管理客户端内存缓存
- 基于 sessionId 隔离不同用户的缓存
- 处理缓存过期和失效
- 提供缓存键生成策略

### 3. 优化后的 API 路由

#### GET /api/favorites

**查询参数：**
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 50）

**优化点：**
- 使用 Prisma 的 `select` 只返回必需字段
- 确保 `sessionId` 和 `recipeId` 上有索引
- 使用 `include` 而不是多次查询避免 N+1 问题

#### GET /api/saved-sets

**查询参数：**
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20，最大 50）

**优化点：**
- 使用 Prisma 的 `select` 只返回必需字段
- 确保 `sessionId` 和 `dishId` 上有索引
- 优化关联查询（dish 和 recipes）

### 4. 页面组件重构

```typescript
// app/favorites/page.tsx

export default function FavoritesPage() {
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  
  // 独立加载 favorites 和 savedSets
  const {
    favorites,
    loading: favoritesLoading,
    error: favoritesError,
    pagination: favoritesPagination,
    refetch: refetchFavorites,
    loadMore: loadMoreFavorites,
    hasMore: hasMoreFavorites
  } = useFavorites({ page: 1, limit: 20 });

  const {
    savedSets,
    loading: setsLoading,
    error: setsError,
    pagination: setsPagination,
    refetch: refetchSets,
    loadMore: loadMoreSets,
    hasMore: hasMoreSets
  } = useSavedSets({ page: 1, limit: 20 });

  // 渲染逻辑...
}
```

## 数据模型

### 现有数据模型（无需修改）

数据库 schema 已经包含必要的索引：

```prisma
model UserFavorite {
  id        String   @id @default(uuid()) @db.Uuid
  sessionId String   @db.VarChar(255)
  recipeId  String   @db.Uuid
  createdAt DateTime @default(now())

  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([sessionId, recipeId])
  @@index([sessionId, recipeId]) // ✅ 已有索引
  @@map("user_favorites")
}

model SavedSet {
  id          String   @id @default(uuid()) @db.Uuid
  sessionId   String   @db.VarChar(255)
  dishId      String   @db.Uuid
  name        String?  @db.VarChar(255)
  description String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  dish    Dish             @relation(fields: [dishId], references: [id], onDelete: Cascade)
  recipes SavedSetRecipe[]

  @@unique([sessionId, dishId])
  @@index([sessionId]) // ✅ 已有索引
  @@index([dishId])    // ✅ 已有索引
  @@map("saved_sets")
}
```

### 缓存数据结构

```typescript
// 缓存键格式
const CACHE_KEYS = {
  favorites: (sessionId: string, page: number) => `favorites:${sessionId}:${page}`,
  savedSets: (sessionId: string, page: number) => `savedSets:${sessionId}:${page}`,
  favoritesTotal: (sessionId: string) => `favorites:${sessionId}:total`,
  setsTotal: (sessionId: string) => `savedSets:${sessionId}:total`,
};

// 缓存条目
interface CachedFavorites {
  favorites: FavoriteItem[];
  pagination: PaginationInfo;
  timestamp: number;
  sessionId: string;
}

interface CachedSavedSets {
  savedSets: SavedSetItem[];
  pagination: PaginationInfo;
  timestamp: number;
  sessionId: string;
}
```

## 错误处理

### 错误类型

1. **网络错误**
   - 超时
   - 连接失败
   - 处理：显示错误消息，提供重试按钮

2. **API 错误**
   - 4xx 客户端错误
   - 5xx 服务器错误
   - 处理：显示具体错误消息，记录日志

3. **部分失败**
   - favorites 加载成功，savedSets 失败
   - 处理：显示成功的部分，为失败部分显示错误状态

### 错误处理策略

```typescript
// 独立错误处理
if (favoritesError) {
  // 只影响 favorites 部分
  return <ErrorState error={favoritesError} onRetry={refetchFavorites} />;
}

if (setsError) {
  // 只影响 savedSets 部分
  return <ErrorState error={setsError} onRetry={refetchSets} />;
}

// 两者都失败
if (favoritesError && setsError) {
  return <GlobalErrorState onRetry={() => {
    refetchFavorites();
    refetchSets();
  }} />;
}
```

## 测试策略

### 单元测试

1. **useFavorites Hook 测试**
   - 测试初始加载
   - 测试缓存命中
   - 测试缓存失效
   - 测试分页加载
   - 测试错误处理

2. **useSavedSets Hook 测试**
   - 同上

3. **FavoritesCache 测试**
   - 测试缓存存储和读取
   - 测试 sessionId 隔离
   - 测试 TTL 过期
   - 测试缓存失效

4. **API 路由测试**
   - 测试分页参数验证
   - 测试查询性能
   - 测试错误响应

### 集成测试

1. **页面加载测试**
   - 测试首屏加载时间 < 2 秒
   - 测试独立加载行为
   - 测试部分失败场景

2. **缓存行为测试**
   - 测试缓存命中减少网络请求
   - 测试缓存失效后重新请求
   - 测试不同 sessionId 的缓存隔离

### 性能测试

1. **加载时间测试**
   - 首屏加载时间（目标 < 2 秒）
   - Time to Interactive (TTI)
   - Largest Contentful Paint (LCP)

2. **数据库查询性能**
   - 查询执行时间
   - 索引使用情况
   - N+1 查询检测

## 实现计划

### 阶段 1：基础优化（高优先级）

1. 减少初始数据加载量（100 → 20）
2. 实现独立加载（移除 Promise.all）
3. 添加骨架屏加载状态

**预期效果：** 首屏时间从 3-5 秒降至 2-3 秒

### 阶段 2：缓存实现（中优先级）

1. 创建 FavoritesCache 类
2. 实现 useFavorites 和 useSavedSets hooks
3. 集成缓存到页面组件

**预期效果：** 二次访问时间 < 500ms

### 阶段 3：数据库优化（低优先级）

1. 验证索引使用情况
2. 优化 Prisma 查询（使用 select）
3. 添加查询性能监控

**预期效果：** API 响应时间降低 20-30%

### 阶段 4：增量加载（可选）

1. 实现无限滚动或"加载更多"按钮
2. 优化移动端体验

**预期效果：** 更好的用户体验，特别是在移动设备上

## 性能指标

### 目标指标

| 指标 | 当前值 | 目标值 | 测量方法 |
|------|--------|--------|----------|
| 首屏加载时间 | 3-5 秒 | < 2 秒 | Chrome DevTools Performance |
| API 响应时间 | 500-1000ms | < 300ms | 服务器日志 |
| 缓存命中率 | 0% | > 80% | 自定义监控 |
| 二次访问时间 | 3-5 秒 | < 500ms | Chrome DevTools Performance |

### 监控方案

```typescript
// 性能监控
const performanceMonitor = {
  trackPageLoad: (duration: number) => {
    console.log(`[Performance] Page load: ${duration}ms`);
    // 可选：发送到分析服务
  },
  
  trackAPICall: (endpoint: string, duration: number) => {
    console.log(`[Performance] API ${endpoint}: ${duration}ms`);
  },
  
  trackCacheHit: (key: string, hit: boolean) => {
    console.log(`[Cache] ${key}: ${hit ? 'HIT' : 'MISS'}`);
  }
};
```

## 安全考虑

1. **sessionId 验证**
   - 确保 sessionId 来自可信的 cookie
   - 防止 sessionId 伪造

2. **缓存隔离**
   - 基于 sessionId 隔离缓存
   - 防止跨用户数据泄露

3. **输入验证**
   - 验证分页参数（page, limit）
   - 防止 SQL 注入（Prisma 已处理）

4. **速率限制**
   - 考虑添加 API 速率限制
   - 防止恶意请求

## 回滚计划

如果优化导致问题：

1. **阶段 1 回滚**
   - 恢复 Promise.all 和 100 条数据加载
   - 风险：低（只是性能回退）

2. **阶段 2 回滚**
   - 禁用缓存，直接请求 API
   - 风险：中（可能有缓存相关 bug）

3. **阶段 3 回滚**
   - 恢复原始 Prisma 查询
   - 风险：低（数据库查询优化通常安全）

## 未来改进

1. **用户登录系统**
   - 用 userId 替代 sessionId
   - 支持跨端数据同步

2. **服务端缓存（Redis）**
   - 如果数据库成为瓶颈
   - 缓存热门数据

3. **实时同步**
   - WebSocket 推送更新
   - 多设备实时同步

4. **离线支持**
   - Service Worker
   - IndexedDB 持久化缓存
