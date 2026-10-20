import { agentCatalog } from '../assault/catalogData'
import { bwikiPageEvidence, type PlayerBuildSource } from './playerBuildSources'
import { gameData32CatalogEntities } from './gameData32CatalogEntities'
import { incremental32AffectedCapabilityIdentity } from './incremental32AffectedCapabilities'
import { stableContentHash } from './types'

export type TriggerCategory =
  | 'anomaly_disorder'
  | 'support_cinema'
  | 'armorer_laceration'
  | 'defense_disc_set'
  | 'stun_synergy'
  | 'new_32_character'
  | 'new_version_character'

export type BuildDependencyImpactKind =
  | 'direct_patch_change'
  | 'new_32_agent'
  | 'new_version_agent'
  | 'synergy_teammate_affected'
  | 'equipment_set_affected'
  | 'unaffected_retained_reference'

export type BuildDependencyImpact = {
  readonly agentId: string
  readonly impactKind: BuildDependencyImpactKind
  readonly affectedFieldPaths: readonly string[]
  readonly reasons: readonly string[]
  readonly triggerCategories: readonly TriggerCategory[]
  readonly beneficiaryAgentIds: readonly string[]
  readonly authorReviewedVersion: string | null
  readonly originalSourceVersion: string | null
  readonly retrievalDate: string | null
  /** Evaluated relation facts, not serialized function bodies. */
  readonly matchedRelations: readonly {
    readonly ruleId: string
    readonly sourceEntityId: string
    readonly beneficiaryAgentIds: readonly string[]
  }[]
}

export type DirectEntityChange = {
  readonly entityId: string
  readonly affectedFieldPaths: readonly string[]
  readonly triggerCategories: readonly TriggerCategory[]
  readonly reasons: readonly string[]
  readonly beneficiaryRoles?: readonly string[]
}

export type SynergyDependencyRule = {
  readonly id: string
  readonly triggerCategory: TriggerCategory
  readonly sourceEntityId: string
  readonly isRecipientAffected: (agent: {
    readonly id: string
    readonly role: string
    readonly attribute: string
    readonly faction: string
  }) => {
    readonly affected: boolean
    readonly affectedFieldPaths: readonly string[]
    readonly reason: string
    readonly beneficiaries: readonly string[]
  }
}

export type VersionDependencyContext = {
  readonly targetVersion: string
  readonly newEntityIds: ReadonlySet<string>
  readonly directChanges: Readonly<Record<string, DirectEntityChange>>
  readonly synergyRules: readonly SynergyDependencyRule[]
  readonly formulaChangedAgentIds: ReadonlySet<string>
  readonly potentialChangedAgentIds: ReadonlySet<string>
}

// ---------------------------------------------------------------------------
// 3.2 Locked Materials Data Adapter
// ---------------------------------------------------------------------------

const directlyChangedAgentImpacts32: Readonly<Record<string, DirectEntityChange>> = Object.freeze({
  'agent-miyabi': {
    entityId: 'agent-miyabi',
    affectedFieldPaths: [
      'build.team_bangboo_scenario',
      'build.main_sub_stats',
      'build.drive_disc_sets',
      'build.target_panel',
      'progression.potential_overlay',
    ],
    triggerCategories: ['anomaly_disorder'],
    reasons: [
      '3.2 锁定公式更新：追加能力扩充异常队友分支，30%冰抗无视需紊乱触发；新体系构筑及词条权重视队伍目标待复审，不捏造当前复审。',
    ],
    beneficiaryRoles: ['anomaly'],
  },
  'agent-nekomata': {
    entityId: 'agent-nekomata',
    affectedFieldPaths: ['build.team_bangboo_scenario', 'progression.potential_overlay'],
    triggerCategories: ['support_cinema'],
    reasons: [
      '3.2 锁定公式更新：追加能力在潜能>=1时扩充支援队友分支；配队与潜能条件待复审，不把支援身份直接当已触发强击。',
    ],
    beneficiaryRoles: ['support'],
  },
  'agent-piper': {
    entityId: 'agent-piper',
    affectedFieldPaths: ['build.team_bangboo_scenario', 'progression.potential_overlay'],
    triggerCategories: ['anomaly_disorder'],
    reasons: ['3.2 锁定公式更新：追加能力扩充异常队友分支；动力>=20条件保持，配队建议待复审。'],
    beneficiaryRoles: ['anomaly'],
  },
  'agent-koleda': {
    entityId: 'agent-koleda',
    affectedFieldPaths: [
      'build.team_bangboo_scenario',
      'progression.potential_overlay',
      'build.progression',
    ],
    triggerCategories: ['armorer_laceration'],
    reasons: [
      '3.2 锁定公式更新：潜能2–6新增锋御（锐暴）与非锋御（暴伤）受体分化；追加能力扩充锋御队友；配队与潜能受体待复审。',
    ],
    beneficiaryRoles: ['rupture', 'defense'],
  },
})

