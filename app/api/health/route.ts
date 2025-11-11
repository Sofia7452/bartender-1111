import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export async function GET() {
  try {
    const services: {
      database: 'healthy' | 'unhealthy' | 'unknown';
      milvus?: 'healthy' | 'unhealthy' | 'unknown';
      redis?: 'healthy' | 'unhealthy' | 'unknown';
    } = {
      database: 'unknown',
    };

    // 检查数据库连接
    try {
      // 简单的数据库查询测试
      await prisma.$queryRaw`SELECT 1`;
      services.database = 'healthy';
    } catch (dbError) {
      console.error('数据库连接失败:', dbError);
      services.database = 'unhealthy';
    }

    // 检查 Milvus 连接（如果配置了）
    if (process.env.MILVUS_HOST) {
      services.milvus = 'unknown'; // 可以添加实际的 Milvus 健康检查
    }

    // 检查 Redis 连接（如果配置了）
    if (process.env.REDIS_URL) {
      services.redis = 'unknown'; // 可以添加实际的 Redis 健康检查
    }

    const isHealthy = services.database === 'healthy';

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database_url: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL.substring(0, 30)}...` // 只显示前30个字符
        : 'not configured',
      services,
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
