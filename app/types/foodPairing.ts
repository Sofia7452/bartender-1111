/**
 * 菜品与酒品搭配推荐系统的类型定义
 * 
 * 本文件定义了多 Agent 系统中 Agent 1 (菜品推荐) 和 Agent 2 (酒品搭配) 的接口规范
 */

/**
 * Agent 1 输入接口
 * 菜品推荐 Agent 的输入参数
 */
export interface DishRecommenderInput {
  /** 菜系类型，可选，如 "川菜"、"日料"、"西餐" 等 */
  cuisine?: string | null;
  /** 现有原料列表，必需，如 ["牛肉", "土豆", "洋葱"] */
  ingredients: string[];
}

/**
 * 菜品推荐项
 * Agent 1 输出的单个菜品推荐
 */
export interface DishRecommendation {
  /** 唯一标识符 */
  id: string;
  /** 菜品名称 */
  name: string;
  /** 菜品描述 */
  description: string;
  /** 所属菜系 */
  cuisine: string;
  /** 所需食材列表，包含用量信息，如 ["牛肉 200g", "土豆 2个", "洋葱 1个"] */
  requiredIngredients: string[];
  /** 烹饪时间（分钟） */
  cookingTime: number;
  /** 难度等级，1-5，1=简单，5=专家 */
  difficulty: number;
  /** 烹饪步骤列表 */
  steps: string[];
  /** 来源信息（可选） */
  source?: string;
  /** 分类标签（可选） */
  tags?: string[];
}

/**
 * Agent 1 输出接口
 * 菜品推荐 Agent 的输出结果
 */
export interface DishRecommenderOutput {
  /** 推荐的菜品列表 */
  dishes: DishRecommendation[];
  /** 推荐元数据 */
  metadata?: {
    /** 推荐时间戳 */
    timestamp: string;
    /** 使用的模型 */
    model?: string;
    /** 推荐数量 */
    count: number;
  };
}

/**
 * Agent 2 输入接口
 * 酒品搭配 Agent 的输入参数
 */
export interface BeveragePairingInput {
  /** Agent 1 输出的菜品推荐列表 */
  dishes: DishRecommendation[];
  /** 用户输入的酒原料列表，可选，如 ["威士忌", "柠檬", "糖浆"] */
  drinkIngredients?: string[];
}

/**
 * 酒品推荐项
 * Agent 2 输出的单个酒品推荐
 */
export interface BeverageRecommendation {
  /** 唯一标识符 */
  id: string;
  /** 酒品名称 */
  name: string;
  /** 酒品描述 */
  description: string;
  /** 原料列表，包含用量信息，如 ["威士忌 50ml", "柠檬汁 20ml", "糖浆 15ml"] */
  ingredients: string[];
  /** 制作步骤列表 */
  steps: string[];
  /** 分类，如 "鸡尾酒"、"红酒"、"白酒" 等 */
  category?: string;
  /** 杯型，如 "古典杯"、"高球杯"、"马天尼杯" 等 */
  glassType?: string;
  /** 调制技巧，如 "摇和"、"搅拌"、"直调" 等 */
  technique?: string;
  /** 装饰，如 "柠檬片"、"薄荷叶" 等 */
  garnish?: string;
  /** 难度等级，1-5，1=简单，5=专家 */
  difficulty: number;
  /** 预估制作时间（分钟） */
  estimatedTime: number;
  /** 来源信息（可选） */
  source?: string;
  /** 分类标签（可选） */
  tags?: string[];
}

/**
 * 搭配理由
 * 说明为什么某个酒品适合搭配某个菜品
 */
export interface PairingReason {
  /** 唯一标识符 */
  id: string;
  /** 关联的菜品 ID */
  dishId: string;
  /** 关联的酒品 ID */
  beverageId: string;
  /** 搭配理由的详细说明 */
  reason: string;
  /** 搭配类型，如 "互补"、"对比"、"平衡" 等 */
  pairingType?: string;
  /** 搭配评分，1-10，10=完美搭配 */
  score?: number;
}

/**
 * Agent 2 输出接口
 * 酒品搭配 Agent 的完整推荐方案
 */
export interface CompletePairingRecommendation {
  /** 推荐的菜品列表（来自 Agent 1） */
  dishes: DishRecommendation[];
  /** 推荐的酒品列表 */
  beverages: BeverageRecommendation[];
  /** 每个搭配的详细理由 */
  pairingReasons: PairingReason[];
  /** 整体搭配建议 */
  overallSuggestion: string;
  /** 推荐元数据 */
  metadata?: {
    /** 推荐时间戳 */
    timestamp: string;
    /** 使用的模型 */
    model?: string;
    /** 菜品数量 */
    dishCount: number;
    /** 酒品数量 */
    beverageCount: number;
    /** 搭配数量 */
    pairingCount: number;
  };
}

