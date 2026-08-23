# dsh 能力评测技术报告

评测任务背景：本次评测是一次真实 Next.js 项目中的 AI coding agent 任务，覆盖代码修复、测试质量提升和推荐质量评测 harness 构建。

## 结论

dsh 已具备可用的本地 coding agent / harness 原型能力：能读项目、运行命令、定位问题、修改代码、复验结果，并保留较完整的执行轨迹。它可以从普通修复任务推进到 LLM 质量评测原型和 CLI harness。

但它还不是足够可靠的高级工程自治体。核心短板不是不会做，而是做到能跑后缺少最后一层资深 reviewer 判断：会误判异步测试语义、默认 CLI 入口设计不够 CI 友好、验证命令偶尔不严谨，容易把演示样例和真实门禁混在一起。

在本次评测前提下，综合判断：工程执行力 7/10，调试韧性 8/10，harness 原型能力 7/10，测试严谨性 5.5/10，资深工程判断 6/10。适合辅助开发和原型探索，不适合无人监督合入关键代码。

## 评测前提

本报告基于用户导出的 4 份 dsh session log，以及当前项目中的实际代码变更进行评估。

| 项目 | 观察值 |
|---|---|
| dsh 模式 | 标准模式（log 中 `agentPreset=standard`） |
| 用户选择模型档位 | DeepSeek-V4-Flash-High |
| log 可见模型字段 | `deepseek-official/deepseek-v4-flash high` |
| context window | 1,000,000 tokens |
| 项目 | Next.js 16 + Prisma + LLMService + Vitest |
| 任务类型 | 代码修复、测试质量提升、LLM 推荐质量评测原型、CLI harness |

## 研究对齐的评估框架

评估维度对齐 AgentBench、AgentBoard、SWE-bench、SWE-agent、ToolBench、WebArena、OSWorld、AppWorld、τ-bench 等 agent / tool-use / coding-agent benchmark，重点考察任务成功、执行式验证、轨迹质量、工具使用、效率、稳定性、边界控制、副作用和可审计性。

| 通用维度 | 论文/benchmark 中的对应关注点 | 本次如何评估 dsh | 本次结论 |
|---|---|---|---|
| 任务成功率 / 功能正确性 | SWE-bench、WebArena、OSWorld、AppWorld 都强调最终任务是否被可执行检查验证 | typecheck、Vitest、CLI eval 退出码、实际代码是否满足任务目标 | 中上。基础修复和测试通过，但 CLI 默认门禁语义不清 |
| 执行式验证与可复现性 | SWE-bench、OSWorld 强调 execution-based evaluation 和可复现环境 | 是否运行真实命令、是否记录命令结果、是否能复跑 | 较好。dsh 有完整命令轨迹和复验记录 |
| 轨迹质量 / 中间进展 | AgentBoard 强调不能只看最终 success rate，要看 progress rate 和多轮轨迹 | 看每个 turn 的读文件、定位、修改、验证路径是否合理 | 中上。能持续推进，但复杂任务路径偏长 |
| 工具使用与 ACI 适配 | ToolBench 关注工具调用能力，SWE-agent 强调 agent-computer interface 影响结果 | 看 read/edit/bash/todo 使用是否有效、是否误用 shell/测试工具 | 中等偏上。工具链可用，但有管道退出码和异步断言误判 |
| 效率 / 成本 | AgentBench、AgentBoard 等都会关注多轮交互和评估运行成本 | 运行时间、工具调用数、token/cache 规模 | 分化明显。简单任务高效，测试隔离任务成本高 |
| 稳定性 / 多次一致性 | τ-bench 提出 pass^k，用多次运行衡量 agent 行为一致性 | 当前只有单条 session 轨迹，不能严格估计 pass^k | 证据不足。只能说明单次可完成，不能证明稳定可靠 |
| 规则遵循与边界控制 | τ-bench 关注 domain policy，AppWorld 关注 collateral damage | 是否遵守最小修复、是否区分 self-test 与 production gate | 中等。能遵循任务，但门禁边界和测试语义判断不够稳 |
| 副作用 / collateral damage | AppWorld 用 state-based tests 检查非预期状态变化 | 改动范围、是否引入不必要 mock/脚本、默认命令是否破坏 CI 预期 | 中等。没有明显破坏，但默认 eval 失败不适合作 CI 默认入口 |
| 可观察性 / 可审计性 | AgentBoard 提供分析面板，OSWorld 也要求轨迹/报告支撑复核 | session log 是否能还原过程、工具调用是否可读 | 较强。这是 dsh 作为 harness 的核心优势 |

运行时间和工具调用主要作为效率、轨迹质量、工具使用、可观察性的证据，而不是孤立的能力结论。

## 运行时间与工具调用评估

