import { l3TeamRecommendationSeeds } from '../gameDataPacks/l3TeamRecommendationSeedProjection'
import { stableContentHash } from '../gameDataPacks/types'
import { current31MetaStrengthR1 } from '../teamEngine/currentMetaStrengthR1'
import type { BoxNumericDecision } from './boxNumericDecision'

export const currentTeamDpsCommunityEvidence = Object.freeze([
  {
    sourceId: 'prydwen-remielle-3.1-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/remielle',
    supportsKernelIds: [
      'kernel-3.1-remielle-velina-aria',
      'kernel-3.1-remielle-velina-promeia',
      'kernel-3.1-remielle-velina-burnice',
    ],
  },
  {
    sourceId: 'prydwen-yixuan-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/yixuan',
    supportsKernelIds: ['kernel-3.1-yixuan-lucia-dialyn', 'kernel-3.1-yixuan-pan-astra'],
  },
  {
    sourceId: 'prydwen-promeia-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/promeia',
    supportsKernelIds: ['kernel-3.1-promeia-nangong-yuzuha'],
  },
  {
    sourceId: 'prydwen-pyrois-norma-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/norma',
    supportsKernelIds: ['kernel-3.1-pyrois-norma-sunna'],
  },
  {
    sourceId: 'prydwen-aria-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/aria',
    supportsKernelIds: ['kernel-3.1-aria-sunna-yuzuha'],
  },
  {
    sourceId: 'prydwen-ye-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/ye-shunguang',
    supportsKernelIds: ['kernel-3.1-ye-dialyn-zhao'],
  },
  {
    sourceId: 'prydwen-qingyi-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters/qingyi',
    supportsKernelIds: ['kernel-3.1-zhu-yuan-qingyi-astra'],
  },
  {
    sourceId: 'prydwen-legacy-current-2026-08-30',
    url: 'https://www.prydwen.gg/zenless/characters',
    supportsKernelIds: [
      'kernel-3.1-ellen-lycaon-soukaku',
      'kernel-3.1-jane-burnice-lucy',
      'kernel-3.1-billy-nicole-anby',
    ],
  },
] as const)

type CalibrationStatus = 'not_evaluated' | 'corroborated' | 'needs_revision'

export type TeamDpsInversionCause =
  | 'event_frequency_or_duration'
  | 'resource_loop'
  | 'team_effect_owner_recipient_snapshot'
  | 'field_time_opportunity_cost'
  | 'special_off_field_or_shared_damage'
  | 'asset_or_final_stats_mismatch'
  | 'benchmark_objective_difference'
  | 'actual_model_bug'

const causeExposureByKernel: Readonly<Record<string, readonly TeamDpsInversionCause[]>> = {
  'kernel-3.1-remielle-velina-aria': [
    'event_frequency_or_duration',
    'team_effect_owner_recipient_snapshot',
    'field_time_opportunity_cost',
    'special_off_field_or_shared_damage',
    'benchmark_objective_difference',
  ],
  'kernel-3.1-remielle-velina-burnice': [
    'event_frequency_or_duration',
    'team_effect_owner_recipient_snapshot',
    'field_time_opportunity_cost',
    'special_off_field_or_shared_damage',
    'benchmark_objective_difference',
  ],
  'kernel-3.1-yixuan-lucia-dialyn': [
    'event_frequency_or_duration',
    'resource_loop',
    'team_effect_owner_recipient_snapshot',
    'field_time_opportunity_cost',
    'benchmark_objective_difference',
  ],
  'kernel-3.1-yixuan-pan-astra': [
    'event_frequency_or_duration',
    'resource_loop',
    'team_effect_owner_recipient_snapshot',
    'field_time_opportunity_cost',
    'benchmark_objective_difference',
  ],
  'kernel-3.1-aria-sunna-yuzuha': [
    'event_frequency_or_duration',
    'team_effect_owner_recipient_snapshot',
    'field_time_opportunity_cost',
    'special_off_field_or_shared_damage',
    'benchmark_objective_difference',
  ],
  'kernel-3.1-promeia-nangong-yuzuha': [
    'event_frequency_or_duration',
    'resource_loop',
    'team_effect_owner_recipient_snapshot',
    'field_time_opportunity_cost',
    'special_off_field_or_shared_damage',
    'benchmark_objective_difference',
  ],
}

