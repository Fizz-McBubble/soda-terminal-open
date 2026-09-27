import type { TeamRatingBand } from './teamDecisionAuthority'

export const current31VariantRealityProfileContractId =
  'soda-current-3.1-variant-reality-profile/v1' as const

export type Current31VariantRealityProfile = {
  profileId: string
  memberIds: readonly [string, string, string]
  bangbooId: string
  guideStanding: 'premiere' | 'mature' | 'substitute' | 'low_cost'
  realityStanding:
    | 'cross_mode_leading'
    | 'cross_mode_present'
    | 'single_mode_present'
    | 'guide_only'
  bangbooContract: 'fully_activated'
  evidenceRefs: readonly string[]
}

const profiles = [
  {
    profileId: 'reality-yixuan-ju-fufu-lucia-belion',
    memberIds: ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
    bangbooId: 'bangboo-belion',
    guideStanding: 'mature',
    realityStanding: 'cross_mode_present',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/yixuan',
      'https://www.prydwen.gg/zenless/shiyu-defense',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
  {
    profileId: 'reality-ye-sunna-zhao-sprout',
    memberIds: ['agent-ye-shunguang', 'agent-sunna', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    guideStanding: 'premiere',
    realityStanding: 'cross_mode_leading',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/ye-shunguang',
      'https://www.prydwen.gg/zenless/shiyu-defense',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
  {
    profileId: 'reality-aria-nangong-yuzuha-biggest-fan',
    memberIds: ['agent-aria', 'agent-nangong', 'agent-yuzuha'],
    bangbooId: 'bangboo-biggest-fan',
    guideStanding: 'premiere',
    realityStanding: 'single_mode_present',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/aria',
      'https://www.prydwen.gg/zenless/shiyu-defense',
    ],
  },
  {
    profileId: 'reality-remielle-burnice-velina-ariel',
    memberIds: ['agent-remielle', 'agent-burnice', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    guideStanding: 'premiere',
    realityStanding: 'cross_mode_present',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/remielle',
      'https://www.prydwen.gg/zenless/shiyu-defense',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
  {
    profileId: 'reality-yixuan-pulchra-lucia-belion',
    memberIds: ['agent-yixuan', 'agent-pulchra', 'agent-lucia'],
    bangbooId: 'bangboo-belion',
    guideStanding: 'low_cost',
    realityStanding: 'guide_only',
    bangbooContract: 'fully_activated',
    evidenceRefs: ['https://www.prydwen.gg/zenless/characters/yixuan'],
  },
  {
    profileId: 'reality-ye-trigger-zhao-sprout',
    memberIds: ['agent-ye-shunguang', 'agent-trigger', 'agent-zhao'],
    bangbooId: 'bangboo-sprout',
    guideStanding: 'substitute',
    realityStanding: 'single_mode_present',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/ye-shunguang',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
  {
    profileId: 'reality-jane-vivian-yuzuha-robin',
    memberIds: ['agent-jane', 'agent-vivian', 'agent-yuzuha'],
    bangbooId: 'bangboo-robin',
    guideStanding: 'mature',
    realityStanding: 'guide_only',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/jane-doe',
      'https://www.prydwen.gg/zenless/characters/vivian',
    ],
  },
  {
    profileId: 'reality-remielle-jane-velina-ariel',
    memberIds: ['agent-remielle', 'agent-jane', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    guideStanding: 'premiere',
    realityStanding: 'cross_mode_leading',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/remielle',
      'https://www.prydwen.gg/zenless/shiyu-defense',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
  {
    profileId: 'reality-remielle-piper-velina-ariel',
    memberIds: ['agent-remielle', 'agent-piper', 'agent-velina'],
    bangbooId: 'bangboo-ariel',
    guideStanding: 'mature',
    realityStanding: 'cross_mode_present',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/velina',
      'https://www.prydwen.gg/zenless/shiyu-defense',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
  {
    profileId: 'reality-miyabi-vivian-yuzuha-robin',
    memberIds: ['agent-miyabi', 'agent-vivian', 'agent-yuzuha'],
    bangbooId: 'bangboo-robin',
    guideStanding: 'mature',
    realityStanding: 'cross_mode_present',
    bangbooContract: 'fully_activated',
    evidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/miyabi',
      'https://www.prydwen.gg/zenless/characters/vivian',
      'https://www.prydwen.gg/zenless/shiyu-defense',
      'https://www.prydwen.gg/zenless/deadly-assault',
    ],
  },
] as const satisfies readonly Current31VariantRealityProfile[]

function variantKey(memberIds: readonly string[], bangbooId: string) {
  return `${[...memberIds].sort().join('|')}::${bangbooId}`
}

const profileByVariantKey = new Map(
  profiles.map((profile) => [variantKey(profile.memberIds, profile.bangbooId), profile]),
)

export function resolveCurrent31VariantRealityProfile(input: {
  memberIds: readonly [string, string, string]
  bangbooId: string | null
}) {
  if (!input.bangbooId) return null
  return profileByVariantKey.get(variantKey(input.memberIds, input.bangbooId)) ?? null
}

/** Bangboo remains source context; the strength assessment belongs to the trio. */
export function resolveCurrent31TeamRealityProfile(memberIds: readonly string[]) {
  const key = [...memberIds].sort().join('|')
  const matches = profiles.filter((profile) => [...profile.memberIds].sort().join('|') === key)
  if (!matches.length || new Set(matches.map(classifyCurrent31VariantRealityProfile)).size !== 1)
    return null
  return matches[0]
}

export function classifyCurrent31VariantRealityProfile(
  profile: Current31VariantRealityProfile,
): TeamRatingBand {
  if (profile.guideStanding === 'premiere') return 'S'
  if (profile.guideStanding === 'mature') return 'A+'
  return 'B'
}

export const current31VariantRealityProfileSet = Object.freeze({
  contract: current31VariantRealityProfileContractId,
  gameVersion: '3.1',
  profiles,
  boundary:
    '该表只保存精确 Variant 的可追溯事实特征，不保存 Gold Band。Team Strength 由机制有效性与公开的 categorical rule 组合产生；不得用连续经验分、账号投入或 Family 评级替代。',
})
