# 🍹 智能调酒师 (Bartender)

一个基于 AI 的智能鸡尾酒推荐系统，能够根据用户提供的原料推荐合适的鸡尾酒配方，并支持菜品与酒品的智能搭配推荐。

## ✨ 功能特性

### 🎯 核心功能

- **智能鸡尾酒推荐**：根据用户提供的原料，智能推荐合适的鸡尾酒配方
- **菜品与酒品搭配**：基于 LangGraph 多 Agent 系统，提供菜品与酒品的智能搭配推荐
- **ReAct Agent 模式**：支持智能 Agent 通过思考-行动-观察循环完成任务
- **RAG 增强**：支持检索增强生成，提供更准确的推荐结果
- **收藏功能**：支持收藏单个配方和菜品-酒品搭配套装
- **MCP工具流程图生成**：通过MCP工具可视化展示鸡尾酒制作流程

### 🚀 技术亮点

- **多 Agent 架构**：使用 LangGraph 构建多 Agent 协作系统
- **智能决策**：ReAct 模式支持动态决策和工具调用
- **向量存储**：使用 LangChain MemoryVectorStore 内存向量库，支持语义搜索
- **MCP工具流程图生成**：通过MCP工具可视化展示鸡尾酒制作流程
- **类型安全**：完整的 TypeScript 类型定义和 Zod 验证
- **现代化 UI**：基于 Tailwind CSS 的响应式设计

## 🛠️ 技术栈

### 前端框架
- **Next.js 16** - React 全栈框架
- **React 19** - UI 库
- **TypeScript** - 类型安全
- **Tailwind CSS 4** - 样式框架

### 后端技术
- **Next.js API Routes** - 服务端 API
- **Prisma** - ORM 数据库工具
- **PostgreSQL** - 关系型数据库
- **MemoryVectorStore** - 内存向量库（LangChain）

### AI & LLM
- **LangChain** - LLM 应用框架
- **LangGraph** - 多 Agent 工作流
- **OpenAI API** - 大语言模型

### 其他工具
- **Zod** - 数据验证
- **MCP (Model Context Protocol)** - 模型上下文协议

## 📁 项目结构

```
nextjs-prisma/
├── app/                          # Next.js App Router
│   ├── api/                      # API 路由
│   │   ├── food-pairing/         # 菜品酒品搭配 API
│   │   ├── favorites/             # 收藏功能 API
│   │   ├── saved-sets/           # 套装收藏 API
│   │   ├── rag/                  # RAG 相关 API
│   │   └── recommend/            # 推荐 API
│   ├── components/               # React 组件
│   │   ├── forms/                # 表单组件
│   │   ├── layout/               # 布局组件
│   │   └── ui/                   # UI 基础组件
│   ├── services/                 # 业务逻辑层
│   │   ├── langgraph/            # LangGraph 相关服务
│   │   │   ├── foodPairingGraph.ts    # 图结构定义
│   │   │   ├── foodPairingNodes.ts    # 节点实现
│   │   │   ├── reactAgentNode.ts      # ReAct Agent 节点
│   │   │   └── reactTools.ts           # ReAct 工具集
│   │   ├── langgraphService.ts   # LangGraph 服务封装
│   │   ├── ragService.ts         # RAG 服务
│   │   └── savedSetService.ts   # 套装服务
│   ├── lib/                      # 工具库
│   │   ├── prisma.ts             # Prisma 客户端
│   │   ├── env.ts                # 环境变量
│   │   └── session.ts            # 会话管理
│   └── types/                    # TypeScript 类型定义
├── prisma/                       # Prisma 配置
│   ├── schema.prisma             # 数据库模型
│   └── migrations/               # 数据库迁移
├── public/                       # 静态资源
└── docs/                         # 文档
```

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- PostgreSQL 14+
- npm/yarn/pnpm

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/Sofia7452/bartender-1111.git
```

2. **安装依赖**

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. **配置环境变量**

创建 `.env` 文件：

```env
# 数据库配置
DATABASE_URL="postgresql://mock_user:mock_password@localhost:5432/mock_bartender?schema=public"

# OpenAI 配置
OPENAI_API_KEY="sk-mock-openai-api-key-1234567890abcdef"
OPENAI_BASE_URL="https://openai.com"
LLM_MODEL="gpt-4"
```

4. **初始化数据库**

```bash
# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# （可选）填充初始数据
npx prisma db seed
```

5. **启动开发服务器**

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

6. **访问应用**

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📖 使用指南

### 基础推荐功能

1. **输入原料**：在首页输入您现有的原料（如：威士忌、柠檬、糖浆）
2. **获取推荐**：点击"获取推荐"按钮
3. **查看配方**：浏览推荐的鸡尾酒配方，查看制作步骤和所需原料
4. **收藏配方**：点击心形图标收藏喜欢的配方

### 菜品酒品搭配功能

1. **启用搭配模式**：在系统设置中勾选"搭配菜提供调酒"
2. **选择模式**：
   - **ReAct 模式**（推荐）：使用智能 Agent 进行多轮思考和决策
   - **传统模式**：使用固定的两阶段推荐流程
3. **输入信息**：
   - 输入菜系类型（可选，如：川菜、日料、西餐）
   - 输入食品原料（必需）
   - 输入酒原料（可选）
4. **获取推荐**：系统将为您推荐合适的菜品和酒品搭配方案
5. **收藏套装**：点击"收藏套装"按钮保存整个搭配方案

### RAG 增强功能

1. **初始化 RAG**：点击"初始化RAG"按钮，系统将处理文档并建立内存向量索引
2. **启用 RAG**：在系统设置中勾选"启用RAG增强"
3. **获取推荐**：使用 RAG 增强的推荐将基于知识库提供更准确的结果

### MCP 流程图生成功能

1. **启用流程图生成**：在系统设置中勾选"生成流程图"选项
2. **获取推荐**：在获取鸡尾酒推荐时，系统会自动为第一个推荐配方生成制作流程图
3. **查看流程图**：流程图将以图片形式显示在推荐结果下方，展示完整的制作步骤和流程
4. **流程图内容**：流程图包含以下信息：
   - 配方名称
   - 所需原料
   - 制作步骤流程
   - 可视化流程节点和连接

## 🔧 配置说明

### 环境变量

| 变量名 | 说明 | 必需 | 示例值 |
|--------|------|------|--------|
| `DATABASE_URL` | PostgreSQL 数据库连接字符串 | ✅ | `postgresql://mock_user:mock_password@localhost:5432/mock_bartender?schema=public` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | ✅ | `sk-mock-openai-api-key-1234567890abcdef` |
| `OPENAI_BASE_URL` | OpenAI API 基础 URL | ✅ | `https://openai.com/v1` |
| `LLM_MODEL` | 使用的 LLM 模型 | ✅ | `gpt-4` |

### Prisma 配置

Prisma 客户端输出到 `app/generated/prisma`，确保在导入时使用正确的路径：

```typescript
import { prisma } from '@/lib/prisma'
```



## 🧪 测试

```bash
# 运行类型检查
npm run type-check

# 运行 Linter
npm run lint

# 构建项目
npm run build
```

## 📦 构建部署

### 构建生产版本

```bash
npm run build
npm run start
```

### 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### 数据库迁移（生产环境）

```bash
npx prisma migrate deploy
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 全栈框架
- [LangChain](https://www.langchain.com/) - LLM 应用框架
- [Prisma](https://www.prisma.io/) - 现代化 ORM
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
