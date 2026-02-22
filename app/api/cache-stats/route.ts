import { NextRequest, NextResponse } from 'next/server';
import { LLMService } from '../../services/llmService';
import { getLLMCache } from '../../lib/llmCache';

/**
 * 缓存统计 API
 * GET /api/cache-stats
 * 
 * 返回 LLM 缓存的详细统计信息，用于监控和调试
 */
export async function GET(request: NextRequest) {
  try {
    const llmService = new LLMService();
    const llmCache = getLLMCache();

    // 获取缓存统计
    const stats = await llmService.getCacheStats();

    // 检查 Redis 健康状态
    const redisHealthy = await llmCache.healthCheck();

    // 计算缓存命中率（如果有请求历史数据）
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      cache: {
        memory: {
          size: stats.memory.size,
          keys: stats.memory.keys,
          status: stats.memory.size > 0 ? 'active' : 'empty'
        },
        redis: {
          totalKeys: stats.redis.totalKeys,
          sampleKeys: stats.redis.keys,
          status: redisHealthy ? 'healthy' : 'unhealthy'
        }
      },
      system: {
        redisAvailable: redisHealthy,
        cacheStrategy: 'L1 (Memory) + L2 (Redis)',
        ttl: '30 minutes'
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取缓存统计失败',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * 清除缓存 API
 * DELETE /api/cache-stats
 * 
 * 清除所有 LLM 缓存（慎用）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 生产环境需要验证管理员权限
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const adminSecret = process.env.ADMIN_SECRET;
      
      if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json(
          { success: false, error: '无权限操作' },
          { status: 403 }
        );
      }
    }

    const llmService = new LLMService();
    await llmService.clearCache();

    return NextResponse.json({
      success: true,
      message: '缓存已清除',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('清除缓存失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '清除缓存失败',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
