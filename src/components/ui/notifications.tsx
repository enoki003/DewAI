// アラート・通知コンポーネント
// セッション削除、分析エラー等の操作結果を適切に表示

import { Alert } from "@chakra-ui/react"
import { toaster } from "./toaster"
import { LuCheck, LuTriangleAlert, LuX, LuInfo } from "react-icons/lu"

/** 通知の種類 */
export type AlertType = "success" | "warning" | "error" | "info"

/** showNotification のオプション */
export interface NotificationOptions {
  type: AlertType
  title: string
  description?: string
  duration?: number
  isClosable?: boolean
}

/**
 * Chakra Toaster を使って通知を表示します。
 */
export const showNotification = (options: NotificationOptions) => {
  const { type, title, description, duration = 5000, isClosable = true } = options
  
  toaster.create({
    title,
    description,
    type: type === "error" ? "error" : type === "warning" ? "warning" : type === "success" ? "success" : "info",
    duration,
    meta: { closable: isClosable },
  })
}

// 各種操作専用の通知関数

/** セッション削除 成功 */
export const showSessionDeleteSuccess = (sessionTopic: string) => {
  showNotification({
    type: "success",
    title: "セッションを削除しました",
    description: `「${sessionTopic}」の議論セッションが正常に削除されました。`,
    duration: 3000,
  })
}

/** セッション削除 エラー */
export const showSessionDeleteError = (error: string) => {
  showNotification({
    type: "error",
    title: "セッション削除に失敗しました",
    description: `エラー詳細: ${error}`,
    duration: 6000,
  })
}

/** セッション保存 成功/更新 */
export const showSessionSaveSuccess = (sessionTopic: string, isUpdate: boolean = false) => {
  showNotification({
    type: "success",
    title: isUpdate ? "セッションを更新しました" : "セッションを保存しました",
    description: `「${sessionTopic}」の議論セッションが正常に${isUpdate ? "更新" : "保存"}されました。`,
    duration: 3000,
  })
}

/** セッション保存 エラー */
export const showSessionSaveError = (error: string) => {
  showNotification({
    type: "error",
    title: "セッション保存に失敗しました",
    description: `エラー詳細: ${error}`,
    duration: 6000,
  })
}

/** 参加者情報更新 成功 */
export const showParticipantsUpdateSuccess = () => {
  showNotification({
    type: "success",
    title: "参加者情報を更新しました",
    duration: 2500,
  })
}

/** 参加者情報更新 失敗 */
export const showParticipantsUpdateError = (error: string) => {
  showNotification({
    type: "error",
    title: "参加者情報の更新に失敗しました",
    description: `エラー詳細: ${error}`,
    duration: 6000,
  })
}

/** 分析 成功 */
export const showAnalysisSuccess = () => {
  showNotification({
    type: "success",
    title: "分析が完了しました",
    duration: 2000,
  })
}

/** 分析 エラー */
export const showAnalysisError = (analysisType: string, error: string) => {
  showNotification({
    type: "error",
    title: `${analysisType}分析に失敗しました`,
    description: `分析処理中にエラーが発生しました。詳細: ${error}`,
    duration: 6000,
  })
}

/** AI応答 生成情報 */
export const showAIResponseGenerated = (name: string) => {
  showNotification({
    type: "info",
    title: `${name}の応答が生成されました`,
    duration: 2000,
  })
}

/** AI応答 エラー */
export const showAIResponseError = (participantName: string, error: string) => {
  showNotification({
    type: "error",
    title: "AI応答の生成に失敗しました",
    description: `${participantName}の応答生成中にエラーが発生しました。詳細: ${error}`,
    duration: 6000,
  })
}

/** 入力が長過ぎる場合の警告 */
export const showInputTooLongWarning = (current: number, max = 10000) => {
  showNotification({
    type: "warning",
    title: "メッセージが長すぎます",
    description: `現在 ${current} 文字です。${max} 文字以内で入力してください。`,
    duration: 5000,
  })
}

/** Ollama接続エラー */
export const showOllamaConnectionError = () => {
  showNotification({
    type: "warning",
    title: "Ollamaに接続できません",
    description: "Ollamaが起動していることを確認してください。localhost:11434でサービスが利用可能である必要があります。",
    duration: 8000,
  })
}

/** モデル準備完了通知 */
export const showModelLoadSuccess = () => {
  showNotification({
    type: "success",
    title: "AIモデルの準備が完了しました",
    description: "Ollamaとの接続が確立され、議論を開始できます。",
    duration: 3000,
  })
}

/** モデル切替通知 */
export const showModelChangeNotice = (model: string) => {
  showNotification({
    type: "info",
    title: "モデルを切り替えました",
    description: `現在のモデル: ${model}`,
    duration: 2500,
  })
}

/** セッション再開ヒント */
export const showSessionResumeHint = () => {
  showNotification({
    type: "info",
    title: "セッションを復元しました",
    description: "右下のボタンから応答を再開できます。",
    duration: 4000,
  })
}

/** 汎用警告 */
export const showGenericWarning = (title: string, description?: string) => {
  showNotification({
    type: "warning",
    title,
    description,
    duration: 5000,
  })
}

/** 汎用エラー */
export const showGenericError = (title: string, description?: string) => {
  showNotification({
    type: "error",
    title,
    description,
    duration: 6000,
  })
}

/** インライン Alert コンポーネント（ページ内に埋め込み表示用） */
export interface InlineAlertProps {
  type: AlertType
  title: string
  description?: string
  onClose?: () => void
  variant?: "subtle" | "surface" | "outline" | "solid"
}

/** ページ内で使う軽量なアラート表示 */
export const InlineAlert = ({ 
  type, 
  title, 
  description, 
  onClose, 
  variant = "surface" 
}: InlineAlertProps) => {
  const getIcon = () => {
    switch (type) {
      case "success": return <LuCheck />
      case "warning": return <LuTriangleAlert />
      case "error": return <LuX />
      case "info": return <LuInfo />
      default: return <LuInfo />
    }
  }

  return (
    <Alert.Root status={type} variant={variant}>
      <Alert.Indicator>
        {getIcon()}
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description && <Alert.Description>{description}</Alert.Description>}
      </Alert.Content>
      {onClose && (
        <button 
          onClick={onClose}
          style={{ 
            marginLeft: 'auto', 
            padding: '4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          ×
        </button>
      )}
    </Alert.Root>
  )
}
