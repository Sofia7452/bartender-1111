import { NextRequest, NextResponse } from 'next/server';
import { LLMService } from '../../../services/llmService';

// 使用与标准 API 相同的 llmService 实例（共享缓存）
const llmService = new LLMService();

export async function POST(request: NextRequest) {
  try {
    const { ingredients } = await request.json();

    // 验证 ingredients 是否为非空数组
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的原料列表' },
        { status: 400 }
      );
    }

    console.log(`🍹 开始流式推荐鸡尾酒，原料: ${ingredients.join('、')}`);

    // 创建 TextEncoder 实例
    const encoder = new TextEncoder();

    // 创建 ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 调用 llmService.generateRecommendationsStream()
          await llmService.generateRecommendationsStream(
            ingredients,
            (chunk: string) => {
              // 将每个 chunk 格式化为 Server-Sent Events 格式
              const data = `data: ${JSON.stringify({ chunk })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          );

          // 完成后发送 [DONE] 信号
          const doneSignal = `data: [DONE]\n\n`;
          controller.enqueue(encoder.encode(doneSignal));

          console.log(`✅ 流式推荐完成`);
          controller.close();
        } catch (error) {
          console.error('流式推荐错误:', error);
          
          // 发送错误信息
          const errorData = `data: ${JSON.stringify({ 
            error: error instanceof Error ? error.message : '推荐生成失败' 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      }
    });

    // 返回 NextResponse 并设置响应头
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('流式推荐API错误:', error);
    return NextResponse.json(
      {
        error: '推荐服务暂时不可用，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
