import { stableContentHash } from '../gameDataPacks/types'
import type { Disc, GameRules, Profile, QualityPolicy } from './absoluteDiscRetentionContract'

const attackSlot = { '2': 'atk_flat' }
const healthSlots = { '1': 'hp_flat', '2': 'atk_flat', '3': 'def_flat' }
/** Approved 24 combinations only; identities bind the reviewed goal, weights, core and sources. */
const namedPolicies: Readonly<Record<string, readonly [string, string, Record<string, string>]>> = {
  'agent-soukaku:base-0:fnv1a-788b': ['45a5c4f7', 'atk_percent', attackSlot],
  'agent-soukaku:base-1:fnv1a-f9a2': ['45a5c4f7', 'atk_percent', attackSlot],
  'agent-soukaku:main-alt-1:anomaly_support': ['a8496042', 'atk_percent', attackSlot],
  'agent-soukaku:main-alt-2:secondary': ['307fe920', 'atk_percent', attackSlot],
  'agent-seth:base-0:fnv1a-f5ec': ['c4e7f103', 'atk_percent', attackSlot],
  'agent-seth:base-1:fnv1a-8e7e': ['c4e7f103', 'atk_percent', attackSlot],
  'agent-seth:base-2:fnv1a-18a1': ['c4e7f103', 'atk_percent', attackSlot],
  'agent-seth:main-alt-0:short_fight': ['4b14e79c', 'atk_percent', attackSlot],
  'agent-astra:base-0:fnv1a-210f': ['f88f9c8', 'atk_percent', attackSlot],
  'agent-astra:base-1:fnv1a-77cc': ['f88f9c8', 'atk_percent', attackSlot],
  'agent-zhao:base-0:fnv1a-2a59': ['44a7cae4', 'hp_percent', healthSlots],
  'agent-zhao:base-1:fnv1a-f244': ['44a7cae4', 'hp_percent', healthSlots],
  'agent-yuzuha:base-0:fnv1a-c737': ['c46e81af', 'atk_percent', attackSlot],
  'agent-yuzuha:base-1:fnv1a-6e0c': ['c46e81af', 'atk_percent', attackSlot],
  'agent-pan-yinhu:base-0:fnv1a-79f0': ['9f66bde5', 'atk_percent', attackSlot],
  'agent-pan-yinhu:base-1:fnv1a-792d': ['9f66bde5', 'atk_percent', attackSlot],
  'agent-lucia:base-0:fnv1a-782d': ['e12e99e8', 'hp_percent', healthSlots],
  'agent-sunna:base-0:fnv1a-e37e': ['a141f52c', 'atk_percent', attackSlot],
}

export function resolveNamedInvestmentCalibration(
  disc: Disc,
  profile: Profile,
  rules: GameRules,
  policy: QualityPolicy,
): { id: string; minimumLines: 1; requiredCoreStat: string } | null {
  const named = namedPolicies[profile.id]
  const investment = policy.investment
  const cutoffs = policy.byProfile[profile.id]?.[String(disc.slot)]
  if (
    !named ||
    !profile.verified ||
    !profile.id.startsWith(`${profile.agentId}:`) ||
    named[2][String(disc.slot)] !== disc.mainStat ||
    disc.rarity !== 'S' ||
    policy.calibration !== 'approved' ||
    !policy.calibratedRarities?.includes('S') ||
    stableContentHash(rules) !== 'fnv1a-50ba626c' ||
    investment?.id !== 'source-goal-stage-investment-r1' ||
    investment.calibration !== 'approved' ||
    investment.meaningfulWeightFrom !== 0.5 ||
    investment.minimumCoreLines !== 1 ||
    investment.leftSlotMinimumLines !== 2 ||
    investment.rightSlotMinimumLines !== 1 ||
    investment.growthTarget !== 'keepFrom' ||
    cutoffs?.cleanupBelow !== 48 ||
    cutoffs.keepFrom !== 60 ||
    cutoffs.premiumFrom !== 67 ||
    [0, 0.25, 0.45, 0.65, 0.85, 1].some(
      (fraction, node) => investment.progressFloorBySpentNode[String(node)] !== fraction,
    )
  )
    return null
  const identity = stableContentHash({
    goal: profile.goal,
    weights: Object.fromEntries(
      Object.entries(profile.weights).sort(([a], [b]) => a.localeCompare(b)),
    ),
    coreStats: [...(profile.coreStats ?? [])].sort(),
    sourceIds: [...profile.sourceIds].sort(),
    weightEvidence: profile.weightEvidence && {
      ...profile.weightEvidence,
      sourceIds: [...profile.weightEvidence.sourceIds].sort(),
    },
  })
  if (identity !== `fnv1a-${named[0]}`) return null
  return {
    id: `named-single-core-investment-r1:${profile.id}:S:${disc.slot}:${disc.mainStat}`,
    minimumLines: 1,
    requiredCoreStat: named[1],
  }
}
