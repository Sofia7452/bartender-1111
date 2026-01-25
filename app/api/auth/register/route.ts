/**
 * 用户注册 API
 * POST /api/auth/register
 * 
 * 请求体：
 * {
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "name": "张三"  // 可选
 * }
 * 
 * 响应：
 * - 成功：201 Created，返回用户信息，设置 auth_token Cookie
 * - 失败：400/409/500，返回错误信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '../../../services/authService';

// 请求体验证 Schema
const registerSchema = z.object({
  email: z
    .string()
    .email('邮箱格式不正确')
    .max(255, '邮箱长度不能超过255个字符'),
  password: z
    .string()
    .min(6, '密码长度不能少于6个字符')
    .max(100, '密码长度不能超过100个字符'),
  name: z
    .string()
    .max(100, '用户名长度不能超过100个字符')
    .optional()
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
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => e.message);
      return NextResponse.json(
        { success: false, error: errors[0], details: errors },
        { status: 400 }
      );
    }

    const { email, password, name } = validationResult.data;

    // 3. 调用注册服务
    const result = await authService.register(email, password, name);

    if (!result.success) {
      // 邮箱已存在返回 409 Conflict
      const statusCode = result.error === '该邮箱已被注册' ? 409 : 500;
      return NextResponse.json(
        { success: false, error: result.error },
        { status: statusCode }
      );
    }

    // 4. 创建响应并设置 Cookie
    const response = NextResponse.json(
      {
        success: true,
        message: '注册成功',
        user: result.user
      },
      { status: 201 }
    );

    // 5. 设置 JWT 到 httpOnly Cookie
    response.cookies.set('auth_token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/'
    });

    console.log(`🎉 用户注册成功: ${email}`);
    return response;

  } catch (error) {
    console.error('注册 API 错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
