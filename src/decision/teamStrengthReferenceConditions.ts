import { stableContentHash } from '../gameDataPacks/types'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import { resolveCurrentReleasedIdentity } from '../gameDataPacks/currentReleasedIdentityMap'
import { teamStrengthReferenceStateIdentity } from './teamStrengthReferenceState'
import {
  resolveTeamStrengthGuidePotentialReference,
  teamStrengthGuidePotentialReferences,
} from './teamStrengthGuidePotentialReferences'
import {
  activatedEditorialConfigs,
  editorialRecords,
  editorialRecordsByTeamKey,
  nekomataPotentialSixConditions,
  nekomataPotentialSixKeys,
  nonEditorialTrainingTeams,
  nonEditorialTrainingTeamsByKey,
} from './teamStrengthReferenceConditionsData'
import type {
  AgentReferenceCondition,
  ResolvedTeamStrengthReferenceConditions,
  ReferenceConditionsValidationResult,
  TeamStrengthReferenceConditionsCoverageReport,
} from './teamStrengthReferenceConditionsTypes'
export type * from './teamStrengthReferenceConditionsTypes'

const calculationAssumption = 'level60-skill11-core7-m0-supported-p6-explicit-override' as const
const contract = 'soda-team-strength-reference-conditions/v4'
/** Includes condition contents and provenance, not just keys or counts. */
export function computeTeamStrengthReferenceConditionsIdentity() {
  return stableContentHash({
    contract,
    calculationAssumption,
    teamStrengthReferenceStateIdentity,
    activatedEditorialConfigs,
    editorialRecords,
    numericKeys: [...nekomataPotentialSixKeys].sort(),
    numericConditions: nekomataPotentialSixConditions,
    guidePotentialReferences: teamStrengthGuidePotentialReferences,
    nonEditorialTrainingTeams,
    unresolvedMeaning: 'retained-source-text-not-numericalized',
    defaultMeaning: 'local-standard-reference-supported-p6-not-source-or-account-observation',
  })
}
export const teamStrengthReferenceConditionsIdentity =
  computeTeamStrengthReferenceConditionsIdentity()

