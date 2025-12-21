'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CardContent } from '../components/ui/Card';
import { RecipeCard } from '../components/forms/RecipeCard';
import { SavedSetCard } from '../components/forms/SavedSetCard';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { useFavorites, type FavoriteItem as HookFavoriteItem } from '../hooks/useFavorites';
import { useSavedSets, type SavedSetItem as HookSavedSetItem } from '../hooks/useSavedSets';
import { performanceMonitor } from '../lib/performanceMonitor';

type FilterTag = 'all' | 'recipes' | 'sets';

// 类型转换辅助函数 - 将 hook 返回的 Recipe 转换为 RecipeCard 期望的格式
function convertRecipeForCard(recipe: NonNullable<HookFavoriteItem['recipe']>) {
  return {
    ...recipe,
    description: recipe.description || '', // 将 null 转换为空字符串
    category: recipe.category || undefined,
    glassType: recipe.glassType || undefined,
    technique: recipe.technique || undefined,
    garnish: recipe.garnish || undefined,
  };
}

// 类型转换辅助函数 - 将 hook 返回的 SavedSet 转换为 SavedSetCard 期望的格式
function convertSavedSetForCard(savedSet: HookSavedSetItem) {
  return {
    ...savedSet,
    dish: {
      ...savedSet.dish,
      tags: savedSet.dish.tags || null,
    },
    recipes: savedSet.recipes.map(recipe => ({
      ...recipe,
      category: recipe.category || null,
      glassType: recipe.glassType || null,
      technique: recipe.technique || null,
      garnish: recipe.garnish || null,
    })),
  };
}

