/**
 * 认证服务
 * 
 * 实现 JWT + httpOnly Cookie 的认证方案
 * - 密码使用 bcryptjs 进行哈希
 * - JWT 使用 jose 库签发和验证
 * - Token 存储在 httpOnly Cookie 中，防止 XSS 攻击
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { prisma } from '../lib/prisma';

// JWT 配置
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);
const JWT_ISSUER = 'cocktail-app';
const JWT_AUDIENCE = 'cocktail-app-users';
const JWT_EXPIRATION = '7d'; // Token 有效期 7 天

// 密码哈希配置
const SALT_ROUNDS = 10;

/**
 * JWT Payload 类型定义
 */
export interface AuthPayload extends JWTPayload {
  userId: number;
  email: string;
}

/**
 * 用户信息类型（不包含密码）
 */
export interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
}

/**
 * 认证结果类型
 */
export interface AuthResult {
  success: boolean;
  user?: UserInfo;
  token?: string;
  error?: string;
}

/**
 * 认证服务类
 */
export class AuthService {
  /**
   * 用户注册
   * 
   * @param email 邮箱
   * @param password 密码（明文）
   * @param name 用户名（可选）
   * @returns 认证结果
   */
  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<AuthResult> {
    try {
      // 1. 检查邮箱是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return {
          success: false,
          error: '该邮箱已被注册'
        };
      }

      // 2. 密码哈希
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // 3. 创建用户
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true
        }
      });

      // 4. 生成 JWT
      const token = await this.generateToken(user.id, user.email);

      console.log(`✅ 用户注册成功: ${email}`);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('注册失败:', error);
      return {
        success: false,
        error: '注册失败，请稍后重试'
      };
    }
  }

  /**
   * 用户登录
   * 
   * @param email 邮箱
   * @param password 密码（明文）
   * @returns 认证结果
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // 1. 查找用户
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          createdAt: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: '邮箱或密码错误'
        };
      }

      // 2. 检查用户是否设置了密码（支持匿名用户升级）
      if (!user.password) {
        return {
          success: false,
          error: '该账户尚未设置密码，请先注册'
        };
      }

      // 3. 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          error: '邮箱或密码错误'
        };
      }

      // 4. 生成 JWT
      const token = await this.generateToken(user.id, user.email);

      console.log(`✅ 用户登录成功: ${email}`);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt
        },
        token
      };
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        error: '登录失败，请稍后重试'
      };
    }
  }

  /**
   * 验证 JWT Token
   * 
   * @param token JWT Token
   * @returns 解析后的 Payload，验证失败返回 null
   */
  async verifyToken(token: string): Promise<AuthPayload | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });

      return payload as AuthPayload;
    } catch (error) {
      console.error('Token 验证失败:', error);
      return null;
    }
  }

  /**
   * 根据 userId 获取用户信息
   * 
   * @param userId 用户 ID
   * @returns 用户信息，不存在返回 null
   */
  async getUserById(userId: number): Promise<UserInfo | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true
        }
      });

      return user;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  /**
   * 生成 JWT Token
   * 
   * @param userId 用户 ID
   * @param email 用户邮箱
   * @returns JWT Token 字符串
   */
  private async generateToken(userId: number, email: string): Promise<string> {
    const token = await new SignJWT({ userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(JWT_EXPIRATION)
      .sign(JWT_SECRET);

    return token;
  }

  /**
   * 修改密码
   * 
   * @param userId 用户 ID
   * @param oldPassword 旧密码
   * @param newPassword 新密码
   * @returns 是否成功
   */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 获取用户
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (!user || !user.password) {
        return { success: false, error: '用户不存在' };
      }

      // 2. 验证旧密码
      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) {
        return { success: false, error: '原密码错误' };
      }

      // 3. 更新密码
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      console.log(`✅ 用户 ${userId} 密码修改成功`);
      return { success: true };
    } catch (error) {
      console.error('修改密码失败:', error);
      return { success: false, error: '修改密码失败' };
    }
  }
}

// 导出单例
export const authService = new AuthService();
