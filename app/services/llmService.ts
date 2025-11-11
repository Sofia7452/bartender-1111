import OpenAI from 'openai';
import { env } from '../lib/env';

interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

export class LLMService {
  private openai: OpenAI;
  private config: LLMConfig;

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
  }

  // 生成鸡尾酒推荐
  async generateRecommendations(ingredients: string[]): Promise<any[]> {
    try {
      // 验证配置
      if (!this.config.apiKey || this.config.apiKey === '' || this.config.apiKey.includes('your_openai_api_key')) {
        throw new Error('OPENAI_API_KEY 未配置或无效。请在环境变量中配置有效的 OpenAI API 密钥。');
      }

      const prompt = this.buildRecommendationPrompt(ingredients);

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的调酒师，擅长根据现有原料推荐合适的鸡尾酒配方。请提供详细、准确的配方信息。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM 返回内容为空');
      }

      return this.parseRecommendations(content);
    } catch (error: any) {
      console.error('LLM推荐生成失败:', error);

      // 提供更详细的错误信息
      let errorMessage = '推荐生成失败，请检查LLM配置';

      if (error?.message) {
        if (error.message.includes('API key')) {
          errorMessage = 'OpenAI API 密钥无效或未配置。请在 Vercel 环境变量中配置 OPENAI_API_KEY。';
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'OpenAI API 请求频率超限，请稍后重试。';
        } else if (error.message.includes('quota')) {
          errorMessage = 'OpenAI API 配额已用完，请检查账户余额。';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorMessage = '网络连接失败，请检查网络连接。';
        } else {
          errorMessage = error.message;
        }
      }

      throw new Error(errorMessage);
    }
  }

  // 构建推荐提示词
  private buildRecommendationPrompt(ingredients: string[]): string {
    return `基于以下原料，推荐3-5个适合的鸡尾酒配方：

原料列表：${ingredients.join('、')}

请为每个推荐提供以下信息（JSON格式）：
{
  "name": "鸡尾酒名称",
  "description": "简短描述",
  "ingredients": ["原料1 用量", "原料2 用量", ...],
  "steps": ["步骤1", "步骤2", ...],
  "difficulty": 1-5,
  "estimatedTime": 分钟数,
  "category": "分类",
  "glassType": "杯型",
  "technique": "调制技巧",
  "garnish": "装饰"
}

请确保：
1. 配方中的原料尽量使用用户提供的原料
2. 难度等级：1=简单，2=容易，3=中等，4=困难，5=专家
3. 制作步骤要详细清晰
4. 返回有效的JSON数组格式`;
  }

  // 解析推荐结果
  private parseRecommendations(content: string | null): any[] {
    if (!content) return [];

    try {
      // 尝试直接解析JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // 如果直接解析失败，尝试提取JSON
      return this.extractFromText(content);
    } catch (error) {
      console.error('解析推荐结果失败:', error);
      return this.extractFromText(content);
    }
  }

  // 从文本中提取配方信息
  private extractFromText(content: string): any[] {
    const recipes = [];
    const lines = content.split('\n');
    let currentRecipe: any = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.includes('"name"') || trimmedLine.includes('鸡尾酒名称')) {
        if (currentRecipe) recipes.push(currentRecipe);
        currentRecipe = {
          name: '',
          description: '',
          ingredients: [],
          steps: [],
          difficulty: 1,
          estimatedTime: 0,
          category: '经典',
          glassType: '古典杯',
          technique: '摇和',
          garnish: ''
        };
      }

      if (currentRecipe) {
        if (trimmedLine.includes('"name"') && trimmedLine.includes(':')) {
          currentRecipe.name = this.extractValue(trimmedLine);
        } else if (trimmedLine.includes('"description"') && trimmedLine.includes(':')) {
          currentRecipe.description = this.extractValue(trimmedLine);
        } else if (trimmedLine.includes('"ingredients"') && trimmedLine.includes('[')) {
          // 处理原料数组
          const ingredientsMatch = content.match(/"ingredients":\s*\[([\s\S]*?)\]/);
          if (ingredientsMatch) {
            currentRecipe.ingredients = this.parseArray(ingredientsMatch[1]);
          }
        } else if (trimmedLine.includes('"steps"') && trimmedLine.includes('[')) {
          // 处理步骤数组
          const stepsMatch = content.match(/"steps":\s*\[([\s\S]*?)\]/);
          if (stepsMatch) {
            currentRecipe.steps = this.parseArray(stepsMatch[1]);
          }
        } else if (trimmedLine.includes('"difficulty"') && trimmedLine.includes(':')) {
          currentRecipe.difficulty = parseInt(this.extractValue(trimmedLine)) || 1;
        } else if (trimmedLine.includes('"estimatedTime"') && trimmedLine.includes(':')) {
          currentRecipe.estimatedTime = parseInt(this.extractValue(trimmedLine)) || 0;
        }
      }
    }

    if (currentRecipe) recipes.push(currentRecipe);
    return recipes;
  }

  private extractValue(line: string): string {
    const match = line.match(/:\s*["']?([^"',\]]+)["']?/);
    return match ? match[1].trim() : '';
  }

  private parseArray(arrayStr: string): string[] {
    const items = arrayStr.split(',').map(item =>
      item.trim().replace(/^["']|["']$/g, '')
    );
    return items.filter(item => item.length > 0);
  }

  // 更新配置
  updateConfig(newConfig: Partial<LLMConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });
  }

  // 获取当前配置
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  // 测试连接
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
