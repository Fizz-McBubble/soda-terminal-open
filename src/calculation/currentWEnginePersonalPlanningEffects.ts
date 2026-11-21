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
import {
  resolveReconciledSteelCushion,
  steelCushionReconciliation,
} from './reviewedSteelCushionPlanning'
import {
  CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS,
  CAGE_OF_CONFINED_SIN_STABLE_ID,
  FIRST_PLUMAGE_STABLE_ID,
  resolveCageOfConfinedSinPassive,
  resolveFirstPlumagePassive,
  reviewedWEngine33Hash,
} from './reviewedWEngine33'

export const currentWEnginePersonalPlanningEffectVersion =
  'wengine-personal-event-final-dependency-r7-source-identity'

export const FIRST_PLUMAGE_WINDOW_FLAG = 'FirstPlumage:teamAnomalyCritWindowActive'
export const CAGE_OF_CONFINED_SIN_WINDOW_FLAG =
  CAGE_OF_CONFINED_SIN_RUNTIME_INPUT_KEYS.basicAttackHitWindowActive

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
  const actor = getCurrentAgentEventContract(input.agentId)
  const targetActor = getCurrentAgentEventContract(input.targetAgentId ?? input.agentId)
  if (actor) {
    for (const key of getCurrentFormulaContractRequirements('wengine', input.engineId)?.flags ??
      []) {
      const match = /^(eq|ne):(own|target)\.char\.(specialty|attribute|key):(.+)$/.exec(key)
      if (match) {
        const recipient = match[2] === 'target' ? targetActor : actor
        if (!recipient) continue
        const actual =
          match[3] === 'key'
            ? recipient.upstreamKey
            : match[3] === 'specialty'
              ? recipient.identity.specialty
              : recipient.identity.attribute
        flags[key] = match[1] === 'eq' ? actual === match[4] : actual !== match[4]
      }
    }
  }
  return {
    flags,
    numbers,
    blockers,
    accumulators: input.runtime?.accumulators,
  }
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
    ? input.engineId === FIRST_PLUMAGE_STABLE_ID ||
      input.engineId === CAGE_OF_CONFINED_SIN_STABLE_ID
      ? [`${source.source.url}#sha256=${source.source.rawSha256}`, reviewedWEngine33Hash]
      : [
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
      input.engineId === FIRST_PLUMAGE_STABLE_ID
        ? (() => {
            if (
              source.source.provider !== 'nanoka' ||
              source.source.rawSha256 !==
                '006b40349cce50cff242630edec086520ff6f3f196da86e92d935c20794c77ff'
            )
              return {
                status: 'unsupported' as const,
                blockers: ['涅槃初翎来源 pin 已变化，须重新核对个人收益接线。'],
              }
            const resolved = resolveFirstPlumagePassive({
              refinement: input.refinement,
              specialtyMatches: true,
              teamAnomalyCritWindowActive: boundRuntime.flags[FIRST_PLUMAGE_WINDOW_FLAG],
            })
            if (resolved.status !== 'supported') return resolved
            return {
              ...resolved,
              exclusions: [],
              // Permanent AP is already included in outOfCombatPanel's initial stats.
              effects: resolved.effects
                .filter((effect) => effect.stat === 'damage_bonus')
                .map((effect) => ({
                  kind: 'modifier',
                  target: effect.target,
                  stat: 'combat.dmg_.fire',
                  value: effect.value,
                })),
            }
          })()
        : input.engineId === CAGE_OF_CONFINED_SIN_STABLE_ID
          ? (() => {
              if (
                source.source.provider !== 'nanoka' ||
                source.source.rawSha256 !==
                  'd87697490b2748eca391d718e9937c7b44c8dc41960dff4b03af4e9041daebc4'
              )
                return {
                  status: 'unsupported' as const,
                  blockers: ['禁罪囚笼来源 pin 已变化，须重新核对个人收益接线。'],
                }
              const resolved = resolveCageOfConfinedSinPassive({
                refinement: input.refinement,
                specialtyMatches: true,
                runtimePolicy: 'exclude_unobserved',
                basicAttackHitWindowActive: boundRuntime.flags[CAGE_OF_CONFINED_SIN_WINDOW_FLAG],
              })
              if (resolved.status !== 'supported') return resolved
              return {
                ...resolved,
                effects: resolved.effects.map((effect) => ({
                  kind: 'modifier',
                  target: effect.target,
                  stat:
                    effect.stat === 'crit_rate'
                      ? 'combat.crit_'
                      : effect.stat === 'attack_percent'
                        ? 'combat.atk_'
                        : 'combat.resIgn_.wind',
                  value: effect.value,
                })),
              }
            })()
          : input.engineId === 'wengine-14102'
            ? resolveReconciledSteelCushion({
                refinement: input.refinement,
                runtime: boundRuntime,
              })
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
        const application = channel
          ? directStats[`combat.${channel[1]}`]
          : stat === 'combat.anomProf'
            ? 'anomaly_proficiency_flat'
            : directStats[stat]
        const effectPath =
          effect.kind === 'damage_event' && effect.owner === 'own'
            ? 'own.damage_event'
            : typeof effect.target === 'string' && stat
              ? `${effect.target}.${stat}`
              : null
        if (application === 'shield_percent' && !hasReviewedShieldConsumer32(input.agentId)) {
          exclude(key, '已解析护盾增益缺少该角色的有限护盾消费者。', [stat], effectPath)
          return
        }
        const transferableEnergy =
          input.engineId === 'wengine-13011' &&
          effect.target === 'team' &&
          application === 'energy_regen_percent'
        // Half-Sugar Bunny grants these effects to all squad members including
        // its wearer; the source resolver handles the conditional veil window.
        const halfSugarSelfShare =
          input.engineId === 'wengine-14134' &&
          effect.target === 'team' &&
          (stat === 'combat.atk_' || stat === 'combat.hp_' || stat === 'combat.crit_dmg_')
        const enemyDefenseReduction =
          effect.target === 'enemy' && application === 'defense_reduction'
        if (
          effect.kind !== 'modifier' ||
          (effect.target !== 'own' &&
            !transferableEnergy &&
            !halfSugarSelfShare &&
            !enemyDefenseReduction) ||
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
          receiverPath: /^(combat|initial|final|common)\./.test(stat)
            ? `${effect.target}.${stat}`
            : null,
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
    runtimeInput: {
      member: input.member ?? null,
      runtime: input.runtime ?? null,
    },
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
