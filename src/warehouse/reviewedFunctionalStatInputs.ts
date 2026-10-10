import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { stableContentHash } from '../gameDataPacks/types'
import type { RetentionUtilityEvidence } from './absoluteDiscRetentionUseFacts'

export const reviewedFunctionalStatInputsPolicy = 'reviewed-normal-functional-inputs-3.2-r1'
export const reviewedFunctionalStatInputsCommit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'
const root = 'libs/zzz/dm-localization/assets/locales/en/'
/** Qualitative M0/P0 input review; not a magnitude, uptime, or damage formula. */
export const reviewedFunctionalStatInputs = [
  {
    agentId: 'agent-nangong',
    upstreamKey: 'NangongYu',
    sha256: '191AE529186874799B9CF4EA147926E1A14A51BF7AB93F1334A4B369F4051CF0',
    inputs: [] as string[],
    incidental: ['atk_', 'anomProf', 'crit_', 'crit_dmg_'],
    locators: [
      'core.desc[0].1',
      'core.desc[0].5',
      'core.desc[0].6',
      'ability.desc.2',
      'ability.desc.5',
      'chain.UltimateMeteorShower.desc.2',
    ],
    semantic:
      'Initial AM converts to Impact. Team DMG and Misstep are fixed bonuses; Abloom/Polarity Disorder reuse original anomaly/disorder damage, not Nangong ATK/AP. Her own anomaly damage remains a separate damage goal.',
    flag: null,
  },
  {
    agentId: 'agent-sunna',
    upstreamKey: 'Sunna',
    sha256: '3C95C73514FD97C7C84B1EB0E3E1D7A32F1BE4135EF88787C8D659D8DE69EACF',
    inputs: ['atk_'],
    incidental: ['anomProf', 'crit_', 'crit_dmg_'],
    locators: [
      'core.desc[0].0',
      'core.desc[0].3',
      'core.desc[0].4',
      'core.desc[0].5',
      'ability.desc',
      'chain',
    ],
    semantic:
      'Angelic Chord-ination grants recipients ATK from Sunna initial ATK, capped by core tier. Cat Gaze damage belongs to the triggering agent; its CRIT/ATK text is not proof that Sunna CR/AP/CD is a team functional input. Healing is skill-level based.',
    flag: 'reviewed.sunna.angelic_chordination',
  },
  {
    agentId: 'agent-yuzuha',
    upstreamKey: 'Yuzuha',
    sha256: '15EA219CAD4890D0EC8EEDB014648A32ECA7534412E47F6BA221CF50F77BBB77',
    inputs: ['atk_'],
    incidental: ['anomProf', 'crit_', 'crit_dmg_'],
    locators: ['core.desc[0].2', 'core.desc[0].3', 'ability.desc.1'],
    semantic:
      'Tanuki Wish reads initial ATK; Additional reads AM, not AP. Tanuki own damage is a separate damage goal.',
    flag: 'reviewed.yuzuha.tanuki_wish',
  },
  {
    agentId: 'agent-zhao',
    upstreamKey: 'Zhao',
    sha256: '422023A95ACBBDD953967757BFA0650061F89A0EBE15602CF959F88AE67F7734',
    inputs: ['hp_'],
    incidental: ['atk_', 'anomProf', 'crit_', 'crit_dmg_'],
    locators: [
      'core.desc[0].0',
      'core.desc[0].5',
      'core.desc[0].6',
      'ability.desc.0',
      'ability.desc.1',
      'special.SpecialAttackShatterfrostSurge.desc.2',
    ],
    semantic:
      '初始生命参与凝聚力团队增伤；特殊技治疗读取最大生命。需确认对应技能已触发，团队增伤另需符合队伍与帷幕条件；战斗生命增益不计入初始生命。给予暴击不代表读取自身暴击。',
    flag: 'reviewed.zhao.crystallization',
    alternateFlag: 'reviewed.zhao.hp_healing',
    policyId: 'reviewed-zhao-hp-functional-input-3.2-r1',
  },
] as const

/** Fallback for incomplete GO IR only. The caller must keep positive consumed IR first.
 * Non-base contexts are deliberately unreviewed: no M1–6/potential absence inference.
 */
export function resolveReviewedFunctionalStatInput(input: {
  agentId: string
  effectStat: string
  mindscape: number
  potential: number
  flags?: Readonly<Record<string, boolean>>
  sourceBinding?: { commit: string; localizationSha256: string }
}): RetentionUtilityEvidence & { fingerprint: string; sourceLocators: string[] } {
  const row = reviewedFunctionalStatInputs.find((candidate) => candidate.agentId === input.agentId)
  const commit =
    input.sourceBinding?.commit ?? getCurrentAgentEventContract(input.agentId)?.source.commit
  const binding =
    row &&
    commit === reviewedFunctionalStatInputsCommit &&
    (!input.sourceBinding || input.sourceBinding.localizationSha256 === row.sha256)
  const base = input.mindscape === 0 && input.potential === 0
  const provenInput = row?.inputs.some((stat) => stat === input.effectStat)
  const excluded = row?.incidental.some((stat) => stat === input.effectStat)
  const flags = row
    ? [row.flag, ...('alternateFlag' in row ? [row.alternateFlag] : [])].filter(
        (flag) => flag !== null,
      )
    : []
  const enabled = flags.some((flag) => input.flags?.[flag] === true)
    ? true
    : flags.length && flags.every((flag) => input.flags?.[flag] === false)
      ? false
      : undefined
  const policy = row && 'policyId' in row ? row.policyId : reviewedFunctionalStatInputsPolicy
  const state =
    !binding || !base
      ? 'missing_fact'
      : provenInput
        ? enabled === undefined
          ? 'conditional'
          : enabled
            ? 'valid'
            : 'incidental'
        : excluded
          ? 'incidental'
          : 'missing_fact'
  const sourceLocators = row
    ? row.locators.map((locator) => `${root}char_${row.upstreamKey}_gen.json#${locator}`)
    : []
  const evidenceIds = row ? [`reviewed-localization:${commit}:${row.sha256}`, policy] : []
  return {
    state,
    predicateId: `${policy}:${input.effectStat}`,
    evidenceIds,
    sourceLocators,
    detail:
      state === 'missing_fact'
        ? '当前版本、源哈希或非M0/P0上下文未覆盖；保持缺事实。'
        : state === 'conditional'
          ? `${row!.semantic} Required actual state: ${flags.join(' or ')}; parameter is qualitative, not a consumed numerical formula.`
          : row!.semantic,
    fingerprint: stableContentHash({
      policy,
      input,
      row,
      commit,
      state,
    }),
  }
}
