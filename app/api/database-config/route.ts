import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConfigService } from '../../services/databaseConfigService';
import { getDatabaseStatus } from '../../lib/database';

const dbConfigService = new DatabaseConfigService();

// 获取当前数据库配置
export async function GET() {
  try {
    const config = dbConfigService.getCurrentConfig();
    const status = await getDatabaseStatus();

    return NextResponse.json({
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        // 不返回密码
      },
      status
    });
  } catch (error) {
    console.error('获取数据库配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// 测试数据库连接
export async function POST(request: NextRequest) {
  try {
    const config = await request.json();

    // 验证配置
    const validation = dbConfigService.validateConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        {
          connected: false,
          error: '配置验证失败',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // 测试连接
    const result = await dbConfigService.testConnection(config);

    return NextResponse.json(result);
  } catch (error) {
    console.error('数据库连接测试失败:', error);
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : '测试失败'
      },
      { status: 500 }
    );
  }
}

// 检查数据库状态
export async function PUT() {
  try {
    const status = await getDatabaseStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('检查数据库状态失败:', error);
    return NextResponse.json(
      {
        connected: false,
        healthy: false,
        message: '检查状态失败',
        tables: []
      },
      { status: 500 }
    );
  }
}
