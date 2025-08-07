@echo off
REM DewAI 配布用ビルドスクリプト (Windows)

echo 🔥 DewAI 配布用パッケージビルドを開始します...

REM 前提条件の確認
echo 📋 前提条件を確認中...

REM Node.js確認
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js がインストールされていません
    exit /b 1
)
echo ✅ Node.js がインストール済み

REM Rust確認
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Rust がインストールされていません
    exit /b 1
)
echo ✅ Rust がインストール済み

REM Tauri CLI確認
where cargo-tauri >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 🔧 Tauri CLI をインストール中...
    cargo install tauri-cli
)
echo ✅ Tauri CLI インストール済み

REM 依存関係のインストール
echo 📦 依存関係をインストール中...
npm install
if %ERRORLEVEL% NEQ 0 exit /b 1

REM フロントエンドのビルド
echo 🏗️ フロントエンドをビルド中...
npm run build
if %ERRORLEVEL% NEQ 0 exit /b 1

REM Tauri バイナリのビルド
echo ⚙️ Tauri アプリケーションをビルド中...
npm run tauri build
if %ERRORLEVEL% NEQ 0 exit /b 1

echo ✅ ビルド完了！
echo 📁 配布用ファイルは src-tauri\target\release\bundle\ に生成されました

echo.
echo 📦 生成されたパッケージ：
dir src-tauri\target\release\bundle\msi\*.msi 2>nul

echo.
echo 🎉 DewAI のビルドが完了しました！
echo.
echo 📋 配布時の注意事項：
echo    • Ollama と gemma3:4b モデルは別途インストールが必要です
echo    • 使用者には 'ollama pull gemma3:4b' の実行を案内してください
echo    • モデルのライセンス条件を遵守してください

pause
