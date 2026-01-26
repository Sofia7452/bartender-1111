/**
 * 分页类型定义
 * 
 * 支持两种分页模式：
 * 1. 传统的 OFFSET 分页（适用于小数据集）
 * 2. 游标分页（Cursor-based Pagination，适用于大数据集和无限滚动）
 */

/**
 * 传统 OFFSET 分页响应
 */
export interface OffsetPaginationResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * 游标分页响应
 * 
 * @template T - 游标类型（通常是 ID 或时间戳）
 */
export interface CursorPaginationResponse<T = string> {
  /** 下一页的游标（如果有） */
  nextCursor: T | null;
  /** 上一页的游标（如果有） */
  prevCursor: T | null;
  /** 是否还有下一页 */
  hasMore: boolean;
  /** 当前页数据量 */
  count: number;
}

/**
 * 游标分页请求参数
 * 
 * @template T - 游标类型
 */
export interface CursorPaginationParams<T = string> {
  /** 游标（用于定位从哪里开始查询） */
  cursor?: T;
  /** 每页数量（默认3，最大50） */
  limit?: number;
  /** 方向：'forward' 向前（下一页），'backward' 向后（上一页） */
  direction?: 'forward' | 'backward';
}

/**
 * 组合分页响应（同时支持 OFFSET 和游标分页）
 * 
 * @template T - 游标类型
 */
export interface CombinedPaginationResponse<T = string> {
  /** 游标分页信息 */
  cursor: CursorPaginationResponse<T>;
  /** 传统分页信息（可选，用于兼容） */
  offset?: OffsetPaginationResponse;
}
