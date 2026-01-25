/**
 * Next.js 中间件
 * 
 * 用于处理认证和请求拦截
 * 
 * 认证策略：
 * - 公开路由：无需认证
 * - 受保护路由（可选认证）：未登录时使用 sessionId，登录后使用 userId
 * - 严格保护路由：必须登录才能访问
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// JWT 配置（与 authService 保持一致）
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);
const JWT_ISSUER = 'cocktail-app';
const JWT_AUDIENCE = 'cocktail-app-users';

// 公开路由（无需任何认证）
const PUBLIC_ROUTES = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/recommend',
  '/api/rag',
  '/api/food-pairing',
  '/api/flowchart'
];

// 严格保护路由（必须登录）
// 注意：这些路由在登录模式下才启用，通过环境变量控制
const STRICT_PROTECTED_ROUTES = [
  '/api/auth/me'
  // 可以在这里添加更多需要强制登录的路由
];

// 可选认证路由（支持匿名和登录两种模式）
// 这些路由会在 header 中注入用户信息，但不强制登录
const OPTIONAL_AUTH_ROUTES = [
  '/api/favorites',
  '/api/saved-sets'
];

/**
 * 验证 JWT Token
 */
async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 公开路由直接放行
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 2. 获取认证 Token
  const token = request.cookies.get('auth_token')?.value;
  let userId: number | null = null;
  let userEmail: string | null = null;

  // 3. 如果有 Token，尝试验证
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      userId = payload.userId as number;
      userEmail = payload.email as string;
    }
  }

  // 4. 严格保护路由检查
  if (STRICT_PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '未登录', isAuthenticated: false },
        { status: 401 }
      );
    }
  }

  // 5. 创建响应并注入用户信息到 header
  const response = NextResponse.next();

  // 注入认证状态到 request headers，供后续 API 使用
  const requestHeaders = new Headers(request.headers);
  
  if (userId) {
    requestHeaders.set('x-user-id', userId.toString());
    requestHeaders.set('x-user-email', userEmail || '');
    requestHeaders.set('x-auth-type', 'user'); // 登录用户
  } else {
    requestHeaders.set('x-auth-type', 'session'); // 匿名用户
  }

  // 返回带有修改后 headers 的响应
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

// 配置中间件匹配的路由
export const config = {
  matcher: [
    // 匹配所有 API 路由
    '/api/:path*'
  ]
};
