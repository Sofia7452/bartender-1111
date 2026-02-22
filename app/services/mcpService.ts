// MCP服务实现 - 使用官方 @modelcontextprotocol/sdk
// 支持流程图生成 (generate_flow_diagram)
// 参考: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/examples/client/simpleStreamableHttp.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolRequest, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
export interface MCPConfig {
  serverUrl: string;  // 必需：完整URL，如 http://localhost:1122/mcp
  timeout?: number;   // 可选：超时时间（默认30秒）
  sessionId?: string; // 可选：会话ID（用于会话恢复）
}

export interface FlowDiagramData {
  title: string;
  nodes: Array<{
    id: string;
    label: string;
    type?: 'start' | 'process' | 'decision' | 'end';
  }>;
  edges: Array<{
    source: string;
    target: string;
    label?: string;
  }>;
  layout?: 'hierarchical' | 'force' | 'circular';
}

export interface FlowchartData {
  title: string;
  ingredients: string[];
  tools: string[];
  steps: string[];
  outputFormat: 'png' | 'svg' | 'pdf';
}

export class MCPService {
  private config: MCPConfig;
  private isConnected = false;
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private sessionId: string | undefined;

  constructor(config: MCPConfig) {
    if (!config.serverUrl) {
      throw new Error('serverUrl 是必需的');
    }

    this.config = {
      serverUrl: config.serverUrl,
      timeout: config.timeout || 30000,
      sessionId: config.sessionId,
    };

    this.sessionId = config.sessionId;

    console.log(`[MCP] 初始化 StreamableHTTP 客户端`);
    console.log(`[MCP] 服务器URL: ${this.config.serverUrl}`);
    if (this.sessionId) {
      console.log(`[MCP] 使用会话ID: ${this.sessionId}`);
    }
  }

  // 连接MCP服务器 - 使用 StreamableHTTP
  // 参考: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/examples/client/simpleStreamableHttp.ts
  async connect(): Promise<boolean> {
    if (this.client && this.transport && this.isConnected) {
      console.log('[MCP] 已经连接，跳过重复连接');
      return true;
    }

    try {
      console.log(`[MCP] 连接到服务器: ${this.config.serverUrl}`);

      // 创建 MCP Client
      this.client = new Client({
        name: 'bartender-mcp-client',
        version: '1.0.0',
      });

      // 设置错误处理器
      this.client.onerror = (error) => {
        console.error('[MCP] 客户端错误:', error);
        this.isConnected = false;
      };

      // 创建 StreamableHTTP Transport，支持 sessionId（会话恢复）
      this.transport = new StreamableHTTPClientTransport(
        new URL(this.config.serverUrl),
        {
          sessionId: this.sessionId
        }
      );
      console.log('📡 使用 StreamableHTTP Transport 连接');
      if (this.sessionId) {
        console.log(`📡 使用会话ID: ${this.sessionId}`);
      }

      // 连接到服务器
      // client.connect() 会内部调用 transport.start()
      await this.client.connect(this.transport);

      // 注意：sessionId 是由服务器在响应头 Mcp-Session-Id 中返回的
      // 如果服务器不支持 sessionId，这里会是 undefined，这是正常的
      // 某些服务器可能在第一次请求后才返回 sessionId
      this.sessionId = this.transport.sessionId;

      if (this.sessionId) {
        console.log(`📡 会话ID: ${this.sessionId}`);
      } else {
        console.log('⚠️  服务器未返回会话ID（可能不支持或将在首次请求时返回）');
      }

      this.isConnected = true;
      console.log('✅ MCP服务器连接成功');
      return true;
    } catch (error) {
      console.error('❌ MCP服务器连接失败:', error);
      this.isConnected = false;
      this.client = null;
      this.transport = null;
      return false;
    }
  }

