import publicDriveDiscData from '../data/drive-disc-data.v1.json'
import { getCandidateSetLabels, getCandidateStatLabels } from '../application/publicCandidateLabels'
import { publicAssetDiscSetById } from '../application/publicAssetCatalog'
import { getCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import type { DriveDisc, StatKey } from '../domain/schemas'

/**
 * Player-facing driver-disc facts with no private rules, weights or warehouse analysis. The desktop
 * build passes its own validated manifest rules into the same functions, so both builds share one
 * implementation of the value math and the set-name resolution.
 */
export type DiscStatRules = {
  maxLevelByRarity: Record<string, number>
  mainStatBaseByRarity: Record<string, { stat: string; unit?: string; baseValue: number }[]>
  subStatStepsByRarity: Record<string, { stat: string; unit?: string }[]>
}

const publicRules = (publicDriveDiscData as { rules?: DiscStatRules }).rules

export function formatDiscStatValue(
  stat: StatKey,
  value: number,
  prefix = '',
  rules = publicRules,
) {
  const unit = rules
    ? (Object.values(rules.mainStatBaseByRarity)
        .flat()
        .find((rule) => rule.stat === stat)?.unit ??
      Object.values(rules.subStatStepsByRarity)
        .flat()
        .find((rule) => rule.stat === stat)?.unit)
    : undefined
  const number = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
  return `${prefix}${number}${unit === 'percent' ? '%' : ''}`
}

export function displayDiscMainValueWithRules(
  disc: DriveDisc,
  rules: DiscStatRules | null | undefined,
) {
  if (!rules || !disc.rarity) return '数值资料待补齐'
  const rule = rules.mainStatBaseByRarity[disc.rarity]?.find((item) => item.stat === disc.mainStat)
  const maxLevel = rules.maxLevelByRarity[disc.rarity]
  if (!rule || !maxLevel) return '数值资料待补齐'
  return formatDiscStatValue(
    disc.mainStat,
    rule.baseValue * (1 + (3 * disc.level) / maxLevel),
    '',
    rules,
  )
}

export function displayDiscMainValue(disc: DriveDisc) {
  return displayDiscMainValueWithRules(disc, publicRules)
}

/**
 * One set-name resolution for every page. The desktop passes the adopted manifest name (and the
 * 3.1 equipment field where it exists) as `adoptedName`; the public build resolves from the
 * published display catalog and released identities only.
 */
export function resolveDriveDiscSetLabel(setId: string, adoptedName?: string | null) {
  const candidateLabel = getCandidateSetLabels([setId])[0]
  if (candidateLabel && !candidateLabel.includes('资料待补齐')) return candidateLabel
  if (adoptedName) return adoptedName
  const releasedIdentity = getCurrentReleasedIdentity(setId)
  if (releasedIdentity?.releaseState === 'released' && releasedIdentity.stableId.startsWith('set-'))
    return releasedIdentity.playerName
  return '套装资料待补齐'
}

export function displayDriveDiscSet(setId: string) {
  return resolveDriveDiscSetLabel(setId, publicAssetDiscSetById.get(setId)?.playerName)
}

export function discMainStatLabel(disc: DriveDisc) {
  return getCandidateStatLabels([disc.mainStat], '主词条')[0] ?? '主词条待补'
}

export function discSubStatLabel(stat: StatKey) {
  return getCandidateStatLabels([stat], '副词条')[0] ?? '副词条待补'
}
