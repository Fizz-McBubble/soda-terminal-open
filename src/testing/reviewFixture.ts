export type ReadonlyReviewFixture = {
  batchId: 'fixture-review'
  entries: Array<{
    sequence: number
    reason: string
    ocr: string
    source: string
    confidence: 'low' | 'medium'
    rule: string
    detailPath: string
    cardPath: string
  }>
}

const image = (label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#17323b"/><text x="48" y="180" fill="#d9f7ef" font-size="30">${label}</text></svg>`,
  )}`

/** Development/test-only, in-memory evidence placeholders for UI/UX review. */
export function createReadonlyReviewFixture(): ReadonlyReviewFixture {
  return {
    batchId: 'fixture-review',
    entries: [
      {
        sequence: 13,
        reason: '缺套装',
        ocr: 'od I',
        source: 'detail-set',
        confidence: 'low',
        rule: 'set_name_whitelist_required',
        detailPath: image('脱敏详情证据 · 第 13 条'),
        cardPath: image('脱敏卡面证据 · 第 13 条'),
      },
      {
        sequence: 16,
        reason: '缺主词条',
        ocr: '攻击?',
        source: 'detail-main',
        confidence: 'low',
        rule: 'main_stat_slot_validation',
        detailPath: image('脱敏详情证据 · 第 16 条'),
        cardPath: image('脱敏卡面证据 · 第 16 条'),
      },
      {
        sequence: 21,
        reason: '缺副词条',
        ocr: '暴击率?',
        source: 'detail-sub',
        confidence: 'low',
        rule: 'sub_stat_step_validation',
        detailPath: image('脱敏详情证据 · 第 21 条'),
        cardPath: image('脱敏卡面证据 · 第 21 条'),
      },
      {
        sequence: 28,
        reason: '多字段：缺套装、缺副词条',
        ocr: '木鸟电音[2]',
        source: 'detail-set + card-art',
        confidence: 'medium',
        rule: 'cross_field_review_required',
        detailPath: image('脱敏详情证据 · 第 28 条'),
        cardPath: image('脱敏卡面证据 · 第 28 条'),
      },
    ],
  }
}
