/**
 * 认证辅助函数
 * 
 * 用于在 API 路由中获取当前用户的认证信息
 */

import { NextRequest } from 'next/server';
import { getSessionIdFromRequest } from './session';

/**
 * 认证信息类型
 */
export interface AuthInfo {
  /** 认证类型：'user' 表示登录用户，'session' 表示匿名用户 */
  type: 'user' | 'session';
  /** 用户 ID（仅登录用户有值） */
  userId: number | null;
  /** 用户邮箱（仅登录用户有值） */
  userEmail: string | null;
  /** Session ID（匿名用户使用） */
  sessionId: string;
  /** 是否已登录 */
  isAuthenticated: boolean;
}

/**
 * 从请求中获取认证信息
 * 
 * 优先使用中间件注入的用户信息，否则回退到 sessionId
 * 
 * @param request NextRequest 对象
 * @returns 认证信息
 */
export function getAuthInfo(request: NextRequest): AuthInfo {
  // 从中间件注入的 header 中获取用户信息
  const authType = request.headers.get('x-auth-type');
  const userIdStr = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');

  // 获取 sessionId（无论是否登录都获取，用于兼容）
  const sessionId = getSessionIdFromRequest(request);

  if (authType === 'user' && userIdStr) {
    // 登录用户
    return {
      type: 'user',
      userId: parseInt(userIdStr, 10),
      userEmail: userEmail || null,
      sessionId,
      isAuthenticated: true
    };
  }

  // 匿名用户
  return {
    type: 'session',
    userId: null,
    userEmail: null,
    sessionId,
    isAuthenticated: false
  };
}

/**
 * 获取用于标识用户的唯一键
 * 
 * - 登录用户：返回 `user:${userId}`
 * - 匿名用户：返回 sessionId
 * 
 * @param authInfo 认证信息
 * @returns 用户标识
 */
export function getUserIdentifier(authInfo: AuthInfo): string {
  if (authInfo.type === 'user' && authInfo.userId) {
    return `user:${authInfo.userId}`;
  }
  return authInfo.sessionId;
}
