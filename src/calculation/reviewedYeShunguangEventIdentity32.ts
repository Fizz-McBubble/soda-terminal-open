import { stableContentHash } from '../gameDataPacks/types'

const yeId = 'agent-ye-shunguang'
const zhaoId = 'agent-zhao'
const commit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'

/** Reviewed localization components supplement the upstream sheet's TODOs.
 * Values are fractions, not percent points. No action count or uptime is supplied. */
export const reviewedYeShunguangEventPolicy32 = {
  contract: 'soda-reviewed-ye-zhao-event-effects32/v1',
  sourceTextEvidence: {
    yeM1: "The <ct color=#FFFFFF>Unity</ct> effect from <ct color=#FFFFFF>Core Passive: Burning Clarity</ct> increases DMG dealt by an additional 10%, and they ignore 20% of the target's DEF.",
    yeM2: "The max stack count of <ct color=#FFFFFF>Bearer</ct> increases to 6, and <ct color=#FFFFFF>Culmination</ct> can stack up to 9 times. While in the <ct color=#FFFFFF>Enlightened Mind</ct> state, each point of <ct color=#FFFFFF>Qingming Sword Force</ct> consumed grants 1 stack of <ct color=#FFFFFF>Culmination</ct>. <ct color=#FFFFFF>EX Special Attack: Enlightened Mind - Soaring Light</ct> and <ct color=#FFFFFF>Ultimate: Cleaving Heavens</ct>'s DMG ignore 40% of the target's DEF.",
    yeVerdict:
      'While <ct color=#FFFFFF>Ether Veil: Verdict</ct> is active, when an enemy enters <ct color=#FFFFFF>Ether Veil: Verdict</ct>, they gain a Veil Vulnerability effect based on their current Stun DMG Multiplier. During this, when Ye Shunguang deals DMG to enemies with her skills, enemy Stun DMG Multiplier is ignored and replaced with the Veil Vulnerability bonus. Veil Vulnerability caps at 110%. The effect is removed when <ct color=#FFFFFF>Ether Veil: Verdict</ct> ends.',
    yeM4: 'Upon entering the battlefield, gains 1,000 Decibels. In Investigation Zone mode, this effect can trigger once every 180s. The Vulnerability bonus provided by <ct color=#FFFFFF>Ether Veil: Verdict</ct> is increased to a maximum of 200%.',
    yeCleaving: {
      '0': 'After consuming Decibels to launch <ct color=#FFFFFF>Ultimate: Chasing Storms</ct> and while in the <ct color=#FFFFFF>Enlightened Mind</ct> state, press <IconUltimateReady /> or hold <IconSpecialReady /> when all <ct color=#FFFFFF>Qingming Sword Force</ct> is expended to activate:',
      '1': 'Summons a massive blade, dealing massive <ct color=#F0D12B>Physical DMG</ct> to enemies.',
      '2': 'Ye Shunguang will not exit the <ct color=#FFFFFF>Enlightened Mind</ct> state during this skill.',
      '3': 'After using this skill, the <ct color=#FFFFFF>Enlightened Mind</ct> state ends, and <ct color=#FFFFFF>Ether Veil: Verdict</ct> is removed.',
      '4': "This skill doesn't consume Decibels.",
      '5': 'Character is invulnerable while using this skill.',
    },
    zhaoM1:
      "When Zhao switches out of being the active character, all squad members' DMG ignores 15% of the target's All-Attribute RES for 50s.",
  },
  commit,
  ye: {
    statsPath: 'libs/zzz/stats/Data/Characters/YeShunguang.json',
    statsSha256: '99342202B3CD34C9BE1AAC5E15E85F394019AE15D33C442230187A43B3D20BA5',
    formulaSha256: 'C9B8003134CB45D551D4F4583B1D468FEB0BB4F2C3FAF708EFE06F9966B222FD',
    localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_YeShunguang_gen.json',
    localizationSha256: 'E6B9F09FD78573BF27CF6877AE30BE679CA99311CD3D769BEFA686BD71D513ED',
    unity: { locator: 'mindscapes/1/desc/1', damageBonus: 0.1, defenseIgnore: 0.2 },
    m2: {
      locator: 'mindscapes/2/desc',
      defenseIgnore: 0.4,
      eventIds: [
        'special.EXSpecialAttackEnlightenedMindSoaringLight.hit-0',
        'chain.UltimateCleavingHeavens.hit-0',
      ],
    },
    verdict: {
      locator: 'core/desc/6/2..3',
      vulnerabilityCap: 1.1,
      m4Locator: 'mindscapes/4/desc',
      m4VulnerabilityCap: 2,
      replacement: 'ignore-enemy-stun-multiplier-use-explicit-verdict-vulnerability',
      unstatedConversion: 'unknown-no-derived-stun-to-verdict-formula',
    },
    cleaving: { locator: 'chain/UltimateCleavingHeavens/desc/0', requiresPaidChasing: true },
  },
  zhao: {
    statsPath: 'libs/zzz/stats/Data/Characters/Zhao.json',
    statsSha256: '64CF480CCEE2AD0C6752E5938D49AE1B9658358E202AB0C0852559649826657E',
    formulaSha256: 'D371D769E3EFA7F079DE26EE86762F7001B1025655CAF767D596F79FEF434B15',
    localizationPath: 'libs/zzz/dm-localization/assets/locales/en/char_Zhao_gen.json',
    localizationSha256: '422023A95ACBBDD953967757BFA0650061F89A0EBE15602CF959F88AE67F7734',
    m1: {
      locator: 'mindscapes/1/desc',
      resistanceIgnore: 0.15,
      durationSeconds: 50,
      elapsedRangePolicy: 'source-window-subset-with-explicit-evidence-no-point-time-inference-v1',
    },
  },
} as const

export const reviewedYeShunguangEventIdentity32 = stableContentHash(
  reviewedYeShunguangEventPolicy32,
)

export const reviewedYeShunguangEventKeys32 = {
  unityDamage: `${yeId}:reviewed_m1_unity_damage32`,
  unityDefenseIgnore: `${yeId}:reviewed_m1_unity_defense_ignore32`,
  enhancedDefenseIgnore: `${yeId}:reviewed_m2_named_defense_ignore32`,
  verdict: `${yeId}:reviewed_verdict_replacement32`,
  zhaoResistanceIgnore: `${zhaoId}:reviewed_m1_switch_out_resistance_ignore32`,
} as const

export function reviewedYeShunguangEventSourceRefs32(agentId: string): string[] {
  const source =
    agentId === yeId ? reviewedYeShunguangEventPolicy32.ye : reviewedYeShunguangEventPolicy32.zhao
  return [
    `https://github.com/frzyc/genshin-optimizer@${commit}`,
    `${source.statsPath}#sha256=${source.statsSha256}`,
    `${source.localizationPath}#sha256=${source.localizationSha256}`,
  ]
}
