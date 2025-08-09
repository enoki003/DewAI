# DewAI 配布ガイド

## 概要

DewAIはローカルAIモデル（Ollama）を使用したデスクトップ議論アプリケーションです。
このガイドでは、配布用パッケージの作成方法とDockerを使用した開発環境の構築方法を説明します。

## 📦 配布用パッケージの作成

### 前提条件

- **Node.js** v18以上
- **Rust** （最新の安定版）
- **Tauri CLI** (`cargo install tauri-cli`)

### クイックビルド

#### Windows
```batch
build-release.bat
```

#### Linux/macOS
```bash
chmod +x build-release.sh
./build-release.sh
```

### 手動ビルド手順

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **フロントエンドのビルド**
   ```bash
   npm run build
   ```

3. **Tauriパッケージの作成**
   ```bash
   npm run tauri build
   ```

4. **生成物の確認**
   ```
   src-tauri/target/release/bundle/
   ├── msi/          # Windows インストーラー
   ├── deb/          # Debian パッケージ
   ├── rpm/          # Red Hat パッケージ
   ├── appimage/     # Linux AppImage
   └── dmg/          # macOS ディスクイメージ
   ```

### 配布時の注意事項

#### 🚨 重要な制限事項

- **Ollamaは別途インストール必要**: パッケージにはOllamaは含まれていません
- **モデルは別途ダウンロード必要**: `gemma3:4b`モデルは使用者が個別にダウンロードする必要があります
- **ライセンス遵守**: Google Gemmaモデルの利用規約を遵守してください

#### 📋 使用者への案内事項

1. **Ollamaのインストール**
   ```bash
   # Ollama公式サイトからダウンロード・インストール
   # https://ollama.ai/
   ```

2. **モデルのダウンロード**
   ```bash
   ollama pull gemma3:4b
   ```

3. **Ollamaの起動**
   ```bash
   ollama serve
   ```

## 🐳 Docker開発環境

### 前提条件

- **Docker** （最新版）
- **Docker Compose** v2.0以上

### 環境構築

1. **Docker環境の構築**
   ```bash
   npm run build:docker
   ```

2. **開発環境の起動**
   ```bash
   npm run dev:docker
   ```

3. **コンテナ内での作業**
   ```bash
   docker exec -it dewai-development bash
   cd /app
   npm run tauri dev
   ```

### Docker構成

- **ベースイメージ**: `node:18-bullseye`
- **含まれるツール**: Node.js, Rust, Tauri CLI, ビルド依存関係
- **ポート**: 1420 （Vite開発サーバー）
- **ボリューム**: ソースコードのバインドマウント

### GUI アプリケーションの実行

DockerでGUIアプリケーションを実行するには追加設定が必要です：

#### Linux環境
```bash
# X11フォワーディングを有効化
docker run --rm -it \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  -v $(pwd):/app \
  dewai-dev bash
```

#### Windows/macOS
- VcXsrv (Windows) やXQuartz (macOS) などのX11サーバーが必要
- または、開発用途であればWeb版インターフェースの利用を推奨

## 🔧 カスタマイズとビルド設定

### Tauri設定

`src-tauri/tauri.conf.json` でパッケージ設定をカスタマイズできます：

```json
{
  "bundle": {
    "targets": "all",
    "identifier": "com.example.dewai",
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13"
    },
    "linux": {
      "deb": {
        "depends": []
      }
    }
  }
}
```

### ビルド最適化

フロントエンドのビルド最適化は `vite.config.ts` で設定：

```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'chakra-ui': ['@chakra-ui/react'],
          'react-vendor': ['react', 'react-dom'],
          'tauri-vendor': ['@tauri-apps/api']
        }
      }
    }
  }
});
```

## 📄 ライセンスと法的考慮事項

### 依存関係ライセンス
- **React**: MIT License
- **Tauri**: Apache-2.0 OR MIT License
- **Chakra UI**: MIT License
- **Rust dependencies**: 主にApache-2.0/MIT License

詳細は `LICENSE.md` を参照してください。

### AIモデルライセンス
- **Google Gemma**: Google Gemma Terms of Use に従う
- **Ollama**: Apache-2.0 License

⚠️ **重要**: モデルファイルの再配布は許可されていません。使用者が個別にダウンロードする必要があります。

## 🚀 CI/CD自動化（推奨）

### GitHub Actions例

```yaml
name: Build Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: npm install
      - run: npm run build:release
      - uses: actions/upload-artifact@v3
        with:
          name: release-${{ matrix.os }}
          path: src-tauri/target/release/bundle/
```

## 📞 サポート

配布やビルドに関する問題が発生した場合：

1. **ログの確認**: ビルドログを確認してエラーの詳細を特定
2. **依存関係の確認**: Node.js、Rust、Tauri CLIのバージョンを確認
3. **環境の初期化**: `npm clean-install` でnode_modulesをクリーンインストール
4. **Cargoキャッシュのクリア**: `cargo clean` でRustビルドキャッシュをクリア

---

このガイドに従って、DewAIの配布用パッケージを作成し、Docker開発環境を構築できます。