export const currentTeamDpsInteractionFixtures = Object.freeze([
  {
    fixtureId: 'remielle-velina',
    kernelId: 'kernel-3.1-remielle-velina-aria',
    requiredSharedOperators: [
      'timed_event_schedule',
      'team_effect_resolution',
      'off_field_shared_damage',
      'field_time_opportunity_cost',
    ],
  },
  {
    fixtureId: 'yixuan-lucia',
    kernelId: 'kernel-3.1-yixuan-lucia-dialyn',
    requiredSharedOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'field_time_opportunity_cost',
    ],
  },
  {
    fixtureId: 'promeia-nangong',
    kernelId: 'kernel-3.1-promeia-nangong-yuzuha',
    requiredSharedOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'off_field_shared_damage',
      'field_time_opportunity_cost',
    ],
  },
  {
    fixtureId: 'pyrois-norma',
    kernelId: 'kernel-3.1-pyrois-norma-sunna',
    requiredSharedOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'chain_ultimate_conversion',
      'field_time_opportunity_cost',
    ],
  },
] as const)

export type TeamDpsAuthorityCalibration = {
  contract: 'soda-team-dps-authority-calibration/v1'
  status: CalibrationStatus
  asOf: '2026-08-30'
  population: number
  communityAnchorEvidenceCoverageCount: number
  previousRatingComparableCount: number
  metaBandComparableCount: number
  metaBandInversionCount: number
  previousRatingSpearmanRho: number | null
  largePreviousRatingDeviationCount: number
  inversionDiagnostics: {
    contract: 'soda-team-dps-inversion-diagnostics/v1'
    inversionPairCount: number
    classifiedPairCount: number
    causeExposureCount: Record<TeamDpsInversionCause, number>
    provenRemainingModelBugCount: number
    resolvedModelBugs: Array<{
      bugId: string
      detail: string
      affectedFormationCountBeforeFix: number | null
      status: 'resolved'
    }>
    representativeFixtures: typeof currentTeamDpsInteractionFixtures
    missingSharedOperators: string[]
    sourceBackedContractPendingOperators: string[]
    remainingCalculationContextGaps: string[]
    boundary: string
  }
  rows: Array<{
    kernelId: string
    modelRank: number
    metaBand: 'apex' | 'meta' | 'viable' | null
    previousRatingIndex: number | null
    previousRatingRank: number | null
    communitySourceIds: string[]
    flags: string[]
  }>
  blockers: string[]
  boundary: string
}

function kernelIdOf(candidateId: string) {
  return candidateId.split(':', 1)[0]!
}

function sameMembers(left: readonly string[], right: readonly string[]) {
  return [...left].sort().join('|') === [...right].sort().join('|')
}

function averageRanksDescending(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => right - left)
  return values.map((value) => {
    const first = sorted.indexOf(value)
    const last = sorted.lastIndexOf(value)
    return (first + last) / 2 + 1
  })
}

function pearson(left: readonly number[], right: readonly number[]) {
  if (left.length < 3 || left.length !== right.length) return null
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length
  let covariance = 0
  let leftVariance = 0
  let rightVariance = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index]! - leftMean
    const rightDelta = right[index]! - rightMean
    covariance += leftDelta * rightDelta
    leftVariance += leftDelta ** 2
    rightVariance += rightDelta ** 2
  }
  const denominator = Math.sqrt(leftVariance * rightVariance)
  return denominator === 0 ? null : covariance / denominator
}

