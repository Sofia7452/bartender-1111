/**
 * 鸡尾酒推荐质量评测测试
 *
 * 目标：用固定 mock LLM 响应，评估 LLMService.generateRecommendations()
 * 的推荐质量是否稳定达标，覆盖 7 个维度：
 *   1. JSON 可解析性   2. 推荐数量   3. 必需字段完整性
 *   4. ingredients/steps 非空数组   5. difficulty ∈ [1,5]
 *   6. estimatedTime > 0            7. 与输入原料基本相关
 *
 * 全程 mock OpenAI 与 @vercel/kv，无真实外部调用、无 Redis/KV 错误日志。
 */

import { describe, it, expect, vi } from 'vitest';
import { LLMService } from '../../app/services/llmService';
import {
  buildQualityReport,
  DEFAULT_COUNT_RULE,
  evaluateRecommendation,
  evaluateRecommendationCount,
  formatQualityReport,
  isIngredientReferenced,
  isJsonParsable,
  type RecommendationVerdict,
} from './recommendationQuality';

// ---------------------------------------------------------------------------
// Mock 声明（hoisted 到 import 之前生效）
// ---------------------------------------------------------------------------

// 每个 LLMService 实例在构造时创建独立的 create mock，登记到注册表，
// 由 createFreshService() 取回——避免多个测试之间污染 calls/once 队列。
const { mockRegistry } = vi.hoisted(() => ({
  mockRegistry: { fns: [] as ReturnType<typeof vi.fn>[] },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat: { completions: { create: ReturnType<typeof vi.fn> } };

    constructor() {
      const create = vi.fn();
      mockRegistry.fns.push(create);
      this.chat = { completions: { create } };
    }
  },
}));

// mock @vercel/kv 走"成功路径"，避免未配置 KV_REST_API_URL 时的错误日志。
// 不能使用自动 mock：keys() 返回 undefined 会让 clearAll() 抛错。
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function createFreshService(): { service: LLMService; mockCreate: any } {
  const before = mockRegistry.fns.length;
  const service = new LLMService({
    apiKey: 'test-api-key',
    baseURL: 'https://test.example.com',
    model: 'test-model',
  });
  const created = mockRegistry.fns.slice(before);
  return { service, mockCreate: created[created.length - 1] };
}

/** 让 mock LLM 直接返回指定的原始文本 content */
function mockRawLLMContent(mockCreate: any, content: string): void {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content } }],
  });
}

/** 通过公共 API 获取推荐 + 生成评测报告 */
async function recommendAndReport(rawContent: string, ingredients: string[]) {
  const { service, mockCreate } = createFreshService();
  mockRawLLMContent(mockCreate, rawContent);
  const recommendations = await service.generateRecommendations(ingredients);
  const report = buildQualityReport({ inputIngredients: ingredients, rawContent, recommendations });
  return { report, recommendations };
}

/** 断言某维度存在且 pass 状态符合预期 */
function expectVerdict(verdicts: RecommendationVerdict[], dimension: string, passed: boolean) {
  const verdict = verdicts.find((v) => v.dimension === dimension);
  expect(verdict, `维度 ${dimension} 应存在`).toBeDefined();
  expect(verdict!.passed, `维度 ${dimension} 判定应为 ${passed}，实际: ${verdict!.details}`).toBe(passed);
  return verdict!;
}

// ---------------------------------------------------------------------------
// 固定 mock 响应样例
// ---------------------------------------------------------------------------

