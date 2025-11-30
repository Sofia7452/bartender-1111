/**
 * 套装收藏卡片组件
 * 展示一个已收藏的菜酒搭配套装
 */

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

interface RecipeInSet {
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
}

interface DishInSet {
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
}

interface SavedSetItem {
  id: string;
  sessionId: string;
  name: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  dish: DishInSet;
  recipes: RecipeInSet[];
}

interface SavedSetCardProps {
  savedSet: SavedSetItem;
  onDelete?: (savedSetId: string) => void;
  className?: string;
}

export const SavedSetCard: React.FC<SavedSetCardProps> = ({
  savedSet,
  onDelete,
  className = '',
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 处理删除套装
  const handleDelete = async () => {
    if (isDeleting || !confirm('确定要删除这个套装吗？')) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/saved-sets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          savedSetId: savedSet.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onDelete?.(savedSet.id);
        console.log('✅ 套装删除成功:', savedSet.id);
      } else {
        setDeleteError(data.error || '删除失败，请重试');
        console.error('❌ 删除失败:', data.error);
      }
    } catch (error) {
      console.error('删除操作失败:', error);
      setDeleteError('网络错误，请检查网络连接后重试');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">
              {savedSet.name || `${savedSet.dish.name} 搭配套装`}
            </CardTitle>
            {savedSet.description && (
              <p className="text-sm text-gray-600 mb-3">{savedSet.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="info" size="sm">
                🍽️ 套装
              </Badge>
              <Badge variant="default" size="sm">
                {savedSet.dish.cuisine}
              </Badge>
              <Badge variant="default" size="sm">
                {savedSet.recipes.length} 个酒品
              </Badge>
            </div>
          </div>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            variant="danger"
            size="sm"
            className="ml-4"
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                删除中...
              </>
            ) : (
              '🗑️ 删除'
            )}
          </Button>
        </div>
        {deleteError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {deleteError}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* 菜品信息 */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-2">🍽️ {savedSet.dish.name}</h4>
          {savedSet.dish.description && (
            <p className="text-sm text-gray-600 mb-2">{savedSet.dish.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" size="sm">
              ⏱️ {savedSet.dish.cookingTime} 分钟
            </Badge>
            <Badge variant="default" size="sm">
              难度: {savedSet.dish.difficulty}/5
            </Badge>
          </div>
        </div>

        {/* 酒品列表 */}
        {savedSet.recipes.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              🍷 搭配酒品 ({savedSet.recipes.length} 款)
            </h4>
            <div className="space-y-2">
              {savedSet.recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="p-2 bg-gray-50 rounded border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 text-sm">{recipe.name}</h5>
                      {recipe.description && (
                        <p className="text-xs text-gray-600 mt-1">{recipe.description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 ml-2">
                      {recipe.category && (
                        <Badge variant="default" size="sm" className="text-xs">
                          {recipe.category}
                        </Badge>
                      )}
                      <Badge variant="default" size="sm" className="text-xs">
                        ⏱️ {recipe.estimatedTime} 分钟
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-2">
            暂无酒品
          </div>
        )}

        {/* 收藏时间 */}
        <div className="mt-4 pt-3 border-t text-xs text-gray-500">
          收藏于: {new Date(savedSet.createdAt).toLocaleString('zh-CN')}
        </div>
      </CardContent>
    </Card>
  );
};