/**
 * Explicit teammates partnered with Claret in 3.2.
 */
const claretExplicitTeammates = new Set(['agent-rina', 'agent-roxy', 'agent-koleda', 'agent-norma'])

/**
 * Previously illustrated Koleda partners. Absence is not proof of no effect.
 */
const koledaSynergyPartnerAgentIds = new Set(['agent-ben', 'agent-soldier-11', 'agent-anton'])

/**
 * DEF-scaling agents who equip or convert DEF for Thorn Rose (set-34200).
 * Attackers and non-DEF scalers (Ellen, Billy, Corin, Zhu Yuan, etc.) do not equip Thorn Rose.
 */
const defenseScalingAgentIds = new Set([
  'agent-claret',
  'agent-ben',
  'agent-caesar',
  'agent-seth',
  'agent-zhao',
  'agent-pan-yinhu',
])

const synergyRules32: readonly SynergyDependencyRule[] = [
  // 1. Forward-edge: Miyabi anomaly disorder partner synergy
  {
    id: 'miyabi-anomaly-disorder-partner',
    triggerCategory: 'anomaly_disorder',
    sourceEntityId: 'agent-miyabi',
    isRecipientAffected: (agent) => {
      if (agent.id !== 'agent-miyabi' && agent.role === 'anomaly') {
        return {
          affected: true,
          affectedFieldPaths: ['build.team_bangboo_scenario'],
          reason:
            '3.2 星见雅追加能力扩充异常队友紊乱触发分支；该异常角色的相关配队字段可能受影响，待来源复审，不据此认定实际配队或最佳构筑。',
          beneficiaries: ['agent-miyabi'],
        }
      }
      return { affected: false, affectedFieldPaths: [], reason: '', beneficiaries: [] }
    },
  },
  // 2. Forward-edge: Nekomata potential >= 1 support partner synergy
  {
    id: 'nekomata-support-cinema-partner',
    triggerCategory: 'support_cinema',
    sourceEntityId: 'agent-nekomata',
    isRecipientAffected: (agent) => {
      if (agent.id !== 'agent-nekomata' && agent.role === 'support') {
        return {
          affected: true,
          affectedFieldPaths: ['build.team_bangboo_scenario'],
          reason:
            '3.2 猫又在潜能>=1时新增支援队友追加能力触发；该支援角色的相关配队字段可能受影响，待来源复审，不据此认定实际配队或最佳构筑。',
          beneficiaries: ['agent-nekomata'],
        }
      }
      return { affected: false, affectedFieldPaths: [], reason: '', beneficiaries: [] }
    },
  },
  // 3. Forward-edge: Claret explicit teammates
  {
    id: 'claret-teammate-synergy',
    triggerCategory: 'armorer_laceration',
    sourceEntityId: 'agent-claret',
    isRecipientAffected: (agent) => {
      if (claretExplicitTeammates.has(agent.id)) {
        if (agent.id === 'agent-rina') {
          return {
            affected: true,
            affectedFieldPaths: ['build.team_bangboo_scenario', 'build.drive_disc_sets'],
            reason:
              '3.2 克拉蕾新增三人队伍搭配与河豚电音/减防取舍；丽娜配队及对应驱动盘套装适用性待复审。',
            beneficiaries: ['agent-claret'],
          }
        }
        return {
          affected: true,
          affectedFieldPaths: ['build.team_bangboo_scenario'],
          reason: '3.2 克拉蕾/洛克茜新增三人队伍搭配；相关配队适用性待复审。',
          beneficiaries: ['agent-claret'],
        }
      }
      return { affected: false, affectedFieldPaths: [], reason: '', beneficiaries: [] }
    },
  },
  // 4. Forward-edge: Koleda fire/belobog/rupture teammates
  {
    id: 'koleda-team-synergy',
    triggerCategory: 'armorer_laceration',
    sourceEntityId: 'agent-koleda',
    isRecipientAffected: (agent) => {
      if (koledaSynergyPartnerAgentIds.has(agent.id)) {
        return {
          affected: true,
          affectedFieldPaths: ['build.team_bangboo_scenario'],
          reason:
            '3.2 珂蕾妲追加能力扩充锋御队友且潜能2–6区分锋御/非锋御受体；相关配队适用性待复审。',
          beneficiaries: ['agent-koleda'],
        }
      }
      return { affected: false, affectedFieldPaths: [], reason: '', beneficiaries: [] }
    },
  },
  // 5. Forward-edge: Defense scaling kit and Thorn Rose drive disc set (set-34200)
  {
    id: 'defense-disc-set-thorn-rose',
    triggerCategory: 'defense_disc_set',
    sourceEntityId: 'set-34200',
    isRecipientAffected: (agent) => {
      if (defenseScalingAgentIds.has(agent.id)) {
        return {
          affected: true,
          affectedFieldPaths: ['build.drive_disc_sets'],
          reason: '3.2 新增防御/锐暴套装荆棘玫瑰（set-34200）；该防御收益角色候选套装收益待复审。',
          beneficiaries: ['set-34200'],
        }
      }
      return { affected: false, affectedFieldPaths: [], reason: '', beneficiaries: [] }
    },
  },
]

