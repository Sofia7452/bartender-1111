/**
 * 菜品搭配卡片组件
 * 展示一个菜品及其对应的多个酒品，支持收藏整个套装
 */

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import type { DishRecommendation, BeverageRecommendation, PairingReason } from '../../types/foodPairing';

interface DishPairingCardProps {
  dish: DishRecommendation;
  beverages: BeverageRecommendation[];
  pairingReasons: PairingReason[];
  onSaved?: (savedSetId: string) => void;
  className?: string;
}

export const DishPairingCard: React.FC<DishPairingCardProps> = ({
  dish,
  beverages,
  pairingReasons,
  onSaved,
  className = '',
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 获取该菜品对应的酒品（根据 pairingReasons）
  // 如果没有找到关联的酒品，则显示所有可用酒品（作为备选）
  let relatedBeverages = beverages.filter((beverage) =>
    pairingReasons.some(
      (reason) => reason.dishId === dish.id && reason.beverageId === beverage.id
    )
  );

  // 如果没有找到关联的酒品，但有可用的酒品，则显示所有酒品
  // 这可能是 pairingReasons 数据不完整的情况
  if (relatedBeverages.length === 0 && beverages.length > 0) {
    console.warn(`⚠️ 菜品 ${dish.id} 没有找到关联的酒品，显示所有可用酒品`);
    relatedBeverages = beverages;
  }

  // 获取该菜品与每个酒品的搭配理由
  const getPairingReason = (beverageId: string): PairingReason | undefined => {
    return pairingReasons.find(
      (reason) => reason.dishId === dish.id && reason.beverageId === beverageId
    );
  };

  // 处理收藏套装
  const handleSaveSet = async () => {
    if (isSaving || isSaved) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // 步骤1：先确保所有 beverage 都已作为 Recipe 存在于数据库中
      // 将 BeverageRecommendation 转换为 Recipe 格式并创建 Recipe 记录
      const recipeIds: string[] = [];

      for (const beverage of relatedBeverages) {
        try {
          // 先尝试创建 Recipe（如果已存在会返回 409，我们可以忽略）
          // 使用 /api/favorites 来创建 Recipe，即使已收藏也没关系
          const recipeResponse = await fetch('/api/favorites', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipeId: beverage.id,
              recipeData: {
                id: beverage.id,
                name: beverage.name,
                description: beverage.description || null,
                ingredients: beverage.ingredients,
                steps: beverage.steps,
                difficulty: beverage.difficulty,
                estimatedTime: beverage.estimatedTime,
                source: beverage.source || null,
                category: beverage.category || null,
                glassType: beverage.glassType || null,
                technique: beverage.technique || null,
                garnish: beverage.garnish || null,
                notes: null,
              },
            }),
          });

          // 无论成功（200）还是已存在（409），都说明 Recipe 已存在
          if (recipeResponse.ok || recipeResponse.status === 409) {
            recipeIds.push(beverage.id);
          } else {
            const recipeData = await recipeResponse.json();
            console.warn(`⚠️ 创建 Recipe 失败: ${beverage.id}`, recipeData.error);
            // 继续处理其他 beverage
          }
        } catch (error) {
          console.error(`❌ 处理 beverage ${beverage.id} 失败:`, error);
          // 继续处理其他 beverage
        }
      }

      if (recipeIds.length === 0) {
        setSaveError('无法创建酒品记录，请重试');
        return;
      }

      // 步骤2：创建套装收藏
      const response = await fetch('/api/saved-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dish: dish,
          recipeIds: recipeIds,
          name: `${dish.name} 搭配套装`,
          description: `包含 ${relatedBeverages.length} 个推荐酒品的搭配套装`,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSaved(true);
        setSaveError(null);
        onSaved?.(data.savedSet.id);
        console.log('✅ 套装收藏成功:', data.savedSet.id);
      } else {
        setSaveError(data.error || '收藏失败，请重试');
        console.error('❌ 收藏失败:', data.error);
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      setSaveError('网络错误，请检查网络连接后重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{dish.name}</CardTitle>
            <p className="text-sm text-gray-600 mb-3">{dish.description}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" size="sm">
                {dish.cuisine}
              </Badge>
              <Badge variant="default" size="sm">
                ⏱️ {dish.cookingTime} 分钟
              </Badge>
              <Badge variant="default" size="sm">
                难度: {dish.difficulty}/5
              </Badge>
            </div>
          </div>
          <Button
            onClick={handleSaveSet}
            disabled={isSaving || isSaved || relatedBeverages.length === 0}
            variant={isSaved ? 'outline' : 'primary'}
            size="sm"
            className="ml-4"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                收藏中...
              </>
            ) : isSaved ? (
              '✓ 已收藏'
            ) : (
              '❤️ 收藏套装'
            )}
          </Button>
        </div>
        {saveError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {saveError}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* 所需食材 */}
        <div className="mb-4">
          <span className="text-xs font-medium text-gray-500">所需食材：</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {dish.requiredIngredients.slice(0, 4).map((ing, idx) => (
              <Badge key={idx} variant="default" size="sm">
                {ing}
              </Badge>
            ))}
            {dish.requiredIngredients.length > 4 && (
              <Badge variant="default" size="sm">
                +{dish.requiredIngredients.length - 4} 更多
              </Badge>
            )}
          </div>
        </div>

        {/* 推荐酒品列表 */}
        {relatedBeverages.length > 0 ? (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                🍷 推荐搭配酒品 ({relatedBeverages.length} 款)
              </h4>
              <div className="space-y-3">
                {relatedBeverages.map((beverage) => {
                  const reason = getPairingReason(beverage.id);
                  return (
                    <div
                      key={beverage.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{beverage.name}</h5>
                          {beverage.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {beverage.description}
                            </p>
                          )}
                        </div>
                        {reason?.score && (
                          <Badge variant="info" size="sm" className="ml-2">
                            {reason.score}/10
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {beverage.category && (
                          <Badge variant="default" size="sm">{beverage.category}</Badge>
                        )}
                        {beverage.glassType && (
                          <Badge variant="default" size="sm">{beverage.glassType}</Badge>
                        )}
                        <Badge variant="default" size="sm">
                          ⏱️ {beverage.estimatedTime} 分钟
                        </Badge>
                        <Badge variant="default" size="sm">
                          难度: {beverage.difficulty}/5
                        </Badge>
                      </div>
                      {beverage.ingredients.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-gray-500">原料：</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {beverage.ingredients.slice(0, 3).map((ing, idx) => (
                              <Badge key={idx} variant="default" size="sm" className="text-xs">
                                {ing}
                              </Badge>
                            ))}
                            {beverage.ingredients.length > 3 && (
                              <Badge variant="default" size="sm" className="text-xs">
                                +{beverage.ingredients.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {reason && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-700">
                          <span className="font-medium">💡 搭配理由：</span>
                          {reason.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            暂无推荐酒品
          </div>
        )}
      </CardContent>
    </Card>
  );
};

