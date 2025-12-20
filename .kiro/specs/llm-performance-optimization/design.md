# Design Document

## Overview

本设计文档描述了 LLM 性能优化的技术方案。通过三个核心优化策略（减少生成内容、添加缓存机制、实现流式响应），将鸡尾酒推荐系统的响应时间从 15-18 秒降低到 8-12 秒，并通过流式响应改善用户感知的响应速度。

## Architecture

### 系统架构

```
Client
  ↓
API Routes (/api/recommend, /api/recommend/stream)
  ↓
LLM Service (with Cache)
  ↓
DeepSeek API
```

### 核心组件

1. **LLM Service**: 封装 LLM 调用逻辑，管理缓存
2. **Cache Layer**: 内存缓存，存储推荐结果
3. **API Routes**: 提供标准和流式两种 API 接口
4. **Stream Handler**: 处理流式响应的传输

## Components and Interfaces

### 1. LLM Service

```typescript
interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

interface CacheEntry {
  data: any[];
  timestamp: number;
}

class LLMService {
  private openai: OpenAI;
  private config: LLMConfig;
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL: number = 30 * 60 * 1000; // 30分钟

  // 标准推荐（带缓存）
  async generateRecommendations(ingredients: string[]): Promise<any[]>
  
  // 流式推荐（带缓存）
  async generateRecommendationsStream(
    ingredients: string[],
    onChunk: (chunk: string) => void
  ): Promise<any[]>
  
  // 缓存管理
  private getCacheKey(ingredients: string[]): string
  private getFromCache(ingredients: string[]): any[] | null
  private saveToCache(ingredients: string[], data: any[]): void
  clearCache(): void
  getCacheStats(): { size: number; keys: string[] }
}
```

### 2. API Routes

#### 标准 API: /api/recommend

```typescript
POST /api/recommend
Request: { ingredients: string[], includeRAG?: boolean }
Response: { 
  success: boolean,
  data: {
    recommendations: Recipe[],
    metadata: {...}
  }
}
```

#### 流式 API: /api/recommend/stream

```typescript
POST /api/recommend/stream
Request: { ingredients: string[] }
Response: text/event-stream
  data: {"chunk": "..."}
  data: {"chunk": "..."}
  data: [DONE]
```

## Data Models

### Recipe (优化后)

```typescript
interface Recipe {
  name: string;           // 鸡尾酒名称
  description: string;    // 一句话描述（≤20字）
  ingredients: string[];  // 原料列表（带用量）
  steps: string[];        // 制作步骤（3-5步）
  difficulty: number;     // 难度等级 1-5
  estimatedTime: number;  // 预计时间（分钟）
}
```

### Cache Entry

