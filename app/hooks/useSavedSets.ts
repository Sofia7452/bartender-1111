import { useState, useEffect, useCallback } from 'react';
import { getFavoritesCache, CACHE_KEYS } from '../lib/favoritesCache';

/**
 * Recipe interface matching the API response
 */
interface Recipe {
  id: string;
  name: string;
  description: string | null;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
  category?: string | null;
  glassType?: string | null;
  technique?: string | null;
  garnish?: string | null;
}

/**
 * Dish interface matching the API response
 */
interface Dish {
  id: string;
  name: string;
  description: string | null;
  cuisine: string;
  requiredIngredients: string[];
  cookingTime: number;
  difficulty: number;
  steps: string[];
  source: string | null;
  tags: string[];
}

/**
 * SavedSet item interface matching the API response
 */
export interface SavedSetItem {
  id: string;
  sessionId: string;
  name: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  dish: Dish;
  recipes: Recipe[];
}

/**
 * Pagination information from API
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * API response structure for saved sets
 */
interface SavedSetsResponse {
  success: boolean;
  savedSets?: SavedSetItem[];
  pagination?: PaginationInfo;
  error?: string;
  details?: string;
}

/**
 * Options for useSavedSets hook
 */
export interface UseSavedSetsOptions {
  page?: number;
  limit?: number;
  enabled?: boolean; // Whether to auto-load on mount
}

/**
 * Return type for useSavedSets hook
 */
export interface UseSavedSetsReturn {
  savedSets: SavedSetItem[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Get sessionId from cookie on client side
 * Returns null if cookie doesn't exist (server will generate one)
 */
function getSessionIdFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'session_id') {
      return value;
    }
  }
  return null;
}

/**
 * Custom hook for managing saved sets data with caching and pagination
 * 
 * Features:
 * - Client-side caching with session isolation
 * - Pagination and incremental loading
 * - Error handling and retry mechanism
 * - Loading states
 * 
 * @param options - Configuration options
 * @returns Saved sets data and control methods
 */
export function useSavedSets(options: UseSavedSetsOptions = {}): UseSavedSetsReturn {
  const {
    page: initialPage = 1,
    limit = 20,
    enabled = true,
  } = options;

  // State management
  const [savedSets, setSavedSets] = useState<SavedSetItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  // Get cache instance
  const cache = getFavoritesCache();

  /**
   * Fetch saved sets from API with caching
   */
  const fetchSavedSets = useCallback(async (page: number, appendMode: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // Get sessionId from cookie
      const sessionId = getSessionIdFromCookie();

      // Check cache if sessionId exists
      if (sessionId) {
        const cacheKey = CACHE_KEYS.savedSets(sessionId, page);
        const cachedData = cache.get<SavedSetsResponse>(cacheKey, sessionId);

        if (cachedData && cachedData.success && cachedData.savedSets && cachedData.pagination) {
          console.log(`[useSavedSets] Cache hit for page ${page}`);
          
          if (appendMode) {
            setSavedSets(prev => [...prev, ...cachedData.savedSets!]);
          } else {
            setSavedSets(cachedData.savedSets);
          }
          setPagination(cachedData.pagination);
          setLoading(false);
          return;
        }
      }

      // Cache miss or no sessionId - fetch from API
      console.log(`[useSavedSets] Cache miss for page ${page}, fetching from API`);
      
      const response = await fetch(`/api/saved-sets?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SavedSetsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch saved sets');
      }

      if (data.savedSets && data.pagination) {
        // Update state
        if (appendMode) {
          setSavedSets(prev => [...prev, ...data.savedSets!]);
        } else {
          setSavedSets(data.savedSets);
        }
        setPagination(data.pagination);

        // Cache the response if we have sessionId
        // After first request, sessionId will be set in cookie by server
        const newSessionId = getSessionIdFromCookie();
        if (newSessionId) {
          const cacheKey = CACHE_KEYS.savedSets(newSessionId, page);
          cache.set(cacheKey, data, newSessionId);
          console.log(`[useSavedSets] Cached data for page ${page}`);
        }
      }
    } catch (err) {
      console.error('[useSavedSets] Error fetching saved sets:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch saved sets';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [limit, cache]);

  /**
   * Refetch current page (useful after mutations)
   */
  const refetch = useCallback(async () => {
    await fetchSavedSets(currentPage, false);
  }, [currentPage, fetchSavedSets]);

  /**
   * Load more items (next page)
   */
  const loadMore = useCallback(async () => {
    if (!pagination || currentPage >= pagination.totalPages) {
      console.log('[useSavedSets] No more pages to load');
      return;
    }

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await fetchSavedSets(nextPage, true);
  }, [currentPage, pagination, fetchSavedSets]);

  /**
   * Check if there are more pages to load
   */
  const hasMore = pagination ? currentPage < pagination.totalPages : false;

  /**
   * Initial load on mount (if enabled)
   */
  useEffect(() => {
    if (enabled) {
      fetchSavedSets(initialPage, false);
    }
  }, [enabled, initialPage, fetchSavedSets]);

  return {
    savedSets,
    loading,
    error,
    pagination,
    refetch,
    loadMore,
    hasMore,
  };
}
