/**
 * 获取当前用户信息 API
 * GET /api/auth/me
 * 
 * 响应：
 * - 已登录：200 OK，返回用户信息
 * - 未登录：401 Unauthorized
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '../../../services/authService';

export async function GET(request: NextRequest) {
  try {
    // 1. 从 Cookie 中获取 token
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          error: '未登录',
          isAuthenticated: false 
        },
        { status: 401 }
      );
    }

    // 2. 验证 token
    const payload = await authService.verifyToken(token);

    if (!payload) {
      // Token 无效，清除 Cookie
      const response = NextResponse.json(
        { 
          success: false, 
          error: 'Token 无效或已过期',
          isAuthenticated: false 
        },
        { status: 401 }
      );

      response.cookies.set('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      });

      return response;
    }

    // 3. 获取用户信息
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: '用户不存在',
          isAuthenticated: false 
        },
        { status: 401 }
      );
    }

    // 4. 返回用户信息
    return NextResponse.json({
      success: true,
      isAuthenticated: true,
      user
    });

  } catch (error) {
    console.error('获取用户信息 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
