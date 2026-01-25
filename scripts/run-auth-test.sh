#!/bin/bash

# 认证功能测试脚本
# 
# 使用方法：
# 1. 确保 Next.js 开发服务器正在运行（npm run dev）
# 2. 在另一个终端运行此脚本：./scripts/run-auth-test.sh
#
# 或者使用 npm script：
# npm run test:auth

echo "🔐 智能调酒师 - 认证功能测试"
echo "========================================"
echo ""

# 检查服务器是否运行
echo "📡 检查开发服务器状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 开发服务器正在运行"
else
    echo "❌ 开发服务器未运行，请先执行: npm run dev"
    exit 1
fi

echo ""
echo "🧪 开始运行认证测试..."
echo ""

# 运行测试
npx tsx scripts/test-auth.ts

echo ""
echo "========================================"
echo "测试完成"
