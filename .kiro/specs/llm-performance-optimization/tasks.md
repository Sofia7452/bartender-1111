# Implementation Plan

- [x] 1. 添加缓存机制到 LLM Service
  - 在 LLMService 类中添加 cache 属性（Map<string, CacheEntry>）
  - 添加 CACHE_TTL 常量（30分钟 = 30 * 60 * 1000）
  - 实现 getCacheKey() 私有方法：排序原料、转小写、逗号分隔
  - 实现 getFromCache() 私有方法：检查缓存是否存在且未过期，过期则删除
  - 实现 saveToCache() 私有方法：保存推荐结果和时间戳到缓存
  - 添加 CacheEntry 接口定义（data: any[], timestamp: number）
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 1.1 实现缓存管理方法
  - 实现 clearCache() 公共方法：清空所有缓存
  - 实现 getCacheStats() 公共方法：返回 { size: number, keys: string[] }
  - 在 getFromCache() 中添加日志："使用缓存结果"
  - 在 saveToCache() 中添加日志："缓存已保存"
  - 在 clearCache() 中添加日志："缓存已清空"
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 1.2 编写缓存功能的 property-based tests
  - **Property 3: 缓存一致性** - 相同原料组合返回相同结果
  - **Property 4: 缓存过期清理** - 过期缓存不被返回
  - **Property 6: 缓存键规范化** - 相同原料不同顺序生成相同键
  - **Validates: Requirements 2.1, 2.3, 2.5**

- [x] 2. 优化 LLM 推荐生成逻辑
  - 修改 buildRecommendationPrompt() 方法：将 "3-5个" 改为 "3个"
  - 简化 JSON 字段：移除 category, glassType, technique, garnish，只保留 name, description, ingredients, steps, difficulty, estimatedTime
  - 在提示词中添加描述要求："description 控制在 20 字以内"
  - 在提示词中更新步骤要求："steps 精简到 3-5 步"
  - _Requirements: 1.1, 1.2_

- [x] 2.1 优化 LLM 调用参数
  - 在 generateRecommendations() 中修改 temperature: 0.7 → 0.5
  - 在 generateRecommendations() 中修改 max_tokens: 2000 → 1200
  - 简化 system prompt：将当前的描述改为 "你是一个专业的调酒师，根据原料推荐鸡尾酒配方"
  - _Requirements: 1.3, 1.4_

- [x] 2.2 集成缓存到推荐生成流程
  - 在 generateRecommendations() 方法开始时调用 getFromCache(ingredients)
  - 如果缓存命中（返回非 null），记录日志并直接返回缓存结果
  - 如果缓存未命中，继续执行现有的 LLM 调用逻辑
  - 在成功解析推荐结果后，调用 saveToCache(ingredients, recommendations) 保存结果
  - _Requirements: 2.1, 2.2, 2.4_

- [ ]* 2.3 编写推荐优化的 property-based tests
  - **Property 1: 推荐数量限制** - 返回结果数量 === 3
  - **Property 2: 字段完整性** - 每个结果包含 6 个必需字段
  - **Validates: Requirements 1.1, 1.2**

- [ ] 3. 实现流式响应功能
  - 在 LLMService 中添加 generateRecommendationsStream() 方法
  - 方法签名：async generateRecommendationsStream(ingredients: string[], onChunk: (chunk: string) => void): Promise<any[]>
  - 在调用 openai.chat.completions.create() 时设置 stream: true
  - 使用 for await (const chunk of response) 循环处理 stream chunks
  - 提取 chunk.choices[0]?.delta?.content 并通过 onChunk 回调传递
  - 收集所有 chunks 拼接成完整内容，解析后返回
  - _Requirements: 3.1, 3.2_

- [ ] 3.1 处理流式响应的缓存逻辑
  - 在 generateRecommendationsStream() 开始时调用 getFromCache(ingredients)
  - 如果缓存命中，通过 onChunk 模拟流式输出（将缓存的 JSON 字符串分块发送）
  - 如果缓存未命中，在流式生成完成后调用 saveToCache() 保存结果
  - _Requirements: 3.5, 2.1_

- [ ] 3.2 添加流式响应的错误处理
  - 在 generateRecommendationsStream() 中使用 try-catch 捕获异常
  - 记录错误日志：console.error('流式推荐生成失败:', error)
  - 抛出友好的错误信息（类似 generateRecommendations 的错误处理）
  - _Requirements: 3.4_

- [ ] 4. 创建流式 API 路由
  - 创建 app/api/recommend/stream/route.ts 文件
  - 实现 POST 方法：export async function POST(request: NextRequest)
  - 解析请求体获取 ingredients 参数
  - 验证 ingredients 是否为非空数组，否则返回 400 错误
  - 创建 ReadableStream 并返回 NextResponse
  - _Requirements: 5.2, 5.3_

- [ ] 4.1 实现 Server-Sent Events 格式
  - 在流式 API 路由中创建 TextEncoder 实例
  - 在 ReadableStream 的 start 方法中调用 llmService.generateRecommendationsStream()
  - onChunk 回调中将每个 chunk 格式化为 `data: ${JSON.stringify({chunk})}\n\n`
  - 使用 controller.enqueue(encoder.encode(...)) 发送数据
  - 完成后发送 `data: [DONE]\n\n` 信号
  - 设置响应头：Content-Type: 'text/event-stream', Cache-Control: 'no-cache', Connection: 'keep-alive'
  - _Requirements: 3.3, 5.3_

- [ ] 4.2 确保 API 兼容性
  - 验证现有 /api/recommend 路由保持不变（无需修改）
  - 在流式 API 路由中使用相同的 llmService 实例（共享缓存）
  - 手动测试现有 API 功能未受影响
  - _Requirements: 5.1, 5.4, 5.5_

- [ ]* 5. 性能测试和验证
  - 创建性能测试脚本（可选）
  - 测试优化前后的响应时间对比
  - 验证缓存命中时的响应时间 < 1ms
  - 验证首次请求响应时间在 8-12 秒范围内
  - _Requirements: 1.5, 2.2_

- [ ]* 5.1 编写集成测试
  - 测试标准 API 的完整流程
  - 测试流式 API 的完整流程
  - 测试缓存在多次请求中的表现
  - 测试缓存过期后的行为

- [ ] 6. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户