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
import {
  functionalEffectMetadata32,
  hasReviewedShieldConsumer32,
  sourceEquipmentEffectPath32,
  sourceEquipmentEffectMetadata32,
} from './reviewedFunctionalEquipmentDependencies32'
import { applyReviewedSpringEmbraceReceivers32 } from './reviewedSpringEmbraceReceivers32'
import { resolveSteelCushionPassive } from './currentWEnginePassiveAdapters'

export const currentWEnginePersonalPlanningEffectVersion =
  'wengine-personal-event-final-dependency-r4'

const steelCushionReconciliation = Object.freeze({
  id: 'steel-cushion-physical-param0-source-reconciliation-r1',
  repository: 'https://github.com/frzyc/genshin-optimizer',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/SteelCushion.ts',
  formulaSha256: '39360E37B6A70E8422CC1EBF6AFB907F139ADC18DD79944EC757ED0F17E94E0D',
  dataPath: 'libs/zzz/stats/Data/Wengine/SteelCushion.json',
  dataSha256: 'BF56ED4B057ED8938A3949F2B2BD70C3D7D76D22F24F01946331F16C1AEFCA97',
  mappedPath: 'libs/zzz/stats/src/mappedStats/wengine/maps/SteelCushion.ts',
  mappedSha256: '187156314135C7F34F392354BA47ECF199270DB660B3C85D4A5387DF0E1EBD6C',
  localizationPath: 'libs/zzz/dm-localization/assets/locales/en/wengine_SteelCushion_gen.json',
  localizationSha256: 'A2650CD0067A612B7320B398DFCF73F77170CBECA51D2A7EB53E484F644590CF',
  reason:
    '锁定原公式被动物伤误读dm.dmg_（param1）；采用同pin映射与本地化的physical_dmg_（param0），背击仍用param1；原IR保留。',
})

function resolveReconciledSteelCushion(input: {
  refinement: number
  runtime: CurrentWEngineFormulaRuntime
}) {
  const unsupported = (reason: string) => ({ status: 'unsupported' as const, blockers: [reason] })
  const source = getCurrentWEngineStaticData('wengine-14102')
  const pin = steelCushionReconciliation
  if (
    !source ||
    source.upstreamKey !== 'SteelCushion' ||
    source.source.formulaPath !== pin.formulaPath ||
    source.source.formulaSha256 !== pin.formulaSha256 ||
    source.source.dataPath !== pin.dataPath ||
    source.source.dataSha256 !== pin.dataSha256
  )
    return unsupported('钢铁肉垫来源裁决的exact-pin已变化，不能继续覆盖当前公式。')
  // Reuse the existing semantic adapter, and prove both channels at every
  // refinement against the pinned native parameter table. No second value table.
  if (
    source.passiveParameterTable.length !== 5 ||
    new Set(source.passiveParameterTable.map((row) => row.refinement)).size !== 5 ||
    source.passiveParameterTable.some((row) => {
      const adapted = resolveSteelCushionPassive({
        refinement: row.refinement,
        specialtyMatches: true,
        hitFromBehind: true,
      })
      return (
        adapted.status !== 'supported' ||
        row.params.length !== 2 ||
        adapted.effects.find((effect) => effect.attribute === 'physical')?.value !==
          row.params[0] ||
        adapted.effects.find((effect) => effect.attribute === undefined)?.value !== row.params[1]
      )
    })
  )
    return unsupported('钢铁肉垫既有适配器与锁定物伤/背击参数逐改装等级核对不一致。')
  const hitFromBehind = input.runtime.flags?.['SteelCushion:hit_behind']
  if (typeof hitFromBehind !== 'boolean')
    return unsupported('钢铁肉垫来源裁决仍要求显式背后命中状态；未知不能按false处理。')
  const adapted = resolveSteelCushionPassive({
    refinement: input.refinement,
    specialtyMatches: true,
    hitFromBehind,
  })
  if (adapted.status !== 'supported') return adapted
  const raw = resolveCurrentFormulaWEngineContract({
    stableId: 'wengine-14102',
    refinement: input.refinement,
    specialtyMatches: true,
    runtimePolicy: 'strict',
    runtime: input.runtime,
  })
  if (raw.status !== 'supported') return raw
  const physical = adapted.effects.find((effect) => effect.attribute === 'physical')
  if (
    !physical ||
    raw.effects.length !== adapted.effects.length ||
    raw.exclusions.length ||
    raw.effects.some(
      (effect) =>
        effect.kind !== 'modifier' ||
        effect.target !== 'own' ||
        !['combat.dmg_.physical', 'combat.common_dmg_'].includes(String(effect.stat)),
    ) ||
    raw.effects.filter((effect) => effect.stat === 'combat.dmg_.physical').length !== 1
  )
    return unsupported('钢铁肉垫原IR形状已变化，来源裁决不可继续应用。')
  return {
    ...raw,
    effects: raw.effects.map((effect) =>
      effect.stat === 'combat.dmg_.physical' ? { ...effect, value: physical.value } : effect,
    ),
  }
}

