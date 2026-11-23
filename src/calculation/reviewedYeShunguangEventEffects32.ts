import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import type { SourceBackedPlanningEffectBucket } from './currentPlanningDamageModifiers'
import {
  reviewedYeShunguangEventPolicy32,
  reviewedYeShunguangEventKeys32,
  reviewedYeShunguangEventSourceRefs32,
} from './reviewedYeShunguangEventIdentity32'
export {
  reviewedYeShunguangEventPolicy32,
  reviewedYeShunguangEventIdentity32,
  reviewedYeShunguangEventKeys32,
  reviewedYeShunguangEventSourceRefs32,
} from './reviewedYeShunguangEventIdentity32'
const yeId = 'agent-ye-shunguang'
const zhaoId = 'agent-zhao'

type ReviewedEventMember32 = Pick<
  PlanningEffectRuntimeMember,
  'agentId' | 'mindscape' | 'skillLevels'
>

type Exclusion = { effectKey: string; reason: string; fields: string[]; sourceRefs: string[] }
export type ReviewedYeVerdictReplacement32 = { vulnerability: number; sourceRefs: string[] }

/** Declared keys travel through the existing per-occurrence Planning conditions.
 * No membership/role is evidence that Unity, a switch, or Verdict is active. */
export function bindReviewedYeShunguangEventEffects32(input: {
  ownerAgentId: string
  members: readonly ReviewedEventMember32[]
  event: { eventId: string; actionId: string; skill: string; skillLevel?: number }
  baselineReferencesByAgentId?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  disabledSupportProviderIds?: readonly string[]
}) {
  const buckets: SourceBackedPlanningEffectBucket[] = []
  const exclusions: Exclusion[] = []
  const blockers: string[] = []
  let verdict: ReviewedYeVerdictReplacement32 | null = null
  const disabled = new Set(input.disabledSupportProviderIds ?? [])
  const add = (
    providerAgentId: string,
    effectKey: string,
    application: SourceBackedPlanningEffectBucket['application'],
    value: number,
    locator: string,
  ) => {
    buckets.push({
      bucketId: `${effectKey}:${input.ownerAgentId}:${input.event.eventId}`,
      effectKey,
      providerAgentId,
      recipientAgentIds: [input.ownerAgentId],
      receiverPath: 'reviewed.source_bound.event',
      damageType: null,
      action: null,
      attribute: null,
      application,
      value,
      sourceRefs: [...reviewedYeShunguangEventSourceRefs32(providerAgentId), locator],
    })
  }
  const unknown = (provider: string, effectKey: string, fields: string[]) =>
    exclusions.push({
      effectKey,
      reason: '具名事件条件未观测；仅保留已结算分量，不视为完整伤害。',
      fields,
      sourceRefs: reviewedYeShunguangEventSourceRefs32(provider),
    })
  const sourceMatches = (member: ReviewedEventMember32) => {
    const expected =
      member.agentId === yeId
        ? reviewedYeShunguangEventPolicy32.ye
        : reviewedYeShunguangEventPolicy32.zhao
    const source = getCurrentAgentEventContract(member.agentId)?.source
    return (
      source?.commit === reviewedYeShunguangEventPolicy32.commit &&
      source.statsSha256 === expected.statsSha256 &&
      source.formulaSha256 === expected.formulaSha256
    )
  }
  const cultivationValid = (member: ReviewedEventMember32) =>
    Number.isInteger(member.mindscape) && member.mindscape >= 0 && member.mindscape <= 6
  const ye = input.members.find((member) => member.agentId === yeId)
  if (input.ownerAgentId === yeId && !ye) blockers.push('ye_event_member_missing32')
  if (input.ownerAgentId === yeId && ye && !disabled.has(yeId)) {
    const sourceEvent = getCurrentAgentEventContract(yeId)?.eventContract.events.find(
      (event) => event.eventId === input.event.eventId,
    )
    if (
      !sourceMatches(ye) ||
      !cultivationValid(ye) ||
      !sourceEvent ||
      sourceEvent.actionId !== input.event.actionId ||
      sourceEvent.skill !== input.event.skill ||
      (input.event.skillLevel !== undefined &&
        ye.skillLevels[input.event.skill] !== input.event.skillLevel)
    )
      blockers.push('ye_event_source_or_cultivation_mismatch32')
    const refs = input.baselineReferencesByAgentId?.[yeId] ?? {}
    const unity = refs.yeShunguangUnity32
    if (ye.mindscape >= 1) {
      if (unity === true) {
        add(
          yeId,
          reviewedYeShunguangEventKeys32.unityDamage,
          'damage_bonus',
          reviewedYeShunguangEventPolicy32.ye.unity.damageBonus,
          'mindscapes/1/desc/1',
        )
        add(
          yeId,
          reviewedYeShunguangEventKeys32.unityDefenseIgnore,
          'defense_ignore',
          reviewedYeShunguangEventPolicy32.ye.unity.defenseIgnore,
          'mindscapes/1/desc/1',
        )
      } else if (unity !== false)
        unknown(yeId, reviewedYeShunguangEventKeys32.unityDamage, ['yeShunguangUnity32'])
    }
    const enhanced =
      input.event.actionId.includes('EnlightenedMind') ||
      [
        'UltimateChasingStorms',
        'UltimateCleavingHeavens',
        'EntrySkillIlluminatingDarkness',
      ].includes(input.event.actionId)
    const mode = refs.yeShunguangEnlightenedMind32
    if (enhanced && mode !== true) blockers.push('ye_enlightened_event_state_missing_or_inactive32')
    if (mode != null && typeof mode !== 'boolean') blockers.push('ye_enlightened_state_invalid32')
    if (
      ye.mindscape >= 2 &&
      (reviewedYeShunguangEventPolicy32.ye.m2.eventIds as readonly string[]).includes(
        input.event.eventId,
      ) &&
      mode === true
    )
      add(
        yeId,
        reviewedYeShunguangEventKeys32.enhancedDefenseIgnore,
        'defense_ignore',
        reviewedYeShunguangEventPolicy32.ye.m2.defenseIgnore,
        'mindscapes/2/desc',
      )
    if (
      input.event.actionId === 'UltimateCleavingHeavens' &&
      refs.yeShunguangPaidChasingStorms32 !== true
    )
      blockers.push('ye_cleaving_requires_prior_decibel_consuming_chasing32')
    if (mode === true) {
      if (refs.yeShunguangVerdictActive32 !== true)
        blockers.push('ye_verdict_active_state_missing_or_inactive32')
      const inside = refs.yeShunguangVerdictTargetInside32
      if (inside !== true && inside !== false) blockers.push('ye_verdict_target_state_unknown32')
      if (inside === true) {
        const cap =
          ye.mindscape >= 4
            ? reviewedYeShunguangEventPolicy32.ye.verdict.m4VulnerabilityCap
            : reviewedYeShunguangEventPolicy32.ye.verdict.vulnerabilityCap
        const atCap = refs.yeShunguangVerdictAtCap32
        const value = refs.yeShunguangVerdictVulnerability32
        if (atCap != null && typeof atCap !== 'boolean')
          blockers.push('ye_verdict_cap_state_invalid32')
        if (
          value !== undefined &&
          (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > cap)
        )
          blockers.push('ye_verdict_value_out_of_source_domain32')
        if (atCap === true && value !== undefined && value !== cap)
          blockers.push('ye_verdict_cap_value_conflict32')
        if (atCap === false && value === cap) blockers.push('ye_verdict_cap_value_conflict32')
        if (atCap !== true && value === undefined)
          blockers.push('ye_verdict_replacement_value_unknown32')
        if (!blockers.length)
          verdict = {
            vulnerability: atCap === true ? cap : (value as number),
            sourceRefs: reviewedYeShunguangEventSourceRefs32(yeId),
          }
      }
    } else if (refs.yeShunguangVerdictActive32 === true)
      blockers.push('ye_verdict_requires_enlightened_state32')
  }
  const zhao = input.members.find((member) => member.agentId === zhaoId)
  if (zhao && !disabled.has(zhaoId)) {
    if (!sourceMatches(zhao) || !cultivationValid(zhao))
      blockers.push('zhao_event_source_or_cultivation_mismatch32')
    if (zhao.mindscape >= 1) {
      const refs = input.baselineReferencesByAgentId?.[zhaoId] ?? {}
      const switched = refs.zhaoM1SwitchedOut32
      const age = refs.zhaoM1SecondsSinceSwitchOut32
      const rawRange = refs.zhaoM1SecondsSinceSwitchOutRange32
      const range =
        rawRange !== null && typeof rawRange === 'object' && !Array.isArray(rawRange)
          ? (rawRange as Record<string, unknown>)
          : null
      const lower = range?.minimumInclusive
      const upper = range?.maximumExclusive
      const evidence = range?.evidenceRefs
      const validRange =
        typeof lower === 'number' &&
        Number.isFinite(lower) &&
        lower >= 0 &&
        typeof upper === 'number' &&
        Number.isFinite(upper) &&
        upper > lower &&
        Array.isArray(evidence) &&
        evidence.length > 0 &&
        evidence.every((ref) => typeof ref === 'string' && ref.trim().length > 0)
      const validAge = typeof age === 'number' && Number.isFinite(age) && age >= 0
      if (
        rawRange !== undefined &&
        (!validRange ||
          switched !== true ||
          (age !== undefined && (!validAge || age < (lower as number) || age >= (upper as number))))
      ) {
        blockers.push('zhao_switch_out_elapsed_range_invalid_or_conflicting32')
      } else if (switched === true && (validAge || validRange)) {
        const duration = reviewedYeShunguangEventPolicy32.zhao.m1.durationSeconds
        const active = validAge ? age < duration : (upper as number) <= duration
        const inactive = validAge ? age >= duration : (lower as number) >= duration
        if (active) {
          add(
            zhaoId,
            reviewedYeShunguangEventKeys32.zhaoResistanceIgnore,
            'resistance_ignore',
            reviewedYeShunguangEventPolicy32.zhao.m1.resistanceIgnore,
            'mindscapes/1/desc',
          )
          if (validRange) buckets[buckets.length - 1]!.sourceRefs.push(...(evidence as string[]))
        } else if (!inactive)
          unknown(zhaoId, reviewedYeShunguangEventKeys32.zhaoResistanceIgnore, [
            'zhaoM1SecondsSinceSwitchOutRange32:crosses_expiry',
          ])
      } else if (switched !== false)
        unknown(zhaoId, reviewedYeShunguangEventKeys32.zhaoResistanceIgnore, [
          'zhaoM1SwitchedOut32',
          'zhaoM1SecondsSinceSwitchOut32',
        ])
    }
  }
  return blockers.length
    ? { status: 'unsupported' as const, blockers }
    : { status: 'supported' as const, buckets, exclusions, verdict }
}
