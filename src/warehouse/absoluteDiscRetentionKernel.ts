import type {
  Disc,
  Catalog,
  QualityPolicy,
  QualityEvidence,
  Decision,
  Disposition,
  RetentionBlocker,
  RetentionReasonKind,
  RetentionNextAction,
  Profile,
  SetFacts,
} from './absoluteDiscRetentionContract'
import {
  history,
  profileValid,
  scoreProfile,
  twoPieceApplicability,
} from './absoluteDiscRetentionScoring'
import { approvedRarityRetention } from './approvedRarityRetention'
export type * from './absoluteDiscRetentionContract'
export { twoPieceApplicability } from './absoluteDiscRetentionScoring'
const EPS = 1e-8

function relevant(disc: Disc, profile: Profile, set: SetFacts | undefined) {
  // A verified negative main/set gate remains valid even if an unrelated numeric field is malformed.
  if (!profile.verified || !profile.sourceIds.length) return true
  if (
    disc.slot > 3 &&
    profile.mainStatsBySlot[String(disc.slot)]?.[disc.mainStat] === 'incompatible'
  )
    return false
  return (
    !set ||
    twoPieceApplicability(set, profile) !== 'incompatible' ||
    (profile.fourPieceUses?.[disc.setId] ?? 'incompatible') !== 'incompatible'
  )
}
function coverageBlockers(
  disc: Disc,
  catalog: Catalog,
  set: SetFacts | undefined,
): RetentionBlocker[] {
  const blockers: RetentionBlocker[] = []
  const add = (field: string, detail: string) =>
    blockers.push({
      kind: 'missing_fact',
      field,
      predicateId: `coverage:${field}`,
      detail,
      sourceIds: [],
    })
  if (catalog.factsGameVersion !== catalog.assessmentGameVersion)
    add('gameVersion', '资料版本与分析版本不一致。')
  const released = new Set(catalog.releasedAgentIds)
  if (!released.size || released.size !== catalog.releasedAgentIds.length)
    add('releasedAgentIds', '已发布角色范围缺失或重复。')
  if (new Set(catalog.profiles.map((row) => row.id)).size !== catalog.profiles.length)
    add('profileIds', '构筑分支身份重复。')
  for (const agentId of released) {
    if (catalog.profiles.some((row) => row.agentId === agentId)) continue
    if (!catalog.coverageGaps?.some((gap) => gap.agentId === agentId))
      add(`profiles.${agentId}`, '该已发布角色缺少构筑分支。')
  }
  if (!catalog.branchCoverageComplete && !catalog.coverageGaps?.length)
    add('branchCoverage', '缺少已发布构筑范围的覆盖证明。')
  for (const gap of catalog.coverageGaps ?? []) {
    if (gap.setIds?.length && !gap.setIds.includes(disc.setId)) continue
    if (gap.slots?.length && !gap.slots.includes(disc.slot)) continue
    if (gap.mainStats?.length && !gap.mainStats.includes(disc.mainStat)) continue
    blockers.push({ ...gap, kind: 'missing_fact', predicateId: `coverage:${gap.field}` })
  }
  if (
    !set?.verified ||
    !set.sourceIds.length ||
    !set.twoPieceEffects.length ||
    set.twoPieceEffects.some((effect) => !Number.isFinite(effect.value) || effect.value <= 0)
  )
    add(`sets.${disc.setId}`, '该套装身份或两件效果尚未闭合。')
  return blockers
}
const ordered = (rows: readonly QualityEvidence[]) =>
  [...rows].sort(
    (a, b) => b.currentScore - a.currentScore || a.profileId.localeCompare(b.profileId),
  )
function action(
  kind: RetentionNextAction['kind'],
  detail: string,
  stopWhen: string,
  targetLevel: number | null = null,
): RetentionNextAction {
  return { kind, detail, stopWhen, targetLevel }
}