export function calibrateCurrentTeamDpsAuthority(
  ranked: ReadonlyArray<
    Pick<BoxNumericDecision['ranked'][number], 'rank' | 'candidateId' | 'memberIds'>
  >,
): TeamDpsAuthorityCalibration {
  const metaBandByKernel = new Map(
    current31MetaStrengthR1.kernelBands.map((entry) => [entry.kernelId, entry.band]),
  )
  const rows = ranked.map((item) => {
    const kernelId = kernelIdOf(item.candidateId)
    const seed = l3TeamRecommendationSeeds.find((entry) =>
      sameMembers(entry.member_stable_ids, item.memberIds),
    )
    const communitySourceIds = currentTeamDpsCommunityEvidence
      .filter((source) => (source.supportsKernelIds as readonly string[]).includes(kernelId))
      .map((source) => source.sourceId)
    return {
      kernelId,
      modelRank: item.rank,
      metaBand: metaBandByKernel.get(kernelId) ?? null,
      previousRatingIndex: seed?.evaluation.non_damage_index ?? null,
      previousRatingRank: null as number | null,
      communitySourceIds,
      flags: [] as string[],
    }
  })

  const seedRows = rows.filter(
    (row): row is typeof row & { previousRatingIndex: number } => row.previousRatingIndex !== null,
  )
  const previousRanks = averageRanksDescending(seedRows.map((row) => row.previousRatingIndex))
  seedRows.forEach((row, index) => {
    row.previousRatingRank = previousRanks[index]!
    if (Math.abs(row.modelRank - previousRanks[index]!) >= 4)
      row.flags.push('large_previous_rating_deviation')
  })

  const bandWeight = { apex: 3, meta: 2, viable: 1 } as const
  let metaBandInversionCount = 0
  for (const higher of rows) {
    if (!higher.metaBand) continue
    for (const lower of rows) {
      if (!lower.metaBand || bandWeight[higher.metaBand] <= bandWeight[lower.metaBand]) continue
      if (higher.modelRank > lower.modelRank) {
        metaBandInversionCount += 1
        higher.flags.push(`ranked_below_${lower.kernelId}`)
      }
    }
  }

  const previousRatingSpearmanRho = pearson(
    seedRows.map((row) => row.modelRank),
    seedRows.map((row) => row.previousRatingRank!),
  )
  const communityAnchorEvidenceCoverageCount = rows.filter(
    (row) => row.communitySourceIds.length > 0,
  ).length
  const largePreviousRatingDeviationCount = rows.filter((row) =>
    row.flags.includes('large_previous_rating_deviation'),
  ).length
  const inversionPairs = rows.flatMap((row) =>
    row.flags
      .filter((flag) => flag.startsWith('ranked_below_'))
      .map((flag) => ({
        higherKernelId: row.kernelId,
        lowerKernelId: flag.slice('ranked_below_'.length),
      })),
  )
  const causeExposureCount: Record<TeamDpsInversionCause, number> = {
    event_frequency_or_duration: 0,
    resource_loop: 0,
    team_effect_owner_recipient_snapshot: 0,
    field_time_opportunity_cost: 0,
    special_off_field_or_shared_damage: 0,
    asset_or_final_stats_mismatch: 0,
    benchmark_objective_difference: 0,
    actual_model_bug: 0,
  }
  for (const pair of inversionPairs) {
    const causes = causeExposureByKernel[pair.higherKernelId] ?? [
      'event_frequency_or_duration',
      'team_effect_owner_recipient_snapshot',
      'field_time_opportunity_cost',
      'benchmark_objective_difference',
    ]
    for (const cause of causes) causeExposureCount[cause] += 1
  }
  const inversionDiagnostics: TeamDpsAuthorityCalibration['inversionDiagnostics'] = {
    contract: 'soda-team-dps-inversion-diagnostics/v1',
    inversionPairCount: inversionPairs.length,
    classifiedPairCount: inversionPairs.length,
    causeExposureCount,
    provenRemainingModelBugCount: 0,
    resolvedModelBugs: [
      {
        bugId: 'wengine-specialty-attack-damage-vocabulary-mismatch',
        detail:
          '代理人 attack specialty 与音擎 damage specialty 未归一，曾错误排除可用音擎；修复后完整账户资产绑定恢复。',
        affectedFormationCountBeforeFix: 1_596,
        status: 'resolved',
      },
      {
        bugId: 'wengine-recommendation-priority-before-numeric-truncation',
        detail:
          '音擎 alternatives 曾按攻略推荐优先级截取前三，使“前三足够”的互斥最优证明失效；现按当前数值目标降序，推荐顺序仅用于同分 tie-break。',
        affectedFormationCountBeforeFix: null,
        status: 'resolved',
      },
    ],
    representativeFixtures: currentTeamDpsInteractionFixtures,
    missingSharedOperators: [],
    sourceBackedContractPendingOperators: [
      'timed_event_schedule',
      'resource_state_transition',
      'team_effect_resolution',
      'field_time_opportunity_cost',
      'off_field_shared_damage',
      'chain_ultimate_conversion',
    ],
    remainingCalculationContextGaps: [
      '共享 operator 已就绪，但条件式效果的数值、持续时间、owner、recipient 与 snapshot 仍缺来源化执行合同。',
      '资源生成、消耗、循环与由资源决定的事件频率尚未形成统一时间轴。',
      '驻场时间、切人时间与动作机会成本尚未进入队伍级调度。',
      '后台、共享、追加、连携与终结技转换伤害尚未统一归属和计时。',
      '固定 30 秒 neutral/direct-potential benchmark 尚未扩展为与玩法场景匹配的多场景基准。',
    ],
    boundary:
      '原因计数允许重叠，表示每个倒挂暴露到哪些来源化执行合同，不表示社区排名是真值。六个共享 operator 与 semantic fixtures 已通过，但 probe 数值不进入生产；资产/finalStats 已完整绑定，剩余倒挂中没有已证实的 model bug。',
  }
  const enoughPopulation = rows.length === current31MetaStrengthR1.kernelBands.length
  const status: CalibrationStatus = !enoughPopulation
    ? 'not_evaluated'
    : metaBandInversionCount === 0 &&
        previousRatingSpearmanRho !== null &&
        previousRatingSpearmanRho >= 0.5
      ? 'corroborated'
      : 'needs_revision'
  const blockers =
    status === 'needs_revision'
      ? [
          `当前统一基线产生 ${metaBandInversionCount} 个跨 Meta band 倒挂。`,
          ...(previousRatingSpearmanRho === null || previousRatingSpearmanRho < 0.5
            ? [
                `与旧配队评级表的 Spearman 相关为 ${previousRatingSpearmanRho?.toFixed(3) ?? '不可计算'}，低于 0.5 校准线。`,
              ]
            : []),
          `${largePreviousRatingDeviationCount} 个可比队伍与旧评级相差至少 4 个名次。`,
          '固定事件 R1 显式排除了条件式队伍效果，不能据此宣称 Team DPS 排序权威。',
        ]
      : status === 'not_evaluated'
        ? ['当前候选集合不是完整 13 队校准基线，不能执行全局权威性判断。']
        : []

  return {
    contract: 'soda-team-dps-authority-calibration/v1',
    status,
    asOf: '2026-08-30',
    population: rows.length,
    communityAnchorEvidenceCoverageCount,
    previousRatingComparableCount: seedRows.length,
    metaBandComparableCount: rows.filter((row) => row.metaBand !== null).length,
    metaBandInversionCount,
    previousRatingSpearmanRho,
    largePreviousRatingDeviationCount,
    inversionDiagnostics,
    rows,
    blockers,
    boundary:
      '社区热门与旧评级只用于外部效度校准，不进入伤害公式、不替代账户资产，也不能把 Candidate 提升为 Formal DPS。',
  }
}

export function applyCurrentTeamDpsAuthorityCalibration(
  decision: BoxNumericDecision,
  calibrationRanked: ReadonlyArray<
    Pick<BoxNumericDecision['ranked'][number], 'rank' | 'candidateId' | 'memberIds'>
  > = decision.ranked,
): BoxNumericDecision {
  const authorityCalibration = calibrateCurrentTeamDpsAuthority(calibrationRanked)
  const claim =
    authorityCalibration.status === 'needs_revision'
      ? {
          strength: 'supported_scope_optimal' as const,
          label: '已支持范围内最优' as const,
          blockers: [...new Set([...decision.claim.blockers, ...authorityCalibration.blockers])],
        }
      : decision.claim
  const core: Omit<BoxNumericDecision, 'fingerprint'> = {
    contract: decision.contract,
    status: decision.status,
    claim,
    ranked: decision.ranked,
    excluded: decision.excluded,
    coverage: decision.coverage,
    authorityCalibration,
    boundary: decision.boundary,
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
