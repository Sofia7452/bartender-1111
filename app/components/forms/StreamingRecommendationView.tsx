'use client';

import { useState } from 'react';
import { useStreamingRecommendation } from '../../hooks/useStreamingRecommendation';
import { StreamingRecipeCard } from './StreamingRecipeCard';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { IngredientInput } from './IngredientInput';

interface Recipe {
  id?: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
}

interface StreamingRecommendationViewProps {
  onComplete?: (recommendations: Recipe[]) => void;
}

export function StreamingRecommendationView({ onComplete }: StreamingRecommendationViewProps) {
  const [ingredients, setIngredients] = useState<string[]>([]);

  const {
    isStreaming,
    streamedContent,
    recommendations,
    error,
    progress,
    isCacheHit,
    startStreaming,
    reset,
  } = useStreamingRecommendation({
    onComplete: (recs) => {
      console.log('✅ 流式推荐完成:', recs);
      onComplete?.(recs);
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
  };

  return (
    <div className="space-y-6">
      {/* 输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle>🍹 流式推荐模式</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <IngredientInput
              value={ingredients}
              onChange={setIngredients}
              placeholder="输入原料名称，如：威士忌、柠檬、糖浆..."
              maxIngredients={8}
            />

            <div className="flex gap-3">
              <Button
                onClick={handleStart}
                disabled={ingredients.length === 0 || isStreaming}
                loading={isStreaming}
                className="flex-1"
              >
                {isStreaming ? '正在生成推荐...' : '开始流式推荐'}
              </Button>

              {(recommendations.length > 0 || error) && (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  disabled={isStreaming}
                >
                  重置
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 进度条 */}
      {isStreaming && (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">生成进度</span>
                <span className="font-semibold text-blue-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  <span>正在接收内容...</span>
                </div>
                <span>•</span>
                <span>已接收 {streamedContent.length} 字符</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 实时内容预览（无缓存时显示） */}
      {!isCacheHit && streamedContent && (
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
      )}

      {/* 缓存命中提示 */}
      {isCacheHit && recommendations.length > 0 && (
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
      )}

      {/* 错误提示 */}
      {error && (
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
      )}

      {/* 推荐结果 */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">
              为您推荐以下配方
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>共 {recommendations.length} 个配方</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((recipe, index) => (
              <StreamingRecipeCard
                key={recipe.id || index}
                recipe={recipe}
                isStreaming={isStreaming}
                animationDelay={index * 200}
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!isStreaming && recommendations.length === 0 && !error && ingredients.length === 0 && (
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
    </div>
  );
}
