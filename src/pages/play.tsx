/**
 * @packageDocumentation
 * Playページ（議論実行画面）。
 *
 * 本ページは、設定済みの参加者（AI/ユーザー）での議論を進行し、
 * - AI応答生成（ローカルOllama経由）
 * - 定期的な要約（フル/インクリメンタル）
 * - 3ターン毎の自動分析（論点・立場・対立・合意・未踏領域）
 * - セッションの自動保存/復元
 * - 自動スクロールとスクロール検知
 * を行います。
 *
 * 技術スタック:
 * - フロントエンド: React + TypeScript + Chakra UI v3
 * - ルーティング: HashRouter
 * - AI通信: `useAIModel` フック（Tauri 経由で Rust → Ollama）
 * - ストレージ: SQLite（`utils/database.ts` 経由）
 *
 * 重要な状態と概念:
 * - `turnIndex`: 現在のターン（0=ユーザー、1..=AI参加者のインデックス+1）
 * - `messages`: 発言履歴（末尾が最新）
 * - `historySummary`: 要約済みテキスト（長大履歴の短縮に利用）
 * - `turnCount`: ユーザー/AI問わず発言が追加されるたびに +1（分析トリガーに利用）
 * - `awaitingAIResume`: 復元直後などに次のAI応答を継続する必要があるときに真
 * - `isSavingSession`: セッション保存バリア。保存中は最新版スナップショットをキューして保存完了後に再保存
 *
 * 自動要約戦略:
 * - 初回は発言が一定数以上（既定:12）溜まったときにフル要約
 * - 以後は差分の発言数が閾値（既定:4）を超えたときにインクリメンタル要約
 *
 * 自動分析戦略:
 * - `turnCount` が 3 の倍数になったタイミングで分析を実行
 *
 * 例:
 * ```tsx
 * // ルーティング
 * <Route path="/play" element={<PlayPage />} />
 * ```
 */

import React, { useState, useEffect, useRef, useCallback,useLayoutEffect } from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Button, 
  Text, 
  Textarea, 
  Spinner, 
  Badge,
  Stack,
} from '@chakra-ui/react';
import { useAIModel } from '../hooks/useAIModel';
import { useNavigate } from 'react-router-dom';
import { 
  showAIResponseError, 
  showAnalysisError,
  showAnalysisSuccess,
  showModelChangeNotice,
  showOllamaConnectionError,
  showInputTooLongWarning,
  showGenericError,
  showSessionResumeHint,
} from '../components/ui/notifications';
import { ChatMessage } from '../components/ui/chat-message';
import { saveSession, updateSession, getSessionById, saveSessionAnalysis, updateSessionLastOpened, updateSessionParticipants } from '../utils/database';
import { jsonrepair } from 'jsonrepair';
import { ParticipantEditorDrawer } from '../components/ParticipantEditorDrawer';
// 追加: 共通型と共通分析パネル
import { AnalysisPanel } from './play/AnalysisPanel';
import { BotProfile, DiscussionAnalysis, ScreenConfig, TalkMessage } from './play/PlayTypes';

const USER_SPEAKER = 'ユーザー' as const;

const CONFIG = {
  KEEP_RECENT_TURNS: 4, // 直近保持ターン数
  MIN_INITIAL_FULL_SUMMARIZE: 12, // 初回フル要約の最小発言数
  MIN_INCREMENTAL_SUMMARIZE: 4, // 差分要約の最小発言数
  ANALYSIS_TURN_INTERVAL: 3, // 分析実行間隔（ターン数）
  SCROLL_END_DEBOUNCE_MS: 150, // スクロール終了検知のデバウンス時間(ms)
  MAX_INPUT_LENGTH: 10000, // 入力欄の最大文字数
} as const

/**
 * 発言者と参加者構成に応じて、次のターンインデックスを計算する。
 * 0 = ユーザー, 1〜 = AIインデックス + 1
 */
const calculateNextTurn = (
  lastSpeaker: string,
  bots: BotProfile[],
  userParticipates: boolean
) : number => {
  const botCount = bots.length;
  const lastBotIndex = bots.findIndex(bot => bot.name === lastSpeaker);
  const lastSlot = lastSpeaker === USER_SPEAKER? 0 : (lastBotIndex >= 0 ? lastBotIndex + 1 : 1);

  if (userParticipates) {
    // ユーザー参加時はユーザーが0、AIが1〜
    return (lastSlot + 1) % (botCount + 1);
  } else {
    if(botCount === 0) return 0;
    const boundedSlot = Math.min(Math.max(1,lastSlot),botCount);
    return (boundedSlot % botCount) + 1;
  }
};


/**
 * 議論を実行するメインページコンポーネント。
 *
 * - セッションの開始/再開/保存を管理
 * - ユーザー入力とAIターンの進行を制御
 * - 要約と分析を自動的に実行
 * - スクロールやモバイル/デスクトップの分析表示を管理
 *
 * @returns JSX.Element
 */