从 log 看，dsh 的整体执行风格是“高可观察、强迭代、偏实验型”。它不是一次性生成答案，而是通过读文件、跑命令、编辑、复验持续逼近结果。

| Turn | 任务 | 耗时 | 工具调用数 | 主要工具分布 | 评价 |
|---:|---|---:|---:|---|---|
| 1 | 项目结构分析 | 42s | 24 | read 13, bash 10 | 进入项目较快，信息收集充分 |
| 3 | 类型检查和测试修复 | 106s | 27 | edit 9, bash 8, read 7 | 基础 coding loop 较高效 |
| 5 | 测试质量提升 | 2344s | 103 | bash 47, edit 33, read 14 | 调试韧性强，但成本高，说明推理收敛慢 |
| 6 | 推荐质量评测原型 | 131s | 15 | bash 5, edit 5, write 2 | 能较快产出 evaluator 原型 |
| 7 | CLI harness 工程化 | 117s | 19 | edit 8, bash 7 | 能继续推进到可运行入口 |

工具调用累计特征：

| 工具 | 调用倾向 | 技术含义 |
|---|---|---|
| `bash` | 高频 | 依赖命令反馈迭代，验证意识强 |
| `edit` / `write` | 高频 | 能主动修改代码，但有时改动偏重 |
| `read` | 中高频 | 会先读上下文，不是纯猜测式修改 |
| `todo_write` | 稳定使用 | 任务管理能力尚可 |

运行时间结论：

- 简单修复任务表现较好：约 2 分钟内完成定位、修改、验证。
- 中等复杂测试隔离任务耗时明显上升：测试质量提升用了约 39 分钟和 103 次工具调用，说明模型能坚持调试，但推理路径不够短。
- harness 原型任务推进较快：约 2 分钟级别产出纯函数 evaluator 和 CLI 入口，适合做原型。
- 从 infra 角度看，dsh 的优势是“可恢复、可观察、能持续试错”，劣势是“高级测试语义和门禁设计需要人类 reviewer 把关”。

## 能力评分

| 维度 | 评分 | 结论 |
|---|---:|---|
| 任务成功率 / 功能正确性 | 7/10 | 多数目标能跑通，基础修复和测试扩展成功；CLI 默认 eval 语义仍有缺陷 |
| 执行式验证与可复现性 | 7.5/10 | 会运行 typecheck、test、CLI 命令，并保留命令输出 |
| 轨迹质量 / 中间进展 | 7/10 | 多轮推进清晰，但复杂测试任务耗时和调用数偏高 |
| 工具使用与 ACI 适配 | 7/10 | read/edit/bash/todo 配合较好，但存在 shell 退出码和异步断言误判 |
| 效率 / 成本 | 6/10 | 简单任务高效，复杂测试隔离任务 39 分钟、103 次工具调用，收敛慢 |
| 稳定性 / 多次一致性 | 5/10 | 当前只有单次 session，无法证明 pass^k 级稳定性 |
| 规则遵循与边界控制 | 6/10 | 基本遵守任务，但 self-test 与真实质量门禁边界混淆 |
| 副作用 / collateral damage | 6.5/10 | 改动范围尚可，但 mock 基建偏重，默认失败命令不适合直接进 CI |
| 可观察性 / 可审计性 | 8.5/10 | session log 对轨迹、工具调用、耗时、命令结果记录充分 |

综合判断：dsh 在“可观察的执行式 agent harness”上表现较强，在“稳定、低成本、边界清晰的生产级自治工程师”上仍需验证。

## 关键证据

### 阶段一：基础修复

dsh 成功完成基础代码修复：

- 修复 `app/favorites-cursor/page.tsx` 的 nullable 类型问题。
- 修复 `scripts/benchmark-cache.ts` 中 `getCacheStats()` 未 `await` 和 `.memory.size` 访问问题。
- 修复 `tests/services/llmService.test.ts` 与当前实现不一致的问题。
- 最终 `typecheck` 通过，测试从失败变为 `68/68` 通过。

评价：基础 coding loop 合格。

### 阶段二：测试质量提升

dsh 做了更深一层测试隔离：

- mock `@vercel/kv`，消除无 KV 环境变量时的 Redis 错误日志。
- mock OpenAI，避免真实外部调用。
- 将部分测试从私有方法调用改为走 `generateRecommendations()` 公共 API。
- 追踪并解决共享 mock 导致的测试间污染。

评价：测试隔离意识不错，调试韧性强。

主要问题：它漏掉了 `fc.asyncProperty` 的异步断言等待问题。

```ts
fc.assert(fc.asyncProperty(...))
```

这里 `fc.assert(...)` 返回 Promise，应该使用：

```ts
await fc.assert(fc.asyncProperty(...))
```

