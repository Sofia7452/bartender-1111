/**
 * 收藏列表页面 - 游标分页版本
 * 
 * 展示如何使用游标分页实现"加载更多"功能
 */

'use client';

import { useFavoritesCursor } from '../hooks/useFavoritesCursor';
import { RecipeCard } from '../components/forms/RecipeCard';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

export default function FavoritesCursorPage() {
  const {
    favorites,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useFavoritesCursor({ limit: 3 });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            我的收藏 <span className="text-sm font-normal text-gray-500">(游标分页)</span>
          </h1>
          <p className="text-gray-600">
            已收藏 {favorites.length} 个鸡尾酒配方
            {hasMore && <span className="text-blue-600 ml-2">• 还有更多</span>}
          </p>
        </div>
        
        <Button
          onClick={refresh}
          variant="outline"
          disabled={isLoading}
        >
          {isLoading ? '刷新中...' : '刷新列表'}
        </Button>
      </div>

      {/* 性能提示 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              游标分页优化
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>此页面使用游标分页技术，相比传统分页：</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>性能提升 10 倍以上（深分页场景）</li>
                <li>支持无限滚动和"加载更多"</li>
                <li>数据库查询复杂度从 O(N) 降低到 O(log N)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">加载失败</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">加载收藏列表中...</p>
        </div>
      )}

      {/* 收藏列表 */}
      {!isLoading && (
        <>
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">暂无收藏</h3>
              <p className="mt-1 text-sm text-gray-500">
                开始探索并收藏你喜欢的鸡尾酒配方吧！
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map((favorite) => (
                  <RecipeCard
                    key={favorite.id}
                    recipe={{
                      ...favorite.recipe,
                      id: favorite.recipeId,
                      description: favorite.recipe.description ?? '',
                      category: favorite.recipe.category ?? undefined,
                      glassType: favorite.recipe.glassType ?? undefined,
                      technique: favorite.recipe.technique ?? undefined,
                      garnish: favorite.recipe.garnish ?? undefined,
                    }}
                    isFavorited={true}
                    onFavorite={(recipeId, isFavorited) => {
                      // 收藏状态变化时刷新列表
                      if (!isFavorited) {
                        // 用户取消了收藏，刷新列表
                        console.log('用户取消收藏，刷新列表');
                        refresh();
                      }
                    }}
                  />
                ))}
              </div>

              {/* 加载更多按钮 */}
              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    size="lg"
                  >
                    {isLoadingMore ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        加载中...
                      </>
                    ) : (
                      '加载更多'
                    )}
                  </Button>
                </div>
              )}

              {/* 已加载全部提示 */}
              {!hasMore && favorites.length > 0 && (
                <div className="mt-8 text-center text-gray-500 text-sm">
                  已加载全部 {favorites.length} 个收藏
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 调试信息（仅开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">调试信息</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• 已加载: {favorites.length} 项</p>
            <p>• 是否加载中: {isLoading ? '是' : '否'}</p>
            <p>• 是否加载更多中: {isLoadingMore ? '是' : '否'}</p>
            <p>• 是否有更多: {hasMore ? '是' : '否'}</p>
            <p>• 错误: {error || '无'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
