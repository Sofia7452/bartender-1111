import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma Client 单例模式实现
 * 
 * 说明：
 * 1. 使用 globalThis 存储 PrismaClient 实例，避免在开发环境中热重载时创建多个连接
 * 2. PrismaClient 会自动从 process.env.DATABASE_URL 读取数据库连接字符串
 * 3. 在 Next.js 中，这个单例模式确保整个应用只有一个 PrismaClient 实例
 * 
 * 环境变量读取：
 * - 本地开发：从 .env.local 读取 DATABASE_URL（连接到 Docker PostgreSQL）
 * - 生产环境：从 Vercel 环境变量读取 DATABASE_URL（连接到 Supabase）
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// 在非生产环境中，将实例存储在 globalThis 中，避免热重载时创建多个连接
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

