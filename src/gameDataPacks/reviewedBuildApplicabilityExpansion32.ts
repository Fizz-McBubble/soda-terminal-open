import type { CurrentBuildAuthorityField } from './currentBuildAuthority'
import {
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
  getCandidateWarehouseConstraintForTeam,
} from './candidateWarehouseConstraints'
import {
  resolveReviewedTeamDiscDirections,
  type AppliedReviewedTeamDiscDirection,
  type ReviewedTeamDiscConditionContext,
} from './reviewedTeamDiscConditions'
import type { CandidateSetPlanEligibilityContext } from './candidateSetPlanEligibility'
import { currentVersionProjection } from './currentVersionProjection'
import type { StatKey } from '../domain/schemas'

/** These two adopted source branches already feed the solver. This adapter
 * exposes their limited review to guidance without reviewing other old builds. */
const adoptedMiyabiDirections = new Set([
  'miyoushe-77017654-miyabi-remielle-anomaly',
  'miyoushe-77017654-miyabi-remielle-anomaly-m2plus',
])

const statLabels: Partial<Record<StatKey, string>> = {
  hp_flat: '生命值',
  hp_percent: '生命值百分比',
  atk_flat: '攻击力',
  atk_percent: '攻击力百分比',
  def_flat: '防御力',
  def_percent: '防御力百分比',
  crit_rate: '暴击率',
  crit_dmg: '暴击伤害',
  anomaly_proficiency: '异常精通',
  anomaly_mastery: '异常掌控',
  energy_regen: '能量自动回复',
  pen_ratio: '穿透率',
  pen: '穿透值',
  impact: '冲击力',
  ice_dmg: '冰属性伤害',
  fire_dmg: '火属性伤害',
  electric_dmg: '电属性伤害',
  physical_dmg: '物理属性伤害',
  ether_dmg: '以太属性伤害',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function mergeMainSubStats(
  baseField: CurrentBuildAuthorityField,
  direction: AppliedReviewedTeamDiscDirection,
): unknown {
  const baseValue = baseField.value
  const directionMain = direction.mainStats ?? {}
  const mergeLines = (lines: unknown[]) => {
    const remaining = new Set(Object.keys(directionMain))
    const merged = lines.map((line) => {
      if (typeof line !== 'string') return line
      for (const slot of ['4', '5', '6'] as const) {
        if (line.includes(`${slot}号位`) && directionMain[slot]?.length) {
          remaining.delete(slot)
          return `${slot}号位：${directionMain[slot]!.map((key) => statLabels[key] ?? key).join(' / ')}`
        }
      }
      return line
    })
    for (const slot of ['4', '5', '6'] as const)
      if (remaining.has(slot) && directionMain[slot]?.length)
        merged.push(
          `${slot}号位：${directionMain[slot]!.map((key) => statLabels[key] ?? key).join(' / ')}`,
        )
    return merged
  }
  if (isRecord(baseValue) && isRecord(baseValue.mainStats)) {
    return {
      ...baseValue,
      mainStats: { ...baseValue.mainStats, ...directionMain },
      ...(direction.subStatCandidates?.length
        ? { subStats: [...direction.subStatCandidates] }
        : {}),
    }
  }
  if (isRecord(baseValue) && Array.isArray(baseValue.mainStats)) {
    return {
      ...baseValue,
      mainStats: mergeLines(baseValue.mainStats),
      ...(direction.subStatCandidates?.length
        ? { subStats: direction.subStatCandidates.map((key) => statLabels[key] ?? key) }
        : {}),
    }
  }

  if (isRecord(baseValue) && 'main' in baseValue && Array.isArray(baseValue.main)) {
    const newMain = mergeLines(baseValue.main)
    const newSub = direction.subStatCandidates?.length
      ? direction.subStatCandidates.map((k) => statLabels[k] ?? k)
      : baseValue.sub
    return {
      ...baseValue,
      main: newMain,
      sub: newSub,
    }
  }

  if (Array.isArray(baseValue)) {
    const merged = mergeLines(baseValue)
    return direction.subStatCandidates?.length
      ? {
          main: merged.filter((line) => typeof line !== 'string' || !line.startsWith('副词条')),
          sub: direction.subStatCandidates.map((key) => statLabels[key] ?? key),
        }
      : merged
  }

  // A missing baseline cannot supply evidence for undeclared slots or priorities.
  return {
    main: Object.entries(directionMain).map(
      ([slot, stats]) => `${slot}号位：${stats.map((key) => statLabels[key] ?? key).join(' / ')}`,
    ),
    sub: (direction.subStatCandidates ?? []).map((key) => statLabels[key] ?? key),
  }
}

function mainStatEvidence(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (!isRecord(value)) return []
  const lines = value.main ?? value.mainStats
  const main = Array.isArray(lines)
    ? lines.filter((item): item is string => typeof item === 'string')
    : isRecord(value.mainStats)
      ? Object.entries(value.mainStats).flatMap(([slot, stats]) =>
          Array.isArray(stats)
            ? [`${slot}号位：${stats.map((key) => statLabels[key as StatKey] ?? key).join(' / ')}`]
            : [],
        )
      : []
  const sub = value.sub ?? value.subStats
  return [
    ...main,
    ...(Array.isArray(sub)
      ? sub
          .filter((item): item is string => typeof item === 'string')
          .map((key) => `副词条：${statLabels[key as StatKey] ?? key}`)
      : []),
  ]
}

export function reviewedBuildApplicabilityExpansion32(
  agentId: string,
  context: ReviewedTeamDiscConditionContext & CandidateSetPlanEligibilityContext,
  fields: readonly CurrentBuildAuthorityField[],
) {
  if (currentVersionProjection.gameVersion !== '3.2') return null

  if (agentId === 'agent-miyabi') {
    const constraint = getCandidateWarehouseConstraintForTeam(agentId, context)
    const directionId = constraint?.reviewedTeamDirectionId
    const source = constraint?.reviewedTeamDirectionSource
    if (
      !constraint ||
      !directionId ||
      !adoptedMiyabiDirections.has(directionId) ||
      source?.targetVersion !== '3.2' ||
      source.localReviewVersion !== '3.2' ||
      source.sourceVersion !== '3.1' ||
      source.contentHash !== '61077E8797FA13E43CF1BB22398D6F945B468A6057A92BD5B541A7004F302003' ||
      source.bodyHash !== '93079E5DABA56EC66D9227F96A3284805B826AFBDF4606482F41ACAF07097CB0' ||
      constraint.status !== 'candidate' ||
      constraint.mainStats['4']?.join('|') !== 'anomaly_proficiency' ||
      constraint.mainStats['6']?.join('|') !== 'anomaly_mastery' ||
      !constraint.mainStats['5']?.length ||
      constraint.reviewedSubStatCandidates?.join('|') !== 'crit_rate|crit_dmg' ||
      Object.keys(constraint.subStatWeights).length !== 0 ||
      (context.selectedDirectionIdByAgentId?.[agentId] &&
        context.selectedDirectionIdByAgentId[agentId] !== directionId)
    )
      return null
    const contextualApplicability = {
      directionId,
      constraintContentHash: constraint.contentHash,
    }
    const sourceRef: CurrentBuildAuthorityField['sourceRefs'][number] = {
      id: `reviewed-team-disc-${directionId}`,
      sourceVersion: source.sourceVersion,
      evaluatedForVersion: source.localReviewVersion,
      checkedAt: source.localReviewedAt ?? null,
      contentHash: source.contentHash,
    }
    const conditions = [source.localReviewScope ?? '', constraint.boundary].filter(Boolean)
    const replace = (
      fieldId: CurrentBuildAuthorityField['fieldId'],
      value: unknown,
      extraConditions: string[] = [],
    ): CurrentBuildAuthorityField => {
      const base = fields.find((field) => field.fieldId === fieldId)!
      return {
        ...base,
        state: 'ready',
        sourceTier: source.sourceVersion === '3.2' ? 'direct_current_3_2' : 'continuity_reviewed',
        sourceStatus: 'candidate',
        value,
        sourceRefs: [...base.sourceRefs.filter((ref) => ref.id !== sourceRef.id), sourceRef],
        conditions: [...conditions, ...extraConditions],
        blockers: [],
        nextEvidence: [],
        contextualApplicability,
      }
    }
    return {
      constraint,
      sourceRef,
      contextualApplicability,
      fields: [
        replace('build.drive_disc_sets', {
          setPlans: candidateSetPlansForConstraint(constraint),
        }),
        replace(
          'build.main_sub_stats',
          {
            main: (['4', '5', '6'] as const).map(
              (slot) =>
                `${slot}号位：${constraint.mainStats[slot]!.map((key) => statLabels[key] ?? key).join(' / ')}`,
            ),
            sub: (constraint.reviewedSubStatCandidates ?? []).map((key) => statLabels[key] ?? key),
          },
          [
            '原文明确4号精通、6号掌控、副词双暴；5号仅保留原有合法候选，不冒充该段作者首选，不预设数值权重。',
          ],
        ),
      ],
    }
  }

  const baseConstraint = getCandidateWarehouseConstraint(agentId)
  if (!baseConstraint) return null
  const constraint = getCandidateWarehouseConstraintForTeam(agentId, context)
  if (!constraint) return null
  if (constraint.contentHash === baseConstraint.contentHash) return null
  if (
    context.selectedDirectionIdByAgentId?.[agentId] &&
    constraint.reviewedTeamDirectionId &&
    context.selectedDirectionIdByAgentId[agentId] !== constraint.reviewedTeamDirectionId
  ) {
    return null
  }

  const directionId = constraint.reviewedTeamDirectionId ?? `candidate-plan-eligibility-${agentId}`
  const contextualApplicability = {
    directionId,
    constraintContentHash: constraint.contentHash,
  }
  const source = constraint.reviewedTeamDirectionSource
  const directions = resolveReviewedTeamDiscDirections(agentId, context)
  const direction = directions.length === 1 ? directions[0] : null
  const hasMainOverride = Boolean(
    direction &&
    ((direction.mainStats && Object.keys(direction.mainStats).length > 0) ||
      direction.subStatCandidates?.length),
  )
  const discSourceRef: CurrentBuildAuthorityField['sourceRefs'][number] | null = source
    ? {
        id: `reviewed-team-disc-${directionId}`,
        sourceVersion: source.sourceVersion ?? null,
        evaluatedForVersion: source.localReviewVersion ?? source.targetVersion ?? null,
        checkedAt: source.localReviewedAt ?? null,
        contentHash: source.contentHash,
        supportedValues: [source.locator.text],
      }
    : null

  const baseDiscField = fields.find((field) => field.fieldId === 'build.drive_disc_sets')
  if (!baseDiscField) return null

  const discConditions = [
    ...baseDiscField.conditions,
    ...(source?.localReviewScope ? [source.localReviewScope] : []),
    ...(constraint.boundary ? [constraint.boundary] : []),
  ].filter(Boolean)

  const replacedDiscField: CurrentBuildAuthorityField = {
    ...baseDiscField,
    state: baseDiscField.state,
    ...(source
      ? {
          sourceTier: source.sourceVersion === '3.2' ? 'direct_current_3_2' : 'continuity_reviewed',
        }
      : {}),
    sourceStatus: baseDiscField.sourceStatus,
    value: { setPlans: candidateSetPlansForConstraint(constraint) },
    sourceRefs: [
      ...baseDiscField.sourceRefs.filter((ref) => ref.id !== discSourceRef?.id),
      ...(discSourceRef ? [discSourceRef] : []),
      // Additional evidence in a set-only declaration supports the set/teammate
      // condition; stat-image evidence stays on the overridden stat field.
      ...(!hasMainOverride ? (direction?.additionalSources ?? []) : []).map((ref) => ({
        id: ref.id,
        sourceVersion: ref.sourceVersion,
        evaluatedForVersion: ref.authorReviewedVersion ?? null,
        checkedAt: ref.checkedAt,
        contentHash: ref.contentHash,
        supportedValues: [ref.licenseBoundary],
      })),
    ].filter((ref, index, refs) => refs.findIndex((other) => other.id === ref.id) === index),
    conditions: [...new Set(discConditions)],
    contextualApplicability,
  }

  const replacedFields: CurrentBuildAuthorityField[] = [replacedDiscField]

  if (hasMainOverride && direction) {
    const baseMainField = fields.find((field) => field.fieldId === 'build.main_sub_stats')
    if (baseMainField) {
      const mergedValue = mergeMainSubStats(baseMainField, direction)
      const replacedSlots = (['4', '5', '6'] as const).filter(
        (slot) => direction.mainStats?.[slot]?.length,
      )
      const branchValues = mainStatEvidence(mergedValue).filter(
        (value) =>
          replacedSlots.some((slot) => value.startsWith(`${slot}号位`)) ||
          (Boolean(direction.subStatCandidates?.length) && value.startsWith('副词条：')),
      )
      const inheritedValues = mainStatEvidence(baseMainField.value).filter(
        (value) =>
          !replacedSlots.some((slot) => value.startsWith(`${slot}号位`)) &&
          !(direction.subStatCandidates?.length && value.startsWith('副词条：')),
      )
      const additionalRefs: CurrentBuildAuthorityField['sourceRefs'][number][] = (
        direction.additionalSources ?? []
      ).map((s) => ({
        id: s.id,
        sourceVersion: s.sourceVersion ?? null,
        evaluatedForVersion: s.authorReviewedVersion ?? null,
        checkedAt: s.checkedAt ?? null,
        contentHash: s.contentHash ?? null,
        supportedValues: branchValues,
      }))
      const mainSourceRef = discSourceRef
        ? { ...discSourceRef, supportedValues: branchValues }
        : null
      const mainRefs = [
        ...baseMainField.sourceRefs
          .filter(
            (ref) =>
              (!mainSourceRef || ref.id !== mainSourceRef.id) &&
              !additionalRefs.some((a) => a.id === ref.id),
          )
          .map((ref) => ({ ...ref, supportedValues: inheritedValues })),
        ...(additionalRefs.length ? additionalRefs : mainSourceRef ? [mainSourceRef] : []),
      ]
      const slotCondition =
        replacedSlots.length === 3
          ? '4/5/6号位主词条由分支来源明示；副词条继承自原基线。'
          : replacedSlots.length > 0
            ? `${replacedSlots.join('/')}号位主词条由分支来源明示，其余槽位与副词条继承自原基线，不修改基线副词权重。`
            : '主副词条继承自原基线。'

      replacedFields.push({
        ...baseMainField,
        state: baseMainField.state,
        ...(source
          ? {
              sourceTier:
                source.sourceVersion === '3.2' ? 'direct_current_3_2' : 'continuity_reviewed',
            }
          : {}),
        sourceStatus: baseMainField.sourceStatus,
        value: mergedValue,
        sourceRefs: mainRefs,
        conditions: [
          ...baseMainField.conditions,
          direction.subStatCandidates?.length
            ? `${replacedSlots.join('/')}号位及副词条候选由分支原文明示，其余字段继承原基线；候选排列不代表作者收益排名，不展示数值权重。`
            : slotCondition,
        ],
        contextualApplicability,
      })
    }
  }

  return {
    constraint,
    sourceRef: discSourceRef ?? {
      id: `candidate-plan-eligibility-${agentId}`,
      sourceVersion: null,
      evaluatedForVersion: null,
      checkedAt: null,
      contentHash: constraint.contentHash,
    },
    contextualApplicability,
    fields: replacedFields,
  }
}
