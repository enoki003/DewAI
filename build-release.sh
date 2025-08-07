#!/bin/bash
# DewAI 配布用ビルドスクリプト

set -e

echo "🔥 DewAI 配布用パッケージビルドを開始します..."

# 前提条件の確認
echo "📋 前提条件を確認中..."

# Node.js バージョン確認
if ! command -v node &> /dev/null; then
    echo "❌ Node.js がインストールされていません"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js v18以上が必要です（現在: $(node -v)）"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Rust バージョン確認
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust がインストールされていません"
    exit 1
fi
echo "✅ Rust $(rustc --version)"

# Tauri CLI 確認
if ! command -v cargo-tauri &> /dev/null; then
    echo "🔧 Tauri CLI をインストール中..."
    cargo install tauri-cli
fi
echo "✅ Tauri CLI $(cargo tauri --version)"

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# フロントエンドのビルド
echo "🏗️ フロントエンドをビルド中..."
npm run build

# Tauri バイナリのビルド
echo "⚙️ Tauri アプリケーションをビルド中..."
npm run tauri build

echo "✅ ビルド完了！"
echo "📁 配布用ファイルは src-tauri/target/release/bundle/ に生成されました"

# 生成されたファイルを表示
echo ""
echo "📦 生成されたパッケージ："
find src-tauri/target/release/bundle -name "*.msi" -o -name "*.dmg" -o -name "*.AppImage" -o -name "*.deb" -o -name "*.rpm" 2>/dev/null | head -10

echo ""
echo "🎉 DewAI のビルドが完了しました！"
echo ""
echo "📋 配布時の注意事項："
echo "   • Ollama と gemma3:4b モデルは別途インストールが必要です"
echo "   • 使用者には 'ollama pull gemma3:4b' の実行を案内してください"
echo "   • モデルのライセンス条件を遵守してください"
