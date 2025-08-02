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
    discussionTopic: string
  ): Promise<string> {
    if (!isModelLoaded) throw new Error('モデルがロードされていません');
    setIsGenerating(true);
    try {
      return await invoke<string>('generate_ai_response', {
        participantName: name,
        role,
        description,
        conversationHistory: conversationHistory,
        discussionTopic: discussionTopic,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError({ message });
      throw new Error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function startDiscussion(
    topic: string,
    participants: string[]
  ): Promise<string> {
    if (!isModelLoaded) throw new Error('モデルがロードされていません');
    setIsGenerating(true);
    try {
      return await invoke<string>('start_discussion', {
        topic,
        participants,
      });
    } catch (err) {
      console.error('議論開始エラー:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }

  async function summarizeDiscussion(
    discussionTopic: string,
    conversationHistory: string,
    participants: string[]
  ): Promise<string> {
    if (!isModelLoaded) throw new Error('モデルがロードされていません');
    setIsGenerating(true);
    try {
      return await invoke<string>('summarize_discussion', {
        discussionTopic: discussionTopic,
        conversationHistory: conversationHistory,
        participants,
      });
    } catch (err) {
      console.error('要約エラー:', err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }

  async function analyzeDiscussionPoints(
    discussionTopic: string,
    conversationHistory: string,
    participants: string[]
  ): Promise<string> {
    if (!isModelLoaded) throw new Error('モデルがロードされていません');
    setIsGenerating(true);
    try {
      return await invoke<string>('analyze_discussion_points', {
        discussionTopic: discussionTopic,
        conversationHistory: conversationHistory,
        participants,
      });
    } catch (err) {
      console.error('議論分析エラー:', err);
      throw err;
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
    startDiscussion,
    summarizeDiscussion,
    analyzeDiscussionPoints,
  };
}
