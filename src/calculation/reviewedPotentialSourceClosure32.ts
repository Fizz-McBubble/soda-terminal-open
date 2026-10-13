import {
  getReviewedPotentialDefinition,
  type PotentialLevelValues,
} from '../gameDataPacks/reviewedPotentialDefinitions'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'

const commit = 'c91eb0933bbb76333d52ffe57d8376ead61f9253'

/** The raw extractor recognizes the number in the name "Soldier 11". Its
 * special-case removal covers Soldier 0 - Anby only. This preserved raw row
 * is therefore not a missing timer, resource or combat operand. */
export const reviewedPotentialRawArtifact32 = Object.freeze({
  agentId: 'agent-soldier-11',
  rawParameterRow: 1,
  rawValuesByLevel: [0, 11, 11, 11, 11, 11] as const,
  disposition: 'character_name_numeric_extraction' as const,
  upstreamCommit: 'eabba1f092b282cccb3f028b7253a1db3dac5208',
  sources: [
    {
      path: 'libs/zzz/stats/src/executors/gen-stats/src/characterData.ts',
      locator: 'extractPotentialParams:199-211',
      sha256: '276e102f8aeb7b46e957374a7802272f3be3d2ac1ad1cebe7e610bc3c5351d3b',
    },
    {
      path: 'libs/zzz/stats/src/executors/gen-stats/src/util.ts',
      locator: 'extractParamsFromString:3-15',
      sha256: '12e7cc922e611c8713dfe1fd76ab9ddfa6536492c73e6afddb6fcbcd80e0a4a3',
    },
    {
      path: 'libs/zzz/dm-localization/assets/locales/en/char_Soldier11_gen.json',
      locator: 'potential.desc[1..5]',
      sha256: 'dc70ebb62ed2dc29e3728954bcb850df6bb99ccbfd525047ad1d537b74604e7f',
    },
  ],
})

export type ReviewedPotentialTimer32 = {
  agentId: string
  stateKey: string
  rawParameterRow: number
  secondsByLevel: PotentialLevelValues
  triggerKeys: readonly string[]
  refresh: 'reset_duration'
  source: { url: string; contentHash: string; locator: string }
}

/** Missing typed timer operands from the already adopted raw rows. These
 * measure source states only; they never become damage or a resource grant.
 * L1 raw parameters are zero. The L1 action changes remain separate mechanics. */
export const reviewedPotentialTimers32: readonly ReviewedPotentialTimer32[] = Object.freeze([
  {
    agentId: 'agent-harumasa',
    stateKey: 'harumasa_focus',
    rawParameterRow: 3,
    secondsByLevel: [0, 0, 12, 12, 12, 12, 12],
    triggerKeys: ['ex_special', 'chain', 'ultimate'],
    refresh: 'reset_duration',
    source: {
      url: `https://raw.githubusercontent.com/pingwinekZ/zzz-nanoka-data-0delay/${commit}/character/1201.json`,
      contentHash: 'd752d0aa4bfd5ad86b9c4659a57f7abb4463e4b7e20d22076c2914bb0611570d',
      locator: 'PotentialDetail.120101..120105.Desc',
    },
  },
  {
    agentId: 'agent-harumasa',
    stateKey: 'harumasa_gleaming_edge',
    rawParameterRow: 4,
    secondsByLevel: [0, 0, 10, 10, 10, 10, 10],
    // This normalized trigger asserts a qualifying critical hit; merely using
    // the action does not prove a crit or create stacks.
    triggerKeys: ['gleaming_edge_qualifying_critical_hit'],
    refresh: 'reset_duration',
    source: {
      url: `https://raw.githubusercontent.com/pingwinekZ/zzz-nanoka-data-0delay/${commit}/character/1201.json`,
      contentHash: 'd752d0aa4bfd5ad86b9c4659a57f7abb4463e4b7e20d22076c2914bb0611570d',
      locator: 'PotentialDetail.120101..120105.Desc; Passive.Level.1201508..1201514.Desc[0]',
    },
  },
  {
    agentId: 'agent-grace',
    stateKey: 'grace_electric_enhancement',
    rawParameterRow: 2,
    secondsByLevel: [0, 0, 25, 25, 25, 25, 25],
    triggerKeys: ['zap_consumed'],
    refresh: 'reset_duration',
    source: {
      url: `https://raw.githubusercontent.com/pingwinekZ/zzz-nanoka-data-0delay/${commit}/character/1181.json`,
      contentHash: 'c3de876211ed55e0d348c2eb772c785b1641d08564b4fbc73be0019b6550b524',
      locator: 'PotentialDetail.118101..118105.Desc',
    },
  },
])

export type ReviewedPotentialTimerObservation32 = {
  ownerAgentId: string
  stateKey: string
  triggeredAt: number
  triggerKey: string
  /** Must identify the adopted raw character, independently of event prose. */
  upstreamRawSha256: string
}

