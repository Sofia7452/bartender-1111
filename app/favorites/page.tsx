'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { RecipeCard } from '../components/forms/RecipeCard';
import { SavedSetCard } from '../components/forms/SavedSetCard';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
  category?: string;
  glassType?: string;
  technique?: string;
  garnish?: string;
}

interface FavoriteItem {
  id: string;
  sessionId: string;
  recipeId: string;
  createdAt: string;
  recipe: Recipe | null;
}

interface FavoritesResponse {
  success: boolean;
  favorites?: FavoriteItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
  details?: string;
}

interface SavedSetItem {
  id: string;
  sessionId: string;
  name: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  dish: {
    id: string;
    name: string;
    description: string | null;
    cuisine: string;
    requiredIngredients: string[];
    cookingTime: number;
    difficulty: number;
    steps: string[];
    source: string | null;
    tags: string[] | null;
  };
  recipes: Array<{
    id: string;
    name: string;
    description: string | null;
    ingredients: string[];
    steps: string[];
    difficulty: number;
    estimatedTime: number;
    category: string | null;
    glassType: string | null;
    technique: string | null;
    garnish: string | null;
  }>;
}

interface SavedSetsResponse {
  success: boolean;
  savedSets?: SavedSetItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  details?: string;
}

type FilterTag = 'all' | 'recipes' | 'sets';

export default function FavoritesPage() {
  // 状态管理
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [savedSets, setSavedSets] = useState<SavedSetItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [favoritesPagination, setFavoritesPagination] = useState<FavoritesResponse['pagination'] | null>(null);
  const [setsPagination, setSetsPagination] = useState<SavedSetsResponse['pagination'] | null>(null);

  // 获取单独收藏的酒品列表
  const fetchFavorites = async (page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(`/api/favorites?page=${page}&limit=${limit}`);
      const data: FavoritesResponse = await response.json();

      if (data.success && data.favorites && data.pagination) {
        setFavorites(data.favorites);
        setFavoritesPagination(data.pagination);
      } else {
        const errorMsg = data.error || '获取收藏列表失败';
        console.error('获取收藏列表失败:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('获取收藏列表失败:', err);
    }
  };

  // 获取套装收藏列表
  const fetchSavedSets = async (page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(`/api/saved-sets?page=${page}&limit=${limit}`);
      const data: SavedSetsResponse = await response.json();

      if (data.success && data.savedSets && data.pagination) {
        setSavedSets(data.savedSets);
        setSetsPagination(data.pagination);
      } else {
        const errorMsg = data.error || '获取套装列表失败';
        console.error('获取套装列表失败:', errorMsg);
        // 不设置 error 状态，因为这是后台获取，不影响主界面
      }
    } catch (err) {
      console.error('获取套装列表失败:', err);
    }
  };

  // 获取所有收藏
  const fetchAllFavorites = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchFavorites(1, 100), // 获取足够多的单独收藏
        fetchSavedSets(1, 100), // 获取足够多的套装收藏
      ]);
    } catch (err) {
      console.error('获取收藏列表失败:', err);
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取所有收藏
  useEffect(() => {
    fetchAllFavorites();
  }, []);

  // 处理取消收藏
  const handleUnfavorite = async (recipeId: string, isFavorited: boolean) => {
    if (isFavorited) {
      // 如果还在收藏状态，说明取消收藏失败，不处理
      return;
    }

    // 取消收藏成功，从列表中移除该配方
    setFavorites(prevFavorites =>
      prevFavorites.filter(fav => fav.recipeId !== recipeId)
    );

    // 更新总数
    if (favoritesPagination) {
      setFavoritesPagination({
        ...favoritesPagination,
        total: Math.max(0, favoritesPagination.total - 1),
        pages: Math.ceil(Math.max(0, favoritesPagination.total - 1) / favoritesPagination.limit)
      });
    }
  };

  // 处理删除套装
  const handleDeleteSet = (savedSetId: string) => {
    setSavedSets(prevSets => prevSets.filter(set => set.id !== savedSetId));

    // 更新总数
    if (setsPagination) {
      setSetsPagination({
        ...setsPagination,
        total: Math.max(0, setsPagination.total - 1),
        totalPages: Math.ceil(Math.max(0, setsPagination.total - 1) / setsPagination.limit)
      });
    }
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
  const totalCount = (favoritesPagination?.total || 0) + (setsPagination?.total || 0);

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
        {!loading && (favorites.length > 0 || savedSets.length > 0) && (
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
              🍷 只有酒品 ({favoritesPagination?.total || 0})
            </Button>
            <Button
              onClick={() => setFilterTag('sets')}
              variant={filterTag === 'sets' ? 'primary' : 'outline'}
              size="sm"
            >
              🍽️ 菜酒品套装 ({setsPagination?.total || 0})
            </Button>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <Card className="mb-6">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button
                  onClick={() => fetchAllFavorites()}
                  variant="outline"
                >
                  重试
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {!loading && !error && filteredFavorites.length === 0 && filteredSets.length === 0 && (
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
        {!loading && !error && (filteredFavorites.length > 0 || filteredSets.length > 0) && (
          <>
            {/* 收藏统计 */}
            <div className="mb-6">
              <p className="text-gray-600">
                共 {totalCount} 个收藏
                {filterTag === 'recipes' && `（${favoritesPagination?.total ?? 0} 个酒品）`}
                {filterTag === 'sets' && `（${setsPagination?.total ?? 0} 个套装）`}
                {filterTag === 'all' && `（${favoritesPagination?.total ?? 0} 个酒品 + ${setsPagination?.total ?? 0} 个套装）`}
              </p>
            </div>

            {/* 单独收藏的酒品 */}
            {filteredFavorites.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  🍷 单独收藏的酒品
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFavorites.map((favorite) => {
                    if (!favorite.recipe) {
                      return null;
                    }

                    return (
                      <RecipeCard
                        key={favorite.id}
                        recipe={favorite.recipe}
                        isFavorited={true}
                        onFavorite={handleUnfavorite}
                        onViewDetails={handleViewDetails}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* 套装收藏 */}
            {filteredSets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  🍽️ 菜酒品搭配套装
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredSets.map((savedSet) => (
                    <SavedSetCard
                      key={savedSet.id}
                      savedSet={savedSet}
                      onDelete={handleDeleteSet}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

