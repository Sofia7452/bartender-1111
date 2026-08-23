#!/usr/bin/env tsx
/**
 * 缓存性能基准测试 - 模拟高并发场景
 * 运行: npx tsx scripts/benchmark-cache.ts
 */

import { LLMService } from '../app/services/llmService';

interface BenchmarkResult {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalTime: number;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 模拟真实用户请求模式
 */
function generateTestRequests(count: number): string[][] {
  // 热点原料（80% 的请求会使用这些）
  const hotIngredients = [
    ['伏特加', '橙汁', '蔓越莓汁'],
    ['金酒', '汤力水', '青柠'],
    ['朗姆酒', '薄荷', '苏打水'],
    ['威士忌', '苦精', '糖浆'],
  ];

  // 长尾原料（20% 的请求）
  const longTailIngredients = [
    ['龙舌兰', '青柠汁', '橙皮酒'],
    ['白兰地', '柠檬汁', '糖'],
    ['伏特加', '咖啡利口酒', '浓缩咖啡'],
    ['金酒', '樱桃白兰地', '菠萝汁'],
  ];

  const requests: string[][] = [];
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.8) {
      // 80% 选择热点原料（模拟缓存命中）
      requests.push(hotIngredients[Math.floor(Math.random() * hotIngredients.length)]);
    } else {
      // 20% 选择长尾原料
      requests.push(longTailIngredients[Math.floor(Math.random() * longTailIngredients.length)]);
    }
  }

  return requests;
}

/**
 * 运行基准测试
 */
