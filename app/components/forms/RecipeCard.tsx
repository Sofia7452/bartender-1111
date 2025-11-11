'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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

interface RecipeCardProps {
  recipe: Recipe;
  onFavorite?: (recipeId: string, isFavorited: boolean) => void;
  onViewDetails?: (recipeId: string) => void;
  isFavorited?: boolean;
  className?: string;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onFavorite,
  onViewDetails,
  isFavorited: initialIsFavorited = false,
  className = ''
}) => {
  // 1. 添加状态管理
  const [isFavorited, setIsFavorited] = useState<boolean>(initialIsFavorited);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 2. 当外部传入的 isFavorited 变化时，更新内部状态
  useEffect(() => {
    setIsFavorited(initialIsFavorited);
  }, [initialIsFavorited]);

  // 3. 实现 handleFavorite 异步函数
  const handleFavorite = async () => {
    // 防止重复点击
    if (isLoading) {
      return;
    }

    // 验证 recipe.id 是否存在
    if (!recipe?.id) {
      console.error('Recipe ID 不存在:', recipe);
      alert('配方ID不存在，无法收藏');
      return;
    }

    setIsLoading(true);

    try {
      const method = isFavorited ? 'DELETE' : 'POST';
      const url = '/api/favorites';
      // 传递完整的Recipe数据，以便在Recipe不存在时自动创建
      const requestBody = {
        recipeId: recipe.id,
        ...(method === 'POST' && !isFavorited ? { recipeData: recipe } : {})
      };

      console.log('发送收藏请求:', { method, url, body: requestBody });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 更新状态
        const newFavorited = !isFavorited;
        setIsFavorited(newFavorited);

        // 调用回调函数
        onFavorite?.(recipe.id, newFavorited);
      } else {
        // 处理错误响应
        console.error('收藏操作失败:', data.error || '未知错误');
        // 可以在这里显示错误提示，比如使用 toast
        alert(data.error || '操作失败，请重试');
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      alert('网络错误，请检查网络连接后重试');
    } finally {
      setIsLoading(false);
    }
  };
  const difficultyLabels = ['简单', '容易', '中等', '困难', '专家'];
  const difficultyColors = ['green', 'green', 'yellow', 'orange', 'red'];

  const getDifficultyColor = (difficulty: number) => {
    const colors = {
      green: 'bg-green-100 text-green-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800'
    };
    return colors[difficultyColors[difficulty - 1] as keyof typeof colors] || colors.green;
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow duration-200 ${className}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{recipe.name}</CardTitle>
            {recipe.description && (
              <p className="text-gray-600 text-sm">{recipe.description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFavorite}
            disabled={isLoading}
            loading={isLoading}
            className={`p-2 ${isFavorited ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'} transition-colors`}
            title={isFavorited ? '取消收藏' : '收藏'}
          >
            <svg className="h-5 w-5" fill={isFavorited ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* 基本信息 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="info" size="sm">
            {difficultyLabels[recipe.difficulty - 1] || '未知'}
          </Badge>
          <Badge variant="default" size="sm">
            {recipe.estimatedTime}分钟
          </Badge>
          {recipe.category && (
            <Badge variant="default" size="sm">
              {recipe.category}
            </Badge>
          )}
          {recipe.glassType && (
            <Badge variant="default" size="sm">
              {recipe.glassType}
            </Badge>
          )}
        </div>

        {/* 原料列表 */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">所需原料</h4>
          <div className="flex flex-wrap gap-1">
            {recipe.ingredients.slice(0, 4).map((ingredient, index) => (
              <Badge key={index} variant="default" size="sm">
                {ingredient}
              </Badge>
            ))}
            {recipe.ingredients.length > 4 && (
              <Badge variant="default" size="sm">
                +{recipe.ingredients.length - 4} 更多
              </Badge>
            )}
          </div>
        </div>

        {/* 制作步骤预览 */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">制作步骤</h4>
          <p className="text-sm text-gray-600 line-clamp-2">
            {recipe.steps[0] || '暂无制作步骤'}
          </p>
        </div>
      </CardContent>

      <CardFooter>
        <div className="flex space-x-2 w-full">
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(recipe.id)}
              className="flex-1"
            >
              查看详情
            </Button>
          )}
          <Button
            variant={isFavorited ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleFavorite}
            disabled={isLoading}
            loading={isLoading}
            className="flex-1"
          >
            {isFavorited ? '已收藏' : '收藏'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
