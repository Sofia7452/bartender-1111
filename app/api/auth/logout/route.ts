/**
 * 用户登出 API
 * POST /api/auth/logout
 * 
 * 响应：
 * - 成功：200 OK，清除 auth_token Cookie
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 创建响应
    const response = NextResponse.json({
      success: true,
      message: '登出成功'
    });

    // 清除 auth_token Cookie（设置为空值并立即过期）
    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 立即过期
      path: '/'
    });

    console.log('🔒 用户已登出');
    return response;

  } catch (error) {
    console.error('登出 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
