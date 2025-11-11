// @ts-nocheck
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { runRagPipeline, queryVectorStore, getRagStatus } from './services/ragService';

// 初始化RAG系统
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, k } = body;

    switch (action) {
      case 'initialize':
        await runRagPipeline();
        return NextResponse.json({
          success: true,
          message: 'RAG系统初始化完成'
        });

      case 'sync':
        await runRagPipeline();
        return NextResponse.json({
          success: true,
          message: '知识库同步完成'
        });

      case 'query': {
        const result = await queryVectorStore(query, k ?? 5);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: '无效的操作' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('RAG API错误:', error);
    return NextResponse.json(
      {
        error: 'RAG操作失败',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 获取RAG状态
export async function GET() {
  try {
    const status = await getRagStatus();
    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('获取RAG状态失败:', error);
    return NextResponse.json(
      {
        error: '获取状态失败',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
