import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import {
  currentFormulaMechanicContractHash,
  resolveCurrentFormulaWEngineContract,
  getCurrentFormulaContractRequirements,
} from './currentFormulaMechanicContracts'
import { getCurrentWEngineStaticData } from '../gameDataPacks/currentWEngineStaticCatalog'
import { stableContentHash } from '../gameDataPacks/types'
import type { SourceBackedEquipmentModifierBucket } from './currentPlanningTeamDpsRuntime'
import {
  evaluateCurrentPlanningInitialCritConversion32,
  type PlanningEffectRuntimeMember,
} from './currentPlanningEffectRuntime'
import type { ValueBenchmarkEffectExclusion } from './valueBenchmarkComparison'
import { currentCombatPlanningModifierTargets } from './currentCombatPlanningModifierTargets'
import {
  planningWEngineActions as actions,
  retainPlanningWEngineDependencies32,
} from './currentPlanningWEngineDependencies32'
import type { PlanningEffectRuntimeStats } from './currentPlanningEffectDomain'

export const currentWEnginePersonalPlanningEffectVersion =
  'wengine-personal-event-final-dependency-r2'

const directStats = currentCombatPlanningModifierTargets

export type CurrentWEngineFormulaRuntime = {
  flags?: Readonly<Record<string, boolean>>
  numbers?: Readonly<Record<string, number>>
  accumulators?: Readonly<Record<string, number>>
}

export function bindCurrentWEngineFormulaRuntime(input: {
  agentId: string
  engineId: string
  member?: PlanningEffectRuntimeMember
  targetAgentId?: string
  runtime?: CurrentWEngineFormulaRuntime
  eventFinalStats?: PlanningEffectRuntimeStats
}) {
  const blockers: string[] = []
  const numbers = { ...input.runtime?.numbers }
  const flags = { ...input.runtime?.flags }
  if (input.member) {
    if (input.member.agentId !== input.agentId) blockers.push('音擎面板代理人与消费代理人不一致。')
    const conversion = evaluateCurrentPlanningInitialCritConversion32(input.member)
    if (conversion.status === 'unsupported') blockers.push(...conversion.blockers)
    for (const [key, value] of Object.entries(input.eventFinalStats ?? input.member.finalStats))
      if (typeof value === 'number') numbers[`own.final.${key}`] = value
    if (conversion.status === 'supported' && !input.eventFinalStats)
      numbers['own.final.crit_'] = input.member.finalStats.crit_ + conversion.critRate
  }
  const identity = getCurrentAgentEventContract(input.agentId)?.identity
  const targetIdentity = getCurrentAgentEventContract(
    input.targetAgentId ?? input.agentId,
  )?.identity
  if (identity) {
    for (const key of getCurrentFormulaContractRequirements('wengine', input.engineId)?.flags ??
      []) {
      const match = /^(eq|ne):(own|target)\.char\.(specialty|attribute):(.+)$/.exec(key)
      if (match) {
        const recipient = match[2] === 'target' ? targetIdentity : identity
        if (!recipient) continue
        const actual = match[3] === 'specialty' ? recipient.specialty : recipient.attribute
        flags[key] = match[1] === 'eq' ? actual === match[4] : actual !== match[4]
      }
    }
  }
  return { flags, numbers, blockers, accumulators: input.runtime?.accumulators }
}

