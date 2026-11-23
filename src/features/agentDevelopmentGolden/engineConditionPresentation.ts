import { playerConditionLines } from '../../application/playerDecisionPresentation'

export function engineConditionPresentation(
  engineConditions: readonly string[],
  panelConditions: readonly string[],
) {
  const panelText = playerConditionLines(panelConditions).map((line) => line.text)
  const panelCoversClaretCrit = panelText.some(
    (text) =>
      text.includes('初始暴伤按0.35转换为初始暴击') &&
      text.includes('锐暴伤害不直接使用普通暴伤倍率'),
  )
  const seen = new Set(panelText)
  return playerConditionLines(engineConditions).filter(({ source, text }) => {
    if (
      /^沿用一般培养参考[；;]\s*\d+(?:\.\d+)?\s*版本实战效果、最佳配装与精确伤害未确认[。.]?$/u.test(
        text,
      )
    )
      return false
    if (
      panelCoversClaretCrit &&
      source === '初始暴击伤害以 0.35 系数转换为暴击率，锐暴伤害本身不使用普通暴击伤害加成。'
    )
      return false
    if (seen.has(text)) return false
    seen.add(text)
    return true
  })
}
