import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AIModelError {
  message: string;
}

export function useAIModel() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<AIModelError | null>(null);

  useEffect(() => {
    const checkModelStatus = async () => {
      try {
        const loaded = await invoke<boolean>('is_model_loaded');
        setIsModelLoaded(loaded);
        if (!loaded) {
          setTimeout(checkModelStatus, 2000);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError({ message });
      }
    };
    checkModelStatus();
  }, []);

  async function generateText(prompt: string): Promise<string> {
    try {
      const res = await invoke<string>('generate_text', { prompt });
      return res;
    } catch (err) {
      console.error('エラー:', err);
      return 'エラーが発生しました。';
    }
  }

  async function generateAIResponse(
    name: string,
    role: string,
    description: string,
    conversationHistory: string,
    query: string
  ): Promise<string> {
    if (!isModelLoaded) throw new Error('モデルがロードされていません');
    setIsGenerating(true);
    try {
      return await invoke<string>('generate_ai_response', {
        name,
        role,
        description,
        conversationHistory,
        query,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError({ message });
      throw new Error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return {
    isModelLoaded,
    isGenerating,
    error,
    generateText,
    generateAIResponse,
  };
}
