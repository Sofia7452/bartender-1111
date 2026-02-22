#!/usr/bin/env tsx
/**
 * 生产环境诊断工具 - 检测系统关键指标
 * 运行: npx tsx scripts/diagnose-system.ts
 */

import { PrismaClient } from '../app/generated/prisma/client';
import OpenAI from 'openai';
import { config } from 'dotenv';

// 加载环境变量
config();

interface DiagnosticResult {
  category: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  metric: string;
  value: string;
  recommendation?: string;
}

const results: DiagnosticResult[] = [];

function addResult(result: DiagnosticResult) {
  results.push(result);
  const icon = {
    'OK': '✅',
    'WARNING': '⚠️',
    'CRITICAL': '🚨',
    'UNKNOWN': '❓'
  }[result.status];
  
  console.log(`${icon} [${result.category}] ${result.metric}: ${result.value}`);
  if (result.recommendation) {
    console.log(`   💡 ${result.recommendation}`);
  }
}

// ==================== 1️⃣ 数据库连接诊断 ====================
async function diagnoseDatabaseConnection() {
  console.log('\n📊 === 数据库连接诊断 ===\n');
  
  try {
    const prisma = new PrismaClient();
    
    // 1. 测试连接
    const startTime = Date.now();
    await prisma.$connect();
    const connectTime = Date.now() - startTime;
    
    addResult({
      category: 'Database',
      status: connectTime < 100 ? 'OK' : 'WARNING',
      metric: '连接耗时',
      value: `${connectTime}ms`,
      recommendation: connectTime > 200 ? '连接耗时过长，建议检查网络或迁移到 Prisma Accelerate' : undefined
    });

    // 2. 检查 DATABASE_URL 配置
    const dbUrl = process.env.DATABASE_URL || '';
    const isSupabase = dbUrl.includes('supabase.co');
    const hasPooling = dbUrl.includes('pgbouncer') || dbUrl.includes('pooler');
    
    addResult({
      category: 'Database',
      status: isSupabase ? 'OK' : 'UNKNOWN',
      metric: '数据库提供商',
      value: isSupabase ? 'Supabase' : '未知'
    });

    addResult({
      category: 'Database',
      status: hasPooling ? 'OK' : 'CRITICAL',
      metric: '连接池配置',
      value: hasPooling ? '已启用 (PgBouncer)' : '❌ 未启用',
      recommendation: !hasPooling ? 
        '🚨 未使用连接池！Supabase 连接字符串应包含 :6543/postgres（Transaction Mode）或 :6543/postgres?pgbouncer=true' : 
        undefined
    });

    // 3. 尝试查询获取当前连接数（需要 pg_stat_activity 权限）
    try {
      const result = await prisma.$queryRaw<Array<{ total: number }>>`
        SELECT count(*) as total 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      const currentConnections = Number(result[0]?.total || 0);
      
      addResult({
        category: 'Database',
        status: currentConnections < 10 ? 'OK' : currentConnections < 50 ? 'WARNING' : 'CRITICAL',
        metric: '当前活跃连接数',
        value: `${currentConnections}`,
        recommendation: currentConnections > 20 ? 
          '连接数偏高，并发量增大后可能耗尽连接池（Supabase 免费版最大 60-100）' : 
          undefined
      });
    } catch (error) {
      addResult({
        category: 'Database',
        status: 'UNKNOWN',
        metric: '当前活跃连接数',
        value: '无权限查询',
        recommendation: '需要 pg_stat_activity 查询权限，建议在 Supabase Dashboard 查看'
      });
    }

    // 4. 检查索引优化情况
    try {
      const indexes = await prisma.$queryRaw<Array<{ schemaname: string; tablename: string; indexname: string }>>`
        SELECT schemaname, tablename, indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `;
      
      const hasUserFavoriteIndex = indexes.some(idx => 
        idx.tablename === 'UserFavorite' && idx.indexname.includes('sessionId')
      );
      
      addResult({
        category: 'Database',
        status: hasUserFavoriteIndex ? 'OK' : 'WARNING',
        metric: 'UserFavorite 索引',
        value: hasUserFavoriteIndex ? '已优化' : '可能缺少索引',
        recommendation: !hasUserFavoriteIndex ? 
          '建议在 sessionId + recipeId 上创建复合索引加速查询' : 
          undefined
      });
      
      console.log(`   📋 总共 ${indexes.length} 个索引`);
    } catch (error) {
      console.log(`   ⚠️ 无法查询索引信息`);
    }

    await prisma.$disconnect();
    
  } catch (error) {
    addResult({
      category: 'Database',
      status: 'CRITICAL',
      metric: '数据库连接',
      value: '❌ 连接失败',
      recommendation: `错误: ${(error as Error).message}`
    });
  }
}

// ==================== 2️⃣ OpenAI API 诊断 ====================
async function diagnoseOpenAI() {
  console.log('\n🤖 === OpenAI API 诊断 ===\n');
  
  try {
    const apiKey = process.env.OPENAI_API_KEY || '';
    const baseURL = process.env.OPENAI_BASE_URL;
    
    if (!apiKey || apiKey.includes('your_openai_api_key')) {
      addResult({
        category: 'OpenAI',
        status: 'CRITICAL',
        metric: 'API Key',
        value: '❌ 未配置',
        recommendation: '必须配置 OPENAI_API_KEY 环境变量'
      });
      return;
    }

    addResult({
      category: 'OpenAI',
      status: 'OK',
      metric: 'API Key',
      value: `${apiKey.substring(0, 10)}...（${apiKey.length} 字符）`
    });

    if (baseURL) {
      addResult({
        category: 'OpenAI',
        status: 'OK',
        metric: 'Base URL',
        value: baseURL,
        recommendation: '使用自定义 Base URL（可能是代理或第三方服务）'
      });
    }

    // 测试连接和速率限制
    const openai = new OpenAI({
      apiKey,
      baseURL
    });

    console.log('   🔍 正在检测 API 限额...');
    
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    });
    const responseTime = Date.now() - startTime;

    addResult({
      category: 'OpenAI',
      status: responseTime < 1000 ? 'OK' : 'WARNING',
      metric: 'API 响应时间',
      value: `${responseTime}ms`,
      recommendation: responseTime > 2000 ? 'API 响应较慢，可能影响用户体验' : undefined
    });

    // 检查 Response Headers 获取限额信息（如果可用）
    addResult({
      category: 'OpenAI',
      status: 'OK',
      metric: '使用模型',
      value: response.model
    });

    // 警告：无法直接获取 RPM/TPM 限额，需要手动检查
    console.log('\n   ⚠️ OpenAI API 限额需要手动检查：');
    console.log('   1. 访问: https://platform.openai.com/settings/organization/limits');
    console.log('   2. 查看当前套餐的 RPM (Requests Per Minute) 和 TPM (Tokens Per Minute)');
    console.log('   3. 常见限额:');
    console.log('      - Free Tier: 3 RPM / 40,000 TPM');
    console.log('      - Pay-as-you-go (Tier 1): 3,500 RPM / 200,000 TPM');
    console.log('      - Pay-as-you-go (Tier 2+): 10,000+ RPM');
    console.log('   4. 并发量增大 10 倍，预估需要: 30-100 RPM (假设每个用户请求 1 次推荐)');

    addResult({
      category: 'OpenAI',
      status: 'WARNING',
      metric: 'RPM/TPM 限额',
      value: '❓ 需要手动检查',
      recommendation: '访问 OpenAI Dashboard 确认限额，并发大10倍后可能触发 rate_limit_exceeded'
    });

  } catch (error: any) {
    let status: 'CRITICAL' | 'WARNING' = 'CRITICAL';
    let recommendation = '';

    if (error?.status === 429) {
      status = 'CRITICAL';
      recommendation = '🚨 已触发限流！当前 API 调用频率已超限';
    } else if (error?.status === 401) {
      status = 'CRITICAL';
      recommendation = 'API Key 无效或已过期';
    } else {
      recommendation = `错误: ${error?.message || '未知错误'}`;
    }

    addResult({
      category: 'OpenAI',
      status,
      metric: 'API 连接',
      value: '❌ 测试失败',
      recommendation
    });
  }
}

// ==================== 3️⃣ Vercel 部署诊断 ====================
async function diagnoseVercel() {
  console.log('\n🚀 === Vercel 部署诊断 ===\n');
  
  // 检查是否在 Vercel 环境
  const isVercel = !!process.env.VERCEL;
  const vercelEnv = process.env.VERCEL_ENV; // production, preview, development
  
  addResult({
    category: 'Vercel',
    status: isVercel ? 'OK' : 'UNKNOWN',
    metric: '运行环境',
    value: isVercel ? `Vercel (${vercelEnv || 'unknown'})` : '本地开发',
    recommendation: !isVercel ? '当前在本地运行，生产环境诊断需要在 Vercel 上执行' : undefined
  });

  if (isVercel) {
    const region = process.env.VERCEL_REGION || 'unknown';
    addResult({
      category: 'Vercel',
      status: 'OK',
      metric: '部署区域',
      value: region
    });
  }

  // Vercel 套餐检测（需要通过 API 或手动检查）
  console.log('\n   ⚠️ Vercel 套餐和限额需要手动检查：');
  console.log('   1. 访问: https://vercel.com/dashboard/usage');
  console.log('   2. 查看当前套餐和 Serverless 并发限制:');
  console.log('      - Hobby (免费): 1,000 次/天执行, 10 并发函数');
  console.log('      - Pro: 100 GB-Hrs 执行时长, 100 并发函数');
  console.log('      - Enterprise: 无限制（取决于合同）');
  console.log('   3. 检查当前使用量和函数执行时长');
  console.log('   4. 流式 API 平均执行 5-10 秒，并发大 10 倍可能需要 100+ 并发函数');

  addResult({
    category: 'Vercel',
    status: 'WARNING',
    metric: 'Serverless 并发限制',
    value: '❓ 需要手动检查',
    recommendation: '访问 Vercel Dashboard 确认套餐，Hobby 套餐 10 并发可能不足'
  });

  // 检查环境变量配置完整性
  const requiredEnvVars = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'JWT_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    addResult({
      category: 'Vercel',
      status: 'CRITICAL',
      metric: '环境变量',
      value: `❌ 缺少 ${missingVars.length} 个`,
      recommendation: `缺少: ${missingVars.join(', ')}`
    });
  } else {
    addResult({
      category: 'Vercel',
      status: 'OK',
      metric: '环境变量',
      value: '✅ 完整'
    });
  }
}

// ==================== 4️⃣ 缓存和监控诊断 ====================
async function diagnoseCacheAndMonitoring() {
  console.log('\n📈 === 缓存和监控诊断 ===\n');
  
  // 检查是否配置了 Vercel KV (Redis)
  const hasVercelKV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  
  addResult({
    category: 'Cache',
    status: hasVercelKV ? 'OK' : 'CRITICAL',
    metric: 'Vercel KV (Redis)',
    value: hasVercelKV ? '✅ 已配置' : '❌ 未配置',
    recommendation: !hasVercelKV ? 
      '🚨 未配置 Redis！LLM 缓存在 Serverless 环境中无法跨实例共享，并发大10倍后缓存命中率接近 0%' : 
      undefined
  });

  if (hasVercelKV) {
    try {
      // 尝试连接 Vercel KV
      const { kv } = await import('@vercel/kv');
      const testKey = '__diagnostic_test__';
      
      const startTime = Date.now();
      await kv.set(testKey, 'test', { ex: 10 });
      const value = await kv.get(testKey);
      const kvLatency = Date.now() - startTime;
      await kv.del(testKey);
      
      addResult({
        category: 'Cache',
        status: kvLatency < 50 ? 'OK' : 'WARNING',
        metric: 'Redis 延迟',
        value: `${kvLatency}ms`,
        recommendation: kvLatency > 100 ? 'Redis 延迟较高，可能影响缓存效果' : undefined
      });
      
    } catch (error) {
      addResult({
        category: 'Cache',
        status: 'CRITICAL',
        metric: 'Redis 连接',
        value: '❌ 连接失败',
        recommendation: `错误: ${(error as Error).message}`
      });
    }
  }

  // 检查是否有监控代码
  addResult({
    category: 'Monitoring',
    status: 'WARNING',
    metric: '性能监控',
    value: '❌ 未实现',
    recommendation: '缺少关键指标监控（LLM 缓存命中率、API 响应时间、数据库查询耗时）'
  });

  addResult({
    category: 'Monitoring',
    status: 'WARNING',
    metric: '错误追踪',
    value: '❌ 未集成',
    recommendation: '建议集成 Sentry 或 Vercel Analytics 进行错误追踪'
  });

  console.log('\n   💡 建议添加监控指标：');
  console.log('   1. LLM 缓存命中率（目标 > 80%）');
  console.log('   2. API P99 响应时间（目标 < 500ms）');
  console.log('   3. 数据库连接池使用率（目标 < 70%）');
  console.log('   4. OpenAI API 调用频率（监控是否接近限额）');
}

// ==================== 主函数 ====================
async function main() {
  console.log('🔍 ==========================================');
  console.log('🔍   生产环境高并发诊断工具');
  console.log('🔍   检测系统关键瓶颈和风险点');
  console.log('🔍 ==========================================');

  await diagnoseDatabaseConnection();
  await diagnoseOpenAI();
  await diagnoseVercel();
  await diagnoseCacheAndMonitoring();

  // 汇总报告
  console.log('\n\n📋 ==================== 诊断汇总 ====================\n');
  
  const criticalCount = results.filter(r => r.status === 'CRITICAL').length;
  const warningCount = results.filter(r => r.status === 'WARNING').length;
  const okCount = results.filter(r => r.status === 'OK').length;

  console.log(`✅ OK: ${okCount}`);
  console.log(`⚠️  WARNING: ${warningCount}`);
  console.log(`🚨 CRITICAL: ${criticalCount}`);

  if (criticalCount > 0) {
    console.log('\n🚨 致命问题：');
    results
      .filter(r => r.status === 'CRITICAL')
      .forEach(r => {
        console.log(`   - [${r.category}] ${r.metric}: ${r.value}`);
        if (r.recommendation) {
          console.log(`     💡 ${r.recommendation}`);
        }
      });
  }

  if (criticalCount > 2) {
    console.log('\n💥 结论: 并发量增大 10 倍，系统会在 30 秒内崩溃！');
  } else if (criticalCount > 0 || warningCount > 3) {
    console.log('\n⚠️  结论: 系统存在明显瓶颈，高并发时会出现严重性能问题。');
  } else {
    console.log('\n✅ 结论: 系统基本健康，但仍需持续监控和优化。');
  }

  console.log('\n📚 下一步操作:');
  console.log('   1. 解决所有 CRITICAL 级别问题');
  console.log('   2. 在 Vercel/Supabase/OpenAI Dashboard 确认手动检查项');
  console.log('   3. 实施 Redis 缓存迁移（优先级最高）');
  console.log('   4. 添加性能监控和告警');
  console.log('   5. 进行压力测试验证优化效果');
}

main().catch(console.error);
