import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface IngredientInputProps {
  value: string[];
  onChange: (ingredients: string[]) => void;
  placeholder?: string;
  maxIngredients?: number;
  className?: string;
}

export const IngredientInput: React.FC<IngredientInputProps> = ({
  value = [],
  onChange,
  placeholder = '输入原料名称，按回车添加',
  maxIngredients = 10,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddIngredient = () => {
    const ingredient = inputValue.trim();
    if (ingredient && !value.includes(ingredient) && value.length < maxIngredients) {
      onChange([...value, ingredient]);
      setInputValue('');
    }
  };

  const handleRemoveIngredient = (index: number) => {
    const newIngredients = value.filter((_, i) => i !== index);
    onChange(newIngredients);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddIngredient();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 输入框 */}
      <div className="flex space-x-2">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1"
          disabled={value.length >= maxIngredients}
        />
        <Button
          onClick={handleAddIngredient}
          disabled={!inputValue.trim() || value.includes(inputValue.trim()) || value.length >= maxIngredients}
          size="md"
        >
          添加
        </Button>
      </div>

      {/* 已添加的原料 */}
      {value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              已添加原料 ({value.length}/{maxIngredients})
            </span>
            {value.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="text-red-600 hover:text-red-700"
              >
                清空
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {value.map((ingredient, index) => (
              <Badge
                key={index}
                variant="default"
                className="flex items-center space-x-1"
              >
                <span>{ingredient}</span>
                <button
                  onClick={() => handleRemoveIngredient(index)}
                  className="ml-1 hover:text-red-600 transition-colors"
                  aria-label={`移除 ${ingredient}`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {value.length >= maxIngredients && (
        <p className="text-sm text-amber-600">
          最多只能添加 {maxIngredients} 种原料
        </p>
      )}
    </div>
  );
};
