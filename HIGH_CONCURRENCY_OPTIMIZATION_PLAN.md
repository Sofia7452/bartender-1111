# 🚨 高并发优化方案 - 10 倍流量扩容计划

> **诊断时间**: 2026-01-28  
> **当前状态**: 3 个 CRITICAL 问题，并发大 10 倍会在 30 秒内崩溃  
> **优化目标**: 支持 10 倍流量，P99 延迟 < 500ms，成本增长 < 2 倍

---

## 📊 诊断结果汇总

### 🚨 致命问题 (CRITICAL)

1. **未配置 Vercel KV (Redis)**
   - 影响: LLM 缓存在 Serverless 中完全失效，缓存命中率从 50% → 0%
   - 后果: API 调用量暴增 10-20 倍，成本爆炸 + 限流风险

2. **数据库连接池未优化**
   - 影响: 未启用 PgBouncer 连接池
   - 后果: 并发大 10 倍后，数据库连接耗尽（Supabase 最大 60-100 连接）

3. **环境变量缺失 (JWT_SECRET)**
   - 影响: 认证功能可能异常
   - 后果: 用户登录失败

### ⚠️ 警告问题 (WARNING)

1. **OpenAI API 限额未确认** (使用 DeepSeek API)
2. **Vercel 套餐未确认** (可能是 Hobby 免费版，10 并发限制)
3. **无性能监控系统**
4. **DeepSeek API 响应偏慢** (1234ms)

---

## 🎯 优化目标

| 指标 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| **LLM 缓存命中率** | 0-5% (Serverless) | 80-90% | **16-18x** |
| **API P99 延迟** | 2000ms+ | < 500ms | **4x** |
| **数据库连接数** | 50-100 (耗尽) | 10-20 | **5x** |
| **LLM API 调用量** | 1000/天 → 10,000/天 | 2000/天 | **节省 80%** |
| **月成本** | $500 (预估) | $200 (预估) | **节省 60%** |

---

## 📋 优化实施计划

### Phase 1: 应急止血（2 天内上线）⚡ P0

#### 1.1 迁移 LLM 缓存到 Vercel KV (Redis)

**优先级**: 🔥 **P0 - 立即实施**

**预估收益**:
- 缓存命中率：0-5% → 80-90%
- LLM API 调用减少 80-90%
- 成本节省 $300-400/月

**实施步骤**:

1. **配置 Vercel KV**
   ```bash
   # 在 Vercel Dashboard 创建 KV 数据库
   # 复制 KV_REST_API_URL 和 KV_REST_API_TOKEN 到环境变量
   ```

2. **创建 Redis 缓存服务**
   ```typescript
   // app/lib/llmCache.ts
   import { kv } from '@vercel/kv';

   export class LLMCacheService {
     private readonly CACHE_TTL = 30 * 60; // 30分钟（秒）

     private getCacheKey(ingredients: string[]): string {
       return `llm:${ingredients.map(i => i.toLowerCase()).sort().join(',')}`;
     }

     async get(ingredients: string[]): Promise<any[] | null> {
       const key = this.getCacheKey(ingredients);
       return await kv.get<any[]>(key);
     }

     async set(ingredients: string[], data: any[]): Promise<void> {
       const key = this.getCacheKey(ingredients);
       await kv.set(key, data, { ex: this.CACHE_TTL });
     }

     async clear(): Promise<void> {
       // 清除所有 LLM 缓存
       const keys = await kv.keys('llm:*');
       if (keys.length > 0) {
         await kv.del(...keys);
       }
     }
   }
   ```

3. **修改 LLMService 使用 Redis 缓存**
   ```typescript
   // app/services/llmService.ts
   import { LLMCacheService } from '../lib/llmCache';

   export class LLMService {
     private llmCache = new LLMCacheService();

     async generateRecommendations(ingredients: string[]): Promise<any[]> {
       // 检查 Redis 缓存
       const cachedResult = await this.llmCache.get(ingredients);
       if (cachedResult) {
         console.log('✅ Redis 缓存命中');
         return cachedResult;
       }

       // 调用 LLM API
       const recommendations = await this.callLLMAPI(ingredients);

       // 保存到 Redis
       await this.llmCache.set(ingredients, recommendations);
       return recommendations;
     }
   }
   ```

4. **部署验证**
   - 部署到 Vercel
   - 测试缓存命中情况
   - 监控 Redis 使用量

