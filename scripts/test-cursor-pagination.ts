/**
 * 游标分页测试脚本
 * 
 * 用于测试游标分页 API 的功能和性能
 * 
 * 使用方法:
 * ```bash
 * npx tsx scripts/test-cursor-pagination.ts
 * ```
 */

interface PaginationResponse {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  count: number;
}

interface FavoritesResponse {
  success: boolean;
  favorites: any[];
  pagination: PaginationResponse;
  error?: string;
}

/**
 * 测试游标分页 API
 */
async function testCursorPagination() {
  console.log('🧪 开始测试游标分页...\n');
  
  const baseUrl = 'http://localhost:3000';
  const limit = 3;
  let allFavorites: any[] = [];
  let cursor: string | null = null;
  let pageNum = 1;
  
  try {
    // 循环加载所有页
    while (true) {
      console.log(`📄 加载第 ${pageNum} 页...`);
      
      // 构建 URL
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) {
        params.set('cursor', cursor);
      }
      
      const url = `${baseUrl}/api/favorites-cursor?${params.toString()}`;
      console.log(`   URL: ${url}`);
      
      // 发起请求
      const startTime = Date.now();
      const response = await fetch(url);
      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: FavoritesResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '请求失败');
      }
      
      // 记录结果
      const { favorites, pagination } = data;
      allFavorites.push(...favorites);
      
      console.log(`   ✅ 成功加载 ${favorites.length} 条数据`);
      console.log(`   ⏱️  耗时: ${duration}ms`);
      console.log(`   📊 hasMore: ${pagination.hasMore}`);
      console.log(`   🔗 nextCursor: ${pagination.nextCursor ? '存在' : '无'}`);
      console.log('');
      
      // 检查是否还有更多数据
      if (!pagination.hasMore || !pagination.nextCursor) {
        console.log('✨ 已加载全部数据！\n');
        break;
      }
      
      // 更新游标，准备加载下一页
      cursor = pagination.nextCursor;
      pageNum++;
      
      // 防止无限循环（最多加载10页）
      if (pageNum > 10) {
        console.log('⚠️  已达到最大页数限制（10页），停止加载\n');
        break;
      }
      
      // 短暂延迟，模拟真实场景
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 输出汇总信息
    console.log('📊 测试汇总:');
    console.log(`   总页数: ${pageNum}`);
    console.log(`   总数据量: ${allFavorites.length}`);
    console.log(`   每页数量: ${limit}`);
    console.log('');
    
    // 验证数据唯一性（检查是否有重复）
    const uniqueIds = new Set(allFavorites.map(f => f.id));
    if (uniqueIds.size !== allFavorites.length) {
      console.log('❌ 发现重复数据！');
      console.log(`   唯一ID数: ${uniqueIds.size}`);
      console.log(`   总数据量: ${allFavorites.length}`);
    } else {
      console.log('✅ 数据唯一性验证通过');
    }
    
    // 验证排序（按 createdAt 降序）
    let isSorted = true;
    for (let i = 1; i < allFavorites.length; i++) {
      const prev = new Date(allFavorites[i - 1].createdAt);
      const curr = new Date(allFavorites[i].createdAt);
      if (prev < curr) {
        isSorted = false;
        break;
      }
    }
    
    if (isSorted) {
      console.log('✅ 数据排序验证通过（降序）');
    } else {
      console.log('❌ 数据排序错误！');
    }
    
    console.log('\n🎉 测试完成！\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    console.error('\n💡 提示:');
    console.error('   1. 确保开发服务器正在运行: npm run dev');
    console.error('   2. 确保数据库中有测试数据');
    console.error('   3. 检查 .env 配置是否正确\n');
    process.exit(1);
  }
}

/**
 * 性能对比测试：OFFSET vs 游标分页
 */
async function performanceComparison() {
  console.log('⚡ 开始性能对比测试...\n');
  
  const baseUrl = 'http://localhost:3000';
  const testPages = [1, 5, 10]; // 测试第1页、第5页、第10页
  
  console.log('测试场景: 每页3条数据，对比 OFFSET 和游标分页\n');
  
  for (const pageNum of testPages) {
    console.log(`📊 测试第 ${pageNum} 页:`);
    
    // 测试 OFFSET 分页
    try {
      const offsetUrl = `${baseUrl}/api/favorites?page=${pageNum}&limit=3`;
      const offsetStart = Date.now();
      const offsetResponse = await fetch(offsetUrl);
      const offsetDuration = Date.now() - offsetStart;
      
      if (offsetResponse.ok) {
        console.log(`   OFFSET 分页: ${offsetDuration}ms`);
      }
    } catch (error) {
      console.log(`   OFFSET 分页: 失败`);
    }
    
    // 测试游标分页（需要先加载前面的页获取 cursor）
    try {
      let cursor: string | null = null;
      let cursorDuration = 0;
      
      for (let i = 1; i <= pageNum; i++) {
        const params = new URLSearchParams({ limit: '3' });
        if (cursor) {
          params.set('cursor', cursor);
        }
        
        const cursorUrl = `${baseUrl}/api/favorites-cursor?${params.toString()}`;
        const cursorStart = Date.now();
        const cursorResponse = await fetch(cursorUrl);
        const duration = Date.now() - cursorStart;
        
        if (i === pageNum) {
          cursorDuration = duration; // 只记录目标页的耗时
        }
        
        if (cursorResponse.ok) {
          const data = await cursorResponse.json();
          cursor = data.pagination.nextCursor;
        }
      }
      
      console.log(`   游标分页: ${cursorDuration}ms`);
      
    } catch (error) {
      console.log(`   游标分页: 失败`);
    }
    
    console.log('');
  }
  
  console.log('💡 说明:');
  console.log('   - 页码越大，OFFSET 分页越慢');
  console.log('   - 游标分页性能稳定，不受页码影响');
  console.log('   - 实际差异在数据量大时更明显\n');
}

// 运行测试
async function main() {
  console.log('🚀 游标分页测试工具\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  // 基础功能测试
  await testCursorPagination();
  
  // 性能对比测试
  await performanceComparison();
  
  console.log('═══════════════════════════════════════════════════\n');
  console.log('✨ 所有测试完成！\n');
}

main().catch(console.error);
