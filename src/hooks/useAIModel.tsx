import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface AIModel {
  name: string;
  displayName: string;
}

export const useAIModel = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemma3:4b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // モデル状態をチェック
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

  // 利用可能なモデル一覧を取得
  const loadAvailableModels = async () => {
    try {
      const models = await invoke<string[]>('get_available_models');
      setAvailableModels(models);
      console.log('利用可能なモデル:', models);
    } catch (error) {
      console.error('モデル一覧取得エラー:', error);
      // エラーの場合はデフォルトモデルを設定
      setAvailableModels(['gemma3:4b', 'gemma3:1b']);
    }
  };

  // 初期化時にモデル状態と利用可能モデルをチェック
  useEffect(() => {
    checkModelStatus();
    loadAvailableModels();
    
    // localStorageから前回選択したモデルを復元
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel && (savedModel.includes('gemma3:1b') || savedModel.includes('gemma3:4b'))) {
      setSelectedModel(savedModel);
    }
  }, []);

  // モデル変更時にlocalStorageに保存
  const changeModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('selectedModel', model);
    console.log('モデル変更:', model);
  };

  // 選択されたモデルでテキスト生成
  const generateTextWithModel = async (prompt: string, model?: string): Promise<string> => {
    const modelToUse = model || selectedModel;
    console.log('テキスト生成開始:', { prompt: prompt.substring(0, 50) + '...', model: modelToUse });
    
    try {
      const res = await invoke<string>('generate_text_with_model', { 
        prompt, 
        model: modelToUse 
      });
      console.log('テキスト生成成功');
      return res;
    } catch (error) {
      console.error('テキスト生成エラー:', error);
      throw error;
    }
  };

  // 従来のgenerateText（後方互換性のため）
  const generateText = async (prompt: string): Promise<string> => {
    return generateTextWithModel(prompt, selectedModel);
  };

  const testGenerateText = async (): Promise<string> => {
    try {
      const res = await invoke<string>('test_generate_text');
      console.log('テスト成功:', res);
      return res;
    } catch (error) {
      console.error('テストエラー:', error);
      throw error;
    }
  };

  // AI応答生成（モデル選択対応）
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
        discussionTopic
      });
      return res;
    } catch (error) {
      console.error('AI応答生成エラー:', error);
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
        discussion_topic: discussionTopic,
        conversation_history: conversationHistory,
        participants
      });
      return res;
    } catch (error) {
      console.error('議論要約エラー:', error);
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
        discussion_topic: discussionTopic,
        conversation_history: conversationHistory,
        participants
      });
      return res;
    } catch (error) {
      console.error('議論分析エラー:', error);
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
    analyzeDiscussionPoints
  };
};
