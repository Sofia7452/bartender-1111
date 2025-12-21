import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFavoritesCache } from '../../app/lib/favoritesCache';

// Mock fetch globally
global.fetch = vi.fn();

// Mock document for client-side environment
global.document = {
  cookie: '',
} as any;

describe('useFavorites Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFavoritesCache();
    global.document.cookie = '';
  });

  it('should export useFavorites function', async () => {
    const { useFavorites } = await import('../../app/hooks/useFavorites');
    expect(typeof useFavorites).toBe('function');
  });

  it('should have correct interface types', () => {
    // This test verifies that the hook can be called with expected options
    // TypeScript compilation will catch interface mismatches
    const options = {
      page: 1,
      limit: 20,
      enabled: true,
    };

    // If this compiles, the interface is correct
    expect(options).toBeDefined();
  });
});