---

#### 1.2 优化数据库连接池

**优先级**: 🔥 **P0 - 立即实施**

**方案 A: 启用 Supabase PgBouncer（推荐）**

1. **修改 DATABASE_URL**
   ```bash
   # 原有（直连）
   DATABASE_URL="postgresql://user:pass@host.supabase.co:5432/postgres"

   # 优化后（PgBouncer 连接池 - Transaction Mode）
   DATABASE_URL="postgresql://user:pass@host.supabase.co:6543/postgres"
   ```

2. **验证连接池生效**
   ```typescript
   // 在 Supabase Dashboard -> Database -> Connection Pooling 查看
   // 或运行诊断脚本检测
   ```

**方案 B: 使用 Prisma Accelerate（推荐用于高并发）**

1. **安装 Prisma Accelerate**
   ```bash
   npm install @prisma/extension-accelerate
   ```

2. **配置 Prisma Client**
   ```typescript
   // app/lib/prisma.ts
   import { PrismaClient } from '@prisma/client';
   import { withAccelerate } from '@prisma/extension-accelerate';

   export const prisma = new PrismaClient().$extends(withAccelerate());
   ```

3. **更新 DATABASE_URL**
   ```bash
   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
   ```

**成本对比**:
- PgBouncer (免费): $0/月
- Prisma Accelerate: $29/月起

**推荐**: 先用 PgBouncer，并发超过 100 再考虑 Prisma Accelerate

---

#### 1.3 添加请求限流

**优先级**: 🟡 **P1 - 1 周内实施**

**实施步骤**:

1. **安装依赖**
   ```bash
   npm install @upstash/ratelimit
   ```

2. **创建限流中间件**
   ```typescript
   // middleware.ts
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   import { Ratelimit } from '@upstash/ratelimit';
   import { kv } from '@vercel/kv';

   const ratelimit = new Ratelimit({
     redis: kv,
     limiter: Ratelimit.slidingWindow(100, '1 m'),
     analytics: true,
   });

   export async function middleware(request: NextRequest) {
     if (request.nextUrl.pathname.startsWith('/api/recommend')) {
       const identifier = request.ip ?? 'anonymous';
       const { success } = await ratelimit.limit(identifier);

       if (!success) {
         return NextResponse.json(
           { error: '请求过于频繁，请稍后重试' },
           { status: 429 }
         );
       }
     }

     return NextResponse.next();
   }

   export const config = {
     matcher: '/api/:path*',
   };
   ```

---

### Phase 2: 性能优化（1 周内上线）🚀 P1

#### 2.1 收藏列表 API 缓存优化

**实施步骤**:

1. **添加 Redis 缓存层**
   ```typescript
   // app/api/favorites/route.ts
   export async function GET(request: NextRequest) {
     const sessionId = getSessionIdFromRequest(request);
     const page = parseInt(searchParams.get('page') || '1', 10);
     
     // 检查 Redis 缓存
     const cacheKey = `favorites:${sessionId}:${page}`;
     const cached = await kv.get(cacheKey);
     if (cached) {
       console.log('✅ 收藏列表缓存命中');
       return NextResponse.json(cached);
     }

     // 查询数据库
     const [favorites, total] = await Promise.all([...]);

     // 缓存结果（5分钟）
     const response = { success: true, favorites, pagination: {...} };
     await kv.set(cacheKey, response, { ex: 300 });

     return NextResponse.json(response);
   }
   ```

2. **缓存失效策略**
   ```typescript
   // POST /api/favorites (添加收藏)
   export async function POST(request: NextRequest) {
     // ... 添加收藏 ...
     
     // 清除该用户的所有收藏列表缓存
     const keys = await kv.keys(`favorites:${sessionId}:*`);
     if (keys.length > 0) {
       await kv.del(...keys);
     }
   }
   ```

---

#### 2.2 流式 API 降级策略

**优化目标**: 缓存命中时跳过流式响应，直接返回 JSON

```typescript
// app/api/recommend/stream/route.ts
export async function POST(request: NextRequest) {
  const { ingredients } = await request.json();

  // 🔥 关键优化：优先检查缓存，直接返回 JSON（不走流式）
  const cachedResult = await llmCache.get(ingredients);
  if (cachedResult) {
    console.log('✅ 缓存命中，返回 JSON（跳过流式）');
    return NextResponse.json({
      success: true,
      recommendations: cachedResult,
      cacheHit: true,
    });
  }

  // 未命中缓存，走流式响应
  const stream = new ReadableStream({ ... });
  return new NextResponse(stream, { ... });
}
```

