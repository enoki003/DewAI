import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { jsonrepair } from 'jsonrepair';

/**
 * 許可するOllamaモデルの接頭辞一覧。
 * Gemma3 1B/4BのみをUI上で選択可能にします。
 * @internal
 */
const ALLOWED_PREFIXES = ['gemma3:1b', 'gemma3:4b'];
const isAllowedModel = (m: string) => ALLOWED_PREFIXES.some(p => m?.startsWith(p));

/**
 * DewAI のAI操作をまとめたカスタムフック。
 * - モデル状態確認/切替
 * - 参加者応答生成
 * - 議論の要約（フル/インクリメンタル）
 * - 議論分析
 */
export const useAIModel = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemma3:4b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  /**
   * Ollamaに接続できているかを確認します。
   * @returns 接続可否
   */
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

  /**
   * Ollamaから利用可能なモデル一覧を取得します。
   */
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

  /**
   * 使用するモデルを切り替えます。許可外の場合は既定の gemma3:4b になります。
   */
  const changeModel = (model: string) => {
    const next = isAllowedModel(model) ? model : 'gemma3:4b';
    setSelectedModel(next);
    localStorage.setItem('selectedModel', next);
  };

  /**
   * 明示したモデルでテキスト生成を行います。
   * @param prompt プロンプト
   * @param model 使用するモデル（未指定時は選択中のモデル）
   */
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

  /**
   * 選択中モデルでテキスト生成を行います。
   */
  const generateText = async (prompt: string): Promise<string> => generateTextWithModel(prompt, selectedModel);

  /** Tauriバックエンドの疎通確認用メソッド。 */
  const testGenerateText = async (): Promise<string> => {
    try {
      const res = await invoke<string>('test_generate_text');
      return res;
    } catch (error) {
      console.error('テストエラー:', error);
      throw error;
    }
  };

  /**
   * 1人のAI参加者の応答を生成します。
   */
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

  /**
   * 議論全体の要約を生成します（初回フル）。
   */
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

  /**
   * 直近の追加発言のみを反映したインクリメンタル要約を生成します。
   */
  const incrementalSummarizeDiscussion = async (
    discussionTopic: string,
    previousSummary: string,
    newMessages: string,
    participants: string[]
  ): Promise<string> => {
    try {
      const res = await invoke<string>('incremental_summarize_discussion', {
        discussionTopic,
        previousSummary,
        newMessages,
        participants,
        model: selectedModel,
      });
      return res;
    } catch (error) {
      console.error('インクリメンタル要約エラー:', error);
      throw error;
    }
  };

  /**
   * 論点や立場など、議論の分析情報（JSON文字列）を生成します。
   */
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

  /**
   * 指定テーマに適したAI参加者プロフィール案を生成します。
   * @param discussionTopic テーマ
   * @param desiredCount 生成数（既定: 4）
   * @param styleHint 文体・役割のヒント
   */
  const generateAIProfiles = async (
    discussionTopic: string,
    desiredCount = 4,
    styleHint = ''
  ): Promise<Array<{ name: string; role: string; description: string }>> => {
    try {
      const raw = await invoke<string>('generate_ai_profiles', {
        discussionTopic,
        desiredCount,
        styleHint,
        model: selectedModel,
      });
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

      // まずは素直に JSON.parse、失敗したら jsonrepair で修復して再パース
      try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw new Error('JSONが配列ではありません');
        return parsed
          .filter((p: any) => p && typeof p.name === 'string')
          .map((p: any) => ({
            name: String(p.name).trim(),
            role: String(p.role || '').trim(),
            description: String(p.description || '').trim(),
          }));
      } catch (parseErr) {
        const repaired = jsonrepair(cleaned);
        const parsed2 = JSON.parse(repaired);
        if (!Array.isArray(parsed2)) throw new Error('JSONが配列ではありません');
        return parsed2
          .filter((p: any) => p && typeof p.name === 'string')
          .map((p: any) => ({
            name: String(p.name).trim(),
            role: String(p.role || '').trim(),
            description: String(p.description || '').trim(),
          }));
      }
    } catch (error) {
      console.error('AIプロフィール生成エラー:', error);
      throw error;
    }
  };

  return {
    /** モデル接続状態 */
    isModelLoaded,
    /** 現在選択中のモデル */
    selectedModel,
    /** 利用可能モデル一覧 */
    availableModels,
    checkModelStatus,
    loadAvailableModels,
    changeModel,
    generateText,
    generateTextWithModel,
    testGenerateText,
    generateAIResponse,
    summarizeDiscussion,
    incrementalSummarizeDiscussion,
    analyzeDiscussionPoints,
    generateAIProfiles,
  };
};
