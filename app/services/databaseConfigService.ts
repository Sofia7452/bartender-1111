import { Client } from 'pg';
import { DatabaseConfig } from '../types';

export class DatabaseConfigService {
  // 创建数据库连接（使用 pg 客户端）
  private createClient(config: DatabaseConfig): Client {
    return new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
    });
  }

  // 测试数据库连接
  async testConnection(config: DatabaseConfig): Promise<{
    connected: boolean;
    message: string;
    details?: any;
  }> {
    const client = this.createClient(config);
    try {
      await client.connect();

      // 测试基本查询
      await client.query('SELECT 1');

      // 获取数据库信息
      const versionResult = await client.query('SELECT version()');
      const databasesResult = await client.query(`
        SELECT datname FROM pg_database 
        WHERE datistemplate = false
      `);

      return {
        connected: true,
        message: '数据库连接成功',
        details: {
          version: versionResult.rows[0]?.version,
          availableDatabases: databasesResult.rows.map((db: { datname: string }) => db.datname)
        }
      };
    } catch (error) {
      console.error('数据库连接测试失败:', error);
      return {
        connected: false,
        message: error instanceof Error ? error.message : '连接失败',
        details: { error: String(error) }
      };
    } finally {
      await client.end();
    }
  }

  // 检查数据库是否存在
  async checkDatabaseExists(config: DatabaseConfig): Promise<boolean> {
    const client = this.createClient({ ...config, database: 'postgres' });
    try {
      await client.connect();

      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [config.database]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('检查数据库存在性失败:', error);
      return false;
    } finally {
      await client.end();
    }
  }

  // 创建数据库
  async createDatabase(config: DatabaseConfig): Promise<{
    success: boolean;
    message: string;
  }> {
    const client = this.createClient({ ...config, database: 'postgres' });
    try {
      await client.connect();

      await client.query(`CREATE DATABASE "${config.database}"`);

      return {
        success: true,
        message: `数据库 ${config.database} 创建成功`
      };
    } catch (error) {
      console.error('创建数据库失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '创建失败'
      };
    } finally {
      await client.end();
    }
  }

  // 获取当前配置
  getCurrentConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'bartender_db',
      username: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
    };
  }

  // 验证配置完整性
  validateConfig(config: DatabaseConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.host) errors.push('主机地址不能为空');
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('端口必须是1-65535之间的数字');
    }
    if (!config.database) errors.push('数据库名称不能为空');
    if (!config.username) errors.push('用户名不能为空');
    if (!config.password) errors.push('密码不能为空');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
