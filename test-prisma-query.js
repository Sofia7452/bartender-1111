// 测试 Prisma 生成的 SQL
const { PrismaClient } = require('./app/generated/prisma')
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
})

prisma.$on('query', (e) => {
  console.log('\n========== Prisma Query ==========')
  console.log('SQL:', e.query)
  console.log('Params:', e.params)
  console.log('Duration:', e.duration + 'ms')
  console.log('==================================\n')
})

async function testQueries() {
  console.log('\n📊 测试 1: UserFavorite + Recipe (N:1 关系)')
  const favorites = await prisma.userFavorite.findMany({
    where: { sessionId: 'test-session' },
    take: 2,
    select: {
      id: true,
      recipeId: true,
      recipe: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
  
  console.log('\n📊 测试 2: SavedSet + Dish + Recipes (1:1 + 1:N 关系)')
  const savedSets = await prisma.savedSet.findMany({
    where: { sessionId: 'test-session' },
    take: 1,
    select: {
      id: true,
      name: true,
      dish: {
        select: {
          id: true,
          name: true
        }
      },
      recipes: {
        select: {
          recipe: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  })
  
  await prisma.$disconnect()
}

testQueries().catch(console.error)
