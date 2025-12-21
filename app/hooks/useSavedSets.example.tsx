/**
 * Example usage of useSavedSets hook
 * 
 * This file demonstrates how to use the useSavedSets hook
 * in a React component for managing saved sets data.
 */

import React from 'react';
import { useSavedSets } from './useSavedSets';

/**
 * Example component showing basic usage
 */
export function SavedSetsListExample() {
  const {
    savedSets,
    loading,
    error,
    pagination,
    refetch,
    loadMore,
    hasMore,
  } = useSavedSets({
    page: 1,
    limit: 10,
    enabled: true,
  });

  if (loading && savedSets.length === 0) {
    return <div>Loading saved sets...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Saved Sets ({pagination?.total || 0})</h2>
      
      <div>
        {savedSets.map((savedSet) => (
          <div key={savedSet.id}>
            <h3>{savedSet.name || 'Unnamed Set'}</h3>
            <p>{savedSet.description}</p>
            <div>
              <strong>Dish:</strong> {savedSet.dish.name}
            </div>
            <div>
              <strong>Recipes:</strong> {savedSet.recipes.length}
              <ul>
                {savedSet.recipes.map((recipe) => (
                  <li key={recipe.id}>{recipe.name}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}

      {pagination && (
        <div>
          Page {pagination.page} of {pagination.totalPages}
        </div>
      )}
    </div>
  );
}

/**
 * Example component showing manual control
 */
export function SavedSetsManualExample() {
  const {
    savedSets,
    loading,
    error,
    refetch,
  } = useSavedSets({
    enabled: false, // Don't auto-load
  });

  return (
    <div>
      <button onClick={refetch} disabled={loading}>
        {loading ? 'Loading...' : 'Load Saved Sets'}
      </button>

      {error && <p>Error: {error}</p>}

      {savedSets.length > 0 && (
        <div>
          <h3>Found {savedSets.length} saved sets</h3>
          {/* Render saved sets */}
        </div>
      )}
    </div>
  );
}

/**
 * Example component showing cache behavior
 */
export function SavedSetsCacheExample() {
  const [showSets, setShowSets] = React.useState(true);

  return (
    <div>
      <button onClick={() => setShowSets(!showSets)}>
        Toggle Saved Sets
      </button>

      {showSets && <SavedSetsListExample />}
      
      <p>
        Note: When you toggle off and on, the data should load from cache
        instantly if within the 5-minute TTL window.
      </p>
    </div>
  );
}