后续 session 中它还错误地判断“无需 await”，这是明显的测试工程短板。

### 阶段三：推荐质量评测原型

dsh 构建了 LLM 应用评测雏形：

- 新增 `tests/quality/recommendationQuality.ts`，抽出纯函数 evaluator。
- 新增 `tests/quality/recommendationQuality.test.ts`，覆盖 JSON、数量、字段、数组、difficulty、estimatedTime、原料相关性。
- 使用 mock LLM 输出，不触发真实 OpenAI、Redis、数据库。
- 完整测试扩展到 `81/81`，后续到 `83/83`。

评价：具备 LLM 应用评测框架的原型设计能力。

### 阶段四：CLI harness

dsh 继续推进到 CLI 入口：

- 新增 `npm run eval:recommendation-quality`。
- 新增 `scripts/evaluate-recommendation-quality.ts`。
- 支持 `--min-count` / `--max-count` 参数。
- 输出结构化报告和退出码。

评价：harness 产品形态开始出现。

主要问题：默认 eval 内置多个负样例，导致默认命令退出码为 `1`。这适合作为 evaluator 自测，不适合作为默认 CI 质量门禁。它混淆了“测试评测器能力”和“评估当前候选质量”两个层次。

## 能力画像

dsh 强在：

- 快速进入项目上下文。
- 能持续运行命令并根据错误迭代。
- 能处理真实工程里的依赖、mock、测试隔离问题。
- session log 完整，可复盘性好。
- 能从普通修复推进到 evaluator / harness 原型。

dsh 弱在：

- 对测试语义的底层细节不够稳。
- 容易被“测试全绿”迷惑。
- 默认脚本和 CI 入口设计不够成熟。
- 会引入较重 mock 基建和较多注释。
- 对 shell 管道退出码、异步断言等待等 infra 细节把关不足。
- 缺少最后的架构审查视角。

## Infra 与研究视角判断

从 agent infra 角度看，dsh 的核心价值不只是模型能力，而是提供了一个可观察的本地 agent execution harness：

- 有工具调用轨迹。
- 有文件读写记录。
- 有命令执行过程。
- 有验证结果。
- 有最终总结。
- 能支撑多轮任务递进。

这使它适合做：

- 本地项目理解。
- 小中型代码修复。
- 测试补齐。
- LLM 应用评测原型。
- agent workflow 探索。
- 人类监督下的持续迭代。

不适合直接做：

- 无人值守生产级重构。
- 高风险数据库或依赖升级。
- 严格 CI 门禁设计的最终拍板。
- 需要强形式化正确性的测试框架改造。

## 建议

下一阶段应该从“能不能完成任务”转向“能不能在约束下做可靠收敛”。

推荐下一轮任务：

1. 修复 `fc.asyncProperty` 未 `await`。
2. 拆分 evaluator self-test 和 real eval gate。
3. 让默认 `eval:recommendation-quality` 对正向语料返回 0。
4. 增加 `eval:recommendation-quality:fixtures` 或测试文件专门覆盖负样例。
5. 输出可用于 CI 的质量门禁说明。

如果 dsh 能在这一轮里主动收敛复杂度、修正语义错误、设计清楚的门禁边界，说明它有接近生产 harness 的潜力。当前阶段应定位为：优秀的原型型 coding agent，尚未达到资深 autonomous engineer 水平。

## 研究依据

- [AgentBench: Evaluating LLMs as Agents](https://arxiv.org/abs/2308.03688)：强调多维环境、推理、决策、长程任务和指令遵循。
- [AgentBoard: An Analytical Evaluation Board of Multi-turn LLM Agents](https://arxiv.org/abs/2401.13178)：强调 final success rate 之外的 fine-grained progress rate 和轨迹分析。
- [SWE-bench: Can Language Models Resolve Real-World GitHub Issues?](https://arxiv.org/abs/2310.06770)：强调真实软件工程任务、跨文件修改、execution-based 测试验证。
- [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793)：强调 agent-computer interface 对代码导航、编辑、测试执行结果的影响。
- [ToolLLM / ToolBench](https://arxiv.org/abs/2307.16789)：强调真实 API 工具使用、工具选择、工具调用路径和自动评估。
- [WebArena](https://arxiv.org/abs/2307.13854)：强调真实交互环境、长程任务和 functional correctness。
- [OSWorld](https://arxiv.org/abs/2404.07972)：强调真实计算机环境、任务初始化、执行式评估和可复现脚本。
- [AppWorld](https://arxiv.org/abs/2407.18901)：强调交互式 coding agent、state-based unit tests，以及 collateral damage 检查。
- [τ-bench](https://arxiv.org/abs/2406.12045)：强调工具-agent-用户交互、规则遵循、数据库最终状态评估和 pass^k 稳定性。
