import review from './data/reviewed-build-patch-impact.3.2.json'
import mechanicCatalog from './generated/current-agent-mechanic-catalog.v1.json' with { type: 'json' }
import { currentReleasedIdentityMap } from './currentReleasedIdentityMap'
import { currentVersionAdoption32 } from './currentVersionAdoption32'
import { stableContentHash } from './types'
import type { AgentProfileField } from './agentProfileFieldProjection'
import { agentCatalog } from '../assault/catalogData'

const delta = currentVersionAdoption32.sourceIdentity.deltaIdentity
if (
  review.previousCommit !== delta.previousCommit ||
  review.currentCommit !== delta.currentCommit ||
  review.deltaSha256 !== delta.deltaSha256 ||
  review.targetVersion !== currentVersionAdoption32.gameVersion
)
  throw new Error('Build impact review does not match the installed 3.2 source identity.')

const subjects = new Map(review.subjects.map((row) => [row.externalId, row]))
if (subjects.size !== review.subjects.length) throw new Error('Duplicate build impact identity.')
for (const contract of mechanicCatalog.items) {
  const subject = subjects.get(contract.externalId)
  if (
    !subject ||
    subject.afterFormulaSha256 !== contract.source.formulaSha256.toLowerCase() ||
    subject.afterStatsSha256 !== contract.source.statsSha256.toLowerCase()
  )
    throw new Error(`Build impact source has drifted: ${contract.externalId}`)
}

const teamPath = 'build.team_bangboo_scenario'
const potentialPath = 'progression.potential_overlay'
const mainPath = 'build.main_sub_stats'
const targetPath = 'build.target_panel'

/** Exact source expressions, not a second activation evaluator. Category sums
 * include the owner; the production mechanic consumer removes its contribution.
 * Nekomata's reviewed potential gate remains stricter than the raw sheet. */
