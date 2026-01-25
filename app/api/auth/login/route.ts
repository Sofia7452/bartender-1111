/**
 * 用户登录 API
 * POST /api/auth/login
 * 
 * 请求体：
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 * 
 * 响应：
 * - 成功：200 OK，返回用户信息，设置 auth_token Cookie
 * - 失败：400/401/500，返回错误信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '../../../services/authService';

// 请求体验证 Schema
const loginSchema = z.object({
  email: z
    .string()
    .email('邮箱格式不正确'),
  password: z
    .string()
    .min(1, '密码不能为空')
});

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }

    // 2. 参数验证
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => e.message);
      return NextResponse.json(
        { success: false, error: errors[0], details: errors },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // 3. 调用登录服务
    const result = await authService.login(email, password);

    if (!result.success) {
      // 认证失败返回 401
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    // 4. 创建响应并设置 Cookie
    const response = NextResponse.json({
      success: true,
      message: '登录成功',
      user: result.user
    });

    // 5. 设置 JWT 到 httpOnly Cookie
    response.cookies.set('auth_token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/'
    });

    console.log(`🔓 用户登录成功: ${email}`);
    return response;

  } catch (error) {
    console.error('登录 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
