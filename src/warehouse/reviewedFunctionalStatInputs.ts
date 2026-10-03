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
    inputs: [] as string[],
    incidental: ['atk_', 'anomProf', 'crit_', 'crit_dmg_'],
    locators: ['core.desc[0].0', 'core.desc[0].5', 'core.desc[0].6', 'ability.desc.1'],
    semantic:
      'Source reads initial Max HP for CR and team DMG; team ATK is a core-tier constant. Granting CR does not read owner CR. HP/ER functional uses remain separate.',
    flag: null,
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
  const enabled = row?.flag ? input.flags?.[row.flag] : undefined
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
  const evidenceIds = row
    ? [`reviewed-localization:${commit}:${row.sha256}`, reviewedFunctionalStatInputsPolicy]
    : []
  return {
    state,
    predicateId: `${reviewedFunctionalStatInputsPolicy}:${input.effectStat}`,
    evidenceIds,
    sourceLocators,
    detail:
      state === 'missing_fact'
        ? '当前版本、源哈希或非M0/P0上下文未覆盖；保持缺事实。'
        : state === 'conditional'
          ? `${row!.semantic} Required actual state: ${row!.flag}; parameter is qualitative, not a consumed numerical formula.`
          : row!.semantic,
    fingerprint: stableContentHash({
      policy: reviewedFunctionalStatInputsPolicy,
      input,
      row,
      commit,
      state,
    }),
  }
}
