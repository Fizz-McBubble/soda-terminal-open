/** Public ordinal scale shared by the rating engine and its presentation.
 * It contains no mechanic weights, source ledgers, or model implementation. */
export const teamRecommendationScorePolicy = Object.freeze({
  version: 'generic-reviewed-tier-reference/v3',
  use: 'generic_reference' as const,
  anchors: { 'S+': 94, S: 94, 'A+': 84, A: 74, B: 64 },
  boundary:
    '泛用评级的统一参考刻度；同档缺少可靠偏序时同分，不表示伤害比例、实战胜率或档内精确名次。',
})
