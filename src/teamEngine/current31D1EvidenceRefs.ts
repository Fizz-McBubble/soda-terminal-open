import type { BangbooRule, TeamEngineEvidenceRef } from './contracts'
import {
  reviewedBelionFactionCountMinimumByStar,
  reviewedBiggestFanFactionCountMinimumByStar,
} from '../gameDataPacks/reviewedBangbooActivationSemantics'
const currentGuide = (sourceId: string, locator: string): TeamEngineEvidenceRef => ({
  sourceId,
  gameVersion: '3.1',
  status: 'candidate',
  locator,
})

export const zhuYuanGuide = currentGuide(
  'prydwen-zhu-yuan-3.1-2026-08-24',
  'Core Passive, Additional Ability, current rating and Astra synergy',
)
export const qingyiGuide = currentGuide(
  'prydwen-qingyi-3.1-2026-08-24',
  'Additional Ability, field-time demand and stun multiplier',
)
export const astraGuide = currentGuide(
  'prydwen-astra-3.1-2026-08-24',
  'Additional Ability, Idyllic Cadenza, Quick Assist and team buffs',
)
export const yixuanGuide = currentGuide(
  'prydwen-yixuan-3.1-2026-08-24',
  'Additional Ability, Adrenaline, Sheer Force and current synergy',
)
export const panGuide = currentGuide(
  'prydwen-pan-yinhu-3.1-2026-08-24',
  'Additional Ability, Meridian Flow, Depleted Qi and party ordering',
)

/** Keeps a changed adopted catalog from silently retaining the old two-member predicate. */
export function resolveReviewedBelionActivation(
  factionCountMinimumByStar = reviewedBelionFactionCountMinimumByStar,
): BangbooRule['activation'] {
  if (!factionCountMinimumByStar)
    return {
      status: 'unknown',
      description: '狮耶星级激活阈值的已采用数值目录语义绑定失效，待重新审阅。',
      evidence: [yixuanGuide, panGuide],
    }
  return {
    status: 'modeled',
    predicate: { kind: 'faction_count', faction: '云岿山', minimum: 2 },
    factionCountMinimumByStar,
    description: '额外能力要求云岿山代理人：1至2星至少两名，3至5星至少一名。',
    evidence: [yixuanGuide, panGuide],
  }
}

/** Keeps a changed adopted catalog from silently retaining the old two-member predicate. */
export function resolveReviewedBiggestFanActivation(
  factionCountMinimumByStar = reviewedBiggestFanFactionCountMinimumByStar,
): BangbooRule['activation'] {
  if (!factionCountMinimumByStar)
    return {
      status: 'unknown',
      description: '阿饭星级激活阈值的已采用数值目录语义绑定失效，待重新审阅。',
      evidence: [biggestFanAdoption],
    }
  return {
    status: 'modeled',
    predicate: { kind: 'faction_count', faction: '妄想天使', minimum: 2 },
    factionCountMinimumByStar,
    description: '额外能力要求妄想天使代理人：1至2星至少两名，3至5星至少一名。',
    evidence: [biggestFanAdoption],
  }
}
export const luciaGuide = currentGuide(
  'prydwen-lucia-page-candidate',
  'Current candidate mechanics: Ether Veil, rupture support and Yixuan team relation',
)
export const dialynGuide = currentGuide(
  'prydwen-dialyn-2.4',
  'Current candidate mechanics: stun window, ultimate conversion and Yixuan team relation',
)
export const yixuanLuciaDialynSeed: TeamEngineEvidenceRef = {
  sourceId: 'source-user-confirmed-gpt-r2-team-matrix-r92',
  gameVersion: '3.1',
  status: 'limited',
  locator:
    'TEAM_RECOMMENDATIONS_3.1 row 38; candidate discovery and formation evidence only; non_damage_index/current_top are not strength inputs',
}
export const yixuanPanSeed: TeamEngineEvidenceRef = {
  sourceId: 'source-user-confirmed-gpt-r2-team-matrix-r92',
  gameVersion: '3.1',
  status: 'limited',
  locator:
    'TEAM_RECOMMENDATIONS_3.1 row 55; formation and Sprout relation only; non_damage_index/S tier are not strength inputs',
}
export const yeGuide = currentGuide(
  'prydwen-ye-shunguang-2.5-2026-08-05',
  'Qingming Sword Force, Enlightened Mind, Ether Veil: Verdict, Additional Ability and current strength boundary',
)
export const zhaoGuide = currentGuide(
  'prydwen-zhao-current-2026-08-05',
  'Ether Veil: Wellspring, team buffs, Additional Ability and Ye Shunguang synergy',
)
export const sunnaGuide = currentGuide(
  'prydwen-sunna-2.6-2026-08-05',
  "Cat's Gaze, Ether Veil, team buffs and Additional Ability",
)
export const ariaGuide = currentGuide(
  'prydwen-aria-2.6-2026-08-05',
  'Fandom, Perfect Pitch, Abloom, Additional Ability, current strength and Sunna/Yuzuha synergy',
)
export const yuzuhaGuide = currentGuide(
  'prydwen-yuzuha-current-2026-08-05',
  'Tanuki Wish, anomaly/disorder amplification and Additional Ability',
)
export const promeiaGuide = currentGuide(
  'prydwen-promeia-2.8-2026-07-29',
  'Corrosive Chill, Trial by Cold, Merciless Judgement, Abloom, Additional Ability and current strength',
)
export const nangongGuide = currentGuide(
  'prydwen-nangong-2.7-2026-06-23',
  'Downbeats, Misstep, Dance Prowess, Polarity Disorder, Vibrato and Additional Ability',
)
export const pyroisGuide = currentGuide(
  'prydwen-pyrois-3.0-2026-07-29',
  'Celestial Light, Chain/Ultimate loop, Additional Ability and current strength',
)
export const normaTeamGuide = currentGuide(
  'icyveins-norma-team-2026-07-28',
  'Norma/Pyrois/Sunna representative team, Preheated Chamber, Tech Divide and Ultra Jake relation',
)
export const ultraJakeGuide = currentGuide(
  'noncharacter-r13-source-92653c760e8839ac4499',
  'Additional Ability requires at least one Roscaelifer agent',
)
export const sproutAdoption = currentGuide(
  'game8-sprout-ye-team-2026-08-26',
  'Sprout requires Ye Shunguang and directly supports Ye Shunguang/Dialyn/Zhao',
)
export const biggestFanAdoption = currentGuide(
  'gamevika-biggest-fan-predicate-2026-08-26',
  'Additional Ability requires two Angels of Delusion agents',
)
export const knightbooPredicateAdoption = currentGuide(
  'zzz-wiki-knightboo-support-predicate-2026-08-26',
  'Additional Ability requires at least one Support agent',
)
export const knightbooTeamAdoption = currentGuide(
  'gladiatorboost-promeia-knightboo-team-2026-08-26',
  'Promeia/Nangong/Yuzuha representative team uses Knightboo',
)
export const coverageDiscoverySeed = (row: number, family: string): TeamEngineEvidenceRef => ({
  sourceId: 'source-user-confirmed-gpt-r2-team-matrix-r92',
  gameVersion: '3.1',
  status: 'limited',
  locator: `TEAM_RECOMMENDATIONS_3.1 row ${row}; ${family} discovery/formation only; current_top, S/SS/SSS and non_damage_index are not strength inputs`,
})