const PlayPage: React.FC = () => {
  const navigate = useNavigate();// React Routerのナビゲーションフック
  // AIモデルフックから必要な関数を取得
  const { generateAIResponse, summarizeDiscussion, analyzeDiscussionPoints, isModelLoaded, selectedModel, changeModel, checkModelStatus, incrementalSummarizeDiscussion } = useAIModel();
  
  // 状態定義
  /** 現在の画面設定（議論テーマ/参加者/ユーザー参加可否） */
  const [config, setConfig] = useState<ScreenConfig | null>(null);
  /** 表示と保存対象のメッセージ履歴（末尾が最新） */
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  /** 入力欄のテキスト */
  const [inputText, setInputText] = useState('');
  /** AI応答生成中フラグ（多重実行の抑止） */
  const [isGenerating, setIsGenerating] = useState(false);
  /** 議論が開始されているか（開始前/進行中） */
  const [isActive, setIsActive] = useState(false);
  /** 現在のターン（0=ユーザー、1..=AIインデックス+1） */
const [turnIndex, setTurnIndex] = useState(0);

  // セッション保存関連
  /** 現在のセッションID（保存済みなら > 0） */
  const [sessionId, setSessionId] = useState<number | null>(null);
  /** 最新のセッションIDを参照するためのRef（非同期処理間の漏斗） */
  const sessionIdRef = useRef<number | null>(null);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  /** セッション復元モードか */
  const [isResumed, setIsResumed] = useState(false);
  /** 戻る遷移先（復元時は /sessions、通常は /start → 開始設定画面へ） */
  const [backPath, setBackPath] = useState<string>('/start');
  /** 復元直後にAIの続きを実行する必要があるか */
  const [awaitingAIResume, setAwaitingAIResume] = useState(false);
  /** 保存バリア（保存中は最新版スナップショットをキュー） */
  const [isSavingSession, setIsSavingSession] = useState(false);
  /** 再開ヒントトーストを一度だけ出す制御 */
  const resumeHintShownRef = useRef(false);

  // 要約・分析関連
  /** 長大履歴の要約文字列（プロンプト圧縮用） */
  const [historySummary, setHistorySummary] = useState<string>('');
  /** 要約した時点のメッセージ数（差分要約トリガーの基準） */
  const [lastSummarizedIndex, setLastSummarizedIndex] = useState<number>(0);
  /** 要約実行中フラグ */
  const [summarizing, setSummarizing] = useState(false);
  /** 分析実行中フラグ */
  const [analyzing, setAnalyzing] = useState(false);
  /** 最新の分析結果 */
  const [analysis, setAnalysis] = useState<DiscussionAnalysis | null>(null);
  /** 最後に分析を実行した時点のメッセージ数（開閉時の不要リクエスト抑止に使用） */
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState<number>(0);

  // UI
  /** 分析パネルの開閉状態 */
  const [analysisOpen, setAnalysisOpen] = useState(false);
  /** 参加者編集ドロワーの開閉状態 */
  const [editOpen, setEditOpen] = useState(false);
  /** 参加者編集ドロワーを開く */
  const openEditor = () => { if (!config) return; setEditOpen(true); };
  /** 参加者編集ドロワーを閉じる */
  const closeEditor = () => setEditOpen(false);

  // スクロール制御
  /** メッセージリストのスクロール要素参照 */
  const messageListRef = useRef<HTMLDivElement>(null);
  /** ユーザーがスクロール操作中か（UIのための状態） */
  const [, setUserScrolling] = useState(false);
  /** 新着時に自動で最下部へスクロールするか */
  const [autoScroll, setAutoScroll] = useState(true);
  /** スクロール終了検知用のタイマーID */
  const scrollTimerRef = useRef<number | null>(null);
  /** `autoScroll` の参照版（非同期境界での正確な判定のため） */
  const autoScrollRef = useRef(true);
  /** ユーザースクロール中フラグの参照版 */
  const userScrollingRef = useRef(false);

  /**
   * メッセージ末尾にスクロール。
   * 自動スクロールが有効かつユーザー操作中でない場合にのみ実行。
   */
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
  if(bottomRef.current){
    bottomRef.current.scrollIntoView({ block : 'end' });
  }

    const el = messageListRef.current;
    if (!el) return;
    if (autoScrollRef.current && !userScrollingRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, []);

  /**
   * メッセージリストのスクロールを監視し、
   * 末尾にいるかどうかで `autoScroll` を切り替えます。
   * スクロール終了はデバウンスで検知。
   */
  const handleScroll = useCallback(() => {
    if (!messageListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
    const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setAutoScroll(atBottom);
    autoScrollRef.current = atBottom;
    setUserScrolling(true);
    userScrollingRef.current = true;
    //　自動スクロールがオンかつユーザが操作中ではない
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      setUserScrolling(false);
      userScrollingRef.current = false;
    }, CONFIG.SCROLL_END_DEBOUNCE_MS);
  }, []);

  // メッセージ更新時スクロール
  useLayoutEffect(() => {
    if(messages.length === 0) return;
  const id = requestAnimationFrame(() => 
    requestAnimationFrame(() => scrollToBottom())
  );
    return () => cancelAnimationFrame(id);
  }, [messages,isGenerating,analysisOpen,scrollToBottom]);

  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (autoScrollRef.current && !userScrollingRef.current) {
        scrollToBottom();
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [scrollToBottom]);

  
  // 3ターン毎の自動分析（ユーザー/AI問わずカウント後に発火）

