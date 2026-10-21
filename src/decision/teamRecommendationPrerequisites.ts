import type { AccountRoster } from '../assault/types'
import { formedAgentCultivation } from './formedTeamCultivation'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { currentAgentDirectory } from '../assault/catalog'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import { createTeamStrengthEquippedReferenceMember } from './teamStrengthReferenceBuild'
import { currentTeamStrengthReferenceConditions } from './teamStrengthReferenceConditions'
import type {
  ReviewedTeamSourceDirection,
  TeamRecommendationPrerequisite,
} from '../gameDataPacks/reviewedTeamSourceDirections'

type RecommendationSource = ReviewedTeamSourceDirection['sourceRefs'][number]
type Status = 'eligible' | 'condition-not-met' | 'condition-unknown'
type Assessment = { status: Status; reasons: string[] }
export type TeamRecommendationPrerequisiteAssessment = Assessment & {
  sources: Array<Assessment & { sourceId: string }>
}

const key = (memberIds: readonly string[]) => [...memberIds].sort().join('|')

function isCurrentRecommendationSource(source: RecommendationSource, reviewVersion: string) {
  if (
    source.observationRole === 'author_comparison_setup' ||
    source.verificationStatus === 'historical_membership_reference'
  )
    return false
  return (
    source.sourceVersion === reviewVersion ||
    (reviewVersion === '3.2' && source.verificationStatus === 'reviewed_exact_team_current_32')
  )
}

function assessOne(
  prerequisite: TeamRecommendationPrerequisite,
  memberIds: readonly string[],
  roster: Pick<AccountRoster, 'agents'>,
  basis: 'account' | 'formed_reference' = 'account',
): Assessment {
  if (!memberIds.includes(prerequisite.agentId))
    return { status: 'condition-not-met', reasons: ['来源前提的主体不在当前三人队伍中。'] }
  if (basis === 'formed_reference') {
    if (prerequisite.kind === 'potential_minimum') {
      const potential = formedAgentCultivation(prerequisite.agentId, memberIds).potential
      return Number.isInteger(prerequisite.minimum) &&
        prerequisite.minimum >= 1 &&
        prerequisite.minimum <= 6 &&
        potential !== null &&
        potential >= prerequisite.minimum
        ? { status: 'eligible', reasons: ['成型参考的潜能满足该来源前提；账户差距在选队后展示。'] }
        : { status: 'condition-unknown', reasons: ['成型参考无法满足已核来源潜能前提。'] }
    }
    const engine = getCurrentWEngineStaticData(prerequisite.engineId)
    const released = currentWEngineDirectory.find((row) => row.id === prerequisite.engineId)
    const agent = currentAgentDirectory.find((row) => row.id === prerequisite.agentId)
    const reference = createTeamStrengthEquippedReferenceMember({
      agentId: prerequisite.agentId,
      memberIds,
      referenceConditions: currentTeamStrengthReferenceConditions(memberIds),
    })
    return engine &&
      released?.releaseState === 'released' &&
      released.accountOwnable &&
      engine.specialty === agent?.specialty &&
      reference.status === 'ready' &&
      reference.equipment.engineId === prerequisite.engineId
      ? { status: 'eligible', reasons: ['成型方向要求此已发布适用音擎；不代表账户已经装备。'] }
      : { status: 'condition-unknown', reasons: ['成型方向要求的音擎尚不适用。'] }
  }
  const records = roster.agents.filter((agent) => agent.agentId === prerequisite.agentId)
  if (records.length !== 1)
    return { status: 'condition-unknown', reasons: ['来源前提主体的账户记录缺失或身份不唯一。'] }
  const agent = records[0]!
  if (!agent.owned)
    return { status: 'condition-not-met', reasons: ['账户未拥有来源前提所需的代理人。'] }
  if (prerequisite.kind === 'potential_minimum') {
    if (
      !Number.isInteger(prerequisite.minimum) ||
      prerequisite.minimum < 1 ||
      prerequisite.minimum > 6
    )
      return { status: 'condition-unknown', reasons: ['来源潜能前提的等级无效，不能自动放行。'] }
    const current = agent.potentialImage
    // The maintained effective value includes manual edits. Missing observation
    // is unknown here, never the separate standard-reference P6 assumption.
    if (typeof current !== 'number' || !Number.isInteger(current) || current < 0 || current > 6)
      return { status: 'condition-unknown', reasons: [`${agent.agentId}的当前潜能未知。`] }
    return current >= prerequisite.minimum
      ? { status: 'eligible', reasons: [`${agent.agentId}的当前潜能满足来源要求。`] }
      : { status: 'condition-not-met', reasons: [`${agent.agentId}的当前潜能低于来源要求。`] }
  }
  if (!/^wengine-\d+$/.test(prerequisite.engineId))
    return { status: 'condition-unknown', reasons: ['来源音擎前提缺少稳定身份。'] }
  // Current agent maintenance owns identity. Owned copies, names and source
  // recommendations cannot stand in for the current equipment on this owner.
  const engineId = agent.wEngineDetails.id
  if (!engineId)
    return { status: 'condition-unknown', reasons: [`${agent.agentId}的当前音擎身份未录入。`] }
  return engineId === prerequisite.engineId
    ? { status: 'eligible', reasons: [`${agent.agentId}的当前音擎满足来源要求。`] }
    : { status: 'condition-not-met', reasons: [`${agent.agentId}的当前音擎不符合来源要求。`] }
}

