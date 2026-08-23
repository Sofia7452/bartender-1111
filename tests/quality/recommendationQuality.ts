/**
 * 鸡尾酒推荐质量评测器（纯函数，零依赖，可被测试 / 脚本 / Agent 复用）
 *
 * 评测对象：LLMService.generateRecommendations() 的输出（推荐列表）及其原始 LLM 响应。
 * 设计原则：
 * - 所有判定都是纯函数：输入 (原始内容, 推荐列表, 输入原料) → 结构化结论。
 * - 不访问 LLMService 私有成员，只消费公共 API 的输出，因此与生产实现解耦。
 * - 判定规则宽松且可解释，避免误判（原料相关性用子串包含）。
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface RecommendationVerdict {
  /** 维度名，如 jsonParsable / requiredFields / nonEmptyArray:ingredients ... */
  dimension: string;
  passed: boolean;
  /** 人类可读的判定说明 */
  details: string;
}

export interface RecipeQualityReport {
  recipe: any;
  verdicts: RecommendationVerdict[];
  /** 该条推荐是否所有维度通过 */
  passed: boolean;
}

export interface QualityReport {
  inputIngredients: string[];
  /** LLM 返回的原始文本（用于 JSON 可解析性判定） */
  rawContent: string;
  recommendations: any[];
  /** 全局维度判定（jsonParsable、recommendationCount） */
  globalVerdicts: RecommendationVerdict[];
  recipeReports: RecipeQualityReport[];
  /** 整体是否合格（所有检查通过） */
  passed: boolean;
  summary: { totalChecks: number; passedChecks: number; failedChecks: number };
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** LLM 提示词要求每条推荐携带的必需字段 */
export const REQUIRED_FIELDS = [
  'name',
  'description',
  'ingredients',
  'steps',
  'difficulty',
  'estimatedTime',
] as const;

/** 推荐数量规则（可参数化：不同场景可要求不同区间） */
export interface CountRule {
  min: number;
  max: number;
}

/** 默认推荐数量合格区间（宽松 1-5，兼容 mock 与真实 LLM 波动） */
export const RECOMMENDATION_COUNT_MIN = 1;
export const RECOMMENDATION_COUNT_MAX = 5;
export const DEFAULT_COUNT_RULE: CountRule = {
  min: RECOMMENDATION_COUNT_MIN,
  max: RECOMMENDATION_COUNT_MAX,
};

// ---------------------------------------------------------------------------
// 基础判定函数
// ---------------------------------------------------------------------------

export function isJsonParsable(content: string): boolean {
  if (typeof content !== 'string') return false;
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * 宽松原料相关性匹配：输入原料规范化（trim + 小写）后，
 * 是否作为子串出现在配方文本（名称 / 描述 / 原料列表）中。
 */
export function isIngredientReferenced(ingredient: string, recipeText: string[]): boolean {
  const normalized = (ingredient ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return recipeText.some((text) => (text ?? '').toLowerCase().includes(normalized));
}

// ---------------------------------------------------------------------------
// 各维度判定
// ---------------------------------------------------------------------------

/** 维度 1: JSON 可解析性 */
export function evaluateJsonParsability(rawContent: string): RecommendationVerdict {
  const passed = isJsonParsable(rawContent);
  return {
    dimension: 'jsonParsable',
    passed,
    details: passed ? 'LLM 返回内容是合法 JSON' : 'LLM 返回内容不是合法 JSON',
  };
}

/** 维度 2: 推荐数量（规则可参数化，默认 DEFAULT_COUNT_RULE） */
export function evaluateRecommendationCount(
  recommendations: any[],
  rule: CountRule = DEFAULT_COUNT_RULE
): RecommendationVerdict {
  const count = Array.isArray(recommendations) ? recommendations.length : 0;
  const passed = count >= rule.min && count <= rule.max;
  return {
    dimension: 'recommendationCount',
    passed,
    details: `推荐数量=${count}${passed ? '' : `（期望 ${rule.min}-${rule.max}）`}`,
  };
}

/** 维度 3-7: 单条推荐的质量判定 */
export function evaluateRecommendation(recipe: any, inputIngredients: string[]): RecommendationVerdict[] {
  const verdicts: RecommendationVerdict[] = [];
  const recipeObj = recipe ?? {};

  // 维度 3: 必需字段完整性
  const missing = REQUIRED_FIELDS.filter(
    (field) => recipeObj[field] === undefined || recipeObj[field] === null
  );
  verdicts.push({
    dimension: 'requiredFields',
    passed: missing.length === 0,
    details: missing.length === 0 ? `必需字段完整（${REQUIRED_FIELDS.join(', ')}）` : `缺少必需字段: ${missing.join(', ')}`,
  });

  // 维度 4: ingredients / steps 为非空数组
  for (const field of ['ingredients', 'steps'] as const) {
    const value = recipeObj[field];
    const passed = Array.isArray(value) && value.length > 0;
    verdicts.push({
      dimension: `nonEmptyArray:${field}`,
      passed,
      details: passed ? `${field} 为非空数组（${value.length} 项）` : `${field} 为空或不是数组`,
    });
  }

  // 维度 5: difficulty 为 1-5 的整数
  const diffPassed =
    typeof recipeObj.difficulty === 'number' &&
    Number.isInteger(recipeObj.difficulty) &&
    recipeObj.difficulty >= 1 &&
    recipeObj.difficulty <= 5;
  verdicts.push({
    dimension: 'difficultyRange',
    passed: diffPassed,
    details: diffPassed
      ? `difficulty=${recipeObj.difficulty} 在 1-5`
      : `difficulty=${JSON.stringify(recipeObj.difficulty)} 不是 1-5 的整数`,
  });

  // 维度 6: estimatedTime 为正数
  const timePassed = typeof recipeObj.estimatedTime === 'number' && recipeObj.estimatedTime > 0;
  verdicts.push({
    dimension: 'estimatedTimePositive',
    passed: timePassed,
    details: timePassed
      ? `estimatedTime=${recipeObj.estimatedTime} > 0`
      : `estimatedTime=${JSON.stringify(recipeObj.estimatedTime)} 不是正数`,
  });

  // 维度 7: 与输入原料基本相关（宽松匹配：至少命中 1 个）
  const recipeText = [
    recipeObj.name,
    recipeObj.description,
    ...(Array.isArray(recipeObj.ingredients) ? recipeObj.ingredients : []),
  ].filter((text) => typeof text === 'string');
  const matched = (inputIngredients ?? []).filter((ing) => isIngredientReferenced(ing, recipeText));
  verdicts.push({
    dimension: 'ingredientRelevance',
    passed: matched.length > 0,
    details: matched.length > 0 ? `命中原料: ${matched.join('、')}` : `未命中任何输入原料: ${(inputIngredients ?? []).join('、')}`,
  });

  return verdicts;
}

// ---------------------------------------------------------------------------
// 报告聚合
// ---------------------------------------------------------------------------

export function buildQualityReport(input: {
  inputIngredients: string[];
  rawContent: string;
  recommendations: any[];
  /** 可选：推荐数量规则，默认 DEFAULT_COUNT_RULE */
  countRule?: CountRule;
}): QualityReport {
  const { inputIngredients, rawContent, recommendations, countRule } = input;
  const list = Array.isArray(recommendations) ? recommendations : [];

  const recipeReports: RecipeQualityReport[] = list.map((recipe) => {
    const verdicts = evaluateRecommendation(recipe, inputIngredients);
    return { recipe, verdicts, passed: verdicts.every((v) => v.passed) };
  });

  const globalVerdicts: RecommendationVerdict[] = [
    evaluateJsonParsability(rawContent),
    evaluateRecommendationCount(list, countRule),
  ];

  const allVerdicts: RecommendationVerdict[] = [
    ...globalVerdicts,
    ...recipeReports.flatMap((r) => r.verdicts),
  ];

  const passedChecks = allVerdicts.filter((v) => v.passed).length;
  return {
    inputIngredients,
    rawContent,
    recommendations: list,
    globalVerdicts,
    recipeReports,
    passed: allVerdicts.every((v) => v.passed),
    summary: {
      totalChecks: allVerdicts.length,
      passedChecks,
      failedChecks: allVerdicts.length - passedChecks,
    },
  };
}

/** 输出人类可读的评测报告（供测试 stdout / 未来脚本 / Agent 使用） */
export function formatQualityReport(report: QualityReport): string {
  const lines: string[] = [];
  lines.push(`📊 推荐质量评测报告`);
  lines.push(`   输入原料: ${report.inputIngredients.join('、') || '(空)'}`);
  lines.push(`   推荐数量: ${report.recommendations.length} 条`);
  for (const r of report.recipeReports) {
    const name = typeof r.recipe?.name === 'string' ? r.recipe.name : '(无名)';
    lines.push(`  ${r.passed ? '✅' : '❌'} ${name}:`);
    for (const v of r.verdicts) {
      lines.push(`     ${v.passed ? '✓' : '✗'} ${v.dimension}: ${v.details}`);
    }
  }
  lines.push(
    `   汇总: ${report.summary.passedChecks}/${report.summary.totalChecks} 项通过` +
      `${report.passed ? ' → ✅ 质量合格' : ' → ❌ 质量不合格'}`
  );
  return lines.join('\n');
}
