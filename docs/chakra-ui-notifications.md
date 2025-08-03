# チャクラUI通知システム - 実装ガイド

## 🎉 実装完了

アラート・通知システムが正常に実装され、従来の`alert()`やブラウザアラートが ChakraUI の洗練された通知システムに置き換わりました。

## 📦 実装内容

### 1. **統一された通知コンポーネント**
`src/components/ui/notifications.tsx`
- Toast による通知表示
- インライン Alert コンポーネント
- 操作別の専用通知関数

### 2. **適用済みの箇所**

#### **セッション管理 (`sessions.tsx`)**
- ✅ セッション削除成功/失敗
- ✅ セッション取得エラー
- ✅ セッション復元エラー

#### **AI応答 (`play.tsx`)**
- ✅ AI応答生成エラー
- ✅ 議論分析エラー

#### **モデル管理 (`useAIModel.tsx`)**
- ✅ Ollama接続エラー/成功
- ✅ モデルロード状態通知
- ✅ 議論分析エラー

## 🎨 通知の種類

### **Toast通知** (画面右下に表示)
```typescript
// 成功通知
showSessionDeleteSuccess("AIとの議論セッション");

// エラー通知
showAIResponseError("AI太郎", "応答生成に失敗しました");

// 警告通知
showOllamaConnectionError();

// 汎用通知
showGenericError("予期しないエラー", "詳細情報...");
```

### **インライン Alert** (ページ内埋め込み)
```typescript
<InlineAlert 
  type="warning"
  title="注意"
  description="この操作は元に戻せません"
  onClose={() => setShowAlert(false)}
/>
```

## 🎯 通知の特徴

| 機能 | 実装内容 |
|------|----------|
| **持続時間** | 種類別で自動調整（成功: 3秒、エラー: 6秒） |
| **位置** | 右下に非侵襲的に表示 |
| **閉じる** | 手動クリックまたは自動非表示 |
| **スタイル** | ChakraUI のテーマに統合 |
| **アクセシビリティ** | スクリーンリーダー対応 |

## 📱 ユーザー体験の改善

### **Before** (従来)
```typescript
alert('セッションを削除しました'); // ❌ ブラウザの標準アラート
```

### **After** (改善後)
```typescript
showSessionDeleteSuccess("セッションタイトル"); // ✅ 美しいToast通知
```

## 🚀 使用方法

### **1. インポート**
```typescript
import { 
  showSessionDeleteSuccess,
  showAIResponseError,
  showOllamaConnectionError 
} from '../components/ui/notifications';
```

### **2. 使用例**
```typescript
// セッション削除
const deleteSession = async (id: number, topic: string) => {
  try {
    await invoke('delete_session', { sessionId: id });
    showSessionDeleteSuccess(topic); // ✅ 成功通知
  } catch (error) {
    showSessionDeleteError(`${error}`); // ❌ エラー通知
  }
};
```

## 🎨 カスタマイズ可能

通知システムは完全にカスタマイズ可能：
- 表示位置の変更
- デザインテーマの調整
- 持続時間の変更
- 追加のアクション ボタン

この実装により、ユーザーは混乱しがちなブラウザアラートではなく、アプリケーションに統合された美しい通知を受け取れるようになりました！

## 🎁 次のステップ

1. **追加の通知タイプ**: 議論開始成功、AI参加者追加など
2. **プログレス通知**: 長時間の分析処理中の進捗表示
3. **アクション通知**: 「元に戻す」「再試行」ボタン付き通知