/** Translate the locked formula contract into the existing fixed-event runtime. */
export function compileCurrentWEnginePersonalPlanningEffects(input: {
  agentId: string
  engineId: string
  refinement: number
  member?: PlanningEffectRuntimeMember
  runtime?: {
    flags?: Readonly<Record<string, boolean>>
    numbers?: Readonly<Record<string, number>>
    accumulators?: Readonly<Record<string, number>>
  }
}) {
  const source = getCurrentWEngineStaticData(input.engineId)
  const identity = getCurrentAgentEventContract(input.agentId)?.identity
  const boundRuntime = bindCurrentWEngineFormulaRuntime(input)
  const blockers = [...boundRuntime.blockers]
  let passiveInactive = false
  const buckets: SourceBackedEquipmentModifierBucket[] = []
  const exclusions: ValueBenchmarkEffectExclusion[] = []
  const sourceRefs = source
    ? [
        `${source.source.formulaPath}#sha256=${source.source.formulaSha256}`,
        `${source.source.dataPath}#sha256=${source.source.dataSha256}`,
        currentFormulaMechanicContractHash,
      ]
    : []
  const exclude = (effectKey: string, reason: string, fields: string[]) =>
    exclusions.push({ effectKey, reason, fields, sourceRefs })

  if (!source || !identity) {
    blockers.push(
      !source ? `音擎缺少冻结来源：${input.engineId}` : `角色缺少特性：${input.agentId}`,
    )
  } else if (
    source.specialty !== (identity.specialty === 'attack' ? 'damage' : identity.specialty)
  ) {
    // A known specialty mismatch makes the passive inactive, not unknown.
  } else if (source.formulaAdoption.status === 'static_only') {
    exclude(
      `wengine:${input.engineId}:passive`,
      '音擎公式仅有静态目录，当前没有可消费的被动机制合同。',
      ['formulaAdoption', 'passive'],
    )
  } else {
    const result = resolveCurrentFormulaWEngineContract({
      stableId: input.engineId,
      refinement: input.refinement,
      specialtyMatches: true,
      runtimePolicy: 'exclude_unobserved',
      runtime: boundRuntime,
    })
    if (result.status === 'unsupported') blockers.push(...result.blockers)
    else if (
      result.source.formulaSha256 !== source.source.formulaSha256 ||
      result.source.dataSha256 !== source.source.dataSha256
    )
      blockers.push(`音擎公式与静态目录来源不一致：${input.engineId}`)
    else {
      passiveInactive = !result.active && result.exclusions.length === 0
      result.exclusions.forEach((item) =>
        exclude(
          `wengine:${input.engineId}:formula:${item.effectIndex}`,
          '固定事件缺少被动触发条件或累计状态，未假定效果已激活。',
          item.reasons,
        ),
      )
      result.effects.forEach((raw, index) => {
        const effect = raw as Record<string, unknown>
        const key = `wengine:${input.engineId}:resolved:${index}`
        const stat = String(effect.stat ?? '')
        const channel =
          /^combat\.(dmg_|common_dmg_|crit_dmg_|laceration_dmg_|sharp_dmg_|sheer_dmg_|direct_dmg_|defIgn_|resIgn_)\.(physical|fire|ice|electric|ether|wind)$/.exec(
            stat,
          )
        const attribute = channel?.[2] ?? null
        const application = channel ? directStats[`combat.${channel[1]}`] : directStats[stat]
        if (effect.kind !== 'modifier' || effect.target !== 'own' || !application) {
          exclude(
            key,
            '效果不属于当前个人固定事件直接伤害公式域。',
            [stat, String(effect.target ?? '')].filter(Boolean),
          )
          return
        }
        const action = effect.action === undefined ? null : actions[String(effect.action)]
        if (effect.action !== undefined && !action) {
          exclude(key, '当前固定事件表没有该音擎动作类型。', [String(effect.action)])
          return
        }
        if (typeof effect.value !== 'number' || !Number.isFinite(effect.value)) {
          blockers.push(`音擎被动效果无法安全映射：${input.engineId}:${stat}`)
          return
        }
        buckets.push({
          bucketId: `wengine:${input.agentId}:${input.engineId}:${index}`,
          effectKey: key,
          providerAgentId: input.agentId,
          recipientAgentIds: [input.agentId],
          receiverPath: null,
          damageType: null,
          action: action ?? null,
          attribute,
          value: effect.value,
          application,
          sourceRefs,
        })
      })
    }
    if (source.formulaAdoption.todoMarkers.length)
      exclude(
        `wengine:${input.engineId}:upstream-todo`,
        '来源公式含未实现标记，不能声明被动完整。',
        source.formulaAdoption.todoMarkers,
      )
  }
  const core = {
    version: currentWEnginePersonalPlanningEffectVersion,
    formulaContractHash: currentFormulaMechanicContractHash,
    runtimeInput: { member: input.member ?? null, runtime: input.runtime ?? null },
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    buckets:
      source &&
      !blockers.length &&
      source.specialty === (identity?.specialty === 'attack' ? 'damage' : identity?.specialty)
        ? retainPlanningWEngineDependencies32({
            buckets,
            agentId: input.agentId,
            engineId: input.engineId,
            refinement: input.refinement,
            runtime: input.runtime,
            boundRuntime,
            sourceRefs,
            target: 'own',
            recipientAgentIds: [input.agentId],
          })
        : buckets,
    passiveInactive,
    exclusions,
    blockers,
    boundary:
      '仅消费冻结公式中可证明、作用于自身固定直接伤害事件的音擎被动；未观测触发及公式域外效果留痕。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