export const reviewedBuildImpactBranches32 = {
  'agent-miyabi': [
    {
      id: 'additional-ability',
      fieldPaths: [teamPath],
      before: { categoryTerms: ['support', 'HollowSpecialOoperationsSection6'], minimum: 2 },
      after: {
        categoryTerms: ['support', 'anomaly', 'HollowSpecialOoperationsSection6'],
        minimum: 3,
      },
      retainedValues: { commonDamage: 0.6, fallenFrost: 2, iceResistanceIgnore: 0.3 },
      conditions: ['需另一位支援、异常或六课队友；30%冰抗无视仍需紊乱触发，不能常驻。'],
      consumer: 'currentAgentMechanicContracts.evaluateCurrentAgentTeamActivation',
      disposition: 'activation_expansion_same_coefficients',
    },
  ],
  'agent-nekomata': [
    {
      id: 'additional-ability-ex-special',
      fieldPaths: [teamPath, potentialPath],
      before: { categoryTerms: ['physical', 'CunningHares'], minimum: 3 },
      after: { categoryTerms: ['support', 'physical', 'CunningHares'], minimum: 3 },
      retainedValues: { exSpecialDamagePerAssault: 0.35, maxAssaultStacks: 2 },
      conditions: [
        '物理或狡兔屋的另一位队友维持基础条件；新增支援分支仅潜能>=1采用。',
        '强击触发后下一次强化特殊技每层增伤35%，最多2层；不把支援身份当作已经触发强击。',
      ],
      consumer: 'currentAgentMechanicContracts / reviewedTeammateActivationTerms',
      disposition: 'potential_gated_activation_expansion_same_coefficients',
    },
  ],
  'agent-piper': [
    {
      id: 'additional-ability-power',
      fieldPaths: [teamPath],
      before: { categoryTerms: ['physical', 'SonsOfCalydon'], minimum: 2 },
      after: { categoryTerms: ['anomaly', 'physical', 'SonsOfCalydon'], minimum: 4 },
      retainedValues: { powerThreshold: 20, teamCommonDamage: 0.18 },
      conditions: [
        '另一位异常、物理或卡吕冬之子队友；自身类别贡献由生产消费者扣除，不能由自身激活。',
        '队伍18%增伤仍需动力>=20；源旧minimum=2是旧实现表达，不推翻已采用的另一位队友修正。',
      ],
      consumer: 'currentAgentMechanicContracts / reviewedInlineAbilityEffectSources',
      disposition: 'native_formula_catches_up_with_adopted_anomaly_branch',
    },
  ],
  'agent-koleda': [
    {
      id: 'potential-team-receiver',
      fieldPaths: [potentialPath, teamPath],
      before: { potentialParams: [], disposition: 'not_modeled_in_old_snapshot' },
      after: {
        potentialLevels: [2, 3, 4, 5, 6],
        armorerLacerationDamage: [0.04, 0.06, 0.08, 0.1, 0.12],
        nonArmorerCritDamage: [0.11, 0.17, 0.23, 0.29, 0.35],
      },
      conditions: [
        '仅潜能2–6；锋御受益者采用锐暴伤害，非锋御受益者采用暴伤，两项互斥；潜能0/1无此数值增益。',
        '旧来源未表达潜能不是游戏旧值为0；不由此改变词条权重或证明珂蕾妲队优于其他队。',
      ],
      consumer:
        'currentPlanningEffectRuntime.evaluateCurrentPlanningFormationEffects / currentPlanningSelfEffects32',
      disposition: 'newly_expressed_potential_receiver_split',
    },
    {
      id: 'potential-basic-and-furnace',
      fieldPaths: [potentialPath, 'build.progression', teamPath],
      before: { disposition: 'not_modeled_in_old_snapshot' },
      after: {
        minimumPotential: 1,
        furnaceFireMaximum: 2,
        basicDamagePerConsumedStack: 0.1,
        basicDazePerConsumedStack: 0.2,
        exSpecialDaze: 0.1,
        teamCommonDamage: 0.35,
      },
      conditions: [
        '普攻强化仅炉火消费对应hit-5/6；炉火库存与实际消费分别声明，不能把库存直接当每次攻击消耗。',
        '潜能>=1、炉火效果窗口成立才采用35%队伍增伤；强化特殊技失衡增益10%。',
      ],
      consumer: 'reviewedKoledaPreparedBenchmark32 / reviewedKoledaPotentialEventStates32',
      disposition: 'event_bound_potential_adoption',
    },
    {
      id: 'additional-ability-armorer',
      fieldPaths: [teamPath],
      before: { categoryTerms: ['fire', 'BelebogHeavyIndustries', 'rupture'], minimum: 3 },
      after: {
        categoryTerms: ['fire', 'BelebogHeavyIndustries', 'rupture', 'armorer'],
        minimum: 3,
      },
      retainedValues: { chainDamagePerDebuffStack: 0.35, maxDebuffStacks: 2 },
      conditions: ['另一位火、白祇、命破或锋御队友；连携增伤仍需敌人失衡及强化特殊技减益层数。'],
      consumer: 'currentAgentMechanicContracts.evaluateCurrentAgentTeamActivation',
      disposition: 'activation_expansion_same_coefficients',
    },
  ],
} as const

const fieldPaths = [
  potentialPath,
  'build.wengines',
  'build.drive_disc_sets',
  mainPath,
  'build.progression',
  teamPath,
  targetPath,
]

import {
  analyzeBuildDependencyImpact,
  isBuildFieldAffectedByVersion32,
} from './buildApplicabilityDependencyAnalysis'

/** Review the installed source delta against the actual adopted guidance. Ready
 * qualifies this bounded review, never a claim that every build/ranking is stable. */