function resolveSourceStateWindow32(input: {
  agentId: string
  stateKey: string
  at: number
  duration: number
  triggerKeys: readonly string[]
  upstreamRawSha256: string
  observations: readonly ReviewedPotentialTimerObservation32[]
  sourceRefs: readonly string[]
}) {
  const relevant = input.observations.filter((row) => row.stateKey === input.stateKey)
  if (
    !relevant.length ||
    relevant.some(
      (row) =>
        row.ownerAgentId !== input.agentId ||
        row.upstreamRawSha256.toLowerCase() !== input.upstreamRawSha256 ||
        !input.triggerKeys.includes(row.triggerKey) ||
        !Number.isFinite(row.triggeredAt) ||
        row.triggeredAt < 0 ||
        row.triggeredAt > input.at,
    )
  )
    return {
      status: 'unknown' as const,
      active: null,
      expiresAt: null,
      reason: 'missing_or_invalid_timer_trigger',
    }
  const expiresAt = Math.max(...relevant.map((row) => row.triggeredAt)) + input.duration
  if (!Number.isFinite(expiresAt))
    return {
      status: 'unknown' as const,
      active: null,
      expiresAt: null,
      reason: 'invalid_timer_expiry',
    }
  return {
    status: 'known' as const,
    active: input.at < expiresAt,
    expiresAt,
    reason: input.at < expiresAt ? 'source_timer_active' : 'source_timer_expired',
    sourceRefs: input.sourceRefs,
  }
}

/** Gates the existing numeric core reference; it does not add any crit damage
 * or infer stack acquisition. P0/P1 retain the adopted five-second base core,
 * while P2..P6 replace its duration with the source ten-second extension. */
export function resolveReviewedHarumasaGleamingEdgeWindow32(input: {
  potential: number | null | undefined
  at: number
  observations: readonly ReviewedPotentialTimerObservation32[]
}) {
  const contract = getCurrentAgentDecisionMechanicContract('agent-harumasa')
  const definition = getReviewedPotentialDefinition('agent-harumasa')
  const source = contract?.effectContract.source
  const refs = contract?.effectContract.runtimeDefaults.references
  const effects = contract?.effectContract.effects
  if (
    !definition ||
    source?.commit !== '3456cd0f6f5bea10e168074502460dac2fcd6df4' ||
    source.formulaSha256 !== '4C8F30B7DF979ED13A05CE49D74C896B14C90BAEA13CCC392142903318ADD616' ||
    refs?.['dm.core.duration'] !== 5 ||
    refs['dm.core.max_stacks'] !== 6 ||
    effects?.find((row) => row.effectId === 'core_dash_crit_dmg_')?.numericExpression
      .expressionSha256 !== '419EB63727B7B10C3ADB5C69206D515D6F46157D1FCA5ED1C4729D7A9CBE18EC' ||
    effects?.find((row) => row.effectId === 'core_ult_crit_dmg_')?.numericExpression
      .expressionSha256 !== '994CF3A172D99AE987FAD854A09E624D6B8D25AA8DCA113F2E6DB2DC3FB9F308' ||
    !Number.isInteger(input.potential) ||
    input.potential == null ||
    input.potential < 0 ||
    input.potential > 6 ||
    !Number.isFinite(input.at) ||
    input.at < 0
  )
    return {
      status: 'unknown' as const,
      active: null,
      expiresAt: null,
      reason: 'invalid_gleaming_edge_source_or_time',
    }
  const timer = reviewedPotentialTimers32.find((row) => row.stateKey === 'harumasa_gleaming_edge')!
  return resolveSourceStateWindow32({
    ...input,
    agentId: 'agent-harumasa',
    stateKey: timer.stateKey,
    duration: input.potential >= 2 ? timer.secondsByLevel[input.potential] : 5,
    triggerKeys: timer.triggerKeys,
    upstreamRawSha256: definition.source.upstreamRawSha256,
    sourceRefs: [
      source.formulaPath,
      `sha256:${source.formulaSha256}`,
      timer.source.url,
      `sha256:${timer.source.contentHash}`,
    ],
  })
}

/** Validates normalized trigger observations, not inferred combat history.
 * Source windows are half open [trigger, trigger + duration). A refresh resets
 * from the latest valid past trigger; future, foreign-owner and stale-source
 * inputs cannot extend a window. Missing/invalid proof remains unknown. */
export function resolveReviewedPotentialTimer32(input: {
  agentId: string
  potential: number
  stateKey: string
  at: number
  observations: readonly ReviewedPotentialTimerObservation32[]
}) {
  const timer = reviewedPotentialTimers32.find(
    (row) => row.agentId === input.agentId && row.stateKey === input.stateKey,
  )
  const definition = getReviewedPotentialDefinition(input.agentId)
  if (
    !timer ||
    !definition ||
    !Number.isInteger(input.potential) ||
    input.potential < 0 ||
    input.potential > 6 ||
    !Number.isFinite(input.at) ||
    input.at < 0
  )
    return {
      status: 'unknown' as const,
      active: null,
      expiresAt: null,
      reason: 'invalid_timer_identity_or_time',
    }
  const duration = timer.secondsByLevel[input.potential]
  if (duration === 0)
    return {
      status: 'known' as const,
      active: false,
      expiresAt: null,
      reason: 'potential_timer_not_unlocked',
    }
  return resolveSourceStateWindow32({
    ...input,
    duration,
    triggerKeys: timer.triggerKeys,
    upstreamRawSha256: definition.source.upstreamRawSha256,
    sourceRefs: [
      timer.source.url,
      `sha256:${timer.source.contentHash}`,
      `upstream-sha256:${definition.source.upstreamRawSha256}`,
      timer.source.locator,
    ],
  })
}