export const version32DependencyContext: VersionDependencyContext = Object.freeze({
  targetVersion: '3.2',
  newEntityIds: new Set(gameData32CatalogEntities.map((entity) => entity.id)),
  directChanges: directlyChangedAgentImpacts32,
  synergyRules: synergyRules32,
  formulaChangedAgentIds: new Set(
    incremental32AffectedCapabilityIdentity.changedOldFormulaSubjects,
  ),
  potentialChangedAgentIds: new Set([
    'agent-koleda',
    'agent-miyabi',
    'agent-nekomata',
    'agent-piper',
  ]),
})

// ---------------------------------------------------------------------------
// Extensible Dependency Impact Evaluator
// ---------------------------------------------------------------------------

export function evaluateDependencyImpact(
  agentId: string,
  context: VersionDependencyContext = version32DependencyContext,
  source: PlayerBuildSource | null = null,
): BuildDependencyImpact {
  const originalSourceVersion = source?.originalSourceVersion ?? source?.sourceVersion ?? null
  const retrievalDate = source?.checkedAt ?? null
  if (context.newEntityIds.has(agentId)) {
    return {
      agentId,
      impactKind: context.targetVersion === '3.2' ? 'new_32_agent' : 'new_version_agent',
      affectedFieldPaths: [],
      reasons: [
        `${context.targetVersion} 新增实体；本分析不自动认定已有作者构筑复审或历史数值对比。`,
      ],
      triggerCategories: [
        context.targetVersion === '3.2' ? 'new_32_character' : 'new_version_character',
      ],
      beneficiaryAgentIds: [],
      authorReviewedVersion: null,
      originalSourceVersion,
      retrievalDate,
      matchedRelations: [],
    }
  }

  const direct = context.directChanges[agentId]
  if (direct) {
    return {
      agentId,
      impactKind: 'direct_patch_change',
      affectedFieldPaths: direct.affectedFieldPaths,
      reasons: direct.reasons,
      triggerCategories: direct.triggerCategories,
      beneficiaryAgentIds: [],
      authorReviewedVersion: null,
      originalSourceVersion,
      retrievalDate,
      matchedRelations: [],
    }
  }

  const catalogEntry = agentCatalog.find((row) => row[0] === agentId)
  if (!catalogEntry) {
    return {
      agentId,
      impactKind: 'unaffected_retained_reference',
      affectedFieldPaths: [],
      reasons: [],
      triggerCategories: [],
      beneficiaryAgentIds: [],
      authorReviewedVersion: null,
      originalSourceVersion,
      retrievalDate,
      matchedRelations: [],
    }
  }

  const [, , role, , , attribute, faction] = catalogEntry
  const agentInfo = { id: agentId, role, attribute, faction }

  const affectedPaths = new Set<string>()
  const reasons: string[] = []
  const triggerCategories = new Set<TriggerCategory>()
  const beneficiaries = new Set<string>()
  const matchedRelations: BuildDependencyImpact['matchedRelations'][number][] = []

  for (const rule of context.synergyRules) {
    const outcome = rule.isRecipientAffected(agentInfo)
    if (outcome.affected) {
      outcome.affectedFieldPaths.forEach((path) => affectedPaths.add(path))
      reasons.push(outcome.reason)
      triggerCategories.add(rule.triggerCategory)
      outcome.beneficiaries.forEach((b) => beneficiaries.add(b))
      matchedRelations.push({
        ruleId: rule.id,
        sourceEntityId: rule.sourceEntityId,
        beneficiaryAgentIds: [...outcome.beneficiaries],
      })
    }
  }

  const affectedList = [...affectedPaths]
  if (affectedList.length > 0) {
    return {
      agentId,
      impactKind: 'synergy_teammate_affected',
      affectedFieldPaths: affectedList,
      reasons: [...new Set(reasons)],
      triggerCategories: [...triggerCategories],
      beneficiaryAgentIds: [...beneficiaries],
      authorReviewedVersion: null,
      originalSourceVersion,
      retrievalDate,
      matchedRelations,
    }
  }

  return {
    agentId,
    impactKind: 'unaffected_retained_reference',
    affectedFieldPaths: [],
    reasons: [],
    triggerCategories: [],
    beneficiaryAgentIds: [],
    authorReviewedVersion: null,
    originalSourceVersion,
    retrievalDate,
    matchedRelations: [],
  }
}

