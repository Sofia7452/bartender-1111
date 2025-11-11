import { OpenAI } from 'openai';
import { env } from '../lib/env';

export class EmbeddingService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  // 生成单个文本的嵌入向量
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      throw new Error('向量化处理失败');
    }
  }

  // 批量生成嵌入向量
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    const batchSize = 100; // 批量处理大小

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: batch,
        });

        const batchEmbeddings = response.data.map(item => item.embedding);
        embeddings.push(...batchEmbeddings);

        console.log(`已处理 ${Math.min(i + batchSize, texts.length)}/${texts.length} 个文本`);

        // 添加延迟避免API限制
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`批量向量化失败 (批次 ${i}-${i + batchSize}):`, error);
        // 为失败的批次生成零向量
        const zeroVector = new Array(1536).fill(0);
        embeddings.push(...batch.map(() => zeroVector));
      }
    }

    return embeddings;
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      console.error('嵌入服务连接测试失败:', error);
      return false;
    }
  }
}
