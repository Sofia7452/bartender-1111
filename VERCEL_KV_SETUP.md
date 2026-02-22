# 🚀 Vercel KV (Redis) 配置指南

> **优化目标**: 将 LLM 缓存从内存迁移到 Redis，实现跨 Serverless 实例共享  
> **预期效果**: 缓存命中率从 0-5% → 80-90%，LLM API 调用减少 80-90%

---

## 📋 配置步骤

### 1. 创建 Vercel KV 数据库

1. **访问 Vercel Dashboard**
   ```
   https://vercel.com/dashboard/stores
   ```

2. **创建 KV 数据库**
   - 点击 "Create Database"
   - 选择 "KV (Redis)"
   - 输入数据库名称（例如：`nextjs-prisma-cache`）
   - 选择区域（推荐选择离用户最近的区域）
   - 点击 "Create"

3. **复制环境变量**
   - 创建成功后，会显示环境变量：
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
     - `KV_URL`（可选，用于 Redis CLI）
   
   - 点击 "Copy All" 或手动复制这些变量

---

### 2. 配置环境变量

#### 方法 A: 在 Vercel Dashboard 配置（推荐）

1. 访问项目设置页面
   ```
   https://vercel.com/[your-team]/[your-project]/settings/environment-variables
   ```

2. 添加环境变量：
   - 点击 "Add New"
   - 粘贴复制的环境变量
   - 选择环境：Production, Preview, Development（建议全选）
   - 点击 "Save"

3. **重新部署项目**（环境变量更新后需要重新部署）
   ```bash
   vercel --prod
   ```

#### 方法 B: 在本地 .env.local 配置（用于本地开发）

1. 编辑 `.env.local` 文件：
   ```bash
   # Vercel KV (Redis)
   KV_REST_API_URL="https://...vercel-storage.com"
   KV_REST_API_TOKEN="..."
   KV_URL="redis://...vercel-storage.com:6379"
   ```

2. 重启开发服务器：
   ```bash
   npm run dev
   ```

---

### 3. 验证配置

#### 3.1 检查 Redis 连接

运行诊断脚本：

```bash
npx tsx scripts/diagnose-system.ts
```

预期输出：

```
✅ [Cache] Vercel KV (Redis): ✅ 已配置
✅ [Cache] Redis 延迟: 25ms
✅ [Cache] Redis 连接: ✅ 连接成功
```

#### 3.2 测试缓存功能

1. **调用推荐 API**（第一次，缓存未命中）
   ```bash
   curl -X POST http://localhost:3000/api/recommend \
     -H "Content-Type: application/json" \
     -d '{"ingredients": ["伏特加", "橙汁", "蔓越莓汁"]}'
   ```

   查看日志，应该看到：
   ```
   🔍 [LLM Cache] 缓存未命中: llm:伏特加,橙汁,蔓越莓汁
   💾 [L1 Cache] 内存缓存已保存
   💾 [L2 Cache] 缓存已保存: llm:伏特加,橙汁,蔓越莓汁 (TTL: 1800s)
   ```

2. **再次调用相同的 API**（第二次，缓存命中）
   ```bash
   curl -X POST http://localhost:3000/api/recommend \
     -H "Content-Type: application/json" \
     -d '{"ingredients": ["伏特加", "橙汁", "蔓越莓汁"]}'
   ```

   查看日志，应该看到：
   ```
   ✅ [L1 Cache] 内存缓存命中
   ✅ 缓存命中 (source: memory)
   ```

3. **在新的 Serverless 实例测试**（部署后，刷新页面多次）
   ```
   ✅ [L2 Cache] Redis 缓存命中并回填内存
   ✅ 缓存命中 (source: redis)
   ```

#### 3.3 查看缓存统计

访问缓存统计 API：

```bash
curl http://localhost:3000/api/cache-stats
```

预期输出：

```json
{
  "success": true,
  "timestamp": "2026-01-28T12:00:00.000Z",
  "cache": {
    "memory": {
      "size": 3,
      "keys": ["llm:伏特加,橙汁,蔓越莓汁", "..."],
      "status": "active"
    },
    "redis": {
      "totalKeys": 15,
      "sampleKeys": ["llm:...", "..."],
      "status": "healthy"
    }
  },
  "system": {
    "redisAvailable": true,
    "cacheStrategy": "L1 (Memory) + L2 (Redis)",
    "ttl": "30 minutes"
  }
}
```

---

## 📊 监控和维护

### 1. 监控 Redis 使用量

1. **访问 Vercel KV Dashboard**
   ```
   https://vercel.com/dashboard/stores/[kv-id]
   ```