/** One entity, one complete use at a time. Ownership and protection never enter quality or investment. */
export function assessDisc(
  disc: Disc,
  catalog: Catalog,
  policy: QualityPolicy,
  annotation: { readonly protected?: boolean; readonly ownedAgentIds?: readonly string[] } = {},
): Decision {
  const evidence: QualityEvidence[] = []
  let disposition: Disposition = 'review'
  let reasonKind: RetentionReasonKind = 'missing_fact'
  let reasons: string[]
  let sourceCoverage: Decision['sourceCoverage'] = 'partial'
  let blockedBy: RetentionBlocker[] = []
  let witnesses: QualityEvidence[] = []
  let nextAction = action(
    'complete_data',
    '补齐列出的用途或品质资料后重新分析。',
    '缺口未闭合时暂停清理。',
  )
  try {
    history(disc, catalog.rules)
    const rarityDecision = approvedRarityRetention(disc, policy, Boolean(annotation.protected))
    if (rarityDecision) return rarityDecision
    const released = new Set(catalog.releasedAgentIds)
    const sets = catalog.sets.filter((row) => row.id === disc.setId)
    const set = sets.length === 1 ? sets[0] : undefined
    const gaps = coverageBlockers(disc, catalog, set)
    for (const profile of catalog.profiles.filter((row) => released.has(row.agentId))) {
      if (!profileValid(profile, catalog.rules)) {
        if (relevant(disc, profile, set))
          gaps.push({
            kind: 'missing_fact',
            profileId: profile.id,
            agentId: profile.agentId,
            field: 'profile',
            predicateId: `${profile.id}:profile`,
            detail: '相关构筑来源、数值权重或功能字段未通过校验。',
            sourceIds: profile.sourceIds,
          })
        continue
      }
      try {
        evidence.push(scoreProfile(disc, profile, set, catalog.rules, policy))
      } catch {
        if (relevant(disc, profile, set))
          gaps.push({
            kind: 'missing_fact',
            profileId: profile.id,
            agentId: profile.agentId,
            field: 'quality',
            predicateId: `${profile.id}:quality`,
            detail: '相关构筑缺少可计算的合法副词品质标尺。',
            sourceIds: profile.sourceIds,
          })
      }
    }
    const relevantUses = evidence.filter((row) => row.useState !== 'incompatible')
    const usable = ordered(
      relevantUses.filter((row) => row.useState === 'valid' || row.useState === 'conditional'),
    )
    const missing = relevantUses.filter(
      (row) =>
        row.useState === 'missing_fact' &&
        (!row.cutoffs ||
          row.functionalMain ||
          row.weightEvidence?.method === 'uncalibrated_direction_only' ||
          row.possibleFinalScore.upper + EPS >= row.cutoffs.cleanupBelow),
    )
    for (const row of relevantUses)
      if (!row.cutoffs)
        gaps.push({
          kind: 'policy',
          profileId: row.profileId,
          agentId: row.agentId,
          field: 'cutoffs',
          predicateId: `${row.profileId}:cutoffs`,
          detail: '该构筑和号位缺少有效品质阈值。',
          sourceIds: row.sourceIds,
        })
    const functionalContext = usable.filter(
      (row) =>
        row.functionalState === 'needs_build_context' ||
        ((row.functionalState === 'ready' || row.functionalState === 'needs_level') &&
          row.useState === 'conditional'),
    )
    const functionalBlockers: RetentionBlocker[] = functionalContext.flatMap((row) => [
      {
        kind: 'conditional_use',
        field: 'functionalTarget',
        predicateId: `${row.profileId}:functional-target`,
        profileId: row.profileId,
        agentId: row.agentId,
        detail: row.functionDetail!,
        sourceIds: row.sourceIds,
      },
      ...row.blockers.filter((blocker) => blocker.kind === 'conditional_use'),
    ])
    const materialGaps = [...gaps, ...missing.flatMap((row) => row.blockers)]
    sourceCoverage = materialGaps.length ? 'partial' : 'complete'
    const winner = usable.find(
      (row) => row.cutoffs && row.currentScore + EPS >= row.cutoffs.keepFrom,
    )
    const readyFunction = usable.find(
      (row) => row.functionalState === 'ready' && row.useState === 'valid',
    )
    const growingFunction = usable.find(
      (row) =>
        row.functionalState === 'needs_level' &&
        row.useState === 'valid' &&
        row.investment.remainingNodes > 0 &&
        row.investment.qualified === true,
    )
    const borderline = usable.find(
      (row) => row.cutoffs && row.currentScore + EPS >= row.cutoffs.cleanupBelow,
    )
    const trial = usable.find(
      (row) =>
        row.cutoffs &&
        row.investment.remainingNodes > 0 &&
        row.possibleFinalScore.upper + EPS >= row.cutoffs.cleanupBelow &&
        (row.investment.qualified === true ||
          (!policy.investment && row.investment.qualified === null)),
    )
    const calibrated =
      policy.calibration === 'approved' &&
      (!policy.calibratedRarities || policy.calibratedRarities.includes(disc.rarity))
    const strictLow =
      usable.length > 0 &&
      usable.every(
        (row) => row.cutoffs && row.possibleFinalScore.upper + EPS < row.cutoffs.cleanupBelow,
      )
    if (winner) {
      disposition = 'keep'
      witnesses = [winner]
      reasonKind = winner.useState === 'conditional' ? 'conditional_use' : 'quality_keep'
      reasons = ['absolute_quality_pass']
      blockedBy = winner.blockers.filter((row) => row.kind === 'conditional_use')
      nextAction = action(
        winner.useState === 'conditional' ? 'check_condition' : 'keep',
        winner.useState === 'conditional'
          ? '品质已达到保留线；先核对列出的用途条件，再决定投入或装配。'
          : '该具名构筑已达到品质保留线。',
        winner.useState === 'conditional'
          ? '条件未核对时保留现状并暂停投入，不按理论潜力自动强化。'
          : '无需为了其他副本或库存排名调整去留。',
      )
    } else if (readyFunction) {
      disposition = 'keep'
      reasonKind = 'functional_ready'
      reasons = ['sourced_functional_main_ready']
      witnesses = [readyFunction]
      blockedBy = readyFunction.blockers.filter((row) => row.kind === 'conditional_use')
      nextAction = action(
        'keep',
        readyFunction.functionDetail ?? '该主词已完成已证实的单盘功能。',
        '功能保留不虚增副词品质，也不要求继续追副词。',
      )
    } else if (growingFunction) {
      disposition = 'observe'
      reasonKind = 'try_next_upgrade'
      witnesses = [growingFunction]
      reasons = ['sourced_functional_main_growth', 'substat_ceiling_does_not_limit_main_function']
      nextAction = action(
        'try_upgrade',
        `已证实的单盘主词功能尚需强化；先到 +${growingFunction.investment.nextLevel} 后重新分析。`,
        '用途前提或记录变化时停止；主词功能完成后按功能保留，不继续追副词。',
        growingFunction.investment.nextLevel,
      )
    } else if (materialGaps.length || functionalBlockers.length) {
      witnesses = functionalContext
      blockedBy = [...materialGaps, ...functionalBlockers]
      reasonKind = materialGaps.length ? 'missing_fact' : 'conditional_use'
      reasons = [
        materialGaps.length
          ? 'incomplete_or_stale_evidence'
          : 'functional_target_needs_build_context',
      ]
      nextAction = action(
        materialGaps.length ? 'complete_data' : 'check_condition',
        materialGaps.length
          ? '按列出的字段补齐相关资料后重新分析。'
          : '先核对列出的用途条件和完整配装中的功能门槛。',
        '前提未核对时暂停投入和清理。',
      )
    } else if (!calibrated) {
      reasonKind = 'missing_fact'
      reasons = [
        policy.calibration !== 'approved'
          ? 'cleanup_policy_not_calibrated'
          : 'rarity_cleanup_threshold_not_calibrated',
      ]
      blockedBy = [
        {
          kind: 'policy',
          field: 'calibration',
          predicateId: policy.id,
          detail: `该品质策略尚未完成 ${disc.rarity} 级的清理校准。`,
          sourceIds: [],
        },
      ]
    } else if (!usable.length) {
      if (catalog.reviewedUseScope) {
        disposition = 'cleanup_candidate'
        reasonKind = 'no_supported_use'
        reasons = ['no_supported_use_in_closed_scope']
        nextAction = action(
          'manual_cleanup',
          '当前版本已审完的支持用途中，没有成立的主词与套装组合。',
          '新版本加入相关用途后重新分析；仅作人工清理候选。',
        )
      } else {
        reasons = ['no_verified_use_is_not_proof_of_worthlessness']
        blockedBy = [
          {
            kind: 'missing_fact',
            field: 'reviewedUseScope',
            predicateId: 'coverage:reviewedUseScope',
            detail: '尚未声明已审完的支持用途范围。',
            sourceIds: [],
          },
        ]
      }
    } else if (strictLow) {
      disposition = 'cleanup_candidate'
      reasonKind = 'proven_low_ceiling'
      witnesses = usable
      reasons = ['all_verified_uses_below_absolute_quality_line', 'legal_growth_cannot_reach_line']
      nextAction = action(
        'manual_cleanup',
        '所有成立用途的当前品质和合法成长上界均低于清理线。',
        '仅作人工清理候选，先确认保护来源。',
      )
    } else if (trial) {
      disposition = 'observe'
      reasonKind = trial.useState === 'conditional' ? 'conditional_use' : 'try_next_upgrade'
      witnesses = [trial]
      blockedBy = [...trial.blockers]
      reasons = ['next_upgrade_trial_qualified', 'not_an_investment_probability']
      nextAction = action(
        trial.useState === 'conditional' ? 'check_condition' : 'try_upgrade',
        trial.useState === 'conditional'
          ? `先核对列出的用途条件，成立后才试到 +${trial.investment.nextLevel}。`
          : `仅建议试到 +${trial.investment.nextLevel}，记录结果后重新分析。`,
        '若用途前提、核心结构或已获得品质未达到该阶段门槛，停止继续投入；不是一路强化到满级。',
        trial.useState === 'conditional' ? null : trial.investment.nextLevel,
      )
    } else if (borderline) {
      disposition = 'observe'
      reasonKind = 'quality_borderline'
      witnesses = [borderline]
      blockedBy = [...borderline.blockers]
      reasons = ['absolute_quality_borderline']
      nextAction = action(
        'review_quality',
        '品质处于清理线与保留线之间，结合具名用途人工复核。',
        borderline.investment.remainingNodes
          ? '只有同时满足下一个节点的投入条件才试强化。'
          : '该盘已满级，继续观察不表示还能强化。',
      )
    } else if (
      policy.investment?.calibration === 'approved' &&
      usable.every((row) => row.investment.qualified === false)
    ) {
      disposition = 'cleanup_candidate'
      reasonKind = 'low_investment_value'
      witnesses = usable
      reasons = ['reviewed_stage_policy_rejects_investment', 'legal_upside_still_exists']
      nextAction = action(
        'manual_cleanup',
        '已审阅的阶段政策下，所有成立用途均不满足下一节点投入条件。',
        '仍可能存在极端好结果；这是低投入价值候选，不是理论上绝无潜力。',
      )
    } else {
      reasons = ['stage_policy_not_closed']
      blockedBy = [
        {
          kind: 'policy',
          field: 'investment',
          predicateId: policy.investment?.id ?? policy.id,
          detail: '该目标或阶段的投入判断尚未校准。',
          sourceIds: [],
        },
      ]
    }
  } catch (error) {
    reasonKind = 'invalid_record'
    reasons = ['invalid_record', error instanceof Error ? error.message : 'unknown_error']
    blockedBy = [
      {
        kind: 'record',
        field: 'enhancementHistory',
        predicateId: 'record:enhancementHistory',
        detail: reasons[1]!,
        sourceIds: catalog.rules.sourceIds,
      },
    ]
    nextAction = action(
      'complete_data',
      '核对等级、初始词条数和真实强化记录。',
      '记录修正前暂停清理。',
    )
  }
  const deduped = [
    ...new Map(
      blockedBy.map((row) => [`${row.profileId ?? ''}:${row.field}:${row.predicateId}`, row]),
    ).values(),
  ]
  const usable = ordered(
    evidence.filter((row) => row.useState === 'valid' || row.useState === 'conditional'),
  )
  const best = witnesses[0] ?? usable[0]
  const useful = evidence.filter(
    (row) =>
      row.useState !== 'incompatible' &&
      (row.functionalMain ||
        (row.cutoffs && row.possibleFinalScore.upper + EPS >= row.cutoffs.cleanupBelow)),
  )
  const owned = new Set(annotation.ownedAgentIds ?? [])
  const agentIds = [...new Set(useful.map((row) => row.agentId))].sort()
  return {
    discId: disc.id,
    qualityDisposition: disposition,
    recommendation: annotation.protected ? 'protected' : disposition,
    reasons: [
      ...(annotation.protected ? ['explicit_account_reference_protection'] : []),
      ...reasons,
    ],
    evidence,
    bestUseProfileId: best?.profileId ?? null,
    bestUseScore: best ? Math.round(best.currentScore * 1e6) / 1e6 : null,
    ownedUseAgentIds: agentIds.filter((id) => owned.has(id)),
    unownedUseAgentIds: agentIds.filter((id) => !owned.has(id)),
    policyId: policy.id,
    sourceCoverage,
    reasonKind,
    nextAction,
    blockedBy: deduped,
    witnessProfileIds: witnesses.map((row) => row.profileId),
    reviewedUseScope: catalog.reviewedUseScope ?? null,
  }
}

