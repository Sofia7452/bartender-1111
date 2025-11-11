import { prisma } from './prisma';

// 数据库初始化（Prisma Client 是懒加载的，这里测试连接）
export async function initializeDatabase(): Promise<void> {
  try {
    // Prisma Client 在第一次查询时自动连接
    // 这里通过一个简单的查询来测试连接
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw new Error('数据库初始化失败');
  }
}

// 测试数据库连接
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ 数据库连接测试成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接测试失败:', error);
    return false;
  }
}

// 关闭数据库连接
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('🔌 数据库连接已关闭');
  } catch (error) {
    console.error('关闭数据库连接时出错:', error);
  }
}

// 获取数据库状态信息
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  healthy: boolean;
  message: string;
  tables: string[];
}> {
  try {
    // 测试基本连接
    await prisma.$queryRaw`SELECT 1`;

    // 获取表列表
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    return {
      connected: true,
      healthy: true,
      message: '数据库连接正常',
      tables: tables.map((t: { table_name: string }) => t.table_name)
    };
  } catch (error) {
    console.error('获取数据库状态失败:', error);
    return {
      connected: false,
      healthy: false,
      message: error instanceof Error ? error.message : '数据库连接失败',
      tables: []
    };
  }
}

// 为了向后兼容，导出 prisma 实例（替换 AppDataSource）
export { prisma as AppDataSource };
