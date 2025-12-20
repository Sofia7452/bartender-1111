import { useState, useCallback } from 'react';

interface Recipe {
  id?: string;
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  difficulty: number;
  estimatedTime: number;
}

interface UseStreamingRecommendationOptions {
  onComplete?: (recommendations: Recipe[]) => void;
  onError?: (error: string) => void;
  onChunk?: (chunk: string) => void;
}

export function useStreamingRecommendation(options: UseStreamingRecommendationOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const startStreaming = useCallback(async (ingredients: string[]) => {
    if (ingredients.length === 0) {
      setError('请至少输入一个原料');
      return;
    }

    setIsStreaming(true);
    setStreamedContent('');
    setRecommendations([]);
    setError(null);
    setProgress(0);

    try {
      const response = await fetch('/api/recommend/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredients }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';
      let totalChunks = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ 流式传输完成');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 处理 Server-Sent Events 格式
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 移除 "data: " 前缀

            if (data === '[DONE]') {
              console.log('🎉 接收到完成信号');
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                setError(parsed.error);
                options.onError?.(parsed.error);
                continue;
              }

              if (parsed.chunk) {
                totalChunks++;
                setStreamedContent((prev) => {
                  const newContent = prev + parsed.chunk;
                  options.onChunk?.(parsed.chunk);

                  // 尝试实时解析 JSON
                  try {
                    const jsonMatch = newContent.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                      const parsedRecommendations = JSON.parse(jsonMatch[0]);
                      if (Array.isArray(parsedRecommendations)) {
                        setRecommendations(parsedRecommendations);
                        // 根据解析进度更新进度条
                        setProgress(Math.min(95, (parsedRecommendations.length / 3) * 100));
                      }
                    }
                  } catch (e) {
                    // 解析失败是正常的，因为内容可能还不完整
                  }

                  return newContent;
                });
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e);
            }
          }
        }
      }

      // 流式传输完成后，最终解析
      setProgress(100);
      const finalContent = streamedContent;
      
      try {
        const jsonMatch = finalContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const finalRecommendations = JSON.parse(jsonMatch[0]);
          setRecommendations(finalRecommendations);
          options.onComplete?.(finalRecommendations);
        }
      } catch (e) {
        console.error('最终解析失败:', e);
        setError('解析推荐结果失败');
        options.onError?.('解析推荐结果失败');
      }

    } catch (err) {
      console.error('流式推荐失败:', err);
      const errorMessage = err instanceof Error ? err.message : '网络错误，请检查连接';
      setError(errorMessage);
      options.onError?.(errorMessage);
    } finally {
      setIsStreaming(false);
    }
  }, [streamedContent, options]);

  const reset = useCallback(() => {
    setIsStreaming(false);
    setStreamedContent('');
    setRecommendations([]);
    setError(null);
    setProgress(0);
  }, []);

  return {
    isStreaming,
    streamedContent,
    recommendations,
    error,
    progress,
    startStreaming,
    reset,
  };
}
