/**
 * Example usage of useFavorites hook
 * 
 * This file demonstrates how to use the useFavorites hook in a React component
 */

import { useFavorites } from '../../app/hooks/useFavorites';

export function FavoritesExample() {
  // Basic usage with default options
  const {
    favorites,
    loading,
    error,
    pagination,
    refetch,
    loadMore,
    hasMore,
  } = useFavorites();

  // Custom usage with options
  const customHook = useFavorites({
    page: 1,
    limit: 10,
    enabled: true, // Auto-load on mount
  });

  if (loading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return (
      <div>
        <p>错误: {error}</p>
        <button onClick={refetch}>重试</button>
      </div>
    );
  }

  return (
    <div>
      <h2>我的收藏 ({pagination?.total || 0})</h2>
      
      {/* Display favorites */}
      <div>
        {favorites.map((favorite) => (
          <div key={favorite.id}>
            <h3>{favorite.recipe?.name}</h3>
            <p>{favorite.recipe?.description}</p>
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? '加载中...' : '加载更多'}
        </button>
      )}

      {/* Pagination info */}
      {pagination && (
        <div>
          第 {pagination.page} 页，共 {pagination.pages} 页
        </div>
      )}
    </div>
  );
}

/**
 * Example: Disabled auto-load
 * Useful when you want to manually trigger the load
 */
export function ManualLoadExample() {
  const { favorites, loading, refetch } = useFavorites({
    enabled: false, // Don't auto-load
  });

  return (
    <div>
      <button onClick={refetch}>加载收藏</button>
      {loading && <p>加载中...</p>}
      {favorites.length > 0 && (
        <div>
          {favorites.map((fav) => (
            <div key={fav.id}>{fav.recipe?.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Example: Infinite scroll
 */
export function InfiniteScrollExample() {
  const { favorites, loading, loadMore, hasMore } = useFavorites({
    limit: 10,
  });

  // In a real app, you'd use IntersectionObserver or a library like react-infinite-scroll-component
  const handleScroll = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  return (
    <div onScroll={handleScroll}>
      {favorites.map((fav) => (
        <div key={fav.id}>{fav.recipe?.name}</div>
      ))}
      {loading && <p>加载更多...</p>}
      {!hasMore && <p>没有更多了</p>}
    </div>
  );
}