/** No allocation, quota, ranking or account writes. */
export function assessWarehouse(
  discs: readonly Disc[],
  catalog: Catalog,
  policy: QualityPolicy,
  annotations: {
    readonly protectedIds?: readonly string[]
    readonly ownedAgentIds?: readonly string[]
  } = {},
): readonly Decision[] {
  const counts = new Map<string, number>()
  for (const disc of discs) counts.set(disc.id, (counts.get(disc.id) ?? 0) + 1)
  const protectedIds = new Set(annotations.protectedIds ?? [])
  return discs.map((disc) => {
    const decision = assessDisc(disc, catalog, policy, {
      protected: protectedIds.has(disc.id),
      ownedAgentIds: annotations.ownedAgentIds,
    })
    return counts.get(disc.id) === 1
      ? decision
      : ({
          ...decision,
          qualityDisposition: 'review',
          recommendation: protectedIds.has(disc.id) ? 'protected' : 'review',
          reasonKind: 'invalid_record',
          reasons: ['duplicate_physical_disc_identity'],
          blockedBy: [
            {
              kind: 'record',
              field: 'discId',
              predicateId: 'record:discId',
              detail: '实体盘 ID 重复，必须先核对记录。',
              sourceIds: [],
            },
          ],
          nextAction: action('complete_data', '先核对重复的实体盘 ID。', '记录修正前暂停清理。'),
        } satisfies Decision)
  })
}