2. **查看关键指标**：
   - 存储使用量（Storage Used）
   - 请求数量（Requests）
   - 缓存命中率（需要自定义监控）

### 2. 免费额度和成本

**Vercel KV 免费额度**（Hobby 套餐）:
- 存储：256 MB
- 请求：30,000 次/天
- 带宽：100 GB/月

**预估使用量**（LLM 缓存场景）:
- 单个缓存条目：~2-5 KB（JSON 数据）
- 1000 个缓存条目：~3-5 MB
- 每天 1000 次推荐请求：
  - 缓存命中率 80% = 800 次 Redis 读取
  - 缓存未命中 20% = 200 次 Redis 写入
  - 总计：1000 次请求/天（**远低于免费额度**）

**结论**: 对于中小规模项目，**免费额度完全够用**！

---

## 🔧 高级配置

### 1. 自定义缓存 TTL

修改 `app/lib/llmCache.ts`：

```typescript
export class LLMCacheService {
  private readonly CACHE_TTL = 60 * 60; // 修改为 1 小时（秒）
}
```

### 2. 缓存预热（可选）

对于热门原料组合，可以预先生成缓存：

```typescript
// scripts/warmup-cache.ts
import { LLMService } from '../app/services/llmService';

const hotIngredients = [
  ['伏特加', '橙汁', '蔓越莓汁'],
  ['金酒', '汤力水', '青柠'],
  ['朗姆酒', '薄荷', '苏打水'],
  // ... 更多热门组合
];

async function warmupCache() {
  const llmService = new LLMService();
  
  for (const ingredients of hotIngredients) {
    console.log(`预热缓存: ${ingredients.join(', ')}`);
    await llmService.generateRecommendations(ingredients);
  }
  
  console.log('✅ 缓存预热完成');
}

warmupCache();
```

### 3. 清除缓存（管理员操作）

**方法 A: 通过 API**

```bash
# 需要配置 ADMIN_SECRET 环境变量
curl -X DELETE http://localhost:3000/api/cache-stats \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

**方法 B: 通过脚本**

```bash
npx tsx scripts/clear-cache.ts
```

**方法 C: 通过 Vercel Dashboard**

访问 KV Dashboard，点击 "Flush All Keys"（慎用）

---

## ⚠️ 故障排查

### 问题 1: Redis 连接失败

**错误信息**:
```
❌ [LLM Cache] Redis 读取失败，降级到无缓存
```

**解决方案**:
1. 检查环境变量是否正确配置
   ```bash
   echo $KV_REST_API_URL
   echo $KV_REST_API_TOKEN
   ```

2. 检查 Vercel KV 是否已创建

3. 重新部署项目（环境变量更新后需要重新部署）

### 问题 2: 缓存未命中率过高

**可能原因**:
- 原料顺序不一致（已通过排序解决）
- TTL 设置过短
- Redis 内存不足（检查 Dashboard 使用量）

**解决方案**:
1. 检查缓存键生成逻辑
2. 增加 TTL（延长缓存时间）
3. 升级 Vercel KV 套餐（如需更大容量）

### 问题 3: 缓存数据过期

**现象**: 用户总是收到旧的推荐结果

**解决方案**:
1. 清除特定缓存：
   ```bash
   # 通过 API 清除所有缓存
   curl -X DELETE http://localhost:3000/api/cache-stats \
     -H "Authorization: Bearer YOUR_ADMIN_SECRET"
   ```

2. 或等待 TTL 自动过期（默认 30 分钟）

---

## 🎯 优化效果验证

完成配置后，运行压力测试验证效果：

```bash
npx tsx scripts/benchmark-cache.ts
```

**预期结果**:

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **缓存命中率** | 0-5% | 80-90% | **16-18x** |
| **API 调用量** | 1000/天 | 100-200/天 | **5-10x 减少** |
| **P99 响应时间** | 2000ms | 200ms | **10x** |

---

## 📚 相关文档

- [Vercel KV 官方文档](https://vercel.com/docs/storage/vercel-kv)
- [Redis 最佳实践](https://redis.io/docs/manual/patterns/)
- [高并发优化方案](./HIGH_CONCURRENCY_OPTIMIZATION_PLAN.md)

---

## ✅ 配置完成检查清单

- [ ] Vercel KV 数据库已创建
- [ ] 环境变量已配置（生产 + 开发）
- [ ] 项目已重新部署
- [ ] 诊断脚本验证通过
- [ ] 缓存功能测试通过
- [ ] 缓存统计 API 正常工作
- [ ] 监控 Redis 使用量

完成以上所有步骤后，你的系统就能支持 **10 倍流量**了！🎉
