#!/bin/bash

# API 性能测试脚本
# 使用方法: bash scripts/test-performance.sh https://your-domain.vercel.app

set -e

# 检查参数
if [ -z "$1" ]; then
  echo "❌ 错误：请提供 API 基础 URL"
  echo "使用方法: bash scripts/test-performance.sh https://your-domain.vercel.app"
  exit 1
fi

BASE_URL=$1

echo "🧪 开始性能测试..."
echo "📍 测试目标: $BASE_URL"
echo ""

# 测试函数
test_api() {
  local endpoint=$1
  local name=$2
  
  echo "🔍 测试: $name"
  echo "   URL: $BASE_URL$endpoint"
  
  # 使用 curl 测试，记录时间
  local start=$(date +%s%3N)
  local response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$BASE_URL$endpoint")
  local end=$(date +%s%3N)
  
  # 解析响应
  local http_code=$(echo "$response" | tail -n 2 | head -n 1)
  local time_total=$(echo "$response" | tail -n 1)
  local duration=$((end - start))
  
  # 显示结果
  if [ "$http_code" = "200" ]; then
    echo "   ✅ 状态码: $http_code"
    echo "   ⏱️  响应时间: ${duration}ms (curl: ${time_total}s)"
  else
    echo "   ❌ 状态码: $http_code"
    echo "   ⏱️  响应时间: ${duration}ms"
  fi
  echo ""
}

# 1. 测试健康检查
test_api "/api/health" "健康检查"

# 2. 测试收藏列表（第一次，缓存未命中）
echo "📋 测试收藏列表（第一次请求，缓存未命中）"
test_api "/api/favorites?page=1&limit=10" "收藏列表 - 第一次"

# 3. 测试收藏列表（第二次，缓存命中）
echo "📋 测试收藏列表（第二次请求，应该缓存命中）"
test_api "/api/favorites?page=1&limit=10" "收藏列表 - 第二次"

# 4. 测试套装列表（第一次，缓存未命中）
echo "📦 测试套装列表（第一次请求，缓存未命中）"
test_api "/api/saved-sets?page=1&limit=10" "套装列表 - 第一次"

# 5. 测试套装列表（第二次，缓存命中）
echo "📦 测试套装列表（第二次请求，应该缓存命中）"
test_api "/api/saved-sets?page=1&limit=10" "套装列表 - 第二次"

echo "🎉 性能测试完成！"
echo ""
echo "📊 性能目标："
echo "   - 缓存未命中: < 1500ms"
echo "   - 缓存命中: < 100ms"
echo ""
echo "💡 提示："
echo "   - 如果响应时间仍然很慢，检查 Vercel 日志"
echo "   - 如果缓存未生效，确认已安装 @vercel/kv"
echo "   - 查看详细日志: vercel logs --follow"
echo ""
