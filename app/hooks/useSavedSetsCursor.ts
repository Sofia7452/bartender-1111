/**
 * 套装列表 Hook - 游标分页版本
 * 
 * 支持"加载更多"模式，解决深分页性能问题
 * 
 * ## 使用示例
 * 
 * ```tsx
 * function SavedSetsPage() {
 *   const {
 *     savedSets,
 *     isLoading,
 *     isLoadingMore,
 *     hasMore,
 *     error,
 *     loadMore,
 *     refresh,
 *   } = useSavedSetsCursor({ limit: 3 });
 * 
 *   return (
 *     <div>
 *       {savedSets.map(set => (
 *         <SavedSetCard key={set.id} savedSet={set} />
 *       ))}
 *       
 *       {hasMore && (
 *         <button onClick={loadMore} disabled={isLoadingMore}>
 *           {isLoadingMore ? '加载中...' : '加载更多'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CursorPaginationResponse } from '../types/pagination';

/**
 * 套装数据结构
 */
export interface SavedSetWithRelations {
  id: string;
  sessionId: string;
  name: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  dish: {
    id: string;
    name: string;
    description: string | null;
    cuisine: string;
    requiredIngredients: any[];
    cookingTime: number;
    difficulty: number;
    steps: any[];
    source: string | null;
    tags: any;
  };
  recipes: Array<{
    id: string;
    name: string;
    description: string | null;
    ingredients: any[];
    steps: any[];
    difficulty: number;
    estimatedTime: number;
    category: string | null;
    glassType: string | null;
    technique: string | null;
    garnish: string | null;
  }>;
}

/**
 * API 响应结构
 */
interface SavedSetsResponse {
  success: boolean;
  savedSets: SavedSetWithRelations[];
  pagination: CursorPaginationResponse<string>;
  error?: string;
}

/**
 * Hook 参数
 */
interface UseSavedSetsCursorOptions {
  /** 每次加载的数量（默认3） */
  limit?: number;
  /** 是否自动加载第一页（默认true） */
  autoLoad?: boolean;
}

/**
 * Hook 返回值
 */
interface UseSavedSetsCursorReturn {
  /** 套装列表（累积所有已加载的数据） */
  savedSets: SavedSetWithRelations[];
  /** 是否正在加载第一页 */
  isLoading: boolean;
  /** 是否正在加载更多 */
  isLoadingMore: boolean;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 错误信息 */
  error: string | null;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 刷新列表（重新加载第一页） */
  refresh: () => Promise<void>;
  /** 清空列表 */
  clear: () => void;
}

/**
 * 套装列表 Hook（游标分页）
 * 
 * @param options - 配置选项
 * @returns Hook 返回值
 */
export function useSavedSetsCursor(
  options: UseSavedSetsCursorOptions = {}
): UseSavedSetsCursorReturn {
  const { limit = 3, autoLoad = true } = options;

  // 状态管理
  const [savedSets, setSavedSets] = useState<SavedSetWithRelations[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载数据的通用函数
   * 
   * @param cursor - 游标（null 表示加载第一页）
   * @param append - 是否追加到现有数据（true）或替换（false）
   */
  const loadData = useCallback(
    async (cursor: string | null, append: boolean) => {
      try {
        // 设置加载状态
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        // 构建 URL
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) {
          params.set('cursor', cursor);
        }

        console.log(`📦 [游标分页] 加载套装列表，cursor: ${cursor ? '存在' : '无'}, append: ${append}`);

        // 发起请求
        const response = await fetch(`/api/saved-sets-cursor?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        const data: SavedSetsResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || '加载失败');
        }

        console.log(`✅ [游标分页] 加载成功，返回 ${data.savedSets.length} 个套装，hasMore: ${data.pagination.hasMore}`);

        // 更新状态
        if (append) {
          // 追加模式：将新数据添加到现有数据后面
          setSavedSets((prev) => [...prev, ...data.savedSets]);
        } else {
          // 替换模式：用新数据替换现有数据
          setSavedSets(data.savedSets);
        }

        setNextCursor(data.pagination.nextCursor);
        setHasMore(data.pagination.hasMore);

      } catch (err) {
        console.error('❌ [游标分页] 加载失败:', err);
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [limit]
  );

  /**
   * 加载第一页
   */
  const loadFirstPage = useCallback(async () => {
    await loadData(null, false);
  }, [loadData]);

  /**
   * 加载更多（下一页）
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      console.log(`⚠️ [游标分页] 无法加载更多，hasMore: ${hasMore}, isLoadingMore: ${isLoadingMore}`);
      return;
    }

    if (!nextCursor) {
      console.warn('⚠️ [游标分页] nextCursor 为空，无法加载更多');
      return;
    }

    await loadData(nextCursor, true);
  }, [hasMore, isLoadingMore, nextCursor, loadData]);

  /**
   * 刷新列表
   */
  const refresh = useCallback(async () => {
    console.log('🔄 [游标分页] 刷新套装列表');
    await loadFirstPage();
  }, [loadFirstPage]);

  /**
   * 清空列表
   */
  const clear = useCallback(() => {
    console.log('🗑️ [游标分页] 清空套装列表');
    setSavedSets([]);
    setNextCursor(null);
    setHasMore(true);
    setError(null);
  }, []);

  /**
   * 自动加载第一页
   */
  useEffect(() => {
    if (autoLoad) {
      loadFirstPage();
    }
  }, [autoLoad, loadFirstPage]);

  return {
    savedSets,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    clear,
  };
}
