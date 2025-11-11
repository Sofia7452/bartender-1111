import { NextRequest, NextResponse } from 'next/server';
import { MCPService } from '../../services/mcpService';
import { env } from '../../lib/env';

const mcpService = new MCPService({
  serverUrl: env.MCP_SERVER_URL || 'http://localhost:1122/mcp'
});

// 生成流程图
export async function POST(request: NextRequest) {
  try {
    const { recipe } = await request.json();

    if (!recipe || !recipe.name) {
      return NextResponse.json(
        { error: '请提供有效的配方信息' },
        { status: 400 }
      );
    }

    console.log(`🎨 开始生成流程图: ${recipe.name}`);

    const flowchart = await mcpService.generateFlowchart({
      title: recipe.name,
      ingredients: recipe.ingredients || [],
      tools: recipe.tools || ['摇酒器', '量杯', '过滤器', '冰块'],
      steps: recipe.steps || [],
      outputFormat: 'png'
    });

    if (!flowchart) {
      return NextResponse.json(
        { error: '流程图生成失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        base64: flowchart,
        format: 'png',
        recipeName: recipe.name
      }
    });

  } catch (error) {
    console.error('流程图生成API错误:', error);
    return NextResponse.json(
      {
        error: '流程图生成失败',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 测试MCP连接
export async function GET() {
  try {
    const connected = await mcpService.testConnection();
    const status = mcpService.getStatus();

    return NextResponse.json({
      success: true,
      data: {
        connected,
        status
      }
    });
  } catch (error) {
    console.error('MCP连接测试失败:', error);
    return NextResponse.json(
      {
        error: 'MCP连接测试失败',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
