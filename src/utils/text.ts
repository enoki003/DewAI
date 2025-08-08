// テキスト処理ユーティリティ

/**
 * 要約テキストから争点を抽出する（最大3件）
 * - 「争点」「論点」「課題」を含む行を対象
 * - コロン（:|：）の後ろの語句を抽出し、先頭の記号（-・）を除去
 */
export function extractTopicsFromSummary(summary: string): string[] {
  const topics: string[] = [];
  if (!summary) return topics;

  const lines = summary.split(/\r?\n/);
  for (const line of lines) {
    if (line.includes('争点') || line.includes('論点') || line.includes('課題')) {
      // コロン以降を取得（全角/半角対応）
      const m = line.match(/[:：]\s*(.+)$/);
      if (m && m[1]) {
        let t = m[1]
          .replace(/^[\-・\s]+/, '') // 箇条書き記号を除去
          .replace(/[。．。]+$/, '')   // 末尾句点を除去
          .trim();
        if (t && !topics.includes(t)) topics.push(t);
      }
    }
    if (topics.length >= 3) break;
  }
  return topics.slice(0, 3);
}
