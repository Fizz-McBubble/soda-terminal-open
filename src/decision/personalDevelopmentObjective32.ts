import type { ValueBenchmarkSide } from '../calculation/valueBenchmarkComparison'
import { valueBenchmarkComparabilityKey } from '../calculation/valueBenchmarkComparison'
import { stableContentHash } from '../gameDataPacks/types'

/** A routing contract, not a claim that every character mechanic is modeled. */
type ObjectiveRoute = 'direct' | 'anomaly' | 'daze' | 'shield' | 'support'
const routes: Readonly<Record<string, ObjectiveRoute>> = Object.freeze({
  'agent-anby': 'daze',
  'agent-nekomata': 'direct',
  'agent-nicole': 'support',
  'agent-soldier-11': 'direct',
  'agent-yidhari': 'direct',
  'agent-corin': 'direct',
  'agent-caesar': 'shield',
  'agent-billy': 'direct',
  'agent-miyabi': 'anomaly',
  'agent-koleda': 'daze',
  'agent-anton': 'direct',
  'agent-ben': 'shield',
  'agent-soukaku': 'support',
  'agent-lycaon': 'daze',
  'agent-lucy': 'support',
  'agent-lighter': 'daze',
  'agent-burnice': 'anomaly',
  'agent-grace': 'anomaly',
  'agent-ellen': 'direct',
  'agent-harumasa': 'direct',
  'agent-rina': 'support',
  'agent-yanagi': 'anomaly',
  'agent-zhu-yuan': 'direct',
  'agent-qingyi': 'daze',
  'agent-jane': 'anomaly',
  'agent-seth': 'shield',
  'agent-piper': 'anomaly',
  'agent-hugo': 'direct',
  'agent-orphie-magus': 'direct',
  'agent-astra': 'support',
  'agent-evelyn': 'direct',
  'agent-vivian': 'anomaly',
  'agent-zhao': 'support',
  'agent-pulchra': 'daze',
  'agent-trigger': 'daze',
  'agent-yixuan': 'direct',
  'agent-soldier-0-anby': 'direct',
  'agent-ju-fufu': 'daze',
  'agent-alice': 'anomaly',
  'agent-yuzuha': 'support',
  'agent-pan-yinhu': 'support',
  'agent-ye-shunguang': 'direct',
  'agent-manato': 'direct',
  'agent-lucia': 'support',
  'agent-seed': 'direct',
  'agent-banyue': 'direct',
  'agent-dialyn': 'daze',
  'agent-sunna': 'support',
  'agent-aria': 'anomaly',
  'agent-nangong': 'daze',
  'agent-cissia': 'direct',
  'agent-starlight-billy': 'direct',
  'agent-promeia': 'anomaly',
  'agent-pyrois': 'direct',
  'agent-velina': 'anomaly',
  'agent-norma': 'daze',
  'agent-phoenix': 'anomaly',
  'agent-severian': 'direct',
  'agent-claret': 'direct',
  'agent-roxy': 'daze',
  'agent-remielle': 'support',
  'agent-sigrid': 'direct',
})

export function personalDevelopmentObjectiveRoute32(agentId: string): ObjectiveRoute | null {
  return Object.hasOwn(routes, agentId) ? routes[agentId]! : null
}

export type PersonalFunctionalObjective32 = {
  kind: 'functional_capacity'
  capacityKey: string
  capacityKind: 'source_daze_basis' | 'shield_generation' | 'source_support_target'
  value: number
  unit: '失衡量' | '护盾量' | '攻击力' | '贯穿力' | '%' | '系数'
  contextKey: string
  coverageIdentity: string
  sourceRefs: string[]
  included: string[]
  excluded: string[]
}

export type PersonalObjective32 =
  | PersonalFunctionalObjective32
  | { kind: 'direct_slice' | 'prepared_anomaly'; route: ObjectiveRoute }
  | { kind: 'unavailable'; route: ObjectiveRoute | null; reason: string }