  // 验证流程图数据格式
  private validateFlowDiagramData(data: FlowDiagramData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证基本字段
    if (!data.title || data.title.trim() === '') {
      errors.push('title 不能为空');
    }

    // 验证节点
    if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      errors.push('nodes 必须是非空数组');
    } else {
      data.nodes.forEach((node, index) => {
        if (!node.id || node.id.trim() === '') {
          errors.push(`nodes[${index}].id 不能为空`);
        }
        if (!node.label || node.label.trim() === '') {
          errors.push(`nodes[${index}].label 不能为空`);
        }
      });
    }

    // 验证边
    if (!data.edges || !Array.isArray(data.edges)) {
      errors.push('edges 必须是数组');
    } else {
      data.edges.forEach((edge, index) => {
        if (!edge.source || edge.source.trim() === '') {
          errors.push(`edges[${index}].source 不能为空`);
        }
        if (!edge.target || edge.target.trim() === '') {
          errors.push(`edges[${index}].target 不能为空`);
        }
      });
    }

    // 验证节点 ID 唯一性
    const nodeIds = data.nodes?.map(n => n.id) || [];
    const uniqueIds = new Set(nodeIds);
    if (nodeIds.length !== uniqueIds.size) {
      errors.push('节点 ID 必须唯一');
    }