export function getReviewedBuildVersionImpact32(
  agentId: string,
  fields: readonly (AgentProfileField & { authorityState?: string })[],
): AgentProfileField | undefined {
  const identity = currentReleasedIdentityMap.entries.find((entry) => entry.stableId === agentId)
  const externalId = identity?.gameEvidenceId ?? agentCatalog.find((row) => row[0] === agentId)?.[3]
  const subject = externalId ? subjects.get(externalId) : undefined
  if (!subject) return undefined
  const introduced = !subject.beforeFormulaSha256
  const branches =
    reviewedBuildImpactBranches32[agentId as keyof typeof reviewedBuildImpactBranches32] ?? []
  const changed =
    subject.beforeFormulaSha256 !== subject.afterFormulaSha256 ||
    subject.beforeStatsSha256 !== subject.afterStatsSha256
  if (changed && !introduced && !branches.length)
    throw new Error(`Changed build branch has no reviewed mapping: ${agentId}`)
  const adopted = [...new Map(fields.map((field) => [field.path, field])).values()].filter(
    (field) => fieldPaths.includes(field.path),
  )
  const dependencyAnalysis = analyzeBuildDependencyImpact(agentId)
  const sourceRefs: AgentProfileField['sourceRefs'] = [
    {
      id: `locked-build-delta32:${subject.upstreamKey}`,
      url: `https://github.com/frzyc/genshin-optimizer/compare/${review.previousCommit}...${review.currentCommit}`,
      sourceVersion: review.targetVersion,
      checkedAt: review.reviewedAt,
      contentHash: review.deltaSha256,
      licenseBoundary: review.boundary,
    },
    ...adopted.flatMap((field) => field.sourceRefs),
  ].filter((source, index, rows) => rows.findIndex((item) => item.id === source.id) === index)
  const conditions = [
    '锁定3.1→3.2公式与原始字段的有限复核；机制采用不代表配装、队伍优劣重排或作者重审。',
    ...(introduced ? ['3.2新增代理人没有3.1同角色数值；仅核对当前已采用字段及配置条件。'] : []),
    ...branches.flatMap((branch) => [...branch.conditions]),
    ...dependencyAnalysis.reasons,
    ...(introduced ? adopted.flatMap((field) => [...(field.conditions ?? [])]) : []),
  ]
  return {
    group: 'build_guidance',
    path: 'build.version_change_impact',
    value: {
      baseVersion: introduced ? null : review.baseVersion,
      targetVersion: review.targetVersion,
      evidenceScope: review.evidenceScope,
      disposition: introduced
        ? 'new_agent_current_fields_reviewed'
        : changed
          ? 'named_branches_reviewed'
          : 'no_change_in_locked_actor_formula_and_raw',
      sourceIdentity: subject,
      numericSourceComparison:
        review.numericChanges.find((row) => row.upstreamKey === subject.upstreamKey) ?? null,
      branchMappings: branches,
      dependencyImpact: {
        impactKind: dependencyAnalysis.impactKind,
        triggerCategories: dependencyAnalysis.triggerCategories,
        affectedFieldPaths: dependencyAnalysis.affectedFieldPaths,
        reasons: dependencyAnalysis.reasons,
        beneficiaries: dependencyAnalysis.beneficiaryAgentIds,
      },
      adoptedBuildFields: adopted.map((field) => {
        const fieldAffected = isBuildFieldAffectedByVersion32(agentId, field.path).affected
        return {
          fieldPath: field.path,
          value: field.value,
          contentHash: stableContentHash(field),
          sourceReviewVersion: field.gameVersion,
          sourceStatus: field.status,
          authorityState: field.authorityState ?? 'not_evaluated',
          conditions: field.conditions ?? [],
          adoption: introduced
            ? 'current_source32'
            : fieldAffected
              ? 'affected_pending_review'
              : 'retained_reviewed_reference_not_reranked',
        }
      }),
      rankingReview: 'not_claimed',
      formalPromotion: false,
    },
    status: 'candidate',
    gameVersion: review.targetVersion,
    originalSourceVersion: introduced ? review.targetVersion : review.baseVersion,
    lastChangeVersion: changed ? review.targetVersion : null,
    currentApplicability: 'continuous',
    sourceRefs,
    verifiedAt: review.reviewedAt,
    conflict: null,
    reason:
      '当前锁定delta已映射到实际采用的构筑字段和适用分支；不外推攻略重排、热修复全集或Formal。',
    conditions,
  }
}