export default function FavoritesPage() {
  // 筛选标签状态
  const [filterTag, setFilterTag] = useState<FilterTag>('all');

  // 页面加载时间监控
  useEffect(() => {
    const pageLoadStart = performance.now();
    
    return () => {
      // 组件卸载时不记录
    };
  }, []);

  // 使用 useFavorites hook - 独立加载收藏数据
  const {
    favorites,
    loading: favoritesLoading,
    error: favoritesError,
    pagination: favoritesPagination,
    refetch: refetchFavorites,
  } = useFavorites({ page: 1, limit: 10 });

  // 使用 useSavedSets hook - 独立加载套装数据
  const {
    savedSets,
    loading: setsLoading,
    error: setsError,
    pagination: setsPagination,
    refetch: refetchSets,
  } = useSavedSets({ page: 1, limit: 10 });

  // 监控页面加载完成时间（当两个数据源都加载完成时）
  useEffect(() => {
    if (!favoritesLoading && !setsLoading) {
      const pageLoadEnd = performance.now();
      const pageLoadTime = pageLoadEnd - performance.timeOrigin;
      performanceMonitor.trackPageLoad('favorites', pageLoadTime);
    }
  }, [favoritesLoading, setsLoading]);

  // 处理取消收藏
  const handleUnfavorite = async (recipeId: string, isFavorited: boolean) => {
    if (isFavorited) {
      // 如果还在收藏状态，说明取消收藏失败，不处理
      return;
    }

    // 取消收藏成功，重新获取数据
    await refetchFavorites();
  };

  // 处理删除套装
  const handleDeleteSet = async (savedSetId: string) => {
    // 删除成功，重新获取数据
    await refetchSets();
  };

  // 根据筛选标签过滤数据
  const getFilteredData = () => {
    switch (filterTag) {
      case 'recipes':
        return { favorites, savedSets: [] };
      case 'sets':
        return { favorites: [], savedSets };
      case 'all':
      default:
        return { favorites, savedSets };
    }
  };

  const { favorites: filteredFavorites, savedSets: filteredSets } = getFilteredData();
  
  // 计算总数 - 使用 pagination 中的 total
  const favoritesTotal = favoritesPagination?.total || 0;
  const setsTotal = setsPagination?.total || 0;
  const totalCount = favoritesTotal + setsTotal;

  // 判断是否正在加载（任一部分正在加载）
  const isLoading = favoritesLoading || setsLoading;
  
  // 判断是否有错误（两者都失败才显示全局错误）
  const hasGlobalError = favoritesError && setsError;
  
  // 判断是否为空状态（两者都加载完成且都为空）
  const isEmpty = !isLoading && !hasGlobalError && 
                  filteredFavorites.length === 0 && 
                  filteredSets.length === 0;

  // 处理查看详情
  const handleViewDetails = (recipeId: string) => {
    // 导航到配方详情页
    window.location.href = `/recipe/${recipeId}`;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">我的收藏</h1>
          <p className="text-gray-600">您收藏的所有鸡尾酒配方和搭配套装</p>
        </div>

        {/* 分类筛选 */}
        {!isLoading && (favorites.length > 0 || savedSets.length > 0) && (
          <div className="mb-6 flex flex-wrap gap-3">
            <Button
              onClick={() => setFilterTag('all')}
              variant={filterTag === 'all' ? 'primary' : 'outline'}
              size="sm"
            >
              全部 ({totalCount})
            </Button>
            <Button
              onClick={() => setFilterTag('recipes')}
              variant={filterTag === 'recipes' ? 'primary' : 'outline'}
              size="sm"
            >
              🍷 只有酒品 ({favoritesTotal})
            </Button>
            <Button
              onClick={() => setFilterTag('sets')}
              variant={filterTag === 'sets' ? 'primary' : 'outline'}
              size="sm"
            >
              🍽️ 菜酒品套装 ({setsTotal})
            </Button>
          </div>
        )}

        {/* 全局加载状态 - 仅在初始加载时显示 */}
        {isLoading && favorites.length === 0 && savedSets.length === 0 && (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        )}

        {/* 全局错误状态 - 仅在两者都失败时显示 */}
        {hasGlobalError && (
          <Card className="mb-6">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-red-600 mb-4">加载失败，请重试</p>
                <Button
                  onClick={() => {
                    refetchFavorites();
                    refetchSets();
                  }}
                  variant="outline"
                >
                  重试
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {isEmpty && (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <svg
                  className="mx-auto h-24 w-24 text-gray-400 mb-4"
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
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  暂无收藏的配方
                </h3>
                <p className="text-gray-600 mb-6">
                  去探索并收藏您喜欢的鸡尾酒配方吧！
                </p>
                <Button
                  onClick={() => (window.location.href = '/')}
                  variant="primary"
                >
                  开始探索
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 收藏列表 */}
        {!isEmpty && (
          <>
            {/* 收藏统计 */}
            <div className="mb-6">
              <p className="text-gray-600">
                共 {totalCount} 个收藏
                {filterTag === 'recipes' && `（${favoritesTotal} 个酒品）`}
                {filterTag === 'sets' && `（${setsTotal} 个套装）`}
                {filterTag === 'all' && `（${favoritesTotal} 个酒品 + ${setsTotal} 个套装）`}
              </p>
            </div>

            {/* 单独收藏的酒品 */}
            {filterTag !== 'sets' && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  🍷 单独收藏的酒品
                </h2>
                
                {/* 收藏部分的独立加载状态 */}
                {favoritesLoading && (
                  <div className="flex justify-center items-center py-12">
                    <div className="text-center">
                      <Spinner size="md" className="mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">加载酒品中...</p>
                    </div>
                  </div>
                )}
                
                {/* 收藏部分的独立错误状态 */}
                {favoritesError && !favoritesLoading && (
                  <Card className="mb-4">
                    <CardContent className="py-6">
                      <div className="text-center">
                        <p className="text-red-600 mb-3">{favoritesError}</p>
                        <Button
                          onClick={refetchFavorites}
                          variant="outline"
                          size="sm"
                        >
                          重试
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* 收藏列表 */}
                {!favoritesLoading && !favoritesError && filteredFavorites.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredFavorites.map((favorite) => {
                      if (!favorite.recipe) {
                        return null;
                      }

                      return (
                        <RecipeCard
                          key={favorite.id}
                          recipe={convertRecipeForCard(favorite.recipe)}
                          isFavorited={true}
                          onFavorite={handleUnfavorite}
                          onViewDetails={handleViewDetails}
                        />
                      );
                    })}
                  </div>
                )}
                
                {/* 收藏为空的提示 */}
                {!favoritesLoading && !favoritesError && filteredFavorites.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-gray-500">暂无收藏的酒品</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* 套装收藏 */}
            {filterTag !== 'recipes' && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  🍽️ 菜酒品搭配套装
                </h2>
                
                {/* 套装部分的独立加载状态 */}
                {setsLoading && (
                  <div className="flex justify-center items-center py-12">
                    <div className="text-center">
                      <Spinner size="md" className="mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">加载套装中...</p>
                    </div>
                  </div>
                )}
                
                {/* 套装部分的独立错误状态 */}
                {setsError && !setsLoading && (
                  <Card className="mb-4">
                    <CardContent className="py-6">
                      <div className="text-center">
                        <p className="text-red-600 mb-3">{setsError}</p>
                        <Button
                          onClick={refetchSets}
                          variant="outline"
                          size="sm"
                        >
                          重试
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* 套装列表 */}
                {!setsLoading && !setsError && filteredSets.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredSets.map((savedSet) => (
                      <SavedSetCard
                        key={savedSet.id}
                        savedSet={convertSavedSetForCard(savedSet)}
                        onDelete={handleDeleteSet}
                      />
                    ))}
                  </div>
                )}
                
                {/* 套装为空的提示 */}
                {!setsLoading && !setsError && filteredSets.length === 0 && (
                  <Card>
                    <CardContent className="py-8">
                      <p className="text-center text-gray-500">暂无收藏的套装</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

