// テキスト処理ユーティリティ

/**
 * 要約テキストから争点を抽出する（最大3件）
 * - 「争点」「論点」「課題」を含む行を対象
 * - 行中の「-・」に続くラベル〜区切り(:|：)までを抽出
 */
export function extractTopicsFromSummary(summary: string): string[] {
  const topics: string[] = [];
  if (!summary) return topics;

  const lines = summary.split(/\r?\n/);
  for (const line of lines) {
    if (line.includes('争点') || line.includes('論点') || line.includes('課題')) {
      const match = line.match(/[-・](.+?)[:：]/);
      if (match && match[1]) {
        const t = match[1].trim();
        if (t && !topics.includes(t)) topics.push(t);
      }
    }
    if (topics.length >= 3) break;
  }
  return topics.slice(0, 3);
}