**收益**:
- 缓存命中时：8 秒 → 50ms
- Serverless 并发压力下降 90%

---

### Phase 3: 监控和告警（持续优化）📈 P2

#### 3.1 添加关键指标监控

**需要监控的指标**:

1. **LLM 缓存命中率** (目标 > 80%)
2. **API P99 响应时间** (目标 < 500ms)
3. **数据库连接池使用率** (目标 < 70%)
4. **DeepSeek API 调用频率** (监控是否接近限额)
5. **Redis 内存使用率**
6. **Vercel Serverless 并发数**

**实施方案**:

```typescript
// app/lib/metrics.ts
import { kv } from '@vercel/kv';

export async function trackMetric(name: string, value: number) {
  const timestamp = Date.now();
  const key = `metrics:${name}:${Math.floor(timestamp / 60000)}`; // 按分钟聚合
  await kv.zadd(key, { score: timestamp, member: value });
  await kv.expire(key, 86400); // 保留 24 小时
}

// 在关键路径埋点
await trackMetric('llm_cache_hit', cachedResult ? 1 : 0);
await trackMetric('db_query_duration', queryDuration);
await trackMetric('api_response_time', totalDuration);
```

---

## 📊 优化效果预估

### 成本分析

| 项目 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| **DeepSeek API** | $300/月 (10,000 次) | $50/月 (2,000 次) | $250/月 |
| **Vercel Serverless** | $200/月 | $100/月 | $100/月 |
| **Vercel KV (Redis)** | $0/月 | $25/月 | -$25/月 |
| **Supabase** | $0/月 (免费版) | $0/月 | $0/月 |
| **总计** | $500/月 | $175/月 | **$325/月** |

### 性能提升

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **LLM 缓存命中率** | 0-5% | 80-90% | **16-18x** |
| **收藏列表 P99** | 300ms | 20ms | **15x** |
| **流式推荐 P99** | 10s+ | 500ms (缓存命中) | **20x** |
| **数据库连接数** | 50-100 | 10-20 | **5x** |

---

## ✅ 实施检查清单

### Phase 1 (P0 - 2 天)

- [ ] 配置 Vercel KV (Redis)
- [ ] 实施 LLM 缓存迁移到 Redis
- [ ] 启用 Supabase PgBouncer 连接池
- [ ] 添加 JWT_SECRET 环境变量
- [ ] 部署到 Vercel 并验证
- [ ] 运行诊断脚本确认问题解决

### Phase 2 (P1 - 1 周)

- [ ] 实施请求限流中间件
- [ ] 优化收藏列表 API 缓存
- [ ] 实施流式 API 降级策略
- [ ] 添加缓存失效逻辑

### Phase 3 (P2 - 持续)

- [ ] 添加性能指标监控
- [ ] 集成 Vercel Analytics
- [ ] 设置告警阈值
- [ ] 定期运行压力测试
- [ ] 监控成本和性能趋势

---

## 🚀 下一步行动

1. **立即配置 Vercel KV**
   - 访问: https://vercel.com/dashboard/stores
   - 创建 KV 数据库
   - 复制环境变量到项目

2. **运行优化脚本**
   ```bash
   npx tsx scripts/diagnose-system.ts  # 再次诊断确认
   ```

3. **实施 LLM 缓存迁移**（见下方优化文件）

4. **部署验证**
   ```bash
   vercel --prod
   ```

5. **监控效果**
   - 观察 Vercel KV 使用量
   - 检查 DeepSeek API 调用量
   - 监控 API 响应时间

---

## 📚 参考资源

- [Vercel KV 文档](https://vercel.com/docs/storage/vercel-kv)
- [Prisma Accelerate 文档](https://www.prisma.io/docs/accelerate)
- [Supabase PgBouncer 文档](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/features/ratelimiting)

---

**🎯 优化目标达成标准**:
- ✅ LLM 缓存命中率 > 80%
- ✅ API P99 响应时间 < 500ms
- ✅ 数据库连接数 < 20
- ✅ 支持 10 倍流量不崩溃
- ✅ 月成本 < $200
