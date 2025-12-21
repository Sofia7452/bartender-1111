#!/bin/bash

# 数据库性能优化部署脚本
# 使用方法: bash scripts/apply-optimizations.sh

set -e  # 遇到错误立即退出

echo "🚀 开始应用数据库性能优化..."
echo ""

# 1. 应用数据库迁移（添加索引）
echo "📊 步骤 1/4: 应用数据库索引优化..."
npx prisma migrate dev --name add_performance_indexes
echo "✅ 索引优化完成"
echo ""

# 2. 重新生成 Prisma Client
echo "🔄 步骤 2/4: 重新生成 Prisma Client..."
npx prisma generate
echo "✅ Prisma Client 生成完成"
echo ""

# 3. 提交更改
echo "📝 步骤 3/4: 提交代码更改..."
git add .
git commit -m "优化数据库性能：移除不必要的初始化，添加索引，准备缓存层" || echo "没有新的更改需要提交"
echo "✅ 代码提交完成"
echo ""

# 4. 推送到远程仓库（触发 Vercel 部署）
echo "🚢 步骤 4/4: 推送到远程仓库..."
git push
echo "✅ 推送完成，Vercel 将自动部署"
echo ""

echo "🎉 优化部署完成！"
echo ""
echo "📋 下一步操作："
echo "1. 等待 Vercel 部署完成（约 2-3 分钟）"
echo "2. 测试 API 性能：curl https://your-domain.vercel.app/api/favorites"
echo "3. 查看 Vercel 日志：vercel logs --follow"
echo ""
echo "💡 可选：安装缓存层（Vercel KV）"
echo "   1. npm install @vercel/kv"
echo "   2. 在 Vercel Dashboard 中启用 KV Storage"
echo "   3. 参考文档：docs/CACHE_IMPLEMENTATION_EXAMPLE.md"
echo ""