const directStats = currentCombatPlanningModifierTargets

export type CurrentWEngineFormulaRuntime = {
  flags?: Readonly<Record<string, boolean>>
  numbers?: Readonly<Record<string, number>>
  accumulators?: Readonly<Record<string, number>>
  recipients?: Readonly<Record<string, string>>
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
  const housekeeperStacks = input.runtime?.accumulators?.['Housekeeper:exSpecialHits']
  if (
    input.engineId === 'wengine-13106' &&
    housekeeperStacks !== undefined &&
    (!Number.isInteger(housekeeperStacks) || housekeeperStacks < 0 || housekeeperStacks > 15)
  )
    blockers.push('家政员当前有效层数必须为0至15整数，不能用累计命中总数代替1秒有效层数。')
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
  runtime?: CurrentWEngineFormulaRuntime
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
  if (input.engineId === 'wengine-14102') {
    const pin = steelCushionReconciliation
    sourceRefs.push(
      `${pin.repository}@${pin.commit}`,
      `${pin.mappedPath}#sha256=${pin.mappedSha256}`,
      `${pin.localizationPath}#sha256=${pin.localizationSha256}`,
      `${pin.id}:${pin.reason}`,
    )
  }
  const exclude = (
    effectKey: string,
    reason: string,
    fields: string[],
    effectPath: string | null = null,
  ) =>
    exclusions.push({
      effectKey,
      reason,
      fields,
      sourceRefs,
      ...functionalEffectMetadata32(effectPath, input.agentId, [input.agentId]),
    })

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
    const result =
      input.engineId === 'wengine-14102'
        ? resolveReconciledSteelCushion({ refinement: input.refinement, runtime: boundRuntime })
        : resolveCurrentFormulaWEngineContract({
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
          sourceEquipmentEffectPath32('wengine', input.engineId, item.effectIndex),
        ),
      )
      for (const item of result.exclusions)
        Object.assign(
          exclusions.find(
            (row) => row.effectKey === `wengine:${input.engineId}:formula:${item.effectIndex}`,
          )!,
          sourceEquipmentEffectMetadata32(
            'wengine',
            input.engineId,
            item.effectIndex,
            input.agentId,
            [input.agentId],
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
        const effectPath =
          typeof effect.target === 'string' && stat ? `${effect.target}.${stat}` : null
        if (application === 'shield_percent' && !hasReviewedShieldConsumer32(input.agentId)) {
          exclude(key, '已解析护盾增益缺少该角色的有限护盾消费者。', [stat], effectPath)
          return
        }
        const transferableEnergy =
          input.engineId === 'wengine-13011' &&
          effect.target === 'team' &&
          application === 'energy_regen_percent'
        if (
          effect.kind !== 'modifier' ||
          (effect.target !== 'own' && !transferableEnergy) ||
          !application
        ) {
          exclude(
            key,
            '效果不属于当前个人固定事件直接伤害公式域。',
            [stat, String(effect.target ?? '')].filter(Boolean),
            effectPath,
          )
          return
        }
        const action = effect.action === undefined ? null : actions[String(effect.action)]
        if (effect.action !== undefined && !action) {
          exclude(key, '当前固定事件表没有该音擎动作类型。', [String(effect.action)], effectPath)
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
          ...(transferableEnergy
            ? {
                sourceReceiverObservation: {
                  engineId: input.engineId,
                  memberIds: [input.agentId],
                  recipientAgentId: input.runtime?.recipients?.['SpringEmbrace:recipientAgentId'],
                  activeProviderAgentId:
                    input.runtime?.recipients?.['SpringEmbrace:activeProviderAgentId'],
                },
              }
            : {}),
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
  const receivers = applyReviewedSpringEmbraceReceivers32(buckets)
  exclusions.push(...receivers.exclusions)
  const core = {
    version: currentWEnginePersonalPlanningEffectVersion,
    formulaContractHash: currentFormulaMechanicContractHash,
    sourceReconciliation: input.engineId === 'wengine-14102' ? steelCushionReconciliation : null,
    runtimeInput: { member: input.member ?? null, runtime: input.runtime ?? null },
    status: blockers.length ? ('unsupported' as const) : ('supported' as const),
    buckets:
      source &&
      !blockers.length &&
      source.specialty === (identity?.specialty === 'attack' ? 'damage' : identity?.specialty)
        ? retainPlanningWEngineDependencies32({
            buckets: receivers.buckets,
            agentId: input.agentId,
            engineId: input.engineId,
            refinement: input.refinement,
            runtime: input.runtime,
            boundRuntime,
            sourceRefs,
            target: 'own',
            recipientAgentIds: [input.agentId],
          })
        : receivers.buckets,
    passiveInactive,
    exclusions,
    blockers,
    boundary:
      '仅消费冻结公式中可证明、作用于自身固定直接伤害事件的音擎被动；未观测触发及公式域外效果留痕。',
  }
  return { ...core, fingerprint: stableContentHash(core) }
}