/** Wrapper using 3.2 locked context for backward compatibility. */
export function analyzeBuildDependencyImpact(agentId: string): BuildDependencyImpact {
  return evaluateDependencyImpact(agentId, version32DependencyContext)
}

/** Check whether a specific field path on an agent is affected by version changes or dependencies. */
export function isBuildFieldAffectedByVersion(
  agentId: string,
  fieldPath: string,
  context: VersionDependencyContext = version32DependencyContext,
): { affected: boolean; reason?: string; impactKind?: BuildDependencyImpactKind } {
  const analysis = evaluateDependencyImpact(agentId, context)
  if (analysis.impactKind === 'new_32_agent' || analysis.impactKind === 'new_version_agent') {
    return { affected: false, impactKind: analysis.impactKind }
  }
  if (analysis.affectedFieldPaths.includes(fieldPath)) {
    return {
      affected: true,
      reason: analysis.reasons.join('；'),
      impactKind: analysis.impactKind,
    }
  }
  return { affected: false, impactKind: analysis.impactKind }
}

export function isBuildFieldAffectedByVersion32(
  agentId: string,
  fieldPath: string,
): { affected: boolean; reason?: string; impactKind?: BuildDependencyImpactKind } {
  return isBuildFieldAffectedByVersion(agentId, fieldPath, version32DependencyContext)
}

// ---------------------------------------------------------------------------
// Field Applicability Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves applicability, strictly distinguishing retrieval/page date, author reviewed version,
 * static fact continuity, and meta guidance applicability.
 * authorReviewedVersion only comes from explicit author build review evidence; no fallbacks to
 * sourceVersion, targetVersion, or '3.1'.
 */
