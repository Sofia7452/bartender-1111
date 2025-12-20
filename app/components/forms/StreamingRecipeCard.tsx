'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface Recipe {
  id?: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
}

interface StreamingRecipeCardProps {
  recipe: Recipe;
  isStreaming?: boolean;
  animationDelay?: number;
}

export function StreamingRecipeCard({ 
  recipe, 
  isStreaming = false,
  animationDelay = 0 
}: StreamingRecipeCardProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);

    return () => clearTimeout(timer);
  }, [animationDelay]);

  const difficultyLabels = ['', '简单', '容易', '中等', '困难', '专家'];
  const difficultyColors = ['', 'success', 'info', 'warning', 'error', 'error'] as const;

  return (
    <div
      className={`transform transition-all duration-500 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <Card className={`h-full hover:shadow-lg transition-shadow ${isStreaming ? 'animate-pulse' : ''}`}>
        <div className="p-6 space-y-4">
          {/* 标题和难度 */}
          <div className="flex items-start justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex-1">
              {recipe.name || '加载中...'}
            </h3>
            {recipe.difficulty > 0 && (
              <Badge variant={difficultyColors[recipe.difficulty] || 'default'} size="sm">
                {difficultyLabels[recipe.difficulty]}
              </Badge>
            )}
          </div>

          {/* 描述 */}
          {recipe.description && (
            <p className="text-gray-600 text-sm leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* 预计时间 */}
          {recipe.estimatedTime > 0 && (
            <div className="flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              约 {recipe.estimatedTime} 分钟
            </div>
          )}

          {/* 原料列表 */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">原料：</h4>
              <ul className="space-y-1">
                {recipe.ingredients.map((ingredient, index) => (
                  <li 
                    key={index} 
                    className="text-sm text-gray-600 flex items-start"
                    style={{ 
                      animation: isStreaming ? `fadeIn 0.3s ease-in ${index * 0.1}s both` : 'none' 
                    }}
                  >
                    <span className="text-blue-500 mr-2">•</span>
                    {ingredient}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 制作步骤 */}
          {recipe.steps && recipe.steps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">步骤：</h4>
              <ol className="space-y-2">
                {recipe.steps.map((step, index) => (
                  <li 
                    key={index} 
                    className="text-sm text-gray-600 flex items-start"
                    style={{ 
                      animation: isStreaming ? `fadeIn 0.3s ease-in ${(recipe.ingredients?.length || 0) * 0.1 + index * 0.1}s both` : 'none' 
                    }}
                  >
                    <span className="font-semibold text-blue-600 mr-2 min-w-[1.5rem]">
                      {index + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Card>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
