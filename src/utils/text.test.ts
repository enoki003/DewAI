import { describe, it, expect } from 'vitest'
import { extractTopicsFromSummary } from './text'

describe('extractTopicsFromSummary', () => {
  it('空文字は空配列', () => {
    expect(extractTopicsFromSummary('')).toEqual([])
  })

  it('争点/論点/課題の行から最大3件抽出', () => {
    const s = `- 争点: 資金調達\n・論点: 開発体制\n- 課題: 品質保証\n- その他: 無視`
    expect(extractTopicsFromSummary(s)).toEqual(['資金調達', '開発体制', '品質保証'])
  })

  it('重複は除外', () => {
    const s = `- 争点: セキュリティ\n- 論点: セキュリティ\n- 課題: 運用`
    expect(extractTopicsFromSummary(s)).toEqual(['セキュリティ', '運用'])
  })

  it('区切りが全角でも抽出', () => {
    const s = `・論点：性能最適化`
    expect(extractTopicsFromSummary(s)).toEqual(['性能最適化'])
  })
})
