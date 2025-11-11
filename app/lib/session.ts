import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * 生成唯一的会话ID
 * 格式: session_timestamp_randomstring
 * @returns {string} 唯一的会话ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 11); // 9个字符
  return `session_${timestamp}_${randomString}`;
}

/**
 * 从请求中获取会话ID
 * 优先从cookie中读取，如果没有则生成新的会话ID
 * 
 * @param {NextRequest} request - Next.js请求对象
 * @returns {string} 会话ID
 */
export function getSessionIdFromRequest(request: NextRequest): string {
  // 尝试从cookie中获取sessionId
  const sessionIdCookie = request.cookies.get('session_id');

  if (sessionIdCookie?.value) {
    return sessionIdCookie.value;
  }

  // 如果没有cookie，生成新的sessionId
  // 注意：在Next.js API路由中，无法直接设置cookie到响应中
  // 需要在响应处理时调用setSessionCookie
  return generateSessionId();
}

/**
 * 在响应中设置sessionId cookie
 * 
 * @param {NextResponse} response - Next.js响应对象
 * @param {string} sessionId - 会话ID
 * @param {number} maxAge - Cookie过期时间（秒），默认30天
 * @returns {NextResponse} 设置cookie后的响应对象
 */
export function setSessionCookie(
  response: NextResponse,
  sessionId: string,
  maxAge: number = 60 * 60 * 24 * 30 // 30天
): NextResponse {
  response.cookies.set('session_id', sessionId, {
    maxAge,
    httpOnly: true, // 防止客户端JavaScript访问
    secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
    sameSite: 'lax', // CSRF保护
    path: '/', // 全站可用
  });

  return response;
}

/**
 * 在服务端组件或API路由中获取会话ID（使用cookies()函数）
 * 这是Next.js 15推荐的方式，适用于Server Components和API Routes
 * 
 * @returns {string} 会话ID（如果不存在则生成新的）
 */
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const sessionIdCookie = cookieStore.get('session_id');

  if (sessionIdCookie?.value) {
    return sessionIdCookie.value;
  }

  // 如果没有cookie，生成新的sessionId
  return generateSessionId();
}

/**
 * 在服务端组件或API路由中设置会话ID cookie
 * 
 * @param {string} sessionId - 会话ID
 * @param {number} maxAge - Cookie过期时间（秒），默认30天
 */
export async function setSessionIdCookie(
  sessionId: string,
  maxAge: number = 60 * 60 * 24 * 30 // 30天
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('session_id', sessionId, {
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * 验证会话ID格式是否正确
 * 
 * @param {string} sessionId - 待验证的会话ID
 * @returns {boolean} 格式是否正确
 */
export function isValidSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  // 验证格式: session_timestamp_randomstring
  const pattern = /^session_\d+_[a-z0-9]+$/;
  return pattern.test(sessionId);
}

