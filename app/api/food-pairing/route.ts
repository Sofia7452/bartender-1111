/**
 * 菜品与酒品搭配推荐 API
 * 
 * POST /api/food-pairing - 获取菜品和酒品搭配推荐
 * GET /api/food-pairing - 健康检查
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFoodPairingService } from '../../services/langgraphService';
import type { CompletePairingRecommendation } from '../../types/foodPairing';

/**
 * POST 方法：获取菜品和酒品搭配推荐
 * 
 * 请求体：
 * {
 *   cuisine?: string,           // 菜系类型（可选）
 *   foodIngredients: string[],   // 食品原料列表（必需）
 *   drinkIngredients?: string[]  // 酒原料列表（可选）
 * }
 * 
 * 响应：
 * {
 *   success: boolean,
 *   data?: CompletePairingRecommendation,
 *   error?: string,
 *   details?: any
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('请求体解析失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: '请求体格式错误，请确保 Content-Type 为 application/json',
        },
        { status: 400 }
      );
    }

    const { cuisine, foodIngredients, drinkIngredients } = body || {};

    // 2. 验证输入参数
    if (!foodIngredients || !Array.isArray(foodIngredients) || foodIngredients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '请提供有效的食品原料列表（foodIngredients）',
          details: 'foodIngredients 必须是一个非空数组',
        },
        { status: 400 }
      );
    }

    // 验证 drinkIngredients（如果提供）
    if (drinkIngredients !== undefined && (!Array.isArray(drinkIngredients) || drinkIngredients.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: '如果提供酒原料列表（drinkIngredients），必须是一个非空数组',
        },
        { status: 400 }
      );
    }

    console.log('🍽️ 收到菜品与酒品搭配推荐请求');
    console.log('📥 输入参数:', {
      cuisine: cuisine || '未指定',
      foodIngredients,
      drinkIngredients: drinkIngredients || [],
    });

    // 3. 获取服务实例
    const service = getFoodPairingService();

    // 4. 执行 LangGraph 推荐流程
    const startTime = Date.now();
    let pairingResult: CompletePairingRecommendation;

    try {
      pairingResult = await service.execute({
        cuisine: cuisine || null,
        foodIngredients,
        drinkIngredients: drinkIngredients || [],
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // 记录详细错误日志（包含堆栈跟踪）
      console.error(`❌ LangGraph 执行失败，耗时 ${executionTime}ms`);
      console.error('错误详情:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        cause: error?.cause,
      });

      // 处理超时错误
      if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: '请求超时，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          },
          { status: 504 } // Gateway Timeout
        );
      }

      // 处理输入验证错误
      if (error?.message?.includes('输入验证失败') || error?.message?.includes('validation')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message || '输入参数验证失败',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          },
          { status: 400 }
        );
      }

      // 处理其他执行错误
      const userFriendlyMessage = error?.message || '推荐服务执行失败，请稍后重试';
      return NextResponse.json(
        {
          success: false,
          error: userFriendlyMessage,
          details: process.env.NODE_ENV === 'development'
            ? {
              message: error?.message,
              stack: error?.stack,
              name: error?.name,
            }
            : undefined,
        },
        { status: 500 }
      );
    }

    const executionTime = Date.now() - startTime;

    // 5. 构建响应
    const response = {
      success: true,
      data: pairingResult,
      metadata: {
        executionTime,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`✅ 推荐完成，耗时 ${executionTime}ms`);
    console.log(`📊 结果: ${pairingResult.dishes.length} 个菜品, ${pairingResult.beverages.length} 个酒品, ${pairingResult.pairingReasons.length} 个搭配理由`);

    return NextResponse.json(response);
  } catch (error: any) {
    // 记录未预期错误的详细日志（包含堆栈跟踪）
    console.error('❌ API 处理失败 - 未预期的错误');
    console.error('错误详情:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
    });

    // 处理未预期的错误
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误，请稍后重试',
        details: process.env.NODE_ENV === 'development'
          ? {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
          }
          : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET 方法：健康检查
 * 
 * 响应：
 * {
 *   status: 'healthy' | 'unhealthy',
 *   services: {
 *     langgraph: { graphBuilt: boolean, serviceReady: boolean }
 *   },
 *   timestamp: string
 * }
 */
export async function GET() {
  try {
    const service = getFoodPairingService();
    const serviceStatus = service.getStatus();

    return NextResponse.json({
      status: 'healthy',
      services: {
        langgraph: serviceStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

