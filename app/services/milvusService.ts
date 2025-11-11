import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { env } from '../lib/env';

export class MilvusService {
  private client: MilvusClient;
  private collectionName = 'cocktail_recipes';
  private isConnected = false;

  constructor() {
    this.client = new MilvusClient({
      address: `${env.MILVUS_HOST}:${env.MILVUS_PORT}`,
      username: env.MILVUS_USER,
      password: env.MILVUS_PASSWORD,
    });
  }

  // 连接Milvus
  async connect(): Promise<void> {
    try {
      // 使用正确的连接方法 - connectPromise 是一个属性，不是方法
      await this.client.connectPromise;
      this.isConnected = true;
      console.log('✅ Milvus连接成功');
    } catch (error) {
      console.error('❌ Milvus连接失败:', error);
      console.log('💡 请确保Milvus Docker服务已启动: npm run docker:dev:up');
      throw new Error('Milvus连接失败，请检查Docker服务是否运行');
    }
  }

  // 创建集合
  async createCollection(): Promise<void> {
    try {
      // 检查集合是否存在
      const hasCollection = await this.client.hasCollection({
        collection_name: this.collectionName,
      });

      if (hasCollection) {
        console.log('集合已存在，跳过创建');
        return;
      }

      // 创建集合 - 使用简化的API
      await this.client.createCollection({
        collection_name: this.collectionName,
        dimension: 1536, // OpenAI embedding维度
        metric_type: 'COSINE',
      });

      // 创建索引
      await this.client.createIndex({
        collection_name: this.collectionName,
        field_name: 'vector',
        index_type: 'IVF_FLAT',
        metric_type: 'COSINE',
        params: { nlist: 1024 }
      });

      console.log('✅ Milvus集合创建成功');
    } catch (error) {
      console.error('❌ 创建Milvus集合失败:', error);
      throw error;
    }
  }

  // 插入向量数据
  async insertVectors(vectors: number[][], texts: string[], metadatas: any[]): Promise<string[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const ids = vectors.map((_, index) => `recipe_${Date.now()}_${index}`);

      // 准备数据 - 使用简化的格式
      const data = [
        {
          id: ids,
          vector: vectors,
          text: texts,
          metadata: metadatas
        }
      ];

      await this.client.insert({
        collection_name: this.collectionName,
        data: data
      });

      // 刷新数据
      await this.client.flush({
        collection_names: [this.collectionName]
      });

      console.log(`✅ 插入了 ${vectors.length} 个向量`);
      return ids;
    } catch (error) {
      console.error('❌ 插入向量失败:', error);
      throw error;
    }
  }

  // 搜索相似向量
  async search(queryVector: number[], topK: number = 5): Promise<any[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const searchParams = {
        collection_name: this.collectionName,
        data: [queryVector],
        limit: topK,
        output_fields: ['id', 'text', 'metadata'],
        search_params: {
          metric_type: 'COSINE',
          params: { nprobe: 10 }
        }
      };

      const results = await this.client.search(searchParams);

      return results.results.map((result: any) => ({
        id: result.id,
        content: result.text,
        score: result.score,
        metadata: result.metadata
      }));
    } catch (error) {
      console.error('❌ 向量搜索失败:', error);
      return [];
    }
  }

  // 获取集合信息
  async getCollectionInfo(): Promise<any> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const collectionInfo = await this.client.describeCollection({
        collection_name: this.collectionName
      });

      const stats = await this.client.getCollectionStatistics({
        collection_name: this.collectionName
      });

      return {
        name: this.collectionName,
        schema: collectionInfo.schema,
        stats: stats
      };
    } catch (error) {
      console.error('❌ 获取集合信息失败:', error);
      return null;
    }
  }

  // 关闭连接
  async close(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.closeConnection();
        this.isConnected = false;
        console.log('🔌 Milvus连接已关闭');
      }
    } catch (error) {
      console.error('关闭Milvus连接失败:', error);
    }
  }
}