const GOOD_RECIPES = [
  {
    name: '古典威士忌酸',
    description: '威士忌与柠檬的经典组合',
    ingredients: ['威士忌 60ml', '柠檬汁 30ml', '糖浆 15ml'],
    steps: ['摇匀所有原料', '倒入冰镇酒杯'],
    difficulty: 3,
    estimatedTime: 5,
  },
  {
    name: '柠檬气泡金汤力',
    description: '清爽的金酒气泡饮品',
    ingredients: ['金酒 45ml', '柠檬 1 片', '汤力水 120ml'],
    steps: ['杯中加冰', '倒入金酒与汤力水'],
    difficulty: 2,
    estimatedTime: 3,
  },
  {
    name: '威士忌老经典',
    description: '浓郁甜美的威士忌鸡尾酒',
    ingredients: ['威士忌 50ml', '苦精 2 滴', '糖 1 块'],
    steps: ['搅拌原料', '滤入酒杯'],
    difficulty: 4,
    estimatedTime: 8,
  },
];

const INPUT_INGREDIENTS = ['威士忌', '柠檬'];

// ---------------------------------------------------------------------------
// 评测器纯函数：单元测试
// ---------------------------------------------------------------------------

describe('推荐质量评测器（纯函数）', () => {
  it('isJsonParsable 正确识别合法/非法 JSON', () => {
    expect(isJsonParsable('[{"name":"a"}]')).toBe(true);
    expect(isJsonParsable('{"type":"recipes","data":[]}')).toBe(true);
    expect(isJsonParsable('这不是 JSON')).toBe(false);
    expect(isJsonParsable('')).toBe(false);
  });

  it('isIngredientReferenced 大小写不敏感且支持子串匹配', () => {
    expect(isIngredientReferenced('威士忌', ['威士忌 60ml'])).toBe(true);
    expect(isIngredientReferenced(' 威士忌 ', ['加冰威士忌'])).toBe(true);
    expect(isIngredientReferenced('Whisky', ['whisky 45ml'])).toBe(true);
    expect(isIngredientReferenced('伏特加', ['威士忌 60ml'])).toBe(false);
  });

  it('evaluateRecommendation 对合格推荐全部通过', () => {
    const verdicts = evaluateRecommendation(GOOD_RECIPES[0], INPUT_INGREDIENTS);
    expect(verdicts.every((v) => v.passed)).toBe(true);
  });

  it('evaluateRecommendation 识别字符串型 difficulty', () => {
    const verdicts = evaluateRecommendation({ ...GOOD_RECIPES[0], difficulty: '3' }, INPUT_INGREDIENTS);
    expectVerdict(verdicts, 'difficultyRange', false);
  });

  it('evaluateRecommendation 识别空 ingredients 数组', () => {
    const verdicts = evaluateRecommendation({ ...GOOD_RECIPES[0], ingredients: [] }, INPUT_INGREDIENTS);
    expectVerdict(verdicts, 'nonEmptyArray:ingredients', false);
  });

  it('evaluateRecommendation 识别缺失必需字段', () => {
    const { name, ...missingName } = GOOD_RECIPES[0];
    const verdicts = evaluateRecommendation(missingName, INPUT_INGREDIENTS);
    expectVerdict(verdicts, 'requiredFields', false);
  });

  it('推荐数量规则可参数化：默认宽松区间与自定义严格区间', () => {
    // 默认 1-5：单条通过
    expect(evaluateRecommendationCount([{}]).passed).toBe(true);
    expect(DEFAULT_COUNT_RULE).toEqual({ min: 1, max: 5 });

    // 严格 3-5：单条不合格，3 条合格
    const strict = { min: 3, max: 5 };
    expect(evaluateRecommendationCount([{}], strict).passed).toBe(false);
    expect(evaluateRecommendationCount([{}, {}, {}], strict).passed).toBe(true);
  });

  it('buildQualityReport 支持传入自定义数量规则', () => {
    // 合格 3 条 + 严格规则（3-5）→ 数量维度通过
    const report = buildQualityReport({
      inputIngredients: INPUT_INGREDIENTS,
      rawContent: JSON.stringify(GOOD_RECIPES),
      recommendations: GOOD_RECIPES,
      countRule: { min: 3, max: 5 },
    });
    expect(report.globalVerdicts.find((v) => v.dimension === 'recommendationCount')!.passed).toBe(true);

    // 2 条 + 严格规则（3-5）→ 数量维度失败
    const report2 = buildQualityReport({
      inputIngredients: INPUT_INGREDIENTS,
      rawContent: JSON.stringify(GOOD_RECIPES.slice(0, 2)),
      recommendations: GOOD_RECIPES.slice(0, 2),
      countRule: { min: 3, max: 5 },
    });
    expect(report2.globalVerdicts.find((v) => v.dimension === 'recommendationCount')!.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 集成评测：mock LLM 驱动的完整链路
// ---------------------------------------------------------------------------

describe('鸡尾酒推荐质量评测（LLMService + mock OpenAI）', () => {
  it('合格响应：7 个维度全部通过', async () => {
    const rawContent = JSON.stringify(GOOD_RECIPES);
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.recommendations).toHaveLength(3);
    expect(report.passed).toBe(true);
    expect(report.summary.failedChecks).toBe(0);
    expect(report.recipeReports.every((r) => r.passed)).toBe(true);
  });

  it('非 JSON 响应：JSON 可解析性失败，整体不合格', async () => {
    const rawContent = '抱歉，我不太确定你想调什么酒。';
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.passed).toBe(false);
    expect(report.summary.failedChecks).toBeGreaterThan(0);
    // 非 JSON 会降级为 chat 回复，但评测器仍须如实报告"JSON 不可解析"
    expectVerdict(report.globalVerdicts, 'jsonParsable', false);
  });

  it('推荐数量为 0：数量维度失败', async () => {
    const rawContent = JSON.stringify({ type: 'recipes', data: [] });
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.recommendations).toHaveLength(0);
    expect(report.passed).toBe(false);
    expect(report.summary.failedChecks).toBeGreaterThan(0);
    expectVerdict(report.globalVerdicts, 'recommendationCount', false);
  });

  it('缺字段：requiredFields 失败', async () => {
    const broken = [{ ...GOOD_RECIPES[0] } as Record<string, unknown>];
    delete broken[0].name;
    const rawContent = JSON.stringify(broken);
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.passed).toBe(false);
    expect(report.recipeReports[0].verdicts.find((v) => v.dimension === 'requiredFields')!.passed).toBe(false);
  });

  it('空数组：ingredients/steps 维度失败', async () => {
    const broken = [{ ...GOOD_RECIPES[0], ingredients: [], steps: [] }];
    const rawContent = JSON.stringify(broken);
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.passed).toBe(false);
    const verdicts = report.recipeReports[0].verdicts;
    expectVerdict(verdicts, 'nonEmptyArray:ingredients', false);
    expectVerdict(verdicts, 'nonEmptyArray:steps', false);
  });

  it('数值越界：difficulty / estimatedTime 维度失败', async () => {
    const broken = [{ ...GOOD_RECIPES[0], difficulty: 9, estimatedTime: -5 }];
    const rawContent = JSON.stringify(broken);
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.passed).toBe(false);
    const verdicts = report.recipeReports[0].verdicts;
    expectVerdict(verdicts, 'difficultyRange', false);
    expectVerdict(verdicts, 'estimatedTimePositive', false);
  });

  it('原料不相关：ingredientRelevance 失败', async () => {
    const irrelevant = [
      {
        name: '草莓奶昔',
        description: '无酒精饮品',
        ingredients: ['草莓 100g', '牛奶 200ml', '蜂蜜 10ml'],
        steps: ['搅拌', '装杯'],
        difficulty: 1,
        estimatedTime: 2,
      },
    ];
    const rawContent = JSON.stringify(irrelevant);
    const { report } = await recommendAndReport(rawContent, INPUT_INGREDIENTS);

    console.log(formatQualityReport(report));
    expect(report.passed).toBe(false);
    const verdicts = report.recipeReports[0].verdicts;
    expectVerdict(verdicts, 'ingredientRelevance', false);
  });
});
