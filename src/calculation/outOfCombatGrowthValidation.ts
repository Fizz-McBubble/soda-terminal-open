import type { PanelInput } from './outOfCombatPanelSupport'
import { legalAscensionsForLevel } from '../gameDataPacks/panel/wEngineGrowth'

/** Preserve input error precedence before core and disc validation. */
export function validateOutOfCombatGrowth(input: PanelInput): string | null {
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 60) {
    return '代理人等级必须在 1 到 60 之间。'
  }
  if (!Number.isInteger(input.ascension) || input.ascension < 0 || input.ascension > 5) {
    return '代理人突破阶段必须在 0 到 5 之间。'
  }
  if (!legalAscensionsForLevel(input.level).includes(input.ascension)) {
    return '代理人等级与突破阶段不匹配。'
  }
  if (
    !Number.isInteger(input.wEngine.level) ||
    input.wEngine.level < 0 ||
    input.wEngine.level > 60
  ) {
    return '音擎等级必须在 0 到 60 之间。'
  }
  if (
    !Number.isInteger(input.wEngine.ascension) ||
    input.wEngine.ascension < 0 ||
    input.wEngine.ascension > 5
  ) {
    return '音擎突破阶段必须在 0 到 5 之间。'
  }
  if (!legalAscensionsForLevel(input.wEngine.level, true).includes(input.wEngine.ascension)) {
    return '音擎等级与突破阶段不匹配。'
  }
  return null
}
