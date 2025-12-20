# Requirements Document

## Introduction

本项目旨在优化鸡尾酒推荐系统的 LLM 调用性能。当前系统使用 DeepSeek API 生成推荐，但响应时间过长（15-18秒），影响用户体验。通过减少生成内容、添加缓存机制和实现流式响应，将响应时间降低到 8-12秒，并改善用户感知的响应速度。

## Glossary

- **LLM Service**: 大语言模型服务，负责调用 DeepSeek API 生成鸡尾酒推荐
- **Cache**: 缓存机制，用于存储相同原料组合的推荐结果
- **Streaming Response**: 流式响应，将 LLM 生成的内容实时传输给客户端
- **Token**: LLM 处理的文本单位，影响生成时间和成本
- **TTL**: Time To Live，缓存有效期

## Requirements

### Requirement 1

**User Story:** 作为用户，我希望鸡尾酒推荐的响应时间更快，这样我可以更快地看到推荐结果。

#### Acceptance Criteria

1. WHEN 用户请求鸡尾酒推荐 THEN LLM Service SHALL 将推荐数量从 5 个减少到 3 个
2. WHEN 用户请求鸡尾酒推荐 THEN LLM Service SHALL 将 JSON 字段从 10 个减少到 6 个核心字段（name, description, ingredients, steps, difficulty, estimatedTime）
3. WHEN 用户请求鸡尾酒推荐 THEN LLM Service SHALL 将 max_tokens 参数从 2000 降低到 1200
4. WHEN 用户请求鸡尾酒推荐 THEN LLM Service SHALL 将 temperature 参数从 0.7 降低到 0.5
5. WHEN 优化完成后 THEN LLM Service SHALL 将响应时间从 15-18 秒降低到 8-12 秒

### Requirement 2

**User Story:** 作为用户，当我使用相同的原料组合查询时，我希望能立即获得结果，而不需要重复等待 LLM 生成。

#### Acceptance Criteria

1. WHEN 用户使用相同的原料组合查询 THEN LLM Service SHALL 从缓存中返回结果
2. WHEN 缓存命中时 THEN LLM Service SHALL 在 1 毫秒内返回结果
3. WHEN 缓存条目超过 30 分钟 THEN LLM Service SHALL 自动清理过期缓存
4. WHEN 生成新的推荐结果 THEN LLM Service SHALL 将结果保存到缓存中
5. WHEN 原料顺序不同但内容相同时 THEN LLM Service SHALL 识别为相同查询并使用缓存

### Requirement 3

**User Story:** 作为用户，我希望能够实时看到推荐内容的生成过程，这样我不会觉得系统卡住了。

#### Acceptance Criteria

1. WHEN 用户请求流式推荐 THEN LLM Service SHALL 启用 stream: true 参数
2. WHEN LLM 生成内容时 THEN LLM Service SHALL 实时将每个 chunk 发送给客户端
3. WHEN 流式响应完成时 THEN LLM Service SHALL 发送完成信号
4. WHEN 流式响应出错时 THEN LLM Service SHALL 发送错误信息并关闭流
5. WHEN 缓存命中时 THEN LLM Service SHALL 模拟流式输出以保持一致的用户体验

### Requirement 4

**User Story:** 作为开发者，我希望能够监控和管理缓存，以便了解缓存使用情况和进行调试。

#### Acceptance Criteria

1. WHEN 开发者调用 getCacheStats THEN LLM Service SHALL 返回缓存大小和所有缓存键
2. WHEN 开发者调用 clearCache THEN LLM Service SHALL 清空所有缓存条目
3. WHEN 缓存命中时 THEN LLM Service SHALL 在日志中输出 "使用缓存结果"
4. WHEN 缓存保存时 THEN LLM Service SHALL 在日志中输出 "缓存已保存"
5. WHEN 缓存清空时 THEN LLM Service SHALL 在日志中输出 "缓存已清空"

### Requirement 5

**User Story:** 作为系统管理员，我希望新的流式 API 与现有 API 兼容，这样不会破坏现有功能。

#### Acceptance Criteria

1. WHEN 创建流式 API 路由 THEN System SHALL 保持现有 /api/recommend 路由不变
2. WHEN 创建流式 API 路由 THEN System SHALL 在 /api/recommend/stream 创建新路由
3. WHEN 调用流式 API THEN System SHALL 返回 text/event-stream 格式的响应
4. WHEN 调用现有 API THEN System SHALL 继续返回 JSON 格式的响应
5. WHEN 两个 API 都使用缓存时 THEN System SHALL 共享同一个缓存实例