export function resolveBuildFieldApplicability(
  agentId: string,
  fieldPath: string,
  source: PlayerBuildSource | null,
  targetVersion?: string,
  context: VersionDependencyContext = version32DependencyContext,
): {
  currentApplicability: 'continuous' | 'affected_pending' | 'unknown'
  authorReviewedVersion: string | null
  originalSourceVersion: string | null
  pageUpdatedAt: string | null
  retrievedAt: string | null
  reason: string
} {
  const effectiveTargetVersion = targetVersion ?? context.targetVersion
  if (targetVersion !== undefined && targetVersion !== context.targetVersion)
    throw new Error('适用性目标版本与依赖上下文版本不一致。')
  const bwiki = bwikiPageEvidence[agentId]
  const pageUpdatedAt = bwiki?.updatedAt ?? null
  const retrievedAt = source?.checkedAt ?? null
  const authorReviewedVersion = source?.authorReviewedVersion ?? null
  const originalSourceVersion = source?.originalSourceVersion ?? source?.sourceVersion ?? null
  if (!agentCatalog.some((row) => row[0] === agentId) && !context.newEntityIds.has(agentId)) {
    return {
      currentApplicability: 'unknown',
      authorReviewedVersion,
      originalSourceVersion,
      pageUpdatedAt,
      retrievedAt,
      reason: '代理人不在当前目录或版本新增实体声明中，不能凭已核验来源推定适用。',
    }
  }

  // 1. Potential overlay: evaluate delta & adopted sources; do not unconditionally overwrite adopted references
  if (fieldPath === 'progression.potential_overlay') {
    if (context.potentialChangedAgentIds.has(agentId)) {
      return {
        currentApplicability: 'affected_pending',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason: `${effectiveTargetVersion} 锁定公式包含潜能或追加能力机制变更，潜能指导待复审。`,
      }
    }
    if (source?.verified) {
      return {
        currentApplicability: 'continuous',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason: `已采纳的潜能参考未受 ${effectiveTargetVersion} 锁定机制变更影响，保持连续性。`,
      }
    }
    return {
      currentApplicability: 'unknown',
      authorReviewedVersion,
      originalSourceVersion,
      pageUpdatedAt,
      retrievedAt,
      reason: '潜能作为独立增量，缺少已核验的同版本来源凭证。',
    }
  }

  // 2. Static facts: require source verification, established entity identity, and lack of formula delta
  if (
    fieldPath === 'identity' ||
    fieldPath === 'progression.lv60_and_ascension' ||
    fieldPath.startsWith('combat.')
  ) {
    if (!source?.verified) {
      return {
        currentApplicability: 'unknown',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason: '该静态事实缺少同版本核验来源。',
      }
    }

    if (context.newEntityIds.has(agentId)) {
      return {
        currentApplicability:
          source.sourceVersion === effectiveTargetVersion ||
          source.originalSourceVersion === effectiveTargetVersion
            ? 'continuous'
            : 'unknown',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason: `${effectiveTargetVersion} 新增实体的静态事实仅在对应版本来源核验后连续。`,
      }
    }

    if (fieldPath.startsWith('combat.') && context.formulaChangedAgentIds.has(agentId)) {
      return {
        currentApplicability: 'affected_pending',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason: `${effectiveTargetVersion} 锁定公式存在数值/机制变更，战斗公式字段待复审。`,
      }
    }

    return {
      currentApplicability: 'continuous',
      authorReviewedVersion,
      originalSourceVersion,
      pageUpdatedAt,
      retrievedAt,
      reason: '静态基础定义在锁定补丁中未发生数值/公式变更，保持连续性。',
    }
  }

  // 3. Build guidance fields: check dependency and version impact
  if (fieldPath.startsWith('build.')) {
    if (!source?.verified) {
      return {
        currentApplicability: 'unknown',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason: '该构筑方向缺少已核验的来源凭证。',
      }
    }

    const check = isBuildFieldAffectedByVersion(agentId, fieldPath, context)
    if (check.affected) {
      return {
        currentApplicability: 'affected_pending',
        authorReviewedVersion,
        originalSourceVersion,
        pageUpdatedAt,
        retrievedAt,
        reason:
          check.reason ??
          `该构筑方向受到 ${effectiveTargetVersion} 依赖与机制关联变化影响；返回待复审，保持候选方向。`,
      }
    }

    return {
      currentApplicability: 'continuous',
      authorReviewedVersion,
      originalSourceVersion,
      pageUpdatedAt,
      retrievedAt,
      reason: '该构筑方向未命中版本变动依赖；保留已有参考支持连续性，不捏造当前版本作者重审。',
    }
  }

  return {
    currentApplicability: source?.verified ? 'continuous' : 'unknown',
    authorReviewedVersion,
    originalSourceVersion,
    pageUpdatedAt,
    retrievedAt,
    reason: '通用字段适用性保持。',
  }
}

// ---------------------------------------------------------------------------
// Shared Applicability Identity Interface for Owner Consumers
// ---------------------------------------------------------------------------

export type BuildApplicabilityStatus =
  | 'continuous'
  | 'affected_pending'
  | 'unreviewed_reference'
  | 'missing'

export type BuildApplicabilityIdentity = {
  readonly agentId: string
  readonly status: BuildApplicabilityStatus
  readonly version: string
  readonly source: {
    readonly id: string | null
    readonly sourceVersion: string | null
    readonly originalSourceVersion: string | null
    readonly checkedAt: string | null
  }
  readonly authorReview: {
    readonly isExplicitAuthorReview: boolean
    readonly authorReviewedVersion: string | null
  }
  readonly localAdoptionReviewId: string | null
  readonly dependencyFingerprint: string
  /**
   * Historical continuity alone does not prove current guidance review.
   */
  readonly isCurrentGuidanceComplete: boolean
  readonly affectedFieldPaths: readonly string[]
  readonly applicabilityReasons: readonly string[]
}

