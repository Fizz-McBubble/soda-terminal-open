import ledger from './teamArchetypeSourceLedger.v1.json'
import { resolveCurrentTeamArchetypeIdentity } from './currentTeamArchetypeIdentity'

export type TeamArchetypeEvidence = 'formal' | 'candidate' | 'missing'
export type TeamArchetypeSourceLayer =
  | 'official_release_scope'
  | 'game_evidence'
  | 'guide'
  | 'practical_statistics'
export type TeamDamageModel = 'anomaly_reaction_burst' | 'direct_stun_window_burst'

export type CurrentTeamArchetype = {
  id: string
  label: string
  gameVersion: '3.1'
  releaseState: 'released' | 'unreleased'
  coreAgentId: string
  members: Array<{ agentId: string; order: number; role: string }>
  bangbooId: string
  substitutions: Array<{
    replaceAgentId: string
    withAgentId: string
    role: string
    status: 'candidate'
    sourceId: string
  }>
  bangbooSubstitutions: Array<{
    withBangbooId: string
    role: string
    status: 'candidate'
    sourceId: string
  }>
  prerequisites: string[]
  scenarios: string[]
  damageModel: {
    kind: TeamDamageModel
    formulaFamily: string
    precision: 'candidate_only'
    reason: string
  }
  strength: { status: 'candidate'; claim: string }
  sources: Array<{
    id: string
    layer: TeamArchetypeSourceLayer
    version: '3.1'
    updatedAt: string
    url: string
    locator: string
    status: Exclude<TeamArchetypeEvidence, 'missing'>
  }>
}

type LedgerArchetype = (typeof ledger.archetypes)[number]

function projectArchetype(value: LedgerArchetype): CurrentTeamArchetype {
  const members = value.members
    .map((member) => ({
      ...member,
      agentId: resolveCurrentTeamArchetypeIdentity(member.agentId),
    }))
    .sort((left, right) => left.order - right.order)
  const coreAgentId = resolveCurrentTeamArchetypeIdentity(value.coreAgentId)
  const bangbooId = resolveCurrentTeamArchetypeIdentity(value.bangbooId)
  if (members.length !== 3 || new Set(members.map((member) => member.agentId)).size !== 3)
    throw new Error(`3.1 队伍原型必须恰有三名不同代理人：${value.id}`)
  if (!bangbooId) throw new Error(`3.1 队伍原型缺邦布：${value.id}`)
  if (value.strength.status !== 'candidate')
    throw new Error(`无 formal CalculationContext 的队伍强度不得升格：${value.id}`)
  if (value.sources.some((source) => source.version !== '3.1'))
    throw new Error(`current 队伍原型混入非 3.1 来源：${value.id}`)
  if (!value.sources.some((source) => source.layer === 'guide'))
    throw new Error(`3.1 队伍原型缺完整攻略来源：${value.id}`)
  return {
    ...value,
    gameVersion: '3.1',
    coreAgentId,
    members,
    bangbooId,
    substitutions: [...value.substitutions],
    bangbooSubstitutions:
      'bangbooSubstitutions' in value ? [...(value.bangbooSubstitutions ?? [])] : [],
    prerequisites: [...value.prerequisites],
    scenarios: [...value.scenarios],
    sources: [...value.sources],
  } as CurrentTeamArchetype
}

const byId = new Map<string, CurrentTeamArchetype>()
for (const archetype of ledger.archetypes.map(projectArchetype)) {
  if (byId.has(archetype.id)) throw new Error(`重复 3.1 队伍原型 ID：${archetype.id}`)
  byId.set(archetype.id, archetype)
}

export const currentTeamArchetypeProjection = {
  id: 'current-team-archetype-projection-3.1-r1',
  gameVersion: '3.1' as const,
  archetypes: [...byId.values()].sort((left, right) => left.id.localeCompare(right.id)),
  coverageGaps: [...ledger.coverageGaps].sort((left, right) => left.id.localeCompare(right.id)),
  precisionGate:
    '只有匹配敌人、轮换、倍率、异常/反应阶段与所有队员完整 formal CalculationContext 才能输出精确 DPS；当前全部仅为 candidate 强度。',
} as const