export function currentTeamStrengthReferenceConditions(
  memberIds: readonly string[],
): ResolvedTeamStrengthReferenceConditions {
  const normalizedMemberIds = memberIds.map(resolveCurrentReleasedIdentity).sort()
  const key = normalizedMemberIds.join('|')
  const sourceTeam = nonEditorialTrainingTeamsByKey.get(key)
  // Same precedence as calibration: existing source authority before editorial.
  const editorial = sourceTeam ? undefined : editorialRecordsByTeamKey.get(key)
  const configs = editorial ? (activatedEditorialConfigs[editorial.id] ?? []) : []
  const establishedCatReference = nekomataPotentialSixKeys.has(key)
  const sourceAuthority: ResolvedTeamStrengthReferenceConditions['sourceAuthority'] =
    sourceTeam?.authority ?? (editorial ? 'local_editorial_estimate' : 'none')
  const agentConditions: AgentReferenceCondition[] = normalizedMemberIds.map((agentId) => {
    const cfg = configs.find((item) => item.agentId === agentId)
    const catReference = establishedCatReference && agentId === 'agent-nekomata'
    const refs = catReference
      ? nekomataPotentialSixConditions.evidenceRefs
      : (cfg?.evidenceRefs ?? [])
    const guide = resolveTeamStrengthGuidePotentialReference(agentId, refs)
    const numeric = catReference || Boolean(guide)
    return {
      agentId,
      status: numeric ? 'explicit_numeric' : cfg ? 'activated_unknown_level' : 'unrecorded',
      numericLevel: guide?.level ?? (catReference ? 6 : null),
      numericLevelBasis:
        guide?.numericLevelBasis ?? (catReference ? 'local_adjudicated_reference' : null),
      mindscapeLevel: 0,
      minimumDemonstratedLevel: cfg?.minimumDemonstratedLevel ?? null,
      demonstrationEvidence: guide
        ? `${guide.sourceUrl}#image=${guide.imageName};sha256=${guide.imageSha256};locator=${guide.locator}`
        : catReference
          ? nekomataPotentialSixConditions.evidenceRefs[1]!
          : (cfg?.demonstrationEvidence ?? null),
      requirementSource: catReference
        ? '保留既有具名猫又P6培养参考，不表示当前账户已达到。'
        : (cfg?.requirementSource ?? null),
      evidenceRefs: refs,
    }
  })
  const potentialByAgentId = Object.fromEntries(
    agentConditions.flatMap((agent) =>
      agent.numericLevel === null ? [] : [[agent.agentId, agent.numericLevel]],
    ),
  )
  // A partially recovered team retains its remaining unknown subjects.
  const status: ResolvedTeamStrengthReferenceConditions['status'] = agentConditions.some(
    (agent) => agent.status === 'activated_unknown_level',
  )
    ? 'activated_unknown_level'
    : Object.keys(potentialByAgentId).length
      ? 'explicit_numeric'
      : sourceTeam || editorial
        ? 'standard_reference'
        : 'unrecorded'
  const evidenceRefs = [
    ...new Set([
      ...(sourceTeam?.evidenceRefs ?? editorial?.evidenceRefs.map((ref) => ref.url) ?? []),
      ...agentConditions.flatMap((agent) => agent.evidenceRefs),
    ]),
  ].sort()
  const unhandledConditions = (editorial?.conditions ?? []).map((rawDescription) => ({
    rawDescription,
    category: 'unresolved_source_condition' as const,
    numericalized: false as const,
    nonNumericalReason: '来源文字完整保留；激发主体标记不等于等级、配装、操作或场景已数值化。',
    requiredFutureFields: ['same-condition-source-review'],
  }))
  const diagnostics = [
    '本地标准比较协议为60级、技能11、核心7、M0；当前支持潜能者P6，其余P0，显式数值优先。这不是作者构筑或账户观测。',
    ...(agentConditions.some((agent) => agent.status === 'activated_unknown_level')
      ? ['部分激发主体的来源参考等级仍未核实；标准P6不证明来源等级。']
      : []),
    ...(agentConditions.some(
      (agent) => agent.numericLevelBasis === 'source_reference_configuration',
    )
      ? ['已核实原图ON / STR 6/6的主体参考配置；不表示作者账号等级或最低机制门槛。']
      : []),
    ...(unhandledConditions.length
      ? ['原始操作、构筑、场景条件尚未全部数值化；保留文字不等于模型已经消费。']
      : []),
  ]
  const result = {
    potentialByAgentId,
    evidenceRefs,
    status,
    sourceAuthority,
    ...(editorial ? { editorialRecordId: editorial.id } : {}),
    normalizedMemberIds,
    calculationAssumption,
    teamStrengthReferenceStateIdentity,
    agentConditions,
    unhandledConditions,
    diagnostics,
    sourceContext: editorial ?? sourceTeam ?? null,
  }
  return { ...result, identity: stableContentHash({ contract, ...result }) }
}
export function teamStrengthReferenceConditionTeamIdentity(memberIds: readonly string[]) {
  return currentTeamStrengthReferenceConditions(memberIds).identity
}
export function allTeamStrengthReferenceConditions() {
  const members = new Map<string, readonly string[]>([
    ...nonEditorialTrainingTeams.map((row) => [row.key, row.memberIds] as const),
    ...editorialRecords.map((row) => [[...row.memberIds].sort().join('|'), row.memberIds] as const),
  ])
  return [...members.values()].map(currentTeamStrengthReferenceConditions)
}
export function getTeamStrengthReferenceConditionIssueCounts(
  input:
    | readonly string[]
    | readonly ResolvedTeamStrengthReferenceConditions[] = allTeamStrengthReferenceConditions(),
) {
  const conditions: readonly ResolvedTeamStrengthReferenceConditions[] =
    typeof input[0] === 'string'
      ? [currentTeamStrengthReferenceConditions(input as readonly string[])]
      : (input as readonly ResolvedTeamStrengthReferenceConditions[])
  return {
    activatedUnknownLevelCount: conditions.filter((row) => row.status === 'activated_unknown_level')
      .length,
    unresolvedConditionCount: conditions.reduce(
      (sum, row) => sum + row.unhandledConditions.length,
      0,
    ),
    standardReferenceCount: conditions.filter((row) => row.status === 'standard_reference').length,
    calculationConflictCount: conditions.reduce((sum, row) => {
      const conflicts = new Set(
        Object.entries(row.potentialByAgentId)
          .filter(
            ([id, level]) =>
              !row.normalizedMemberIds.includes(id) ||
              !Number.isInteger(level) ||
              level < 0 ||
              level > 6 ||
              (level > 0 && !supportsPotentialImage(id)),
          )
          .map(([id]) => id),
      )
      for (const agent of row.agentConditions) {
        const level =
          row.potentialByAgentId[agent.agentId] ?? (supportsPotentialImage(agent.agentId) ? 6 : 0)
        if (
          (agent.status === 'activated_unknown_level' && level === 0) ||
          (agent.numericLevel !== null && level !== agent.numericLevel) ||
          (agent.minimumDemonstratedLevel !== null && level < agent.minimumDemonstratedLevel)
        )
          conflicts.add(agent.agentId)
      }
      return sum + conflicts.size
    }, 0),
  }
}
export function getTeamStrengthReferenceConditionsCoverage(): TeamStrengthReferenceConditionsCoverageReport {
  const conditions = allTeamStrengthReferenceConditions()
  return {
    contract: 'soda-team-strength-reference-conditions-coverage-report/v1',
    totalTrainingTeamsCount: conditions.length,
    editorialRecordsCount: editorialRecords.length,
    breakdown: {
      explicit_numeric: conditions.filter((row) => row.status === 'explicit_numeric').length,
      activated_unknown_level: conditions.filter((row) => row.status === 'activated_unknown_level')
        .length,
      standard_reference: conditions.filter((row) => row.status === 'standard_reference').length,
      unrecorded: conditions.filter((row) => row.status === 'unrecorded').length,
    },
    issueCounts: getTeamStrengthReferenceConditionIssueCounts(conditions),
    boundary: '覆盖只证明条件记录可查询；不证明条件已数值化、同条件实测或评级可信。',
  }
}
export function validateTeamStrengthReferenceConditions(
  memberIds: readonly string[],
): ReferenceConditionsValidationResult {
  const conditions = currentTeamStrengthReferenceConditions(memberIds)
  const issues: string[] = []
  if (memberIds.length !== 3 || new Set(conditions.normalizedMemberIds).size !== 3)
    issues.push('需要三名不同代理人。')
  for (const [id, level] of Object.entries(conditions.potentialByAgentId)) {
    if (
      !conditions.normalizedMemberIds.includes(id) ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > 6 ||
      (level > 0 && !supportsPotentialImage(id))
    )
      issues.push(`非法潜能参考：${id}`)
  }
  for (const agent of conditions.agentConditions) {
    if (
      agent.status === 'activated_unknown_level' &&
      (agent.numericLevel !== null || !agent.evidenceRefs.length)
    )
      issues.push(`激发等级未知状态不一致：${agent.agentId}`)
    if (
      agent.status === 'explicit_numeric' &&
      (agent.numericLevel === null ||
        !agent.numericLevelBasis ||
        agent.numericLevel !== conditions.potentialByAgentId[agent.agentId])
    )
      issues.push(`数值参考状态不一致：${agent.agentId}`)
  }
  return {
    valid: !issues.length,
    teamKey: conditions.normalizedMemberIds.join('|'),
    issues,
    status: conditions.status,
    activatedAgents: conditions.agentConditions
      .filter(
        (agent) =>
          agent.status === 'activated_unknown_level' || agent.status === 'explicit_numeric',
      )
      .map((agent) => agent.agentId),
  }
}
export const isPotentialActivationUnknownLevel = (ids: readonly string[]) =>
  currentTeamStrengthReferenceConditions(ids).status === 'activated_unknown_level'
export const hasExplicitNumericPotential = (ids: readonly string[]) =>
  Object.keys(currentTeamStrengthReferenceConditions(ids).potentialByAgentId).length > 0
export const isUnrecordedTeam = (ids: readonly string[]) =>
  currentTeamStrengthReferenceConditions(ids).status === 'unrecorded'
