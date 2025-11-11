'use client';

import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { RecipeCard } from '../components/forms/RecipeCard';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';

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
  favorites: FavoriteItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function FavoritesPage() {
  // 状态管理
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<FavoritesResponse['pagination'] | null>(null);

  // 获取收藏列表
  const fetchFavorites = async (page: number = 1, limit: number = 20) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/favorites?page=${page}&limit=${limit}`);
      const data: FavoritesResponse = await response.json();

      if (data.success) {
        setFavorites(data.favorites);
        setPagination(data.pagination);
      } else {
        setError('获取收藏列表失败，请稍后重试');
      }
    } catch (err) {
      console.error('获取收藏列表失败:', err);
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取收藏列表
  useEffect(() => {
    fetchFavorites();
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
    if (pagination) {
      setPagination({
        ...pagination,
        total: Math.max(0, pagination.total - 1),
        pages: Math.ceil(Math.max(0, pagination.total - 1) / pagination.limit)
      });
    }
  };

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
          <p className="text-gray-600">您收藏的所有鸡尾酒配方</p>
        </div>

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
                  onClick={() => fetchFavorites()}
                  variant="outline"
                >
                  重试
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {!loading && !error && favorites.length === 0 && (
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
        {!loading && !error && favorites.length > 0 && (
          <>
            {/* 收藏统计 */}
            <div className="mb-6">
              <p className="text-gray-600">
                共 {pagination?.total || favorites.length} 个收藏
              </p>
            </div>

            {/* 收藏网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {favorites.map((favorite) => {
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

            {/* 分页信息（如果需要） */}
            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center items-center space-x-4 mt-8">
                <Button
                  onClick={() => fetchFavorites(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  variant="outline"
                >
                  上一页
                </Button>
                <span className="text-gray-600">
                  第 {pagination.page} 页 / 共 {pagination.pages} 页
                </span>
                <Button
                  onClick={() => fetchFavorites(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  variant="outline"
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

