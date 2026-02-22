const { PrismaClient } = require('./app/generated/prisma')

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
})

prisma.$on('query', (e) => {
  console.log('\n' + '='.repeat(60))
  console.log('📊 Prisma Query Log')
  console.log('='.repeat(60))
  console.log('\n【SQL】:')
  console.log(e.query)
  console.log('\n【Parameters】:', e.params)
  console.log('\n【Duration】:', e.duration + 'ms')
  console.log('='.repeat(60) + '\n')
})

async function testAuthFavoritesQuery() {
  console.log('🔍 测试：AuthUserFavorite + Recipe (N:1 关系)\n')
  
  try {
    const favorites = await prisma.authUserFavorite.findMany({
      where: { userId: 1 },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            description: true,
            ingredients: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
    
    console.log(`✅ 查询完成，返回 ${favorites.length} 条记录\n`)
  } catch (error) {
    console.log('⚠️ 查询出错（可能是没有数据）:', error.message)
  }
  
  await prisma.$disconnect()
}

testAuthFavoritesQuery()
