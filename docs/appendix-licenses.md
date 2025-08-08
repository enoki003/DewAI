# 付録A: 依存ライブラリ・ライセンス一覧

この表は配布時の法的表示に使用します。暫定版です。

- 本体ライセンス: ISC (LICENSE.md 参照)
- 主な依存:
  - React (MIT)
  - Chakra UI (MIT)
  - Vite (MIT)
  - Tauri (Apache-2.0 / MIT)
  - reqwest (Apache-2.0 / MIT)
  - tokio (MIT)
  - react-router-dom (MIT)

自動生成の推奨手順（Node側）:
```
npm i -D license-checker
npx license-checker --production --json > docs/licenses-node.json
```
Rust側は `cargo-license` 等のツールで収集し、集約して本ファイルへ整形します。
