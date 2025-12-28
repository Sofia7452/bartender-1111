'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStreamingRecommendation } from '../../hooks/useStreamingRecommendation';
import { RecipeCard } from './RecipeCard';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { IngredientInput } from './IngredientInput';

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

interface StreamingRecommendationViewProps {
  onComplete?: (recommendations: Recipe[]) => void;
}

// 动画包装组件
interface AnimatedRecipeCardProps {
  recipe: Recipe;
  animationDelay: number;
  isFavorited: boolean;
  onFavorite: (recipeId: string, isFavorited: boolean) => void;
}

function AnimatedRecipeCard({ recipe, animationDelay, isFavorited, onFavorite }: AnimatedRecipeCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);

    return () => clearTimeout(timer);
  }, [animationDelay]);

  console.log('AnimatedRecipeCard 渲染:', { 
    recipeId: recipe.id, 
    recipeName: recipe.name,
    isFavorited 
  });

  return (
    <div
      className={`transform transition-all duration-500 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <RecipeCard
        recipe={recipe}
        isFavorited={isFavorited}
        onFavorite={onFavorite}
        onViewDetails={(id) => console.log('查看详情:', id)}
      />
    </div>
  );
}

export function StreamingRecommendationView({ onComplete }: StreamingRecommendationViewProps) {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [favoritedRecipes, setFavoritedRecipes] = useState<Set<string>>(new Set());

  const {
    isStreaming,
    streamedContent,
    recommendations,
    error,
    isCacheHit,
    startStreaming,
    reset,
  } = useStreamingRecommendation({
    onComplete: (recs) => {
      console.log('✅ 流式推荐完成:', recs);
      // 转换类型以匹配 Recipe 接口
      const convertedRecs = recs.map((rec) => ({
        ...rec,
        id: rec.id || crypto.randomUUID(),
        category: '',
        glassType: '',
        technique: '',
        garnish: undefined,
      }));
      onComplete?.(convertedRecs);
    },
    onError: (err) => {
      console.error('❌ 流式推荐错误:', err);
    },
  });

  const handleStart = () => {
    startStreaming(ingredients);
  };

  const handleReset = () => {
    reset();
    setIngredients([]);
    setFavoritedRecipes(new Set());
  };

  const handleFavorite = (recipeId: string, isFavorited: boolean) => {
    console.log('收藏状态变化:', { recipeId, isFavorited });
    setFavoritedRecipes((prev) => {
      const newSet = new Set(prev);
      if (isFavorited) {
        newSet.add(recipeId);
      } else {
        newSet.delete(recipeId);
      }
      console.log('更新后的收藏列表:', Array.from(newSet));
      return newSet;
    });
  };

  // 转换推荐结果为完整的 Recipe 类型
  // 使用 useMemo 确保 ID 稳定，不会每次渲染都重新生成
  const convertedRecommendations: Recipe[] = useMemo(() => {
    return recommendations.map((rec) => ({
      ...rec,
      id: rec.id || crypto.randomUUID(),
      category: '',
      glassType: '',
      technique: '',
      garnish: undefined,
    }));
  }, [recommendations]);

  return (
    <>
      {/* 输入区域 */}
      <div className="max-w-2xl mx-auto mb-8">
        <Card>
          <CardHeader>
            <CardTitle>输入您的原料</CardTitle>
          </CardHeader>
          <CardContent>
            <IngredientInput
              value={ingredients}
              onChange={setIngredients}
              placeholder="输入原料名称，如：威士忌、柠檬、糖浆..."
              maxIngredients={8}
            />
          </CardContent>
        </Card>
      </div>

      {/* 推荐按钮 */}
      <div className="text-center mb-8">
        <Button
          onClick={handleStart}
          disabled={ingredients.length === 0 || isStreaming}
          loading={isStreaming}
          size="lg"
          className="px-8 py-3"
        >
          {isStreaming ? '正在生成推荐...' : '开始流式推荐'}
        </Button>
        
        {(recommendations.length > 0 || error) && (
          <Button
            onClick={handleReset}
            variant="outline"
            disabled={isStreaming}
            className="ml-3"
          >
            重置
          </Button>
        )}
      </div>

      {/* 实时内容预览（无缓存时显示） */}
      {!isCacheHit && streamedContent && (
        <div className="max-w-2xl mx-auto mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">实时内容预览</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto">
                {streamedContent}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 缓存命中提示 */}
      {isCacheHit && recommendations.length > 0 && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-green-800">缓存命中</h4>
                <p className="text-sm text-green-600 mt-1">使用了之前的推荐结果，响应更快</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-red-800">推荐失败</h4>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 推荐结果 */}
      {convertedRecommendations.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            为您推荐以下配方
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {convertedRecommendations.map((recipe, index) => {
              const isFav = favoritedRecipes.has(recipe.id);
              console.log('渲染配方卡片:', { 
                recipeId: recipe.id, 
                recipeName: recipe.name,
                isFavorited: isFav,
                favoritedRecipesSize: favoritedRecipes.size 
              });
              return (
                <AnimatedRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  animationDelay={index * 200}
                  isFavorited={isFav}
                  onFavorite={handleFavorite}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!isStreaming && convertedRecommendations.length === 0 && !error && ingredients.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⚡</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            体验流式推荐
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            输入您的原料，实时查看 AI 生成推荐的过程，无需等待全部完成
          </p>
        </div>
      )}
    </>
  );
}