/**
 * Lightweight, pure-function applicability identity interface for candidateWarehouseConstraints,
 * BuildIntent, and loadout cache records.
 */
export function getBuildApplicabilityIdentity(
  agentId: string,
  options?: {
    targetVersion?: string
    fieldPath?: string
    source?: PlayerBuildSource | null
    context?: VersionDependencyContext
    localAdoptionReview?: {
      id: string
      agentId: string
      targetVersion: string
      sourceContentHash: string
      scope: 'build_guidance'
    }
  },
): BuildApplicabilityIdentity {
  const ctx = options?.context ?? version32DependencyContext
  const targetVersion = options?.targetVersion ?? ctx.targetVersion
  if (options?.targetVersion !== undefined && options.targetVersion !== ctx.targetVersion)
    throw new Error('适用性目标版本与依赖上下文版本不一致。')
  const source = options?.source ?? null
  const impact = evaluateDependencyImpact(agentId, ctx, source)
  const knownEntity =
    agentCatalog.some((row) => row[0] === agentId) || ctx.newEntityIds.has(agentId)
  const sourceCoversEntity =
    source?.verified === true &&
    (!ctx.newEntityIds.has(agentId) ||
      source.sourceVersion === targetVersion ||
      source.originalSourceVersion === targetVersion)

  const authorReviewedVersion = source?.authorReviewedVersion ?? null
  const originalSourceVersion = source?.originalSourceVersion ?? source?.sourceVersion ?? null
  const isExplicitAuthorReview = Boolean(authorReviewedVersion)
  const localReview = options?.localAdoptionReview
  const localReviewValid = Boolean(
    sourceCoversEntity &&
    localReview?.id.trim() &&
    localReview.agentId === agentId &&
    localReview.targetVersion === targetVersion &&
    localReview.scope === 'build_guidance' &&
    source?.contentHash &&
    localReview.sourceContentHash === source.contentHash,
  )
  const reviewedCurrent = Boolean(
    sourceCoversEntity && (authorReviewedVersion === targetVersion || localReviewValid),
  )

  let status: BuildApplicabilityStatus
  if (!knownEntity) {
    status = 'missing'
  } else if (
    (options?.fieldPath
      ? impact.affectedFieldPaths.includes(options.fieldPath)
      : impact.affectedFieldPaths.length > 0) &&
    !reviewedCurrent
  ) {
    status = 'affected_pending'
  } else if (sourceCoversEntity) {
    status = 'continuous'
  } else if (source) {
    status = 'unreviewed_reference'
  } else {
    status = 'missing'
  }

  const isCurrentGuidanceComplete = status === 'continuous' && reviewedCurrent

  const dependencyFingerprint = stableContentHash({
    agentId,
    targetVersion,
    contextTargetVersion: ctx.targetVersion,
    status,
    impactKind: impact.impactKind,
    affectedFieldPaths: impact.affectedFieldPaths,
    triggerCategories: impact.triggerCategories,
    matchedRelations: impact.matchedRelations,
    beneficiaryAgentIds: impact.beneficiaryAgentIds,
    reasons: impact.reasons,
    directChange: ctx.directChanges[agentId] ?? null,
    isNewEntity: ctx.newEntityIds.has(agentId),
    formulaChanged: ctx.formulaChangedAgentIds.has(agentId),
    potentialChanged: ctx.potentialChangedAgentIds.has(agentId),
    source: source
      ? {
          id: source.id,
          url: source.url,
          sourceVersion: source.sourceVersion,
          originalSourceVersion: source.originalSourceVersion ?? null,
          contentHash: source.contentHash,
          checkedAt: source.checkedAt,
          verified: source.verified,
        }
      : null,
    authorReviewedVersion,
    originalSourceVersion,
    localAdoptionReviewId: localReviewValid ? localReview!.id : null,
    isCurrentGuidanceComplete,
  })

  return {
    agentId,
    status,
    version: targetVersion,
    source: {
      id: source?.id ?? null,
      sourceVersion: source?.sourceVersion ?? null,
      originalSourceVersion,
      checkedAt: source?.checkedAt ?? null,
    },
    authorReview: {
      isExplicitAuthorReview,
      authorReviewedVersion,
    },
    localAdoptionReviewId: localReviewValid ? localReview!.id : null,
    dependencyFingerprint,
    isCurrentGuidanceComplete,
    affectedFieldPaths: impact.affectedFieldPaths,
    applicabilityReasons: impact.reasons,
  }
}
