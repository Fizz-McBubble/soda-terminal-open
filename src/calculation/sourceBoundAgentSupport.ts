import { getL3AgentDevelopmentEvidence } from '../gameDataPacks/l3ProductionProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { evaluateTeamPredicate } from '../teamEngine/teamMethodR1'

// Adopt the already retained field facts, not the generic upstream buff slots.
// Rechecked against the 3.1 Kit / Invitation to Bloom and Mindscape 2 sections.
const evidence = getL3AgentDevelopmentEvidence('agent-remielle')
const facts = [...(evidence?.verifiedFacts ?? []), ...(evidence?.candidateFacts ?? [])]
function fact(field: string, unit: string) {
  const matches = facts.filter(
    (row) => row.fieldPath === field && row.unit === unit && row.gameVersion === '3.1',
  )
  return matches.length === 1 ? matches[0]! : null
}
const ratios = fact('additional_ability.team_atk_ratio_by_anomaly_count', 'ratio_0_1')
const cap = fact('additional_ability.team_atk_flat_cap', 'flat')
const damage = fact('state.phase_flow.team_damage_bonus', 'ratio_0_1')
const m2 = fact('mindscape.2', 'none')
const ruleById = new Map(current31TeamEngineD1Pack.agentRules.map((rule) => [rule.agentId, rule]))
const activation = ruleById.get('agent-remielle')?.additionalAbility
const ratioValues: Record<string, number> | null = (() => {
  if (typeof ratios?.value !== 'string') return null
  try {
    const values = JSON.parse(ratios.value)
    return values &&
      [1, 2, 3].every(
        (count) =>
          typeof values[count] === 'number' && Number.isFinite(values[count]) && values[count] > 0,
      )
      ? values
      : null
  } catch {
    return null
  }
})()
export const sourceBoundAgentSupport = Object.freeze({
  version: 'source-bound-agent-support/v2',
  agentId: 'agent-remielle',
  status: 'candidate' as const,
  sourceVersion: '3.1',
  checkedAt: '2026-09-21',
  sourceUrl: 'https://www.prydwen.gg/zenless/characters/remielle',
  locator:
    'Kit / Additional Ability: Invitation to Bloom; Special Attack: Radiant Turn; Mindscape 2',
  sourcePackage: evidence?.packageId ?? null,
  sourcePackageHash: evidence?.manifestSha256 ?? null,
  activation,
  ratioValues,
  cap:
    typeof cap?.value === 'number' && Number.isFinite(cap.value) && cap.value > 0
      ? cap.value
      : null,
  facts: [ratios, cap, damage, m2].filter((row) => row !== null),
  boundary:
    'Finite source-backed support component; no full combat, uptime, rounding or graduation claim.',
})
export const sourceBoundAgentSupportFingerprint = stableContentHash(sourceBoundAgentSupport)

export function remielleSupportCapabilities() {
  return {
    attack: Boolean(ratioValues && sourceBoundAgentSupport.cap !== null),
    damage: typeof damage?.value === 'number' && damage.value > 0,
    // This fact is M2 anomaly-channel ignore, never an M0 global reduction.
    defenseReduction: false,
  }
}

export type SourceBoundAttackSupport = {
  status: 'supported' | 'inactive' | 'unknown'
  value: number | null
  ratio: number | null
  anomalyCount: number | null
  recipientAgentIds: readonly string[]
  fingerprint: string
  reason: string
}

export function evaluateSourceBoundAttackSupport(input: {
  memberIds: readonly string[]
  initialAttack: number | null
}): SourceBoundAttackSupport {
  const ids = [...input.memberIds].sort()
  const result = (
    status: SourceBoundAttackSupport['status'],
    reason: string,
    value: number | null = null,
    ratio: number | null = null,
    anomalyCount: number | null = null,
  ): SourceBoundAttackSupport => ({
    status,
    reason,
    value,
    ratio,
    anomalyCount,
    recipientAgentIds: ids,
    fingerprint: stableContentHash({
      source: sourceBoundAgentSupportFingerprint,
      ids,
      initialAttack: input.initialAttack,
      status,
      value,
    }),
  })
  if (ids.length !== 3 || new Set(ids).size !== 3 || !ids.includes('agent-remielle'))
    return result('unknown', '需要包含蕾米埃尔的完整三人队伍。')
  const members = ids.map((id) => getCurrentAgentEventContract(id))
  if (members.some((row) => !row)) return result('unknown', '部分成员身份尚未核对。')
  const rules = ids.flatMap((id) => ruleById.get(id) ?? [])
  if (activation?.status !== 'modeled' || rules.length !== ids.length)
    return result('unknown', '额外能力激活条件尚未确认。')
  const active = evaluateTeamPredicate(activation.predicate, {
    agents: rules,
    producedTags: new Set(rules.flatMap((rule) => rule.produces)),
    agentStateById: Object.fromEntries(ids.map((id) => [id, { mindscape: 0 }])),
  })
  if (!active) return result('inactive', '未满足另一名异常或同阵营队友条件。', 0)
  const count = members.filter((row) => row!.identity.specialty === 'anomaly').length
  const ratio = ratioValues?.[String(count)]
  if (
    ratio === undefined ||
    sourceBoundAgentSupport.cap === null ||
    input.initialAttack === null ||
    !Number.isFinite(input.initialAttack) ||
    input.initialAttack < 0
  )
    return result('unknown', '缺少可复算的初始攻击或来源参数。')
  return result(
    'supported',
    '按入场前初始攻击计算的全队攻击支援；不回灌自身初始攻击。',
    Math.min(sourceBoundAgentSupport.cap, input.initialAttack * ratio),
    ratio,
    count,
  )
}
