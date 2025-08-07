# DewAI 開発環境用Dockerfile
FROM node:18-bullseye

# Tauri開発に必要な依存関係をインストール
RUN apt-get update && \
    apt-get install -y \
    curl \
    build-essential \
    libwebkit2gtk-4.0-dev \
    libgtk-3-dev \
    libnss3 \
    libgconf-2-4 \
    libdbus-glib-1-2 \
    libxss1 \
    libxtst6 \
    xz-utils \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Rustツールチェーンをインストール
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Tauri CLIをインストール
RUN cargo install tauri-cli

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# プロジェクトファイルをコピー
COPY . .

# ポート1420を公開（開発サーバー用）
EXPOSE 1420

# デフォルトコマンド（開発サーバー起動）
CMD ["npm", "run", "tauri", "dev"]
