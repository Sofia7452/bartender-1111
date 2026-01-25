/**
 * 认证功能自测脚本
 * 
 * 测试内容：
 * 1. 用户注册
 * 2. 用户登录
 * 3. 获取当前用户信息
 * 4. 登录用户收藏功能
 * 5. 用户登出
 * 
 * 运行方式：
 * npx tsx scripts/test-auth.ts
 * 
 * 注意：需要先启动 Next.js 开发服务器
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// 测试用户信息
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test123456',
  name: '测试用户'
};

// 存储 Cookie
let authCookie = '';

/**
 * 打印分隔线
 */
function printDivider(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

/**
 * 打印结果
 */
function printResult(success: boolean, message: string, data?: any) {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${message}`);
  if (data) {
    console.log('   响应数据:', JSON.stringify(data, null, 2));
  }
}

/**
 * 发送请求
 */
async function request(
  method: string,
  path: string,
  body?: any,
  includeCookie = true
): Promise<{ status: number; data: any; cookies: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (includeCookie && authCookie) {
    headers['Cookie'] = authCookie;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  const setCookie = response.headers.get('set-cookie') || '';

  return { status: response.status, data, cookies: setCookie };
}

/**
 * 测试 1：用户注册
 */
async function testRegister() {
  printDivider('测试 1：用户注册');

  console.log(`📧 注册邮箱: ${testUser.email}`);

  const { status, data, cookies } = await request('POST', '/api/auth/register', testUser, false);

  if (status === 201 && data.success) {
    printResult(true, '注册成功');
    console.log(`   用户ID: ${data.user.id}`);
    console.log(`   用户名: ${data.user.name}`);

    // 保存 Cookie
    if (cookies.includes('auth_token')) {
      authCookie = cookies.split(';')[0];
      console.log(`   🍪 已获取 auth_token Cookie`);
    }
    return true;
  } else {
    printResult(false, `注册失败: ${data.error}`, data);
    return false;
  }
}

/**
 * 测试 2：重复注册（应该失败）
 */
async function testDuplicateRegister() {
  printDivider('测试 2：重复注册（预期失败）');

  const { status, data } = await request('POST', '/api/auth/register', testUser, false);

  if (status === 409 && !data.success) {
    printResult(true, '正确拒绝重复注册');
    console.log(`   错误信息: ${data.error}`);
    return true;
  } else {
    printResult(false, '应该拒绝重复注册', data);
    return false;
  }
}

/**
 * 测试 3：用户登出
 */
async function testLogout() {
  printDivider('测试 3：用户登出');

  const { status, data, cookies } = await request('POST', '/api/auth/logout');

  if (status === 200 && data.success) {
    printResult(true, '登出成功');

    // 检查 Cookie 是否被清除
    if (cookies.includes('auth_token=;') || cookies.includes('Max-Age=0')) {
      console.log(`   🍪 auth_token Cookie 已清除`);
    }
    authCookie = ''; // 清除本地 Cookie
    return true;
  } else {
    printResult(false, '登出失败', data);
    return false;
  }
}

/**
 * 测试 4：未登录访问用户信息（应该失败）
 */
async function testUnauthorizedAccess() {
  printDivider('测试 4：未登录访问用户信息（预期失败）');

  const { status, data } = await request('GET', '/api/auth/me', null, false);

  if (status === 401 && !data.success) {
    printResult(true, '正确拒绝未授权访问');
    console.log(`   错误信息: ${data.error}`);
    return true;
  } else {
    printResult(false, '应该拒绝未授权访问', data);
    return false;
  }
}

/**
 * 测试 5：用户登录
 */
async function testLogin() {
  printDivider('测试 5：用户登录');

  const { status, data, cookies } = await request('POST', '/api/auth/login', {
    email: testUser.email,
    password: testUser.password
  }, false);

  if (status === 200 && data.success) {
    printResult(true, '登录成功');
    console.log(`   用户ID: ${data.user.id}`);
    console.log(`   用户邮箱: ${data.user.email}`);

    // 保存 Cookie
    if (cookies.includes('auth_token')) {
      authCookie = cookies.split(';')[0];
      console.log(`   🍪 已获取 auth_token Cookie`);
    }
    return true;
  } else {
    printResult(false, `登录失败: ${data.error}`, data);
    return false;
  }
}

/**
 * 测试 6：错误密码登录（应该失败）
 */
async function testWrongPassword() {
  printDivider('测试 6：错误密码登录（预期失败）');

  const { status, data } = await request('POST', '/api/auth/login', {
    email: testUser.email,
    password: 'wrongpassword'
  }, false);

  if (status === 401 && !data.success) {
    printResult(true, '正确拒绝错误密码');
    console.log(`   错误信息: ${data.error}`);
    return true;
  } else {
    printResult(false, '应该拒绝错误密码', data);
    return false;
  }
}

/**
 * 测试 7：获取当前用户信息
 */
async function testGetCurrentUser() {
  printDivider('测试 7：获取当前用户信息');

  const { status, data } = await request('GET', '/api/auth/me');

  if (status === 200 && data.success && data.isAuthenticated) {
    printResult(true, '获取用户信息成功');
    console.log(`   用户ID: ${data.user.id}`);
    console.log(`   用户邮箱: ${data.user.email}`);
    console.log(`   用户名: ${data.user.name}`);
    return true;
  } else {
    printResult(false, '获取用户信息失败', data);
    return false;
  }
}

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 测试 8：登录用户添加收藏
 */
async function testAuthFavoriteAdd() {
  printDivider('测试 8：登录用户添加收藏');

  const testRecipeId = generateUUID(); // 使用有效的 UUID 格式
  const recipeData = {
    name: '测试鸡尾酒',
    description: '这是一个测试用的鸡尾酒配方',
    ingredients: ['伏特加 45ml', '柠檬汁 20ml', '糖浆 15ml'],
    steps: ['将所有材料加入摇酒器', '加冰摇匀', '滤入酒杯'],
    difficulty: 2,
    category: '经典',
    glassType: '鸡尾酒杯'
  };

  const { status, data } = await request('POST', '/api/auth-favorites', {
    recipeId: testRecipeId,
    recipeData
  });

  if (status === 200 && data.success) {
    printResult(true, '添加收藏成功');
    console.log(`   收藏ID: ${data.favorite.id}`);
    console.log(`   配方名: ${data.recipe.name}`);

    // 保存 recipeId 供后续测试使用
    (global as any).testRecipeId = testRecipeId;
    return true;
  } else {
    printResult(false, `添加收藏失败: ${data.error}`, data);
    return false;
  }
}

/**
 * 测试 9：登录用户获取收藏列表
 */
async function testAuthFavoriteList() {
  printDivider('测试 9：登录用户获取收藏列表');

  const { status, data } = await request('GET', '/api/auth-favorites?page=1&limit=10');

  if (status === 200 && data.success) {
    printResult(true, '获取收藏列表成功');
    console.log(`   总数: ${data.pagination.total}`);
    console.log(`   当前页: ${data.favorites.length} 条`);
    if (data.favorites.length > 0) {
      console.log(`   第一条收藏: ${data.favorites[0].recipe?.name || '未知'}`);
    }
    return true;
  } else {
    printResult(false, '获取收藏列表失败', data);
    return false;
  }
}

/**
 * 测试 10：登录用户取消收藏
 */
async function testAuthFavoriteDelete() {
  printDivider('测试 10：登录用户取消收藏');

  const testRecipeId = (global as any).testRecipeId;
  if (!testRecipeId) {
    printResult(false, '没有可删除的收藏（跳过）');
    return false;
  }

  const { status, data } = await request('DELETE', '/api/auth-favorites', {
    recipeId: testRecipeId
  });

  if (status === 200 && data.success) {
    printResult(true, '取消收藏成功');
    console.log(`   已删除收藏ID: ${data.deletedFavorite.id}`);
    return true;
  } else {
    printResult(false, '取消收藏失败', data);
    return false;
  }
}

/**
 * 测试 11：未登录访问登录用户收藏（应该失败）
 */
async function testUnauthorizedFavorites() {
  printDivider('测试 11：未登录访问登录用户收藏（预期失败）');

  // 先登出
  await request('POST', '/api/auth/logout');
  authCookie = '';

  const { status, data } = await request('GET', '/api/auth-favorites', null, false);

  if (status === 401 && !data.success) {
    printResult(true, '正确拒绝未授权访问');
    console.log(`   错误信息: ${data.error}`);
    return true;
  } else {
    printResult(false, '应该拒绝未授权访问', data);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('\n');
  console.log('🔐 智能调酒师 - 认证功能测试');
  console.log(`📍 测试服务器: ${BASE_URL}`);
  console.log(`📧 测试用户: ${testUser.email}`);

  const results: { name: string; passed: boolean }[] = [];

  try {
    // 执行测试
    results.push({ name: '用户注册', passed: await testRegister() });
    results.push({ name: '重复注册拒绝', passed: await testDuplicateRegister() });
    results.push({ name: '用户登出', passed: await testLogout() });
    results.push({ name: '未授权访问拒绝', passed: await testUnauthorizedAccess() });
    results.push({ name: '用户登录', passed: await testLogin() });
    results.push({ name: '错误密码拒绝', passed: await testWrongPassword() });
    results.push({ name: '获取用户信息', passed: await testGetCurrentUser() });
    results.push({ name: '登录用户添加收藏', passed: await testAuthFavoriteAdd() });
    results.push({ name: '登录用户获取收藏', passed: await testAuthFavoriteList() });
    results.push({ name: '登录用户取消收藏', passed: await testAuthFavoriteDelete() });
    results.push({ name: '未登录收藏拒绝', passed: await testUnauthorizedFavorites() });

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
  }

  // 打印测试结果汇总
  printDivider('测试结果汇总');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`  总计: ${results.length} 个测试`);
  console.log(`  通过: ${passed} ✅`);
  console.log(`  失败: ${failed} ❌`);
  console.log('-'.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！\n');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查\n');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(console.error);
