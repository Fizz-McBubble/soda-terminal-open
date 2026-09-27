import { stableContentHash } from '../gameDataPacks/types'
import { inspectAmillionPlanningInputs } from '../upstream/genshinOptimizer/zzzBangbooAmillionCompat'
import { calculateStandardDirectDamageCore } from './directDamageCore'
import {
  createPlanningDpsContract,
  type PlanningBaseline,
  type PlanningDpsInput,
} from './planningDpsContract'
import { createPlanningDpsExecution } from './planningDpsExecution'
import { composePlanningTeamDps } from './planningTeamDps'

export const cunningHaresP0BaselineId = 'SODA-PLANNING-DPS-R1-CUNNING-HARES-30S' as const

/**
 * A deliberately small, injectable production compatibility seam.  It does
 * not infer a panel, events, skill levels, occurrence counts or equipment:
 * callers must bind all of those facts to the current Decision Run first.
 */
export type CunningHaresP0Input = {
  account: {
    accountId: string
    rosterHash: string
    warehouseHash: string
    planningHash: string
    capturedAt: string
  }
  baseline: PlanningBaseline
  members: Array<{
    agentId: 'agent-billy' | 'agent-nicole' | 'agent-anby'
    level: number
    attack: number
    critRate: number
    critDamage: number
    damageBonus: number
    multiplier: number
    eventId: string
    eventCount: number
    finalStatsHash: string
    wEngineCopyId: string
    discIds: [string, string, string, string, string, string]
  }>
  bangboo: {
    level: number
    ascensionLevelCap: 60
    stars: 1
    activeSkillLevel: 10
    chainSkillLevel: 10
    activeUseCount: 1
    chainUseCount: 1
    enemyCount: 1
    cunningHaresMemberCount: 3
  }
}

const memberIds = ['agent-billy', 'agent-nicole', 'agent-anby'] as const
const planningCapabilities: PlanningDpsInput['supports'][number]['capabilities'] = [
  'planning_damage',
  'planning_dps',
]

function complete(fieldId: string, reason: string) {
  return { state: 'complete' as const, fields: [{ fieldId, status: 'ready' as const, reason }] }
}

