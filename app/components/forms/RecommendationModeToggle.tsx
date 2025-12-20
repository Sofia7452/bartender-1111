'use client';

import { Badge } from '../ui/Badge';

interface RecommendationModeToggleProps {
  mode: 'standard' | 'streaming';
  onChange: (mode: 'standard' | 'streaming') => void;
  disabled?: boolean;
}

export function RecommendationModeToggle({ 
  mode, 
  onChange, 
  disabled = false 
}: RecommendationModeToggleProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <span className="text-sm font-medium text-gray-700">推荐模式：</span>
      
      <div className="flex gap-2">
        <button
          onClick={() => onChange('standard')}
          disabled={disabled}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all
            ${mode === 'standard'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>标准模式</span>
          </div>
        </button>

        <button
          onClick={() => onChange('streaming')}
          disabled={disabled}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all
            ${mode === 'streaming'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>流式模式</span>
            <Badge variant="success" size="sm">新</Badge>
          </div>
        </button>
      </div>

      <div className="ml-auto">
        <div className="text-xs text-gray-500">
          {mode === 'standard' ? (
            <span>一次性返回完整结果</span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              实时流式展示
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