useEffect(() => {
  if (!config) return;
  const total = messages.length;
  if (total === 0) return;

  const parts = [ ...(config.participate ? [USER_SPEAKER] : []), ...config.aiData.map(a => a.name) ];

  const run = async () => {
    setSummarizing(true);
    try {
      if (!historySummary) {
        if (total >= CONFIG.MIN_INITIAL_FULL_SUMMARIZE) {
          const history = messages.map(m => `${m.speaker}: ${m.message}`).join('\n');
          const full = await summarizeDiscussion(config.discussionTopic, history, parts);
          setHistorySummary(full);
          setLastSummarizedIndex(total);
          if (sessionId && sessionId > 0) {
            await saveSessionAnalysis(sessionId, 'summary', JSON.stringify({ summary: full }));
          }
        }
      } else {
        const delta = total - lastSummarizedIndex;
        if (delta >= CONFIG.MIN_INCREMENTAL_SUMMARIZE) {
          const newSlice = messages.slice(lastSummarizedIndex).map(m => `${m.speaker}: ${m.message}`).join('\n');
          if (newSlice) {
            const updated = await incrementalSummarizeDiscussion(config.discussionTopic, historySummary, newSlice, parts);
            setHistorySummary(updated);
            setLastSummarizedIndex(total);
            if (sessionId && sessionId > 0) {
              await saveSessionAnalysis(sessionId, 'summary', JSON.stringify({ summary: updated, delta }));
            }
          }
        }
      }
    } catch (e) {
      console.error('[summary] failed:', e);
      showAnalysisError('議論要約', String(e));
    } finally {
      setSummarizing(false);
    }
  };

  run();
}, [config, messages, historySummary, lastSummarizedIndex, summarizeDiscussion, incrementalSummarizeDiscussion, saveSessionAnalysis, sessionId]);

  useEffect(() => {analyzeIfNeeded();}, [messages,config,lastAnalyzedCount]);
  


  // 初期化/復元
  useEffect(() => {
    /**
     * セッション復元フロー:
     * - localStorage の `resumeSession` を検査
     * - セッション/参加者/メッセージ/モデルを復元
     * - 復元後の次ターンと継続実行要否を決定
     * - `last_opened_at` を更新
     */
    const resumeData = localStorage.getItem('resumeSession');
    if (resumeData) {
      try {
        const parsed = JSON.parse(resumeData);
        if (parsed.isResume) {
          const load = async () => {
            try {
              console.log('[resume] 開始 id=', parsed.sessionId);
              const session = await getSessionById(parsed.sessionId);
              if (!session) throw new Error('セッションが見つかりません');

              // セッション状態
              setSessionId(parsed.sessionId);
              sessionIdRef.current = parsed.sessionId;
              setIsResumed(true);

              // 参加者復元
              const participantsObj = JSON.parse(session.participants);
              if (!participantsObj || !Array.isArray(participantsObj.aiData)) {
                throw new Error('participantsフォーマットが不正です');
              }
              const bots: BotProfile[] = participantsObj.aiData;
              const userParticipatesFlag:boolean = Boolean(participantsObj.userParticipates);// ユーザー参加フラグ
              setConfig({ discussionTopic: session.topic, aiData: bots, participate: userParticipatesFlag });

              // 使用モデル復元
              // 条件式： モデルを持つ(session) ∧ (session.model ≠ 選択中モデル)
              if (session.model && session.model !== selectedModel) {
                changeModel(session.model);
                showModelChangeNotice(session.model);
              }

              // メッセージ復元
              const saved: TalkMessage[] = JSON.parse(session.messages).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
              setMessages(saved);

              // モデル状態確認→議論状態
              const ok = await checkModelStatus();
              if (ok) {
                setIsActive(true);
                if (!resumeHintShownRef.current) {
                  showSessionResumeHint();
                  resumeHintShownRef.current = true;
                }
              } else {
                showOllamaConnectionError();
              }

              // 最近開いたセッションを更新
              try { await updateSessionLastOpened(parsed.sessionId); } catch (e) { console.warn('[resume] last_opened_at 更新失敗:', e); }

              // 発言者の決定
                const botCount = bots.length;

                if (saved.length === 0) {
                const initialTurnIndex = userParticipatesFlag ? 0 : (botCount > 0 ? 1 : 0);
                setTurnIndex(initialTurnIndex);
                if (initialTurnIndex > 0) setAwaitingAIResume(true);
                } else {
                const lastMessage = saved[saved.length - 1];
                const lastSpeaker = lastMessage?.speaker ?? '';
                // 発言者がユーザーなら0、AIなら1〜
                const nextTurnIndex = calculateNextTurn(lastSpeaker, bots, userParticipatesFlag);
                setTurnIndex(nextTurnIndex);
                if (nextTurnIndex > 0) setAwaitingAIResume(true);
                }


              console.log('[resume] 完了 msg=', saved.length);
            } catch (e) {
              console.error('[resume] 失敗:', e);
            }
            localStorage.removeItem('resumeSession');
          };
          load();
          setBackPath('/sessions');
          return;
        }
      } catch (e) {
        console.error('[resume] エラー:', e);
      }
    }

    // 新規開始: localStorageの設定を読む：よみ込み失敗時は設定画面へ
    const savedConfig = localStorage.getItem('aiConfig');
    if (!savedConfig) { navigate('/config'); return; }
    try {
      const parsed: ScreenConfig = JSON.parse(savedConfig);
      console.log('[init] 設定読込');
      setConfig(parsed);
      setBackPath('/config');
    } catch (e) {
      console.error('[init] 設定読込失敗:', e);
      navigate('/config');
    }
  }, []);

  /**
   * 表示用の参加者配列（ユーザーが先頭に来るよう整形）。
   * `turnIndex` の強調色判定にも利用。
   */
  const displayParticipants = config ? [
    //スプレッド構文とかいうやつ
    ...(config.participate ? [{ name: 'あなた', role: '参加者', description: 'ユーザ' }] : []),
    ...config.aiData
  ] : [];

  /**
   * 議論を開始。ユーザーが不参加の場合は先頭AIのターンから開始。
   * モデル未接続時はエラートーストを表示。
   */
  const startSession = async () => {
    if (isSavingSession) { console.log('[session] 保存中のため開始を待機'); return; }
    if (!isModelLoaded) { 
      console.log('[session] モデル未接続'); 
      showOllamaConnectionError(); 
      return; 
    }

    // 新規時はセッションIDをリセット
    if (!isResumed) {
      setSessionId(null);
      sessionIdRef.current = null;
      setIsResumed(false);
    }

    if (!config?.participate) {
      setTurnIndex(1);
      setIsActive(true);
      setAwaitingAIResume(false);
      runAITurn(1);
    } else {
      setIsActive(true);
      setAwaitingAIResume(false);
    }
  };

  /**
   * 復元直後などにAI応答の続きを実行。
   * モデル未接続時はエラートーストを表示。
   */
  const continueAIResponse = async () => {
    if (isSavingSession) { console.log('[session] 保存中のため続行待機'); return; }
    if (!isModelLoaded) { 
      console.log('[session] モデル未接続'); 
      showOllamaConnectionError(); 
      return; 
    }
    setAwaitingAIResume(false);
    try { await runAITurn(); } catch (e) { console.error('[ai] 続行失敗:', e); showAIResponseError('AI参加者', `${e}`); }
  };

  /**
   * ユーザーの発言を確定して履歴に追加し、必要に応じて要約/分析を実行した後、
   * 次のAIターンをトリガー。
   */
  const handleSubmit = async () => {
    const trimmed = inputText.trim();
    // 入力が空、生成中、保存中は何もしない
    if (!trimmed || isGenerating || isSavingSession) { console.log('[input] 無効または処理中'); return; }
    // 入力文字数チェック
    if (trimmed.length > CONFIG.MAX_INPUT_LENGTH) { showInputTooLongWarning(trimmed.length); return; }

    try {
      const userMsg: TalkMessage = { speaker: USER_SPEAKER, message: trimmed, isUser: true, timestamp: new Date() };
      // 画面反映は関数型更新で競合回避(非同期であるから)
      setMessages(prev => [...prev, userMsg]);
      const next = [...messages, userMsg]; // 保存・AI用のスナップショット
      setInputText('');
      setTurnIndex(1);

      try { await autoSaveSession(next); } catch (e) { console.warn('[save] 直後保存失敗:', e); }

      try {
        setAwaitingAIResume(false);
        // AIは next（ユーザー発言を含む）を基準に生成
        await runAITurn(1, next);
      } catch (e) {
        console.error('[ai] 応答失敗:', e);
        showAIResponseError('AI参加者', `${e}`);
      }
    } catch (e) {
      console.error('[input] 送信失敗:', e);
      showGenericError('メッセージ送信に失敗しました', `${e}`);
    }
  };

  /**
   * 必要に応じて要約を実行。
   * - 初回は一定件数以上でフル要約
   * - 以降は差分件数に応じてインクリメンタル（増分）要約
   */
  

  /**
   * 必要に応じて ANALYSIS_TURN_INTERVAL ターン毎の自動分析を実行。
   * 条件に満たない場合は何もしない。
   */
  const analyzeIfNeeded = async () => {
    // 条件チェック
    if (!config || messages.length === 0) return;
    const turnCount = messages.length;
    // ターン数が CONFIG.ANALYSIS_TURN_INTERVAL の倍数でない場合はスキップ
    if (turnCount % CONFIG.ANALYSIS_TURN_INTERVAL !== 0) return;
    if (messages.length < CONFIG.ANALYSIS_TURN_INTERVAL) return;
    // 直近と同一内容ならスキップ
    if (messages.length <= lastAnalyzedCount) return;
    await runAnalysis();
  };

  /**
   * 議論の分析を実行し、解析結果をUIとストレージに反映。
   * JSONの破損に耐えるために `jsonrepair` で修復を試みる。
   */
  const runAnalysis = async () => {
    if (!config || messages.length === 0 || isSavingSession) {
      console.log('[analysis] 条件未満でスキップ');
      return;
    }
    // 重複実行ガード
    if (analyzing) {
      console.log('[analysis] 実行中のためスキップ');
      return;
    }
    try {
      setAnalyzing(true);
      const history = messages.map(m => `${m.speaker}: ${m.message}`).join('\n');
      const parts = [ ...(config.participate ? [USER_SPEAKER] : []), ...config.aiData.map(a => a.name) ];
      const result = await analyzeDiscussionPoints(config.discussionTopic, history, parts);

      try {
        let cleaned = result.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

        let parsed: any;
        try {
          parsed = JSON.parse(cleaned);
        } catch (e1) {
          // 壊れたJSONを修復して再パース
          const repaired = jsonrepair(cleaned);
          parsed = JSON.parse(repaired);
        }

        // 必要なフィールドの検証と整形
        const valid: DiscussionAnalysis = {
          mainPoints: Array.isArray(parsed.mainPoints) ? parsed.mainPoints.filter((p: any) => p && typeof p.point === 'string' && typeof p.description === 'string') : [],
          participantStances: Array.isArray(parsed.participantStances) ? parsed.participantStances.filter((s: any) => s && typeof s.participant === 'string') : [],
          conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.filter((c: any) => c && typeof c.issue === 'string') : [],
          commonGround: Array.isArray(parsed.commonGround) ? parsed.commonGround.filter((x: any) => typeof x === 'string') : [],
          unexploredAreas: Array.isArray(parsed.unexploredAreas) ? parsed.unexploredAreas.filter((x: any) => typeof x === 'string') : [],
        };

        setAnalysis(valid);
        // この時点のメッセージ数を記録（次回開閉時の不要実行を抑止）
        setLastAnalyzedCount(messages.length);
        showAnalysisSuccess();
        if (sessionId && sessionId > 0) {
          try { await saveSessionAnalysis(sessionId, 'analysis', JSON.stringify(valid)); } catch (e) { console.warn('[save] 分析保存失敗:', e); }
        }
      } catch (pe) {
        console.error('[analysis] JSON解析失敗:', pe);
        console.log('raw:', result);
        showAnalysisError('議論分析', `JSON解析に失敗しました: ${pe}`);
      }
    } catch (e) {
      console.error('[analysis] 実行失敗:', e);
      showAnalysisError('議論分析', `${e}`);
    } finally {
      setLastAnalyzedCount(messages.length);
      setAnalyzing(false);
    }
  };

  /**
   * サイレント保存（多重保存時は最新版スナップショットをキューして防止処理する）。
   * 既存セッションは更新、新規は作成してIDを確定。
   */