const acceptedBoundaries = new Set([
  'enemy_daze_resistance_and_taken_factors',
  'enemy_current_daze_threshold_and_stun_timeline',
  'daze_to_damage_conversion',
  'current_shield_and_holder',
  'resource_cost_and_action_acquisition',
  'shield_refresh_damage_depletion_and_uptime',
  'shield_to_damage_conversion',
  'prepared_ex_not_observed',
  'recipient_uptime_and_team_damage',
  'prepared_conversion_not_observed',
  'prepared_doll_not_observed',
  'prepared_support_not_observed',
  '其他属性收益、持续时间、覆盖率、治疗、实际团队伤害。',
  'prepared_nicole_hit_not_observed',
  '不代表异常伤害、触发频率、虚光快照或完整循环。',
])

export function resolvePersonalFunctionalObjective32(
  agentId: string,
  side: Pick<ValueBenchmarkSide, 'state' | 'coverage' | 'functionalCapacities32' | 'dimensions'>,
): PersonalObjective32 {
  const route = personalDevelopmentObjectiveRoute32(agentId)
  if (!route) return { kind: 'unavailable', route, reason: '角色身份没有已声明个人目标策略。' }
  if (side.coverage?.domain === 'prepared_anomaly_settlement')
    return { kind: 'prepared_anomaly', route }
  if (
    agentId === 'agent-miyabi' &&
    side.state === 'supported' &&
    side.dimensions.runtime.includes(':miyabiShimotsuki:')
  )
    return { kind: 'direct_slice', route }
  if (route === 'direct') return { kind: 'direct_slice', route }
  if (route === 'anomaly')
    return { kind: 'unavailable', route, reason: '当前固定动作未建立该角色的异常结算目标。' }
  if (
    route === 'support' &&
    ![
      'agent-nicole',
      'agent-lucy',
      'agent-rina',
      'agent-soukaku',
      'agent-yuzuha',
      'agent-astra',
      'agent-pan-yinhu',
      'agent-zhao',
      'agent-sunna',
      'agent-lucia',
      'agent-remielle',
    ].includes(agentId)
  )
    return { kind: 'unavailable', route, reason: '当前个人输入未建立可比较的支持接受者与触发。' }
  const result = side.functionalCapacities32
  const expectedKind =
    route === 'daze'
      ? 'source_daze_basis'
      : route === 'shield'
        ? 'shield_generation'
        : 'source_support_target'
  const capacities = result
    ? result.capacities.filter(
        (row) =>
          row.kind === expectedKind &&
          row.key.startsWith(`${agentId}:`) &&
          (agentId !== 'agent-remielle' || row.key === 'agent-remielle:refringe_coefficient') &&
          (agentId !== 'agent-ben' || row.key === 'agent-ben:special_shield'),
      )
    : []
  // Ben's explicitly named EX self-shield is the objective; its independent
  // core shield remains a separate non-regression constraint.
  if (side.state !== 'supported' || capacities.length !== 1)
    return { kind: 'unavailable', route, reason: '缺少唯一可计算的声明功能目标。' }
  const capacity = capacities[0]!
  if (
    capacity.value === null ||
    !Number.isFinite(capacity.value) ||
    capacity.value < 0 ||
    !capacity.contextKey ||
    !capacity.sourceRefs.length ||
    capacity.excluded.some((item) => !acceptedBoundaries.has(item))
  )
    return { kind: 'unavailable', route, reason: '功能目标的来源、触发或装备效果尚未完整。' }
  const included = [...capacity.included].sort()
  const excluded = [...capacity.excluded].sort()
  const sourceRefs = [...capacity.sourceRefs].sort()
  return {
    kind: 'functional_capacity',
    capacityKey: capacity.key,
    capacityKind: expectedKind,
    value: capacity.value,
    unit:
      route === 'daze'
        ? '失衡量'
        : route === 'shield'
          ? '护盾量'
          : ['agent-pan-yinhu', 'agent-lucia'].includes(agentId)
            ? '贯穿力'
            : ['agent-rina', 'agent-zhao', 'agent-nicole'].includes(agentId)
              ? '%'
              : agentId === 'agent-remielle'
                ? '系数'
                : '攻击力',
    contextKey: capacity.contextKey,
    coverageIdentity: stableContentHash({ sourceRefs, included, excluded }),
    sourceRefs,
    included,
    excluded,
  }
}