/** Same-source prerequisites are AND; separate current recommendation sources
 * are OR. This assesses default recommendation evidence, never team legality,
 * membership, standard strength, or the numerical effect runtime. */
export function assessTeamRecommendationPrerequisites(input: {
  memberIds: readonly string[]
  sourceRefs: readonly RecommendationSource[]
  roster: Pick<AccountRoster, 'agents'>
  reviewVersion: string
  basis?: 'account' | 'formed_reference'
}): TeamRecommendationPrerequisiteAssessment {
  if (input.memberIds.length !== 3 || new Set(input.memberIds).size !== 3)
    return { status: 'condition-unknown', reasons: ['尚无完整且唯一的三人队伍。'], sources: [] }
  const bySourceId = new Map<string, TeamRecommendationPrerequisite[]>()
  for (const source of input.sourceRefs) {
    if (!isCurrentRecommendationSource(source, input.reviewVersion)) continue
    bySourceId.set(source.id, [
      ...(bySourceId.get(source.id) ?? []),
      ...(source.recommendationPrerequisites ?? []),
    ])
  }
  const sources = [...bySourceId].map(([sourceId, prerequisites]) => {
    const results = prerequisites.map((prerequisite) =>
      assessOne(prerequisite, input.memberIds, input.roster, input.basis),
    )
    const status: Status = results.some((result) => result.status === 'condition-not-met')
      ? 'condition-not-met'
      : results.some((result) => result.status === 'condition-unknown')
        ? 'condition-unknown'
        : 'eligible'
    return {
      sourceId,
      status,
      reasons: results.length
        ? results.flatMap((result) => result.reasons)
        : ['该独立当前推荐来源没有额外声明推荐前提。'],
    }
  })
  if (!sources.length)
    return {
      status: 'condition-unknown',
      reasons: ['没有可为该推荐门提供资格的当前非实验来源。'],
      sources,
    }
  const status: Status = sources.some((source) => source.status === 'eligible')
    ? 'eligible'
    : sources.some((source) => source.status === 'condition-unknown')
      ? 'condition-unknown'
      : 'condition-not-met'
  return { status, reasons: sources.flatMap((source) => source.reasons), sources }
}

/** Keep the established default pool unchanged for formations with no newly
 * typed recommendation gate. Source membership remains available in all cases. */
export function createTeamRecommendationPrerequisiteResolver(input: {
  directions: readonly Pick<ReviewedTeamSourceDirection, 'memberIds' | 'sourceRefs'>[]
  roster: Pick<AccountRoster, 'agents'>
  reviewVersion: string
  basis?: 'account' | 'formed_reference'
}) {
  const allSources = new Map<string, RecommendationSource[]>()
  for (const direction of input.directions) {
    const teamKey = key(direction.memberIds)
    allSources.set(teamKey, [...(allSources.get(teamKey) ?? []), ...direction.sourceRefs])
  }
  const gatedSources = new Map(
    [...allSources].filter(([, sources]) =>
      sources.some((source) => source.recommendationPrerequisites?.length),
    ),
  )
  const cached = new Map<string, TeamRecommendationPrerequisiteAssessment>()
  return (memberIds: readonly string[]): TeamRecommendationPrerequisiteAssessment => {
    const teamKey = key(memberIds)
    const sourceRefs = gatedSources.get(teamKey)
    if (!sourceRefs)
      return {
        status: 'eligible',
        reasons: ['该组合未新增结构化推荐前提，沿用既有默认资格。'],
        sources: [],
      }
    let assessment = cached.get(teamKey)
    if (!assessment) {
      assessment = assessTeamRecommendationPrerequisites({ ...input, memberIds, sourceRefs })
      cached.set(teamKey, assessment)
    }
    return assessment
  }
}