```typescript
interface CacheEntry {
  data: Recipe[];      // 缓存的推荐结果
  timestamp: number;   // 缓存时间戳
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 推荐数量限制

*For any* 原料组合，生成的推荐结果数量应该等于 3 个
**Validates: Requirements 1.1**

### Property 2: 字段完整性

*For any* 生成的推荐结果，每个 Recipe 对象应该包含且仅包含 6 个字段（name, description, ingredients, steps, difficulty, estimatedTime）
**Validates: Requirements 1.2**

### Property 3: 缓存一致性

*For any* 原料组合，如果缓存未过期，则相同原料组合（忽略顺序）应该返回相同的结果
**Validates: Requirements 2.1, 2.5**

### Property 4: 缓存过期清理

*For any* 缓存条目，如果时间戳距离当前时间超过 30 分钟，则该条目不应该被返回
**Validates: Requirements 2.3**

### Property 5: 流式响应完整性

*For any* 流式响应，所有 chunk 拼接后的内容应该等于完整的 LLM 响应内容
**Validates: Requirements 3.2**

### Property 6: 缓存键规范化

*For any* 两个原料列表，如果它们包含相同的原料（忽略顺序和大小写），则应该生成相同的缓存键
**Validates: Requirements 2.5**

## Error Handling

### 1. LLM API 错误

- **API Key 无效**: 返回明确的错误信息，提示配置 API Key
- **Rate Limit**: 返回友好提示，建议稍后重试
- **Network Timeout**: 返回网络错误提示

### 2. 缓存错误

- **缓存读取失败**: 降级到直接调用 LLM
- **缓存写入失败**: 记录日志，不影响主流程

### 3. 流式响应错误

- **Stream 中断**: 发送错误信息并关闭流
- **解析错误**: 返回错误信息给客户端

## Testing Strategy

### Unit Tests

1. **缓存键生成测试**
   - 测试相同原料不同顺序生成相同键
   - 测试大小写不敏感

2. **缓存过期测试**
   - 测试未过期缓存可以命中
   - 测试过期缓存被清理

3. **提示词优化测试**
   - 验证新提示词包含正确的限制条件
   - 验证参数设置正确

### Property-Based Tests

每个 property-based test 应该运行至少 100 次迭代。

1. **Property 1: 推荐数量限制**
   - 生成随机原料组合
   - 验证返回结果数量 === 3

2. **Property 2: 字段完整性**
   - 生成随机原料组合
   - 验证每个结果包含且仅包含 6 个必需字段

3. **Property 3: 缓存一致性**
   - 生成随机原料组合
   - 两次查询应返回相同结果

4. **Property 6: 缓存键规范化**
   - 生成随机原料列表及其排列
   - 验证所有排列生成相同缓存键

### Integration Tests

1. **端到端性能测试**
   - 测试优化前后的响应时间对比
   - 验证响应时间降低到目标范围

2. **流式 API 测试**
   - 测试流式响应的完整性
   - 测试流式响应的实时性

3. **缓存集成测试**
   - 测试缓存在多次请求中的表现
   - 测试缓存过期后的行为

## Implementation Notes

### 优化参数选择

- **temperature: 0.7 → 0.5**: 降低随机性，加快生成速度
- **max_tokens: 2000 → 1200**: 减少生成内容，降低响应时间
- **推荐数量: 5 → 3**: 减少生成工作量
- **字段数量: 10 → 6**: 简化 JSON 结构，减少 token 消耗

### 缓存实现方案

#### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **内存缓存 (Map)** | 1. 零延迟访问<br>2. 无需额外服务<br>3. 实现简单 | 1. 单实例限制<br>2. 重启丢失<br>3. 内存占用 | 单实例部署、开发环境 |
| **Redis** | 1. 多实例共享<br>2. 持久化支持<br>3. 丰富功能 | 1. 网络延迟<br>2. 需要额外服务<br>3. 运维成本 | 多实例部署、生产环境 |

#### 推荐方案：分阶段实现

**阶段 1: 内存缓存（当前实现）**
- 使用 TypeScript Map 作为缓存存储
- 适合快速验证优化效果
- 适合单实例 Vercel 部署场景
- 实现简单，零依赖

**阶段 2: Redis 缓存（未来扩展）**
- 当需要多实例部署时升级
- 使用 Vercel KV (基于 Redis)
- 保持接口不变，只替换底层实现

#### 当前实现细节

```typescript
class LLMService {
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30分钟
  
  // 缓存键生成：确保相同原料生成相同键
  private getCacheKey(ingredients: string[]): string {
    return ingredients.sort().join(',').toLowerCase();
  }
  
  // 缓存读取：检查过期时间
  private getFromCache(ingredients: string[]): any[] | null {
    const key = this.getCacheKey(ingredients);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    // 清理过期缓存
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }
}
```

#### 内存使用估算

- 每个推荐结果：~2KB (3个配方 × ~700字节)
- 100 个缓存条目：~200KB
- 1000 个缓存条目：~2MB
- 对于 Vercel 的内存限制（1GB）完全可接受

#### 缓存策略

- **TTL: 30 分钟**: 平衡缓存命中率和数据新鲜度
- **键生成**: 排序 + 小写 + 逗号分隔，确保一致性
- **过期清理**: 被动清理（访问时检查）+ 主动清理（可选）
- **容量限制**: 当前不限制（可根据需要添加 LRU 策略）

### 流式响应实现

- **格式**: Server-Sent Events (SSE)
- **Content-Type**: text/event-stream
- **完成信号**: data: [DONE]
- **错误处理**: 发送错误信息后关闭流

## Performance Targets

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 响应时间（首次） | 15-18s | 8-12s | ~40% |
| 响应时间（缓存） | 15-18s | <1ms | ~99.9% |
| Token 消耗 | ~500-700 | ~300-450 | ~35% |
| 用户感知延迟 | 高 | 低（流式） | 显著改善 |