/** Personal damage is the primary comparison; functional quantities are kept
 * independently in functionalCapacities32 as non-regression constraints. */
export function resolvePersonalDevelopmentObjective32(
  agentId: string,
  side: Pick<ValueBenchmarkSide, 'state' | 'coverage' | 'functionalCapacities32' | 'dimensions'>,
): PersonalObjective32 {
  const route = personalDevelopmentObjectiveRoute32(agentId)
  if (!route) return { kind: 'unavailable', route, reason: '角色身份没有已声明个人目标策略。' }
  if (side.coverage?.domain === 'prepared_anomaly_settlement')
    return { kind: 'prepared_anomaly', route }
  if (side.state !== 'supported')
    return { kind: 'unavailable', route, reason: '当前个人输出计算不可用。' }
  if (
    route === 'anomaly' &&
    !(agentId === 'agent-miyabi' && side.dimensions.runtime.includes(':miyabiShimotsuki:'))
  )
    return { kind: 'unavailable', route, reason: '当前固定动作未建立该角色的异常结算目标。' }
  return { kind: 'direct_slice', route }
}

export function comparablePersonalFunctionalObjectives32(
  left: ValueBenchmarkSide,
  right: ValueBenchmarkSide,
  a: PersonalObjective32 | undefined,
  b: PersonalObjective32 | undefined,
) {
  return Boolean(
    a?.kind === 'functional_capacity' &&
    b?.kind === 'functional_capacity' &&
    a.capacityKey === b.capacityKey &&
    a.capacityKind === b.capacityKind &&
    a.contextKey === b.contextKey &&
    a.coverageIdentity === b.coverageIdentity &&
    valueBenchmarkComparabilityKey(left, ['disc_loadout']) ===
      valueBenchmarkComparabilityKey(right, ['disc_loadout']),
  )
}

/** The independent Refringe coefficient has a separate, unknown entry ATK
 * buff. Keep that unknown only when its exact initial-ATK operand, declared
 * context and equipment-gap-free source boundary are unchanged. */
export function scopedPersonalFunctionalProtection32(side: ValueBenchmarkSide, agentId: string) {
  const result = side.functionalCapacities32
  if (!result) return null
  const pending = result.capacities.filter((row) => row.value === null)
  if (!pending.length)
    return result.status === 'supported'
      ? { capacities: result.capacities, unresolvedIdentity: null }
      : null
  const entry = pending.length === 1 ? pending[0] : null
  const initialAttack = side.personalFunctionalInputs32?.initialAttack
  if (
    agentId !== 'agent-remielle' ||
    entry?.key !== 'agent-remielle:entry_team_attack' ||
    !Number.isFinite(initialAttack) ||
    !entry.contextKey ||
    !entry.sourceRefs.length ||
    entry.excluded.some(
      (item) => item !== '其他属性收益、持续时间、覆盖率、治疗、实际团队伤害。',
    ) ||
    result.blockers.some(
      (item) => item !== '功能目标缺少已核来源、等级、激活或初始属性/装备上下文：agent-remielle',
    )
  )
    return null
  return {
    capacities: result.capacities.filter((row) => row !== entry),
    unresolvedIdentity: stableContentHash({
      initialAttack,
      key: entry.key,
      context: entry.contextKey,
      sourceRefs: entry.sourceRefs,
      included: entry.included,
      excluded: entry.excluded,
    }),
  }
}
