import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { LLMService } from '../../services/llmService';
import { queryVectorStore, getRagStatus } from '../../services/ragService';
import { MCPService } from '../../services/mcpService';
import { env } from '../../lib/env';

// 初始化服务
const llmService = new LLMService();
const mcpService = new MCPService({
  serverUrl: env.MCP_SERVER_URL || 'http://localhost:1122/mcp'
});

export async function POST(request: NextRequest) {
  try {
    const { ingredients, includeRAG = true, includeFlowchart = false } = await request.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的原料列表' },
        { status: 400 }
      );
    }

    console.log(`🍹 开始推荐鸡尾酒，原料: ${ingredients.join('、')}`);

    // 1. 生成LLM推荐
    const llmRecommendations = await llmService.generateRecommendations(ingredients);

    let enhancedRecommendations = llmRecommendations;
    let ragContext = null;

    // 2. 如果启用RAG，增强推荐
    if (includeRAG) {
      try {
        // 使用新的RAG服务进行检索
        const query = `鸡尾酒配方 原料: ${ingredients.join('、')}`;
        const ragResult = await queryVectorStore(query, 3);

        if (ragResult.success && ragResult.results && ragResult.results.length > 0) {
          // 构建RAG上下文
          ragContext = ragResult.results.map((result: any) => {
            const [doc, score] = result;
            return `- ${doc.pageContent} (来源: ${doc.metadata?.source || '未知'}, 相似度: ${score.toFixed(3)})`;
          }).join('\n');

          // 构建增强的提示词
          const enhancedPrompt = `你是一个专业的调酒师。请根据用户提供的原料和以下知识库信息，为用户推荐合适的鸡尾酒配方。

[知识库信息]
${ragContext}
[知识库信息结束]

用户原料: ${ingredients.join('、')}

请为每个推荐提供以下信息（JSON格式）：
{
  "name": "鸡尾酒名称",
  "description": "简短描述",
  "ingredients": ["原料1 用量", "原料2 用量", ...],
  "steps": ["步骤1", "步骤2", ...],
  "difficulty": 1-5,
  "estimatedTime": 分钟数,
  "category": "分类",
  "glassType": "杯型",
  "technique": "调制技巧",
  "garnish": "装饰"
}

请确保：
1. 配方中的原料尽量使用用户提供的原料
2. 难度等级：1=简单，2=容易，3=中等，4=困难，5=专家
3. 制作步骤要详细清晰
4. 返回有效的JSON数组格式`;

          // 使用增强的提示词重新生成推荐
          const enhancedResponse = await llmService.generateRecommendations(ingredients, enhancedPrompt);
          enhancedRecommendations = enhancedResponse;
        } else {
          console.warn('RAG检索未找到相关内容，使用纯LLM推荐');
          enhancedRecommendations = llmRecommendations;
        }
      } catch (error) {
        console.warn('RAG增强失败，使用纯LLM推荐:', error);
        enhancedRecommendations = llmRecommendations;
      }
    }

    // 3. 如果启用流程图，生成流程图
    let flowchartData = null;

    if (includeFlowchart && enhancedRecommendations.length > 0) {
      try {
        const firstRecipe = enhancedRecommendations[0];
        console.log('firstRecipe', firstRecipe);

        const flowchart = await mcpService.generateFlowchart({
          title: firstRecipe.name,
          ingredients: firstRecipe.ingredients || [],
          tools: ['摇酒器', '量杯', '过滤器', '冰块'],
          steps: firstRecipe.steps || [],
          outputFormat: 'png'
        });

        if (flowchart) {
          flowchartData = flowchart;
        }
      } catch (error) {
        console.warn('流程图生成失败:', error);
      }
    }

    // 4. 为每个推荐Recipe添加id（如果不存在）
    const recommendationsWithId = enhancedRecommendations.map((recipe: any) => {
      // 如果Recipe已经有id，保持不变；否则生成一个临时id
      if (!recipe.id) {
        recipe.id = randomUUID();
      }
      return recipe;
    });

    // 5. 返回结果
    const response = {
      success: true,
      data: {
        recommendations: recommendationsWithId,
        ragContext,
        flowchart: flowchartData,
        metadata: {
          ingredients,
          timestamp: new Date().toISOString(),
          llmModel: llmService.getConfig().model,
          ragEnabled: includeRAG,
          flowchartEnabled: includeFlowchart
        }
      }
    };
    console.log('推荐 response-flowchartData', flowchartData);

    console.log(`✅ 推荐完成，生成了 ${recommendationsWithId.length} 个配方`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('推荐API错误:', error);
    return NextResponse.json(
      {
        error: '推荐服务暂时不可用，请稍后重试',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}

// 健康检查
export async function GET() {
  try {
    const llmStatus = await llmService.testConnection();
    const ragStatus = await getRagStatus();
    const mcpStatus = mcpService.getStatus();

    return NextResponse.json({
      status: 'healthy',
      services: {
        llm: { connected: llmStatus },
        rag: ragStatus,
        mcp: mcpStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: (error as Error).message },
      { status: 500 }
    );
  }
}