    // 验证边的引用
    if (data.edges && data.nodes) {
      const nodeIdSet = new Set(data.nodes.map(n => n.id));
      data.edges.forEach((edge, index) => {
        if (!nodeIdSet.has(edge.source)) {
          errors.push(`edges[${index}].source "${edge.source}" 不存在于 nodes 中`);
        }
        if (!nodeIdSet.has(edge.target)) {
          errors.push(`edges[${index}].target "${edge.target}" 不存在于 nodes 中`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  // 使用 mcp-server-chart 生成流程图 - 使用官方 SDK
  async generateFlowDiagram(data: FlowDiagramData): Promise<string | null> {
    try {

      // 2. 检查连接
      if (!this.isConnected || !this.client) {
        console.log('📡 尝试连接到 MCP 服务器...');
        const connected = await this.connect();
        if (!connected || !this.client) {
          console.warn('⚠️  MCP服务器连接失败，使用模拟数据');
          return this.generateMockFlowDiagram(data);
        }
      }

      // 3. 根据传入的 data 动态构建流程图参数
      console.log('📝 构建 MCP 请求参数...');

      // 优化宽高计算，基于图表的逻辑深度
      // 深度 = 开始(1) + 准备(1) + 原料层(1) + 步骤层(N) + 结束(1)
      const ingredientNodes = data.nodes.filter(n => n.id.startsWith('ing-'));
      const stepNodes = data.nodes.filter(n => n.id.startsWith('step-'));
      const logicalDepth = 1 + 1 + 1 + stepNodes.length + 1;
      
      // 高度：按层级计算，每层约 60px，设置 300-800px 范围
      const dynamicHeight = Math.min(Math.max(300, logicalDepth * 60 + 50), 800);
      
      // 宽度：由原料的数量决定，防止过宽或过窄，设置 450-850px 范围
      const dynamicWidth = Math.min(Math.max(450, ingredientNodes.length * 120 + 150), 850);

      // 构建 id → label 映射表，MCP 用 name 同时作为标识和显示文本
      const idToLabel = new Map(data.nodes.map(n => [n.id, n.label || n.id]));

      const toolArguments = {
        "data": {
          "nodes": data.nodes.map(node => ({
            "name": node.label || node.id
          })),
          "edges": data.edges.map(edge => ({
            "source": idToLabel.get(edge.source) || edge.source,
            "target": idToLabel.get(edge.target) || edge.target,
            "name": edge.label || ''
          }))
        },
        "style": {
          "rankdir": "TB", // 从上到下排列
          "nodesep": 20,   // 节点间距
          "ranksep": 30    // 层级间距
        },
        "theme": "default",
        "width": dynamicWidth,
        "height": dynamicHeight
      };

      const request: CallToolRequest = {
        method: 'tools/call',
        params: {
          name: 'generate_flow_diagram',
          arguments: toolArguments as any
        }
      };

      // console.log('📤 发送请求:', JSON.stringify(request, null, 2));

      const result = await this.client.request(request, CallToolResultSchema);

      // 在第一次请求后再次检查 sessionId
      // 某些服务器可能在第一次请求时才返回 sessionId
      if (!this.sessionId && this.transport?.sessionId) {
        this.sessionId = this.transport.sessionId;
        console.log(`📡 首次请求后获取到会话ID: ${this.sessionId}`);
      }

      console.log('✅ 流程图生成成功');

      // 解析结果
      console.log('📥 收到结果:', result);

      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const content = result.content[0] as any;

        // 尝试解析文本内容
        if (content && content.type === 'text' && 'text' in content) {
          try {
            // const resultData = JSON.parse(content.text);
            console.log('📦 解析的结果数据:', content.text);
            return content.text

            // if (resultData.success && resultData.resultObj) {
            //   return resultData.resultObj;
            // }
          } catch (parseError) {
            console.error('解析结果 JSON 失败:', parseError);
          }
        }

        // 如果结果是图片URL
        if (content && content.type === 'image' && 'data' in content) {
          console.log('📸 收到图片数据');
          return content.data;
        }
      }

      console.warn('⚠️  无法解析结果，返回空值');
      return null;
    } catch (error: any) {
      console.error('❌ 流程图生成失败:', error);
      console.error('错误详情:', error.message);
      console.error('错误代码:', error.code);

      // 如果是 400 错误，说明数据格式问题，直接使用模拟数据
      if (error.code === -32603 || error.message?.includes('400')) {
        console.warn('⚠️  mcp-server-chart 返回 400 错误，使用模拟数据');
        return this.generateMockFlowDiagram(data);
      }

      // 其他错误也尝试使用模拟数据
      console.warn('⚠️  使用模拟数据作为降级方案');
      return this.generateMockFlowDiagram(data);
    }
  }

  // 生成鸡尾酒制作流程图（兼容旧接口）
  async generateFlowchart(data: FlowchartData): Promise<string | null> {
    try {
      console.log('🎨 开始生成流程图...');

      // 构建完整的鸡尾酒制作流程：准备原料 → 各步骤 → 完成
      const nodes: FlowDiagramData['nodes'] = [];
      const edges: FlowDiagramData['edges'] = [];

      // 起始节点
      nodes.push({ id: 'start', label: data.title, type: 'start' });

      // 原料准备节点
      nodes.push({ id: 'prepare', label: '准备原料', type: 'process' });
      edges.push({ source: 'start', target: 'prepare', label: '开始制作' });

      // 为每个原料创建节点，并连接到准备节点
      data.ingredients.forEach((ing, index) => {
        const nodeId = `ing-${index}`;
        nodes.push({ id: nodeId, label: ing, type: 'process' });
        edges.push({ source: 'prepare', target: nodeId });
      });

      // 步骤链：原料 → 第一步 → 第二步 → ... → 完成
      const firstStepId = 'step-0';
      // 所有原料节点都汇聚到第一个步骤
      if (data.ingredients.length > 0) {
        data.ingredients.forEach((_, index) => {
          edges.push({ source: `ing-${index}`, target: firstStepId, label: index === 0 ? '开始调制' : '' });
        });
      } else {
        edges.push({ source: 'prepare', target: firstStepId, label: '开始调制' });
      }

      // 步骤节点串联
      data.steps.forEach((step, index) => {
        const nodeId = `step-${index}`;
        nodes.push({ id: nodeId, label: `${index + 1}. ${step}`, type: 'process' });

        if (index > 0) {
          edges.push({ source: `step-${index - 1}`, target: nodeId });
        }
      });

      // 结束节点
      nodes.push({ id: 'end', label: '制作完成', type: 'end' });
      if (data.steps.length > 0) {
        edges.push({ source: `step-${data.steps.length - 1}`, target: 'end', label: '出杯' });
      }

      const flowDiagramData: FlowDiagramData = {
        title: data.title,
        nodes,
        edges,
        layout: 'hierarchical'
      };

      return await this.generateFlowDiagram(flowDiagramData);
    } catch (error) {
      console.error('❌ 流程图生成失败:', error);
      return null;
    }
  }


  // 生成模拟流程图（当 mcp-server-chart 不可用时）
  private generateMockFlowDiagram(data: FlowDiagramData): string {
    // 生成一个简单的流程图 URL（模拟）
    const mockImageUrl = `data:image/svg+xml;base64,${Buffer.from(this.createFlowDiagramSVG(data)).toString('base64')}`;

    console.warn('⚠️  使用模拟数据生成流程图');
    return mockImageUrl;
  }

  // 生成模拟流程图（当MCP服务器不可用时）
  private generateMockFlowchart(data: FlowchartData): any {
    // 这里可以生成一个简单的SVG流程图
    const svg = this.createSimpleSVG(data);
    const base64 = Buffer.from(svg).toString('base64');

    return {
      success: true,
      data: base64,
      format: 'svg',
      mock: true
    };
  }

  // 创建流程图 SVG
  private createFlowDiagramSVG(data: FlowDiagramData): string {
    const width = 800;
    const nodeHeight = 40;
    const nodeWidth = 160;
    const verticalGap = 70;
    const margin = 50;
    // 纵向布局：每个节点一行，从上到下排列
    const height = Math.max(400, margin + 80 + data.nodes.length * verticalGap + margin);

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // 箭头标记定义必须在最前面
    svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#666"/></marker></defs>`;

    // 背景
    svg += `<rect width="${width}" height="${height}" fill="#f8f9fa"/>`;

    // 标题
    svg += `<text x="${width / 2}" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#333">${data.title}</text>`;

    // 纵向布局：按节点顺序从上到下排列
    const nodePositions: Record<string, { x: number; y: number }> = {};
    data.nodes.forEach((node, index) => {
      nodePositions[node.id] = {
        x: width / 2,
        y: margin + 80 + index * verticalGap
      };
    });

    // 先绘制边（线在节点下面）
    data.edges.forEach(edge => {
      const sourcePos = nodePositions[edge.source];
      const targetPos = nodePositions[edge.target];
      if (!sourcePos || !targetPos) return;

      // 计算线的起止点（从节点边缘出发，而非中心，避免被节点遮挡）
      const sy = sourcePos.y + nodeHeight / 2;
      const ty = targetPos.y - nodeHeight / 2;

      svg += `<line x1="${sourcePos.x}" y1="${sy}" x2="${targetPos.x}" y2="${ty}" stroke="#999" stroke-width="2" marker-end="url(#arrowhead)"/>`;
      if (edge.label) {
        const midX = (sourcePos.x + targetPos.x) / 2 + 10;
        const midY = (sy + ty) / 2;
        svg += `<text x="${midX}" y="${midY + 4}" text-anchor="start" font-family="Arial, sans-serif" font-size="11" fill="#888">${edge.label}</text>`;
      }
    });

    // 再绘制节点（节点在线上面）
    data.nodes.forEach(node => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      const x = pos.x - nodeWidth / 2;
      const y = pos.y - nodeHeight / 2;

      let fillColor = '#e3f2fd';
      let strokeColor = '#2196f3';
      if (node.type === 'start') {
        fillColor = '#e8f5e9';
        strokeColor = '#4caf50';
      } else if (node.type === 'end') {
        fillColor = '#fce4ec';
        strokeColor = '#e91e63';
      } else if (node.type === 'decision') {
        fillColor = '#fff3e0';
        strokeColor = '#ff9800';
      }

      svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" rx="8"/>`;
      svg += `<text x="${pos.x}" y="${pos.y + 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#333">${node.label}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  // 创建简单的SVG流程图
  private createSimpleSVG(data: FlowchartData): string {
    const width = 800;
    const height = 600;
    const margin = 50;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // 背景
    svg += `<rect width="${width}" height="${height}" fill="#f8f9fa"/>`;

    // 标题
    svg += `<text x="${width / 2}" y="40" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333">${data.title}</text>`;

    // 原料区域
    let y = 100;
    svg += `<text x="${margin}" y="${y}" font-family="Arial" font-size="16" font-weight="bold" fill="#666">原料:</text>`;
    y += 30;
    data.ingredients.forEach((ingredient, index) => {
      svg += `<rect x="${margin}" y="${y}" width="120" height="30" fill="#e3f2fd" stroke="#2196f3" stroke-width="2" rx="5"/>`;
      svg += `<text x="${margin + 60}" y="${y + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="#333">${ingredient}</text>`;
      if ((index + 1) % 4 === 0) {
        y += 40;
      } else {
        svg += `<text x="${margin + 130}" y="${y + 20}" font-family="Arial" font-size="16" fill="#666">→</text>`;
      }
    });

    // 工具区域
    y += 60;
    svg += `<text x="${margin}" y="${y}" font-family="Arial" font-size="16" font-weight="bold" fill="#666">工具:</text>`;
    y += 30;
    data.tools.forEach((tool, index) => {
      svg += `<rect x="${margin + index * 140}" y="${y}" width="120" height="30" fill="#f3e5f5" stroke="#9c27b0" stroke-width="2" rx="5"/>`;
      svg += `<text x="${margin + index * 140 + 60}" y="${y + 20}" text-anchor="middle" font-family="Arial" font-size="12" fill="#333">${tool}</text>`;
    });

    // 步骤区域
    y += 80;
    svg += `<text x="${margin}" y="${y}" font-family="Arial" font-size="16" font-weight="bold" fill="#666">制作步骤:</text>`;
    y += 30;
    data.steps.forEach((step, index) => {
      svg += `<rect x="${margin}" y="${y}" width="${width - 2 * margin}" height="40" fill="#e8f5e8" stroke="#4caf50" stroke-width="2" rx="5"/>`;
      svg += `<text x="${margin + 20}" y="${y + 25}" font-family="Arial" font-size="14" fill="#333">${index + 1}. ${step}</text>`;
      y += 50;
    });

    svg += `</svg>`;
    return svg;
  }

  // 断开连接
  async disconnect(): Promise<void> {
    if (!this.client || !this.transport) {
      console.log('[MCP] 未连接，无需断开');
      return;
    }

    try {
      console.log('[MCP] 断开连接...');

      // 如果支持会话终止，可以尝试终止会话
      if (this.transport.sessionId) {
        try {
          console.log(`[MCP] 终止会话: ${this.transport.sessionId}`);
          await this.transport.terminateSession();
          console.log('[MCP] 会话已终止');
        } catch (error) {
          console.warn('[MCP] 无法终止会话（可能不支持）:', error);
        }
      }

      // 关闭传输
      await this.transport.close();
      console.log('[MCP] 已断开连接');

      this.isConnected = false;
      this.client = null;
      this.transport = null;
      this.sessionId = undefined;
    } catch (error) {
      console.error('[MCP] 断开连接时出错:', error);
    }
  }

  // 获取会话ID（用于会话恢复）
  getSessionId(): string | undefined {
    return this.sessionId || this.transport?.sessionId;
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      return await this.connect();
    } catch (error) {
      console.error('MCP连接测试失败:', error);
      return false;
    }
  }

  // 获取服务状态
  getStatus(): any {
    return {
      connected: this.isConnected,
      serverUrl: this.config.serverUrl,
      timeout: this.config.timeout,
      sessionId: this.getSessionId(),
      transport: 'streamable'
    };
  }
}
