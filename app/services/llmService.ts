import OpenAI from 'openai';
import { env } from '../lib/env';
import { getLLMCache } from '../lib/llmCache';

interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

interface CacheEntry {
  data: any[];
  timestamp: number;
}

// 统一的 LLM 响应结构
interface LLMResponse {
  type: 'recipes' | 'chat';
  data?: any[];
  message?: string;
}

export class LLMService {
  private openai: OpenAI;
  private config: LLMConfig;
  private memoryCache: Map<string, CacheEntry>;
  private readonly CACHE_TTL: number = 30 * 60 * 1000; // 30分钟
  private redisCache = getLLMCache();

  private static readonly COCKTAIL_EXPERT_SYSTEM_PROMPT = `你是一位拥有 20 年经验的资深调酒师，精通经典鸡尾酒、现代调酒技术及风味配搭。

### 行为准则
1. **专业性**：使用准确的调酒术语（如：摇和法、搅拌法、直调法）。
2. **知识范围**：你只回答与鸡尾酒、酒精饮料、调酒技术、原料配搭相关的问题。如果用户询问你的身份，请告知你是"智能调酒助手"。如果用户的问题完全无关（如：编程、数学、时政），请礼貌地拒绝并引导其回到调酒话题。
3. **防幻觉策略**：如果用户提供的原料完全无法调配出合理的饮品，请诚实告知用户，并建议一些基础原料，不要硬造配方。

### 输出格式（严格遵守）
你必须始终返回一个合法的 JSON 对象，格式如下：

**配方推荐场景**（用户提供了调酒原料）：
{
  "type": "recipes",
  "data": [
    {
      "name": "鸡尾酒名称",
      "description": "20字以内描述",
      "ingredients": ["原料1 用量", "原料2 用量"],
      "steps": ["步骤1", "步骤2"],
      "difficulty": 3,
      "estimatedTime": 5
    }
  ]
}

**闲聊/无关/拒绝场景**（用户不是在提供原料）：
{
  "type": "chat",
  "message": "你的回复内容"
}

严禁输出任何非 JSON 内容。`;

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      apiKey: config?.apiKey || env.OPENAI_API_KEY,
      baseURL: config?.baseURL || env.OPENAI_BASE_URL,
      model: config?.model || env.LLM_MODEL,
    };

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });

    this.memoryCache = new Map<string, CacheEntry>();
  }

  private getCacheKey(ingredients: string[], options?: Record<string, any>): string {
    const base = ingredients.map(i => i.toLowerCase()).sort().join(',');
    if (!options) return base;

    const optionStr = Object.keys(options).sort().map(k => `${k}:${options[k]}`).join('|');
    return `${base}:opts[${optionStr}]`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async getFromCache(ingredients: string[], customPrompt?: string): Promise<{ data: any[] | null; source: 'memory' | 'redis' | 'none' }> {
    const options = customPrompt ? { promptHash: this.simpleHash(customPrompt) } : undefined;
    const key = this.getCacheKey(ingredients, options);

    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && Date.now() - memoryCached.timestamp < this.CACHE_TTL) {
      console.log('✅ [L1 Cache] 内存缓存命中');
      return { data: memoryCached.data, source: 'memory' };
    }

    if (memoryCached) {
      this.memoryCache.delete(key);
    }

    try {
      const redisData = await this.redisCache.get(ingredients, options);
      if (redisData) {
        this.memoryCache.set(key, { data: redisData, timestamp: Date.now() });
        console.log('✅ [L2 Cache] Redis 缓存命中并回填内存');
        return { data: redisData, source: 'redis' };
      }
    } catch (error) {
      console.error('⚠️ [L2 Cache] Redis 读取失败，降级到无缓存:', error);
    }

    return { data: null, source: 'none' };
  }

  private async saveToCache(ingredients: string[], data: any[], customPrompt?: string): Promise<void> {
    const options = customPrompt ? { promptHash: this.simpleHash(customPrompt) } : undefined;
    const key = this.getCacheKey(ingredients, options);

    this.memoryCache.set(key, { data, timestamp: Date.now() });
    console.log('💾 [L1 Cache] 内存缓存已保存');

    try {
      await this.redisCache.set(ingredients, data, options);
    } catch (error) {
      console.error('⚠️ [L2 Cache] Redis 写入失败:', error);
    }
  }

  async clearCache(): Promise<void> {
    this.memoryCache.clear();
    console.log('🗑️ [L1 Cache] 内存缓存已清空');

    try {
      const count = await this.redisCache.clearAll();
      console.log(`🗑️ [L2 Cache] Redis 缓存已清空 (${count} 个)`);
    } catch (error) {
      console.error('⚠️ [L2 Cache] Redis 清空失败:', error);
    }
  }

  async getCacheStats(): Promise<{ memory: { size: number; keys: string[] }; redis: { totalKeys: number; keys: string[] } }> {
    const memoryStats = {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys())
    };

    let redisStats = { totalKeys: 0, keys: [] as string[] };
    try {
      redisStats = await this.redisCache.getStats();
    } catch (error) {
      console.error('⚠️ 获取 Redis 统计信息失败:', error);
    }

    return { memory: memoryStats, redis: redisStats };
  }

  /**
   * 解析 LLM 返回的 JSON 响应，统一处理配方和聊天两种场景。
   * 如果 JSON 解析失败，降级为聊天回复。
   */
  private parseLLMResponse(content: string): any[] {
    try {
      const parsed: LLMResponse = JSON.parse(content);

      if (parsed.type === 'chat') {
        console.log('💬 [Intent] 检测到非配方查询，返回聊天回复');
        return [{
          id: 'chat-response',
          name: '智能助手',
          description: parsed.message || '',
          isChat: true,
          ingredients: [],
          steps: [],
          difficulty: 1,
          estimatedTime: 0
        }];
      }

      if (parsed.type === 'recipes' && Array.isArray(parsed.data)) {
        console.log(`🍹 [Intent] 检测到配方推荐，共 ${parsed.data.length} 个`);
        return parsed.data;
      }

      // 兜底：如果 type 不识别，尝试当作配方数组解析
      if (Array.isArray(parsed)) {
        return parsed;
      }

      console.warn('⚠️ LLM 返回了未知的 JSON 结构，降级为聊天回复');
      return [{
        id: 'chat-response',
        name: '智能助手',
        description: content.trim(),
        isChat: true,
        ingredients: [],
        steps: [],
        difficulty: 1,
        estimatedTime: 0
      }];
    } catch {
      // JSON 解析失败，将原始文本作为聊天回复返回
      console.warn('⚠️ JSON 解析失败，降级为聊天回复');
      return [{
        id: 'chat-response',
        name: '智能助手',
        description: content.trim(),
        isChat: true,
        ingredients: [],
        steps: [],
        difficulty: 1,
        estimatedTime: 0
      }];
    }
  }

  async generateRecommendations(ingredients: string[], customPrompt?: string): Promise<any[]> {
    try {
      const { data: cachedResult, source } = await this.getFromCache(ingredients, customPrompt);
      if (cachedResult !== null) {
        console.log(`✅ 缓存命中 (source: ${source})`);
        return cachedResult;
      }

      if (!this.config.apiKey || this.config.apiKey === '' || this.config.apiKey.includes('your_openai_api_key')) {
        throw new Error('OPENAI_API_KEY 未配置或无效。请在环境变量中配置有效的 OpenAI API 密钥。');
      }

      const prompt = customPrompt || this.buildRecommendationPrompt(ingredients);

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: LLMService.COCKTAIL_EXPERT_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM 返回内容为空');
      }

      const recommendations = this.parseLLMResponse(content);

      if (recommendations.length > 0 && !recommendations[0].isChat) {
        await this.saveToCache(ingredients, recommendations, customPrompt);
      }

      return recommendations;
    } catch (error: any) {
      console.error('LLM推荐生成失败:', error);
      throw new Error(this.formatErrorMessage(error));
    }
  }

  private buildRecommendationPrompt(ingredients: string[]): string {
    const rawInput = ingredients.join('、');
    return `用户输入内容如下：
---
${rawInput}
---

请根据上述内容执行以下逻辑：
1. 判断用户输入的是否是"调酒原料"或"调酒相关咨询"。
2. 如果是调酒请求：基于原料推荐 3 个配方，返回 { "type": "recipes", "data": [...] } 格式。
3. 如果不是调酒请求（如闲聊、问身份、问其他话题）：返回 { "type": "chat", "message": "你的回复" } 格式。

请确保返回合法的 JSON 对象。`;
  }

  // 流式模式：由于大部分 API 在 stream 模式下不支持 response_format，
  // 这里保留降级解析逻辑，收集完整内容后统一用 parseLLMResponse 解析。
  async generateRecommendationsStream(
    ingredients: string[],
    onChunk: (chunk: string, isCacheHit?: boolean) => void,
    customPrompt?: string
  ): Promise<any[]> {
    try {
      const { data: cachedResult, source } = await this.getFromCache(ingredients, customPrompt);
      if (cachedResult !== null) {
        console.log(`✅ 缓存命中（流式模拟, source: ${source}）`);
        onChunk('', true);
        const cachedJson = JSON.stringify(cachedResult);
        const chunkSize = 50;
        for (let i = 0; i < cachedJson.length; i += chunkSize) {
          const chunk = cachedJson.slice(i, i + chunkSize);
          onChunk(chunk, true);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return cachedResult;
      }

      if (!this.config.apiKey || this.config.apiKey === '' || this.config.apiKey.includes('your_openai_api_key')) {
        throw new Error('OPENAI_API_KEY 未配置或无效。请在环境变量中配置有效的 OpenAI API 密钥。');
      }

      const prompt = customPrompt || this.buildRecommendationPrompt(ingredients);

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: LLMService.COCKTAIL_EXPERT_SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1200,
        stream: true,
      });

      let fullContent = '';
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      }

      if (!fullContent) {
        throw new Error('LLM 返回内容为空');
      }

      const recommendations = this.parseLLMResponse(fullContent);

      if (recommendations.length > 0 && !recommendations[0].isChat) {
        await this.saveToCache(ingredients, recommendations, customPrompt);
      }

      return recommendations;
    } catch (error: any) {
      console.error('流式推荐生成失败:', error);
      throw new Error(this.formatErrorMessage(error));
    }
  }

  private formatErrorMessage(error: any): string {
    if (!error?.message) return '推荐生成失败，请检查LLM配置';

    if (error.message.includes('API key')) {
      return 'OpenAI API 密钥无效或未配置。请在 Vercel 环境变量中配置 OPENAI_API_KEY。';
    }
    if (error.message.includes('rate limit')) {
      return 'OpenAI API 请求频率超限，请稍后重试。';
    }
    if (error.message.includes('quota')) {
      return 'OpenAI API 配额已用完，请检查账户余额。';
    }
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return '网络连接失败，请检查网络连接。';
    }
    return error.message;
  }

  updateConfig(newConfig: Partial<LLMConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('LLM API连接测试失败:', error);
      return false;
    }
  }
}
