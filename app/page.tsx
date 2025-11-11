'use client';

import { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { IngredientInput } from './components/forms/IngredientInput';
import { Button } from './components/ui/Button';
import { RecipeCard } from './components/forms/RecipeCard';
import { Spinner } from './components/ui/Spinner';

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
  category: string;
  glassType: string;
  technique: string;
  garnish?: string;
}

interface RecommendationResponse {
  success: boolean;
  data: {
    recommendations: Recipe[];
    ragContext?: string;
    flowchart?: string;
    metadata: {
      ingredients: string[];
      timestamp: string;
      llmModel: string;
      ragEnabled: boolean;
      flowchartEnabled: boolean;
    };
  };
}

export default function Home() {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [flowchartEnabled, setFlowchartEnabled] = useState(false);
  const [flowchartData, setFlowchartData] = useState<string | null>(null);

  const handleGetRecommendations = async () => {
    if (ingredients.length === 0) return;

    setIsLoading(true);
    setError(null);
    setFlowchartData(null);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients,
          includeRAG: ragEnabled,
          includeFlowchart: flowchartEnabled,
        }),
      });

      const data: RecommendationResponse = await response.json();
      console.log('page-推荐接口data', data);
      console.log('data.data.flowchart', data.data.flowchart);

      if (data.success) {
        setRecommendations(data.data.recommendations);
        if (data.data.flowchart) {
          setFlowchartData(data.data.flowchart);
        }
        console.log('推荐结果:', data.data);
      } else {
        setError('推荐失败，请稍后重试');
      }
    } catch (err) {
      console.error('推荐请求失败:', err);
      setError('网络错误，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeRAG = async () => {
    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'initialize' }),
      });

      const data = await response.json();
      if (data.success) {
        alert('RAG系统初始化完成！');
      } else {
        alert('RAG系统初始化失败');
      }
    } catch (err) {
      console.error('RAG初始化失败:', err);
      alert('RAG系统初始化失败');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🍹 智能调酒师
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            根据您现有的原料，为您推荐最适合的鸡尾酒配方
          </p>
        </div>

        {/* 系统控制面板 */}
        <div className="max-w-2xl mx-auto mb-8">
          <Card>
            <CardHeader>
              <CardTitle>系统设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={ragEnabled}
                    onChange={(e) => setRagEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">启用RAG增强</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={flowchartEnabled}
                    onChange={(e) => setFlowchartEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">生成流程图</span>
                </label>
                <Button
                  onClick={handleInitializeRAG}
                  variant="outline"
                  size="sm"
                >
                  初始化RAG
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 原料输入区域 */}
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
            onClick={handleGetRecommendations}
            disabled={ingredients.length === 0 || isLoading}
            loading={isLoading}
            size="lg"
            className="px-8 py-3"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="mr-2" />
                正在推荐...
              </>
            ) : (
              '获取推荐'
            )}
          </Button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* 流程图显示 */}
        {flowchartData && (
          <div className="max-w-4xl mx-auto mb-8">
            <Card>
              <CardHeader>
                <CardTitle>制作流程图</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <img
                    src={flowchartData}
                    alt="鸡尾酒制作流程图"
                    className="max-w-full h-auto mx-auto border rounded-lg shadow-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 推荐结果 */}
        {recommendations.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              为您推荐以下配方
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onFavorite={(id) => console.log('收藏配方:', id)}
                  onViewDetails={(id) => console.log('查看详情:', id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {ingredients.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🍸</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              开始您的调酒之旅
            </h3>
            <p className="text-gray-600">
              输入您现有的原料，我们将为您推荐最适合的鸡尾酒配方
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
