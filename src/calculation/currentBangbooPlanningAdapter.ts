import { projectCurrentBangbooStats } from '../gameDataPacks/currentBangbooNumericCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { resolveCurrentBangbooMechanicContract } from './currentBangbooMechanicContracts'
import { currentBangbooFixedEventObservation } from './currentNormalizedPlanningBaseline'

function teamComposition(memberIds: readonly [string, string, string]) {
  const composition: Record<string, number> = {}
  const normalizeKey = (value: string) =>
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase()
  for (const agentId of memberIds) {
    const identity = getCurrentAgentEventContract(agentId)?.identity
    composition[`agent:${normalizeKey(agentId.replace(/^agent-/, ''))}`] = 1
    if (!identity) continue
    for (const dimensionKey of [
      `attribute:${normalizeKey(identity.attribute)}`,
      `specialty:${normalizeKey(identity.specialty)}`,
      `faction:${normalizeKey(identity.faction)}`,
    ])
      composition[dimensionKey] = (composition[dimensionKey] ?? 0) + 1
  }
  return composition
}

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

/** Resolves one selected level-60 Bangboo under the normalized one-active/one-chain baseline. */
export function evaluateCurrentBangbooPlanningParameter(input: {
  stableId: string
  stars: number
  memberIds: readonly [string, string, string]
}) {
  const stats = projectCurrentBangbooStats({
    stableId: input.stableId,
    level: 60,
    ascensionLevelCap: 60,
  })
  const mechanic = resolveCurrentBangbooMechanicContract({
    stableId: input.stableId,
    bangbooLevel: 60,
    skillLevel: 10,
    additionalAbilityLevel: input.stars,
    composition: teamComposition(input.memberIds),
    flags: {},
    accumulators: {},
  })
  const blockers = [
    ...(stats.status === 'supported' ? [] : [`邦布 ${input.stableId} 缺少 60 级静态数值。`]),
    ...(mechanic.status === 'unsupported' ? mechanic.blockers : []),
  ]
  const outputs = (mechanic.status === 'supported' ? mechanic.outputs : []) as Array<
    Record<string, unknown>
  >
  const scheduleMutations = outputs.filter((output) => output.operator === 'event_schedule_mutate')
  const excludedOutputs = scheduleMutations.filter((output) => output.mechanic === 'guarantee')
  const unsupportedScheduleMutations = scheduleMutations.filter(
    (output) => output.mechanic !== 'guarantee',
  )
  if (unsupportedScheduleMutations.length)
    blockers.push(
      ...unsupportedScheduleMutations.map(
        (output) =>
          `邦布 ${input.stableId} 的 ${String(output.mechanic)} 会改变固定事件计划，当前 baseline 尚未声明其事件结果。`,
      ),
    )
  const damageEvents = outputs.filter((output) => output.operator === 'damage_event_emit')
  const damageModifiers = outputs.filter(
    (output) =>
      output.operator === 'scoped_modifier_apply' && output.mechanic === 'damage_multiplier',
  )
  const directDamage =
    stats.status === 'supported' && blockers.length === 0
      ? damageEvents.reduce((total, event) => {
          const action = String(event.action)
          const uses =
            action === 'active'
              ? currentBangbooFixedEventObservation.activeUseCount
              : action === 'chain'
                ? currentBangbooFixedEventObservation.chainUseCount
                : 0
          const bonus = damageModifiers
            .filter((modifier) => String(modifier.targetAction).startsWith(action))
            .reduce(
              (sum, modifier) =>
                sum + Number(Array.isArray(modifier.values) ? (modifier.values[0] ?? 0) : 0),
              0,
            )
          return total + stats.attack * Number(event.multiplier) * (1 + bonus) * uses
        }, 0)
      : null
  const core = {
    contract: 'soda-current-bangboo-planning-parameter/v1' as const,
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    stableId: input.stableId,
    level: 60 as const,
    stars: input.stars,
    skillLevel: 10 as const,
    additionalAbilityLevel: input.stars,
    composition: teamComposition(input.memberIds),
    stats: stats.status === 'supported' ? stats : null,
    outputs,
    excludedOutputs,
    directDamage,
    declaredObservation: currentBangbooFixedEventObservation,
    blockers: unique(blockers),
    boundary:
      '星级映射为附加能力 1–5 级；主动技/连携技固定采用 60 级对应技能 10 级。固定计划已声明一次主动与一次连携，guarantee 只作为非数值事件保证显式排除；其他未声明事件变更仍 fail closed。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}

export type CurrentBangbooPlanningParameter = ReturnType<
  typeof evaluateCurrentBangbooPlanningParameter
>