const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

const enqueueSave = (snapshot: TalkMessage[]) => {
  if (!config) return;
  if (snapshot.length === 0) return; 
  saveQueueRef.current = saveQueueRef.current.then(async () => {
    setIsSavingSession(true);
    try {
      const participantsData = { userParticipates: config.participate, aiData: config.aiData };
      const currentId = sessionIdRef.current;
      if (currentId && currentId > 0) {
        await updateSession(currentId, JSON.stringify(snapshot));
      } else {
        const newId = await saveSession(
          config.discussionTopic,
          JSON.stringify(participantsData),
          JSON.stringify(snapshot),
          selectedModel
        );
        setSessionId(newId);
        sessionIdRef.current = newId;
        setIsResumed(true);
      }
    } catch (e) {
      console.error('[save] 失敗:', e);
    } finally {
      setIsSavingSession(false);
    }
  }).catch(e => {
    console.error('[save] queue error:', e);
    setIsSavingSession(false);
  });
};

const autoSaveSession = async (messagesToSave?: TalkMessage[]) => {
  const snapshot = messagesToSave || messages;
  enqueueSave(snapshot);
};

  /**
   * 指定ターン（未指定なら現在の `turnIndex`）のAI参加者で応答を生成し、
   * 履歴/保存/次ターン計算までを行います。ユーザー参加ON時は次のAIが続く場合に自動チェーン(連鎖的に次のターンを実行すること)。
   *
   * @param turnOverride 実行するターンの上書き（0=ユーザー、1..=AI）
   * @param baseMessages 応答生成の基準とする履歴スナップショット（未指定なら現在の `messages`）
   */
  const runAITurn = async (turnOverride?: number, baseMessages?: TalkMessage[]) => {
    if (!config) { console.log('[ai] 設定未読込'); return; }
    if (isGenerating || isSavingSession) { console.log('[ai] 多重実行スキップ'); return; }
    if (!isModelLoaded) { showOllamaConnectionError(); return; }

    const turn = typeof turnOverride === 'number' ? turnOverride : turnIndex;
    if (turn === 0) { console.log('[ai] ユーザーのターン'); return; }

    const aiIdx = turn - 1;
    const bot = config.aiData[aiIdx];
    if (!bot) { console.log('[ai] 対応参加者なし', { turn }); return; }

    // 次ターンの自動チェーン用変数
    let scheduleNextTurn: number | null = null;
    let nextBase: TalkMessage[] | undefined;

    try {
      setIsGenerating(true);
      const base = baseMessages ?? messages;
      const recentLines = base.slice(-CONFIG.KEEP_RECENT_TURNS).map((m: TalkMessage) => `${m.speaker}: ${m.message}`).join('\n');//末尾からKEEP_RECENT_TURNS件のメッセージを取得
      const history = historySummary ? `${historySummary}\n${recentLines}` : recentLines;

      const response = await generateAIResponse(bot.name, bot.role, bot.description, history, config.discussionTopic);
      const aiText = typeof response === 'string' ? response : String(response ?? '');

      const aiMsg: TalkMessage = { speaker: bot.name, message: aiText, isUser: false, timestamp: new Date() };

      // 関数型更新で追記（上書き防止）
      setMessages(prev => [...prev, aiMsg]);

      nextBase = [...base, aiMsg];
      try { await autoSaveSession(nextBase); } catch (e) { console.warn('[save] 自動保存失敗:', e); }

      //次のターンを計算
      const nextSpeaker = bot.name;
      const nextTurnIndex = calculateNextTurn(nextSpeaker,config.aiData,config.participate);
      setTurnIndex(nextTurnIndex);

      //チェーン条件(AIが次の時に自動実行)
      if(nextTurnIndex > 0) {
        scheduleNextTurn = nextTurnIndex;
        setAwaitingAIResume(false);
      }

    } catch (e) {
      console.error('[ai] 応答生成失敗:', e);
      showAIResponseError(bot?.name || 'AI', `${e}`);
    } finally {
      setIsGenerating(false);
      if (scheduleNextTurn && nextBase) {
        // 少し遅延して次AIを実行（多重実行ガードをクリアしてから）
        setTimeout(() => {
          runAITurn(scheduleNextTurn as number, nextBase);
        }, 0);
      }
    }
  };

  /**
   * 戻るボタン押下時にセッション保存の完了を短時間だけ待ち、
   * 完了またはタイムアウト（2秒）で遷移。
   */
  const handleBack = async () => {
    try {
      await autoSaveSession(messages);
      const start = Date.now();
      while (isSavingSession) {
        await new Promise((r) => setTimeout(r, 100));
        if (Date.now() - start > 2000) break; // 最大2秒待機
      }
    } catch (e) {
      console.warn('[back] 保存待機中にエラー:', e);
    } finally {
      navigate(backPath);
    }
  };

  if (!config) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="lg" />
        <Text mt={4}>設定を読み込み中...</Text>
      </Box>
    );
  }

  return (
    <Box height="100vh" display="flex" flexDirection="column">
      {/* コンテンツ */}
      <VStack 
        gap={{ base: 2, md: 4 }} 
        p={{ base: 3, md: 6 }} 
        flex="1" 
        overflow="hidden"
        pb={{ base: "220px", md: "200px" }}
      >
        {/* ヘッダー */}
        <Box width="100%" borderBottom="1px solid" borderColor="border.muted" pb={{ base: 2, md: 4 }}>
          <Stack 
            direction={{ base: "column", md: "row" }}
            justify="space-between" 
            align={{ base: "start", md: "center" }}
            width="100%"
            gap={{ base: 2, md: 0 }}
          >
            <Button onClick={handleBack} size={{ base: "xs", md: "sm" }} variant="ghost">
              ← 戻る
            </Button>
            <Text 
              fontSize={{ base: "md", md: "xl" }} 
              fontWeight="bold"
              textAlign={{ base: "left", md: "center" }}
              flex={{ base: "none", md: "1" }}
            >
              テーマ: {config.discussionTopic}
            </Text>
            <HStack gap={2} minWidth={{ base: "auto", md: "120px" }} justify="flex-end">
              <Button 
                size={{ base: "xs", md: "sm" }} 
                variant="outline"
                colorPalette="green"
                onClick={openEditor}
              >
                <Text display={{ base: "none", md: "block" }}>AI編集</Text>
                <Text display={{ base: "block", md: "none" }}>✏️</Text>
              </Button>
            </HStack>
          </Stack>
        </Box>

        {/* 参加者 */}
        <Stack 
          direction={{ base: "column", lg: "row" }}
          wrap="wrap" 
          gap={2} 
          justify="space-between" 
          width="100%"
        >
          <HStack wrap="wrap" gap={2} flex="1">
            {displayParticipants.map((p, index) => (
              <Badge
                key={index}
                colorPalette={turnIndex === (config.participate ? index : index + 1) ? "green" : "gray"}
                variant={turnIndex === (config.participate ? index : index + 1) ? "solid" : "outline"}
                size={{ base: "sm", md: "md" }}
              >
                {p.name} ({p.role})
              </Badge>
            ))}
          </HStack>
          <HStack gap={1} wrap="wrap" justify={{ base: "start", lg: "end" }}>
            <Badge colorPalette="green" variant="outline" size={{ base: "sm", md: "md" }}>
              ターン: {messages.length}
            </Badge>
            {historySummary && (
              <Badge colorPalette="green" variant="outline" size={{ base: "sm", md: "md" }}>
                要約済み
              </Badge>
            )}
          </HStack>
        </Stack>

        {/* 状態表示 */}
        {(summarizing || analyzing) && (
          <Box width="100%" p={{ base: 2, md: 3 }} bg="bg.panel" borderRadius="md" border="1px solid" borderColor="border.muted">
            {summarizing && (
              <HStack gap={2}><Spinner colorPalette="green" size="sm" /><Text fontSize={{ base: "xs", md: "sm" }}>📝 議論を要約中です。少々時間がかかる場合がございます。</Text></HStack>
            )}
            {analyzing && (
              <HStack gap={2} mt={summarizing ? 2 : 0}><Spinner colorPalette="green" size="sm" /><Text fontSize={{ base: "xs", md: "sm" }}>📊 議論を分析中です。少々時間がかかる場合がございます。</Text></HStack>
            )}
          </Box>
        )}

        {/* 分析パネル */}
        <HStack width="100%" justify="flex-end" gap={3}>
          <Button 
            size={{ base: "sm", md: "md" }}
            colorPalette="green" 
            variant={analysisOpen ? "solid" : "outline"}
            onClick={() => {
              const nextOpen = !analysisOpen;
              setAnalysisOpen(nextOpen);
              // 初回または未分析時のみ、かつ未実行中・十分なメッセージ数・未分析または新規発言がある場合にだけ実行
              if (
                nextOpen &&
                !analyzing &&
                messages.length > 2 &&
                messages.length > lastAnalyzedCount &&
                (!analysis || messages.length > lastAnalyzedCount)
              ) {
                runAnalysis();
              }
            }}
          >
            <Text display={{ base: "none", md: "block" }}>{analysisOpen ? '分析パネルを閉じる' : '議論分析パネルを開く'}</Text>
            <Text display={{ base: "block", md: "none" }}>{analysisOpen ? '分析を閉じる' : '📊 分析'}</Text>
          </Button>
        </HStack>

        {/* 開始前 */}
        {!isActive && (
          <VStack gap={4} flex={1} justify="center" p={{ base: 4, md: 0 }}>
            <Text fontSize={{ base: "md", md: "lg" }}>議論の準備ができました</Text>
            <Text fontSize={{ base: "sm", md: "md" }}>参加者: {displayParticipants.length}人</Text>
            <VStack gap={2}>
              <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted" textAlign="center">💬 {config.participate ? '下部の入力エリアから議論を開始できます' : '下部のボタンから自動議論を開始できます'}</Text>
              <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted" textAlign="center">🎯 テーマ: {config.discussionTopic}</Text>
            </VStack>
          </VStack>
        )}

        {/* 進行中 */}
        {isActive && (
          <Stack direction={{ base: "column", lg: "row" }} gap={{ base: 4, md: 0 }} flex={1} align="stretch" width="100%">
            {/* メッセージ履歴 */}
            <Box 
              ref={messageListRef}
              onScroll={handleScroll}
              flex={{ base: "1", lg: analysisOpen ? "2" : "1" }}
              minHeight={{ base: "200px", md: "300px" }}
              maxHeight={{ base: "calc(100vh - 500px)", lg: "calc(100vh - 450px)" }}
              overflowY="auto" 
              border="1px solid" 
              borderColor="border.muted" 
              borderRadius="md" 
              p={{ base: 2, md: 4 }}
              transition="all 0.3s"
              mb={{ base: 4, md: 0 }}
            >
              {messages.map((msg, index) => (
                <ChatMessage key={index} message={msg} index={index} />
              ))}

              {isGenerating && (
                <Box textAlign="center" p={4}>
                  <Spinner colorPalette="green" />
                  <Text mt={2}>{turnIndex > 0 && config.aiData[turnIndex - 1] ? `（${config.aiData[turnIndex - 1].name}）が考え中` : 'AI応答を生成中...'}</Text>
                </Box>
              )}
              
              {/* 余白 */}
              <Box height={{ base: "20px", md: "30px" }} />

              {/* 最下部アンカー */}
              <div ref={bottomRef} />

              {/* 下部へスクロールボタン */}
              {!autoScroll && messages.length > 0 && (
                <Box position="sticky" bottom={2} textAlign="center" mt={2}>
                  <Button
                    size="sm"
                    colorPalette="green"
                    variant="solid"
                    onClick={() => {
                      setAutoScroll(true);
                      autoScrollRef.current = true;
                      scrollToBottom();
                    }}
                    boxShadow="md"
                    opacity={0.7}
                    _hover={{ opacity: 1 }}
                    transition="opacity 0.2s"
                  >
                    ↓ 新しいメッセージを表示する
                  </Button>
                </Box>
              )}
            </Box>

            {/* デスクトップ分析 */}
            {analysisOpen && (
              <Box display={{ base: "none", lg: "block" }} flex="1" minWidth="350px" maxHeight="calc(100vh - 450px)" overflowY="auto" p={4} bg="green.subtle" borderRadius="md" mb={4} border="1px solid" borderColor="green.muted">
                <AnalysisPanel
                  analysis={analysis}
                  analyzing={analyzing}
                  onRefresh={() => { if (!analyzing && messages.length > 2) runAnalysis(); }}
                  canRefresh={messages.length > 2}
                />
              </Box>
            )}
          </Stack>
        )}
      </VStack>

      {/* モバイル用 分析オーバーレイ */}
      {analysisOpen && (
        <Box display={{ base: "block", lg: "none" }} position="fixed" top="0" left="0" right="0" bottom="0" bg="blackAlpha.600" zIndex="modal" onClick={() => setAnalysisOpen(false)}>
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" bg="bg" borderRadius="lg" border="1px solid" borderColor="border.muted" boxShadow="xl" maxWidth="90vw" maxHeight="80vh" width="full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <HStack justify="flex-end" align="center" p={2} borderBottom="1px solid" borderColor="border.muted">
              <Button size="xs" variant="ghost" onClick={() => setAnalysisOpen(false)}>✕</Button>
            </HStack>

            <Box p={4} maxHeight="calc(80vh - 80px)" overflowY="auto">
              <AnalysisPanel
                analysis={analysis}
                analyzing={analyzing}
                onRefresh={() => { if (!analyzing && messages.length > 2) runAnalysis(); }}
                canRefresh={messages.length > 2}
              />
            </Box>
          </Box>
        </Box>
      )}

      {/* 参加者編集ドロワー（再利用コンポーネント） */}
      <ParticipantEditorDrawer
        open={editOpen}
        onClose={closeEditor}
        initialBots={config!.aiData}
        initialUserParticipates={config!.participate}
        onSave={async (bots, userParticipates) => {
          // ここでエラーを throw すると内部で成功トーストは表示されない
          try {
            const aiData = bots.map(b => ({ ...b }));
            setConfig(prev => prev ? { ...prev, aiData, participate: userParticipates } : prev);
            if (sessionIdRef.current && sessionIdRef.current > 0) {
              await updateSessionParticipants(
                sessionIdRef.current,
                JSON.stringify({ userParticipates, aiData })
              );
            }
            // ターンインデックス整合
            setTurnIndex(prev => {
              if (prev === 0) return userParticipates ? 0 : aiData.length > 0 ? 1 : 0;
              const aiIdx = prev - 1;
              if (aiIdx >= aiData.length) return userParticipates ? 0 : aiData.length > 0 ? 1 : 0;
              return prev;
            });
          } catch (e) {
            throw e; // コンポーネント側でエラー表示
          }
        }}
      />

      {/* 入力エリア（固定） */}
      <Box borderTop="1px solid" borderColor="border.muted" bg="bg" p={{ base: 3, md: 4 }} width="100%" minWidth="100%">
        {config!.participate && (
          <VStack width="100%" gap={2}>
            {turnIndex === 0 && !isGenerating ? (
              <>
                <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>あなたのターンです</Text>
                {!isModelLoaded && (
                  <Text fontSize={{ base: "xs", md: "sm" }} color="red.solid">⚠️ AIモデルが準備できていません。Ollamaが起動しているか確認してください。</Text>
                )}
                <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted">💡 議論を深めるヒント: 多様な視点や疑問、具体例や根拠を示して論点を深掘りしてください</Text>
              </>
            ) : (
              <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" textAlign="center">
                {isGenerating
                  ? (turnIndex > 0 && config!.aiData[turnIndex - 1]
                      ? `（${config!.aiData[turnIndex - 1].name}）が考え中`
                      : 'AI応答を生成中...')
                  : (!isActive
                      ? '議論を開始してください'
                      : 'AIのターンです')}
              </Text>
            )}
            <VStack align="stretch" gap={2} width="100%" flex="1">
              <Textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={!isActive ? "議論開始後に入力できます" : turnIndex === 0 && !isGenerating ? "あなたの意見や質問を入力してください..." : "他の参加者のターンです"} resize="none" rows={3} fontSize={{ base: "sm", md: "md" }} disabled={!isActive || turnIndex !== 0 || isGenerating || isSavingSession} maxLength={CONFIG.MAX_INPUT_LENGTH} width="100%" minWidth="100%" />
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">{inputText.length}/{CONFIG.MAX_INPUT_LENGTH}文字</Text>
                {inputText.length > CONFIG.MAX_INPUT_LENGTH * 0.9 && (<Text fontSize="xs" color="orange.500">残り{CONFIG.MAX_INPUT_LENGTH - inputText.length}文字</Text>)}
              </HStack>
            </VStack>
            <HStack width="100%" gap={2}>
              {!isActive ? (
                <Button colorPalette="green" onClick={startSession} disabled={!isModelLoaded || isGenerating || isSavingSession} flex="1" size={{ base: "sm", md: "md" }}>{!isModelLoaded ? 'Ollamaが起動していません' : isSavingSession ? '保存中...' : isGenerating ? '処理中...' : '議論を開始する'}</Button>
              ) : (
                <Button colorPalette="green" onClick={awaitingAIResume && turnIndex > 0 ? continueAIResponse : handleSubmit} disabled={awaitingAIResume && turnIndex > 0 ? false : (!inputText.trim() || !isModelLoaded || turnIndex !== 0 || isGenerating || isSavingSession)} flex="1" size={{ base: "sm", md: "md" }}
                  loading={isGenerating} loadingText="生成中...">
                  {!isModelLoaded ? 'Ollamaが起動していません' : awaitingAIResume && turnIndex > 0 ? '応答を再開する' : turnIndex !== 0 ? 'AIのターンです' : isSavingSession ? '保存中...' : '発言する'}
                </Button>
              )}
              {isActive && !config!.participate && !isGenerating && (
                <Button colorPalette="green" onClick={awaitingAIResume ? continueAIResponse : () => runAITurn()} size={{ base: "sm", md: "md" }} variant="outline">{awaitingAIResume ? '応答を再開する' : '次の発言を生成'}</Button>
              )}
            </HStack>
          </VStack>
        )}

        {!config!.participate && (
          <VStack width="100%" gap={2}>
            <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" textAlign="center">
              {isGenerating
                ? (turnIndex > 0 && config!.aiData[turnIndex - 1]
                    ? `（${config!.aiData[turnIndex - 1].name}）が考え中`
                    : 'AI応答を生成中...')
                : (!isActive
                    ? '議論を開始してください'
                    : 'AI自動議論モード')}
            </Text>
            <Button colorPalette="green" onClick={isActive ? () => runAITurn() : startSession} disabled={isGenerating || !config || isSavingSession} size={{ base: "sm", md: "md" }} width="100%">
              {!isActive ? '議論開始' : isSavingSession ? '保存中...' : isGenerating ? '処理中...' : '次の発言を生成'}
            </Button>
          </VStack>
        )}
      </Box>
    </Box>
  );
};
export default PlayPage;