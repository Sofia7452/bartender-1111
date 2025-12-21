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
 * Favorite item interface matching the API response
 */
export interface FavoriteItem {
  id: string;
  sessionId: string;
  recipeId: string;
  createdAt: string;
  recipe: Recipe | null;
}

/**
 * Pagination information from API
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * API response structure for favorites
 */
interface FavoritesResponse {
  success: boolean;
  favorites?: FavoriteItem[];
  pagination?: PaginationInfo;
  error?: string;
  details?: string;
}

/**
 * Options for useFavorites hook
 */
export interface UseFavoritesOptions {
  page?: number;
  limit?: number;
  enabled?: boolean; // Whether to auto-load on mount
}

/**
 * Return type for useFavorites hook
 */
export interface UseFavoritesReturn {
  favorites: FavoriteItem[];
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
 * Custom hook for managing favorites data with caching and pagination
 * 
 * Features:
 * - Client-side caching with session isolation
 * - Pagination and incremental loading
 * - Error handling and retry mechanism
 * - Loading states
 * 
 * @param options - Configuration options
 * @returns Favorites data and control methods
 */
export function useFavorites(options: UseFavoritesOptions = {}): UseFavoritesReturn {
  const {
    page: initialPage = 1,
    limit = 20,
    enabled = true,
  } = options;

  // State management
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  // Get cache instance
  const cache = getFavoritesCache();

  /**
   * Fetch favorites from API with caching
   */
  const fetchFavorites = useCallback(async (page: number, appendMode: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // Get sessionId from cookie
      const sessionId = getSessionIdFromCookie();

      // Check cache if sessionId exists
      if (sessionId) {
        const cacheKey = CACHE_KEYS.favorites(sessionId, page);
        const cachedData = cache.get<FavoritesResponse>(cacheKey, sessionId);

        if (cachedData && cachedData.success && cachedData.favorites && cachedData.pagination) {
          console.log(`[useFavorites] Cache hit for page ${page}`);
          
          if (appendMode) {
            setFavorites(prev => [...prev, ...cachedData.favorites!]);
          } else {
            setFavorites(cachedData.favorites);
          }
          setPagination(cachedData.pagination);
          setLoading(false);
          return;
        }
      }

      // Cache miss or no sessionId - fetch from API
      console.log(`[useFavorites] Cache miss for page ${page}, fetching from API`);
      
      const response = await fetch(`/api/favorites?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: FavoritesResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch favorites');
      }

      if (data.favorites && data.pagination) {
        // Update state
        if (appendMode) {
          setFavorites(prev => [...prev, ...data.favorites!]);
        } else {
          setFavorites(data.favorites);
        }
        setPagination(data.pagination);

        // Cache the response if we have sessionId
        // After first request, sessionId will be set in cookie by server
        const newSessionId = getSessionIdFromCookie();
        if (newSessionId) {
          const cacheKey = CACHE_KEYS.favorites(newSessionId, page);
          cache.set(cacheKey, data, newSessionId);
          console.log(`[useFavorites] Cached data for page ${page}`);
        }
      }
    } catch (err) {
      console.error('[useFavorites] Error fetching favorites:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch favorites';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [limit, cache]);

  /**
   * Refetch current page (useful after mutations)
   */
  const refetch = useCallback(async () => {
    await fetchFavorites(currentPage, false);
  }, [currentPage, fetchFavorites]);

  /**
   * Load more items (next page)
   */
  const loadMore = useCallback(async () => {
    if (!pagination || currentPage >= pagination.pages) {
      console.log('[useFavorites] No more pages to load');
      return;
    }

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await fetchFavorites(nextPage, true);
  }, [currentPage, pagination, fetchFavorites]);

  /**
   * Check if there are more pages to load
   */
  const hasMore = pagination ? currentPage < pagination.pages : false;

  /**
   * Initial load on mount (if enabled)
   */
  useEffect(() => {
    if (enabled) {
      fetchFavorites(initialPage, false);
    }
  }, [enabled, initialPage, fetchFavorites]);

  return {
    favorites,
    loading,
    error,
    pagination,
    refetch,
    loadMore,
    hasMore,
  };
}
