'use client';

import { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { IngredientInput } from './components/forms/IngredientInput';
import { Button } from './components/ui/Button';
import { RecipeCard } from './components/forms/RecipeCard';
import { DishPairingCard } from './components/forms/DishPairingCard';
import { Spinner } from './components/ui/Spinner';
import { Input } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { RecommendationModeToggle } from './components/forms/RecommendationModeToggle';
import { StreamingRecommendationView } from './components/forms/StreamingRecommendationView';
import type { CompletePairingRecommendation } from './types/foodPairing';

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
  const [ragEnabled, setRagEnabled] = useState(false);
  const [flowchartEnabled, setFlowchartEnabled] = useState(false);
  const [flowchartData, setFlowchartData] = useState<string | null>(null);

  // 推荐模式：标准或流式
  const [recommendationMode, setRecommendationMode] = useState<'standard' | 'streaming'>('streaming');

  // for cocktail pairing (legacy API - 保留用于向后兼容)
  const [pairingEnabled, setPairingEnabled] = useState(false);
  const [pairingIngredients, setPairingIngredients] = useState<string[]>([]);
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // for LangGraph food pairing (新的多 Agent 系统)
  const [cuisine, setCuisine] = useState<string>(''); // 菜系选择
  const [foodIngredients, setFoodIngredients] = useState<string[]>([]); // 食品原料列表
  const [drinkIngredients, setDrinkIngredients] = useState<string[]>([]); // 酒原料列表
  const [pairingResult, setPairingResult] = useState<CompletePairingRecommendation | null>(null); // 搭配结果
  const [isFoodPairingLoading, setIsFoodPairingLoading] = useState(false); // 加载状态
  const [foodPairingError, setFoodPairingError] = useState<string | null>(null); // 错误信息
  const [useReAct, setUseReAct] = useState<boolean>(true); // ReAct 模式开关，默认启用

  const handleGetRecommendations = async () => {
    // 如果启用了搭配模式，使用新的 LangGraph API
    if (pairingEnabled) {
      // 验证输入：至少需要食品原料
      if (foodIngredients.length === 0) {
        setFoodPairingError('请至少输入一个食品原料');
        return;
      }

      setIsFoodPairingLoading(true);
      setFoodPairingError(null);
      setPairingResult(null);

      try {
        const response = await fetch('/api/food-pairing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cuisine: cuisine || null,
            foodIngredients,
            drinkIngredients: drinkIngredients.length > 0 ? drinkIngredients : undefined,
            useReAct: useReAct, // 传递 ReAct 模式参数
          }),
        });

        const data = await response.json();
        console.log('🍽️ LangGraph 推荐接口响应:', data);

        if (data.success && data.data) {
          setPairingResult(data.data);
          console.log('✅ 推荐结果:', {
            dishes: data.data.dishes.length,
            beverages: data.data.beverages.length,
            pairingReasons: data.data.pairingReasons.length,
          });
        } else {
          setFoodPairingError(data.error || '推荐失败，请稍后重试');
        }
      } catch (err) {
        console.error('❌ 推荐请求失败:', err);
        setFoodPairingError('网络错误，请检查连接');
      } finally {
        setIsFoodPairingLoading(false);
      }
    } else {
      // 使用旧的鸡尾酒推荐 API（向后兼容）
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
    }
  };

  const handleGetPairing = async () => {
    if (!cuisine && pairingIngredients.length === 0) return;

    setIsPairingLoading(true);
    setPairingError(null);

    try {
      const response = await fetch('/api/cocktail-pairing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cuisine,
          ingredients: pairingIngredients,
        }),
      });

      const data: RecommendationResponse = await response.json();

      if (data.success) {
        setRecommendations(data.data.recommendations);
      } else {
        setPairingError('配餐推荐失败，请稍后重试');
      }
    } catch (err) {
      console.error('配餐推荐请求失败:', err);
      setPairingError('网络错误，请检查连接');
    } finally {
      setIsPairingLoading(false);
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
              <div className="space-y-4">
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
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={pairingEnabled}
                      onChange={(e) => setPairingEnabled(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">搭配菜提供调酒</span>
                  </label>
                  <Button
                    onClick={handleInitializeRAG}
                    variant="outline"
                    size="sm"
                  >
                    初始化RAG
                  </Button>
                </div>
                {pairingEnabled && (
                  <div className="pt-2 border-t border-gray-200">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={useReAct}
                        onChange={(e) => setUseReAct(e.target.checked)}
                        className="mr-2"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">启用 ReAct 模式</span>
                        <span className="text-xs text-gray-500 mt-1">
                          {useReAct
                            ? '使用智能 Agent 模式，通过思考-行动-观察循环完成任务（推荐）'
                            : '使用传统两阶段模式，先推荐菜品再推荐酒品'}
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {pairingEnabled ? (
          <>
            {/* 菜品输入区域 */}
            <div className="max-w-2xl mx-auto mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>输入菜系和食品原料</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        菜系类型（可选）
                      </label>
                      <Input
                        value={cuisine}
                        onChange={(e) => setCuisine(e.target.value)}
                        placeholder="输入菜系，如：川菜、日料、西餐..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        食品原料 <span className="text-red-500">*</span>
                      </label>
                      <IngredientInput
                        value={foodIngredients}
                        onChange={setFoodIngredients}
                        placeholder="输入菜品原料，如：牛肉、海鲜、土豆..."
                        maxIngredients={8}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 酒原料输入区域 */}
            <div className="max-w-2xl mx-auto mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>输入酒原料（可选）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        酒原料列表（可选，不填写将根据菜品自动推荐）
                      </label>
                      <IngredientInput
                        value={drinkIngredients}
                        onChange={setDrinkIngredients}
                        placeholder="输入酒原料，如：威士忌、柠檬、糖浆..."
                        maxIngredients={8}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            {/* 推荐模式切换（仅在纯 LLM 模式下显示） */}
            {!ragEnabled && !flowchartEnabled && (
              <div className="max-w-2xl mx-auto mb-6">
                <RecommendationModeToggle
                  mode={recommendationMode}
                  onChange={(mode) => {
                    setRecommendationMode(mode);
                    // 切换模式时清空结果和错误
                    setRecommendations([]);
                    setError(null);
                  }}
                  disabled={isLoading}
                />
              </div>
            )}

            {/* 根据模式显示不同的推荐界面 */}
            {recommendationMode === 'streaming' && !ragEnabled && !flowchartEnabled ? (
              /* 流式推荐界面 */
              <StreamingRecommendationView
                onComplete={(recs) => {
                  // 转换类型以匹配主页面的 Recipe 接口
                  const convertedRecs = recs.map((rec) => ({
                    ...rec,
                    id: rec.id || crypto.randomUUID(),
                    category: '',
                    glassType: '',
                    technique: '',
                    garnish: undefined,
                  }));
                  setRecommendations(convertedRecs);
                }}
              />
            ) : (
              /* 标准推荐界面 */
              <>
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
                    {isLoading ? '正在推荐...' : '获取推荐'}
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

                {/* 传统鸡尾酒推荐结果 */}
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
                {ingredients.length === 0 && recommendations.length === 0 && (
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
              </>
            )}
          </>
        )}

        {/* 搭配模式的推荐按钮 */}
        {pairingEnabled && (
          <div className="text-center mb-8">
            <Button
              onClick={handleGetRecommendations}
              disabled={foodIngredients.length === 0 || isFoodPairingLoading}
              loading={isFoodPairingLoading}
              size="lg"
              className="px-8 py-3"
            >
              {isFoodPairingLoading ? '正在推荐...' : '获取搭配推荐'}
            </Button>
          </div>
        )}

        {/* 搭配模式的错误提示 */}
        {(pairingError || foodPairingError) && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">
                {pairingError || foodPairingError}
              </p>
            </div>
          </div>
        )}

        {/* LangGraph 搭配推荐结果 */}
        {pairingEnabled && pairingResult && (
          <div className="space-y-8">
            {/* 模式提示 */}
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-2">
                <Badge variant={useReAct ? 'info' : 'default'} size="sm">
                  {useReAct ? '🤖 ReAct 模式' : '📋 传统模式'}
                </Badge>
                <span className="text-sm text-gray-500">
                  {useReAct
                    ? '使用智能 Agent 通过多轮思考完成任务'
                    : '使用传统两阶段推荐流程'}
                </span>
              </div>
            </div>

            {/* 整体搭配建议 */}
            {pairingResult.overallSuggestion && (
              <div className="max-w-4xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>整体搭配建议</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">
                      {pairingResult.overallSuggestion}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 菜品与酒品搭配卡片（一对多模式） */}
            {pairingResult.dishes.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 text-center">
                  🍽️ 为您推荐的菜品搭配
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
                  {pairingResult.dishes.map((dish) => {
                    // 获取该菜品对应的酒品（根据 pairingReasons）
                    let relatedBeverages = pairingResult.beverages.filter((beverage) =>
                      pairingResult.pairingReasons.some(
                        (reason) => reason.dishId === dish.id && reason.beverageId === beverage.id
                      )
                    );

                    // 如果没有找到关联的酒品，但有可用的酒品，则显示所有酒品
                    // 这可能是 pairingReasons 数据不完整的情况
                    if (relatedBeverages.length === 0 && pairingResult.beverages.length > 0) {
                      console.warn(`⚠️ 菜品 ${dish.id} (${dish.name}) 没有找到关联的酒品，显示所有可用酒品`);
                      relatedBeverages = pairingResult.beverages;
                    }

                    // 获取该菜品相关的搭配理由
                    const relatedReasons = pairingResult.pairingReasons.filter(
                      (reason) => reason.dishId === dish.id
                    );

                    return (
                      <DishPairingCard
                        key={dish.id}
                        dish={dish}
                        beverages={relatedBeverages}
                        pairingReasons={relatedReasons}
                        onSaved={(savedSetId) => {
                          console.log('套装已收藏:', savedSetId);
                          // 可以在这里添加成功提示，比如使用 toast
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
