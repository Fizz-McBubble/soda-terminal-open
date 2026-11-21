import type {
  PlanningConditionCatalogInput32,
  PlanningConditionProjection32,
  PlanningConditionDef32,
} from './currentPlanningConditionCatalog32'
import type { PlanningEventDeclaredCondition32 } from '../application/publicPlanningEventDeclarations32'
import {
  reviewedYeShunguangEventKeys32 as keys,
  reviewedYeShunguangEventSourceRefs32,
} from './reviewedYeShunguangEventIdentity32'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'

/** Vocabulary for the existing scalar public conditions, not a new transport.
 * Numeric vulnerability is a declared binding; no stun conversion is inferred. */
export type ReviewedYeShunguangEventConditions32 = {
  yeShunguangUnity32?: boolean
  yeShunguangEnlightenedMind32?: boolean
  yeShunguangPaidChasingStorms32?: boolean
  yeShunguangVerdictActive32?: boolean
  yeShunguangVerdictTargetInside32?: boolean
  yeShunguangVerdictAtCap32?: boolean
  yeShunguangVerdictVulnerability32?: number
}
export type ReviewedZhaoM1EventConditions32 = {
  zhaoM1SwitchedOut32?: boolean
  zhaoM1SecondsSinceSwitchOut32?: number
}

/** Use once per occurrence; omitted fields remain absent/unknown. */
export function declareReviewedYeShunguangEventConditions32(input: {
  ye?: ReviewedYeShunguangEventConditions32
  zhao?: ReviewedZhaoM1EventConditions32
}): PlanningEventDeclaredCondition32[] {
  return [
    ...Object.entries(input.ye ?? {}).flatMap(([referenceKey, value]) =>
      value === undefined ? [] : [{ providerAgentId: 'agent-ye-shunguang', referenceKey, value }],
    ),
    ...Object.entries(input.zhao ?? {}).flatMap(([referenceKey, value]) =>
      value === undefined ? [] : [{ providerAgentId: 'agent-zhao', referenceKey, value }],
    ),
  ]
}

/** Owner registers this alongside the other reviewed condition-domain helpers.
 * Existing public metadata, signature and trusted re-projection then carry it. */
export function appendReviewedYeShunguangEventConditions32(
  projection: PlanningConditionProjection32,
  input: PlanningConditionCatalogInput32,
) {
  const add = (
    providerAgentId: string,
    referenceKey: string,
    label: string,
    effectKeys: string[],
    numeric?: { maximum: number },
  ) => {
    const sourceRefs = reviewedYeShunguangEventSourceRefs32(providerAgentId)
    const def: PlanningConditionDef32 = {
      providerAgentId,
      referenceKey,
      label,
      valueKind: numeric ? 'number' : 'boolean',
      ...(numeric ? { minimum: 0, maximum: numeric.maximum } : {}),
      sourceRefs,
    }
    const existing = projection.evidence.find(
      (row) => row.providerAgentId === providerAgentId && row.referenceKey === referenceKey,
    )
    if (
      !projection.defs.some(
        (row) => row.providerAgentId === providerAgentId && row.referenceKey === referenceKey,
      )
    )
      projection.defs.push(def)
    const eventIds =
      getCurrentAgentEventContract(input.subjectAgentId)?.eventContract.events.map(
        (event) => event.eventId,
      ) ?? []
    const scopes = effectKeys.map((effectKey) => ({
      effectKey,
      applicationScope: 'generic',
      damageType: null,
      eventIds,
      sourceRefs,
    }))
    if (existing) {
      existing.effectKeys = [...new Set([...existing.effectKeys, ...effectKeys])]
      existing.eventScopes.push(...scopes)
      existing.sourceRefs = [...new Set([...existing.sourceRefs, ...sourceRefs])]
    } else
      projection.evidence.push({
        providerAgentId,
        referenceKey,
        unit: numeric ? 'source_enum' : 'boolean_state',
        meaning: label + '；逐次明确声明，不推定持续、层数或发生次数。',
        integerOnly: false,
        runtimeReference: referenceKey,
        effectKeys,
        eventScopes: scopes,
        sourceRefs,
      })
  }
  if (
    input.subjectAgentId === 'agent-ye-shunguang' &&
    input.memberIds.includes(input.subjectAgentId)
  ) {
    add(input.subjectAgentId, 'yeShunguangUnity32', '该次合光有效', [
      keys.unityDamage,
      keys.unityDefenseIgnore,
    ])
    add(input.subjectAgentId, 'yeShunguangEnlightenedMind32', '该次处于澄明心境', [
      keys.enhancedDefenseIgnore,
      keys.verdict,
    ])
    add(
      input.subjectAgentId,
      'yeShunguangPaidChasingStorms32',
      '本次澄明心境此前逐霆已实际消费喧响',
      [keys.verdict],
    )
    add(input.subjectAgentId, 'yeShunguangVerdictActive32', '该次裁决帷幕有效', [keys.verdict])
    add(input.subjectAgentId, 'yeShunguangVerdictTargetInside32', '当前目标在裁决帷幕内', [
      keys.verdict,
    ])
    add(input.subjectAgentId, 'yeShunguangVerdictAtCap32', '当前目标裁决易伤已达其影画上限', [
      keys.verdict,
    ])
    add(
      input.subjectAgentId,
      'yeShunguangVerdictVulnerability32',
      '当前目标明确绑定的裁决易伤分数值',
      [keys.verdict],
      { maximum: 2 },
    )
  }
  if (input.memberIds.includes('agent-zhao')) {
    add('agent-zhao', 'zhaoM1SwitchedOut32', '照已发生触发一影的换出', [keys.zhaoResistanceIgnore])
    add(
      'agent-zhao',
      'zhaoM1SecondsSinceSwitchOut32',
      '距照最近一次具名换出的有效秒数',
      [keys.zhaoResistanceIgnore],
      { maximum: Number.MAX_SAFE_INTEGER },
    )
  }
}