/** Builds a static 30-second comparison model, explicitly not a combat rotation. */
export function evaluateCunningHaresP0(input: CunningHaresP0Input) {
  if (
    input.baseline.baselineId !== cunningHaresP0BaselineId ||
    input.baseline.declaredDurationSeconds !== 30
  )
    return {
      status: 'unsupported' as const,
      blockers: ['Cunning Hares P0 只接受冻结的 30 秒具名 PlanningBaseline。'],
    }
  if (
    input.members.length !== 3 ||
    input.members.some((member, index) => member.agentId !== memberIds[index])
  )
    return {
      status: 'unsupported' as const,
      blockers: ['Cunning Hares P0 必须按 Billy/Nicole/Anby 顺序绑定三名成员。'],
    }
  if (new Set(input.members.flatMap((member) => member.discIds)).size !== 18)
    return {
      status: 'unsupported' as const,
      blockers: ['Cunning Hares P0 必须绑定 18 张不同实体驱动盘。'],
    }
  if (new Set(input.members.map((member) => member.wEngineCopyId)).size !== 3)
    return {
      status: 'unsupported' as const,
      blockers: ['Cunning Hares P0 必须绑定三件不同且已确认的实体音擎副本。'],
    }
  const amillion = inspectAmillionPlanningInputs(input.bangboo)
  if (amillion.status !== 'ready_for_damage') return amillion
  if (typeof amillion.attack.value !== 'number')
    return { status: 'unsupported' as const, blockers: ['艾米莉安攻击力投影未闭合。'] }
  const amillionAttack = amillion.attack.value
  const supports: PlanningDpsInput['supports'] = [
    ...input.members.map((member) => ({
      supportId: `p0:${member.agentId}:${member.eventId}`,
      kind: 'personalFormula' as const,
      applicability: 'required' as const,
      capabilities: [...planningCapabilities],
      providerId: member.agentId,
      targetIds: [member.agentId],
      build: complete('decision-run-assets', '已绑定当前 Decision Run 的实体音擎副本与六张盘。'),
      calculation: complete(
        'hakushin-direct-event',
        `已冻结 ${member.eventId} 的直接伤害事件与次数。`,
      ),
      coverage: {
        activeSeconds: 30,
        eligibleEventCount: member.eventCount,
        coveredEventCount: member.eventCount,
      },
      sourceHash: stableContentHash({
        eventId: member.eventId,
        multiplier: member.multiplier,
        eventCount: member.eventCount,
      }),
    })),
    {
      supportId: 'p0:cunning-hares-static-interaction',
      kind: 'interaction' as const,
      applicability: 'required' as const,
      capabilities: [...planningCapabilities],
      providerId: 'agent-nicole',
      targetIds: [...memberIds],
      build: complete('static-bundle', '30 秒静态事件集；未把未验证的队友效果默认为增益。'),
      calculation: complete('static-bundle', '成员事件均按显式 owner/bucket 归属。'),
      coverage: { activeSeconds: 30, eligibleEventCount: 3, coveredEventCount: 3 },
      sourceHash: stableContentHash(cunningHaresP0BaselineId),
    },
    {
      supportId: 'p0:bangboo-amillion',
      kind: 'bangboo' as const,
      applicability: 'required' as const,
      capabilities: [...planningCapabilities],
      providerId: 'bangboo-amillion',
      targetIds: [...memberIds],
      build: complete('amillion-level-skill', 'Lv60、1星、主动/连携 Lv10 已具名绑定。'),
      calculation: complete(
        'amillion-static-events',
        '主动 1 次 + 连携 1 次由冻结 bundle 显式提供。',
      ),
      coverage: { activeSeconds: 30, eligibleEventCount: 2, coveredEventCount: 2 },
      sourceHash: stableContentHash(amillion),
    },
  ]
  const planning = createPlanningDpsContract({
    schemaVersion: 'planning-dps-input-v1',
    baseline: input.baseline,
    accountSnapshot: {
      ...input.account,
      ownedAgentIds: [...memberIds],
      ownedBangbooIds: ['bangboo-amillion'],
      stale: false,
    },
    calculationTarget: {
      targetId: 'team:cunning-hares-p0',
      scope: 'team',
      agentIds: [...memberIds],
      bangbooId: 'bangboo-amillion',
    },
    supports,
    supportHash: stableContentHash(supports),
    solverHash: stableContentHash({
      core: 'soda-direct-damage-core-r25-v1',
      model: cunningHaresP0BaselineId,
    }),
  })
  const memberExecutions = input.members.map((member) => {
    const direct = calculateStandardDirectDamageCore({
      attackerLevel: member.level,
      attack: member.attack,
      attackPercent: 0,
      attackFlat: 0,
      multiplier: member.multiplier,
      hitCount: member.eventCount,
      critRate: member.critRate,
      critDamage: member.critDamage,
      damageBonus: member.damageBonus,
      vulnerability: input.baseline.enemy.vulnerability,
      defenseReduction: 0,
      penetrationRatio: 0,
      penetrationFlat: 0,
      resistance: input.baseline.enemy.resistance,
      resistanceReduction: 0,
      stunMultiplier: input.baseline.enemy.stunMultiplier,
      enemyDefense: input.baseline.enemy.defense,
    })
    const supportId = `p0:${member.agentId}:${member.eventId}`
    return createPlanningDpsExecution(planning.fingerprint, {
      status: 'supported',
      kind: 'member_in_team',
      subjectId: member.agentId,
      baselineFingerprint: stableContentHash(input.baseline),
      declaredDurationSeconds: 30,
      capabilities: [
        { capability: 'planning_damage', state: 'ready', supportIds: [supportId], blockers: [] },
        { capability: 'planning_dps', state: 'ready', supportIds: [supportId], blockers: [] },
      ],
      totalDamage: direct.expectedDamage,
      planningDps: direct.expectedDamage / 30,
    })
  })
  const bangbooDamage = ['active', 'chain'].reduce((total, kind) => {
    const event = kind === 'active' ? amillion.active : amillion.chain
    if (event.status !== 'supported') return total
    const chainBonus =
      amillion.chainBonus.active && 'damageBonus' in amillion.chainBonus
        ? (amillion.chainBonus.damageBonus ?? 0)
        : 0
    return (
      total +
      calculateStandardDirectDamageCore({
        attackerLevel: 60,
        attack: amillionAttack,
        attackPercent: 0,
        attackFlat: 0,
        multiplier: event.multiplier,
        hitCount: 1,
        critRate: 0.5,
        critDamage: 1,
        damageBonus: kind === 'chain' ? chainBonus : 0,
        vulnerability: input.baseline.enemy.vulnerability,
        defenseReduction: 0,
        penetrationRatio: 0,
        penetrationFlat: 0,
        resistance: input.baseline.enemy.resistance,
        resistanceReduction: 0,
        stunMultiplier: input.baseline.enemy.stunMultiplier,
        enemyDefense: input.baseline.enemy.defense,
      }).expectedDamage
    )
  }, 0)
  const { fingerprint, ...planningInput } = planning
  void fingerprint
  const projection = composePlanningTeamDps({
    planning: planningInput,
    memberExecutions,
    additionalDamageBuckets: [
      {
        bucketId: 'p0:amillion',
        kind: 'bangboo',
        supportId: 'p0:bangboo-amillion',
        providerId: 'bangboo-amillion',
        totalDamage: bangbooDamage,
        sourceHash: stableContentHash(amillion),
      },
    ],
  })
  if (projection.status !== 'supported') return projection
  const members = input.members.map(({ agentId, wEngineCopyId, discIds, finalStatsHash }) => ({
    agentId,
    wEngineCopyId,
    discIds,
    finalStatsHash,
  }))
  const assetBinding = { members, bangbooId: 'bangboo-amillion' as const }
  return {
    status: 'supported' as const,
    planning: planningInput,
    projection,
    execution: createPlanningDpsExecution(planning.fingerprint, projection.result),
    assetBinding: { ...assetBinding, assetHash: stableContentHash(assetBinding) },
  }
}
