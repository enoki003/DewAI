import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 許可するモデル（バックエンドと整合）
const ALLOWED_PREFIXES = ['gemma3:1b', 'gemma3:4b'];
const isAllowedModel = (m: string) => ALLOWED_PREFIXES.some(p => m?.startsWith(p));

export const useAIModel = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemma3:4b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // モデル状態チェック
  const checkModelStatus = async (): Promise<boolean> => {
    try {
      const result = await invoke<boolean>('is_model_loaded');
      setIsModelLoaded(result);
      return result;
    } catch (error) {
      console.error('モデル状態チェックエラー:', error);
      setIsModelLoaded(false);
      return false;
    }
  };

  // 利用可能なモデル一覧
  const loadAvailableModels = async () => {
    try {
      const models = await invoke<string[]>('get_available_models');
      setAvailableModels(models);
    } catch (error) {
      console.error('モデル一覧取得エラー:', error);
      setAvailableModels(['gemma3:4b', 'gemma3:1b']);
    }
  };

  // 初期化
  useEffect(() => {
    checkModelStatus();
    loadAvailableModels();
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel && isAllowedModel(savedModel)) setSelectedModel(savedModel);
  }, []);

  // モデル変更
  const changeModel = (model: string) => {
    const next = isAllowedModel(model) ? model : 'gemma3:4b';
    setSelectedModel(next);
    localStorage.setItem('selectedModel', next);
  };

  // 選択モデルでテキスト生成
  const generateTextWithModel = async (prompt: string, model?: string): Promise<string> => {
    const modelToUse = model || selectedModel;
    try {
      const res = await invoke<string>('generate_text_with_model', { prompt, model: modelToUse });
      return res;
    } catch (error) {
      console.error('テキスト生成エラー:', error);
      throw error;
    }
  };

  // 互換API
  const generateText = async (prompt: string): Promise<string> => generateTextWithModel(prompt, selectedModel);

  const testGenerateText = async (): Promise<string> => {
    try {
      const res = await invoke<string>('test_generate_text');
      return res;
    } catch (error) {
      console.error('テストエラー:', error);
      throw error;
    }
  };

  // 応答生成
  const generateAIResponse = async (
    participantName: string,
    role: string,
    description: string,
    conversationHistory: string,
    discussionTopic: string
  ): Promise<string> => {
    try {
      const res = await invoke<string>('generate_ai_response', {
        participantName,
        role,
        description,
        conversationHistory,
        discussionTopic,
        model: selectedModel,
      });
      return res;
    } catch (error) {
      console.error('応答生成エラー:', error);
      throw error;
    }
  };

  const summarizeDiscussion = async (
    discussionTopic: string,
    conversationHistory: string,
    participants: string[]
  ): Promise<string> => {
    try {
      const res = await invoke<string>('summarize_discussion', {
        discussionTopic,
        conversationHistory,
        participants,
        model: selectedModel,
      });
      return res;
    } catch (error) {
      console.error('要約エラー:', error);
      throw error;
    }
  };

  const analyzeDiscussionPoints = async (
    discussionTopic: string,
    conversationHistory: string,
    participants: string[]
  ): Promise<string> => {
    try {
      const res = await invoke<string>('analyze_discussion_points', {
        discussionTopic,
        conversationHistory,
        participants,
        model: selectedModel,
      });
      return res;
    } catch (error) {
      console.error('分析エラー:', error);
      throw error;
    }
  };

  return {
    isModelLoaded,
    selectedModel,
    availableModels,
    checkModelStatus,
    loadAvailableModels,
    changeModel,
    generateText,
    generateTextWithModel,
    testGenerateText,
    generateAIResponse,
    summarizeDiscussion,
    analyzeDiscussionPoints,
  };
};