async function runBenchmark(concurrency: number, totalRequests: number): Promise<BenchmarkResult> {
  console.log(`\n🏃 开始测试: ${concurrency} 并发 x ${totalRequests} 请求`);
  
  const llmService = new LLMService();
  const requests = generateTestRequests(totalRequests);
  
  let cacheHits = 0;
  let cacheMisses = 0;
  const responseTimes: number[] = [];

  const startTime = Date.now();

  // 分批并发执行
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (ingredients) => {
      const requestStart = Date.now();
      
      try {
        // 检查缓存状态（通过内部 cache 检测）
        const cacheStats = await llmService.getCacheStats();
        const cacheKeyBefore = cacheStats.memory.size;
        
        await llmService.generateRecommendations(ingredients);
        
        const cacheKeyAfter = (await llmService.getCacheStats()).memory.size;
        const isHit = cacheKeyBefore === cacheKeyAfter;
        
        if (isHit) {
          cacheHits++;
        } else {
          cacheMisses++;
        }
        
        const duration = Date.now() - requestStart;
        responseTimes.push(duration);
        
        // 打印进度
        const progress = Math.floor((i + batch.indexOf(ingredients) + 1) / requests.length * 100);
        if (progress % 10 === 0) {
          process.stdout.write(`\r   进度: ${progress}% (命中率: ${(cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error(`\n   ❌ 请求失败: ${(error as Error).message}`);
      }
    });

    await Promise.all(batchPromises);
    
    // 添加小延迟，避免触发 API 限流
    await sleep(100);
  }

  const totalTime = Date.now() - startTime;
  console.log('\n');

  // 计算统计数据
  responseTimes.sort((a, b) => a - b);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
  const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;
  const cacheHitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;

  return {
    totalRequests: cacheHits + cacheMisses,
    cacheHits,
    cacheMisses,
    cacheHitRate,
    avgResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    totalTime
  };
}

/**
 * 打印基准测试结果
 */
function printResults(scenario: string, result: BenchmarkResult) {
  console.log(`\n📊 === ${scenario} ===`);
  console.log(`   总请求数: ${result.totalRequests}`);
  console.log(`   缓存命中: ${result.cacheHits} (${result.cacheHitRate.toFixed(1)}%)`);
  console.log(`   缓存未命中: ${result.cacheMisses}`);
  console.log(`   平均响应时间: ${result.avgResponseTime.toFixed(0)}ms`);
  console.log(`   P95 响应时间: ${result.p95ResponseTime}ms`);
  console.log(`   P99 响应时间: ${result.p99ResponseTime}ms`);
  console.log(`   总耗时: ${(result.totalTime / 1000).toFixed(1)}s`);
  console.log(`   吞吐量: ${(result.totalRequests / (result.totalTime / 1000)).toFixed(1)} req/s`);

  // 评估结果
  if (result.cacheHitRate < 20) {
    console.log(`   ⚠️ 缓存命中率过低！在 Serverless 环境中会更糟（接近 0%）`);
  } else if (result.cacheHitRate < 50) {
    console.log(`   ⚠️ 缓存命中率偏低，建议迁移到 Redis`);
  } else if (result.cacheHitRate > 70) {
    console.log(`   ✅ 缓存命中率良好`);
  }

  if (result.avgResponseTime > 2000) {
    console.log(`   🚨 平均响应时间过长！并发增大后会更严重`);
  } else if (result.avgResponseTime > 1000) {
    console.log(`   ⚠️ 响应时间偏慢`);
  } else {
    console.log(`   ✅ 响应速度良好`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔥 ==========================================');
  console.log('🔥   LLM 缓存性能基准测试');
  console.log('🔥   模拟高并发场景下的缓存效果');
  console.log('🔥 ==========================================');

  console.log('\n⚠️  注意: 此测试会调用真实的 OpenAI API，请确保:');
  console.log('   1. 已配置 OPENAI_API_KEY 环境变量');
  console.log('   2. 账户有足够的 API 配额');
  console.log('   3. 不会触发 rate limit (建议使用低并发测试)\n');

  // 场景 1: 低并发（当前情况）
  console.log('\n📍 场景 1: 当前低并发场景 (2 并发 x 10 请求)');
  const lowConcurrencyResult = await runBenchmark(2, 10);
  printResults('低并发测试', lowConcurrencyResult);

  // 场景 2: 中等并发（5倍流量）
  console.log('\n📍 场景 2: 中等并发场景 (5 并发 x 20 请求)');
  const mediumConcurrencyResult = await runBenchmark(5, 20);
  printResults('中等并发测试', mediumConcurrencyResult);

  // 场景 3: 高并发（10倍流量 - 谨慎测试）
  console.log('\n📍 场景 3: 高并发场景 (10 并发 x 30 请求)');
  console.log('   ⚠️ 此场景会大量调用 API，可能触发限流');
  console.log('   ⚠️ 按 Ctrl+C 跳过此测试...');
  
  await sleep(3000);
  
  const highConcurrencyResult = await runBenchmark(10, 30);
  printResults('高并发测试', highConcurrencyResult);

  // 汇总分析
  console.log('\n\n💡 ==================== 优化建议 ====================\n');
  
  console.log('📈 当前架构问题:');
  console.log('   1. ❌ 内存缓存在 Serverless 环境中无法跨实例共享');
  console.log('   2. ❌ 并发增大 10 倍 = 至少 10 个独立的函数实例');
  console.log('   3. ❌ 每个实例都有独立的缓存 → 命中率接近 0%');
  console.log('   4. ❌ LLM API 调用量暴增 10 倍 → 成本爆炸 + 限流风险');

  console.log('\n✅ 解决方案:');
  console.log('   1. 🔥 迁移到 Vercel KV (Redis) - 全局共享缓存');
  console.log('   2. 📊 预估效果:');
  console.log(`      - 缓存命中率: ${lowConcurrencyResult.cacheHitRate.toFixed(0)}% → 80%+`);
  console.log(`      - API 调用量: 减少 80-90%`);
  console.log(`      - 成本: 减少 80-90%`);
  console.log('   3. 💰 成本分析:');
  console.log('      - 内存缓存 (当前): 100 请求 → 80-90 次 API 调用 → ~$0.18');
  console.log('      - Redis 缓存 (优化后): 100 请求 → 10-20 次 API 调用 → ~$0.02');
  console.log('   4. 🚀 实施优先级: P0 (立即实施)');

  console.log('\n📚 下一步:');
  console.log('   1. 运行: npx tsx scripts/diagnose-system.ts (检查系统配置)');
  console.log('   2. 配置 Vercel KV (Redis) 环境变量');
  console.log('   3. 实施 LLM 缓存迁移方案');
  console.log('   4. 重新运行此基准测试验证效果');
}

main().catch(console.error);
