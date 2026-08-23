#!/usr/bin/env tsx
/**
 * 鸡尾酒推荐质量评测 harness（CLI 入口）
 *
 * 用法：
 *   npm run eval:recommendation-quality
 *   npm run eval:recommendation-quality -- --min-count 3 --max-count 5
 *
 * 设计说明：
 * - 复用 tests/quality/recommendationQuality.ts 的纯函数评测器，与生产代码解耦。
 * - 数据源为内置固定 mock 语料（模拟 LLMService 解析后的输出），
 *   确定性、无真实 OpenAI / Redis / KV 调用。
 * - 刻意不使用 fast-check / fc.assert 的属性测试语义（随机+收缩），
 *   以保证评测报告确定、可读，退出码可直接作为 CI 质量门禁：
 *      exit 0 = 全部样例质量合格；exit 1 = 存在不合格样例。
 * - 推荐数量规则可参数化：--min-count / --max-count（默认 1-5）。
 */

import {
  buildQualityReport,
  DEFAULT_COUNT_RULE,
  formatQualityReport,
  type CountRule,
  type QualityReport,
} from '../tests/quality/recommendationQuality';

// ---------------------------------------------------------------------------
// 内置 mock 语料（每个样例 = 一次"LLM 响应"）
// ---------------------------------------------------------------------------

interface CorpusCase {
  name: string;
  inputIngredients: string[];
  /** LLM 返回的原始文本（评测 JSON 可解析性） */
  rawContent: string;
  /** LLMService 解析后的推荐列表（评测其余维度） */
  recommendations: any[];
}

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

const CASES: CorpusCase[] = [
  {
    name: '合格响应（3 条，含输入原料）',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: JSON.stringify(GOOD_RECIPES),
    recommendations: GOOD_RECIPES,
  },
  {
    name: '非 JSON 响应（LLM 降级为聊天回复）',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: '抱歉，我不太确定你想调什么酒。',
    recommendations: [
      { id: 'chat-response', name: '智能助手', description: '抱歉…', isChat: true, ingredients: [], steps: [], difficulty: 1, estimatedTime: 0 },
    ],
  },
  {
    name: '空推荐列表',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: JSON.stringify({ type: 'recipes', data: [] }),
    recommendations: [],
  },
  {
    name: '缺少必需字段',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: JSON.stringify([{ ...GOOD_RECIPES[0], name: undefined }]),
    recommendations: [{ ...GOOD_RECIPES[0], name: undefined }],
  },
  {
    name: 'ingredients/steps 为空数组',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: JSON.stringify([{ ...GOOD_RECIPES[0], ingredients: [], steps: [] }]),
    recommendations: [{ ...GOOD_RECIPES[0], ingredients: [], steps: [] }],
  },
  {
    name: '数值越界（difficulty=9, estimatedTime=-5）',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: JSON.stringify([{ ...GOOD_RECIPES[0], difficulty: 9, estimatedTime: -5 }]),
    recommendations: [{ ...GOOD_RECIPES[0], difficulty: 9, estimatedTime: -5 }],
  },
  {
    name: '原料不相关（草莓奶昔）',
    inputIngredients: INPUT_INGREDIENTS,
    rawContent: JSON.stringify([
      {
        name: '草莓奶昔',
        description: '无酒精饮品',
        ingredients: ['草莓 100g', '牛奶 200ml', '蜂蜜 10ml'],
        steps: ['搅拌', '装杯'],
        difficulty: 1,
        estimatedTime: 2,
      },
    ]),
    recommendations: [
      {
        name: '草莓奶昔',
        description: '无酒精饮品',
        ingredients: ['草莓 100g', '牛奶 200ml', '蜂蜜 10ml'],
        steps: ['搅拌', '装杯'],
        difficulty: 1,
        estimatedTime: 2,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// CLI 参数解析
// ---------------------------------------------------------------------------

function parseCountRule(argv: string[]): CountRule {
  const rule: CountRule = { ...DEFAULT_COUNT_RULE };
  const read = (flag: string): number | null => {
    const idx = argv.indexOf(flag);
    if (idx === -1 || idx + 1 >= argv.length) return null;
    const value = Number(argv[idx + 1]);
    return Number.isFinite(value) ? value : null;
  };
  const min = read('--min-count');
  const max = read('--max-count');
  if (min !== null) rule.min = min;
  if (max !== null) rule.max = max;
  return rule;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main(): void {
  const countRule = parseCountRule(process.argv.slice(2));
  const label = `推荐数量规则: ${countRule.min}-${countRule.max}`;
  console.log(`🍹 鸡尾酒推荐质量评测 harness`);
  console.log(`   ${label}\n`);

  const reports: QualityReport[] = CASES.map((c) =>
    buildQualityReport({
      inputIngredients: c.inputIngredients,
      rawContent: c.rawContent,
      recommendations: c.recommendations,
      countRule,
    })
  );

  let passedCases = 0;
  let totalChecks = 0;
  let passedChecks = 0;

  reports.forEach((report, index) => {
    const c = CASES[index];
    console.log(`── 案例 ${index + 1}: ${c.name} ──`);
    console.log(formatQualityReport(report));
    console.log('');
    if (report.passed) passedCases += 1;
    totalChecks += report.summary.totalChecks;
    passedChecks += report.summary.passedChecks;
  });

  const passRate = (passedChecks / totalChecks) * 100;
  console.log('══════════════════════════════════════════');
  console.log(`📈 汇总: ${passedCases}/${reports.length} 个案例合格`);
  console.log(`   ${passedChecks}/${totalChecks} 项检查通过 (${passRate.toFixed(1)}%)`);
  console.log(`   ${label}`);
  console.log(passedCases === reports.length ? '✅ 推荐质量稳定达标' : '❌ 存在不合格案例，质量未达标');
  console.log('══════════════════════════════════════════');

  // CI 门禁：全部合格 → 0，否则 → 1
  process.exitCode = passedCases === reports.length ? 0 : 1;
}

main();
