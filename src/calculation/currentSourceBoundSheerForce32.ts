import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentEventContract } from './currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { PlanningEffectRuntimeMember } from './currentPlanningEffectDomain'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

import {
  sheerForceCommonSource32,
  reviewedSources,
  reviewedStatHashes,
  reviewedPublicMappedStatLocators32,
  sourceBoundSheerForceHash32,
} from './currentSourceBoundSheerForceIdentity32'
export {
  sheerForceCommonSource32,
  sourceBoundSheerForceIdentity32,
  sourceBoundSheerForceHash32,
} from './currentSourceBoundSheerForceIdentity32'

const unsupported = (...blockers: string[]) => ({ status: 'unsupported' as const, blockers })
const bindingHashes = new WeakMap<object, string>()

/** Unconditional source contribution only. Conditional sheer buffs belong to event buckets. */
export function evaluateSourceBoundSheerForce32(input: {
  agentId: string
  level: number
  coreLevel: number
  initialStats: { atk: number; hp: number }
  finalStats: { atk: number; hp: number }
}) {
  const actor = getCurrentAgentEventContract(input.agentId)
  const effects = getCurrentAgentDecisionMechanicContract(input.agentId)?.effectContract
  const review = actor && reviewedSources.get(actor.upstreamKey)
  if (!actor || actor.identity.specialty !== 'rupture' || !effects || !review)
    return unsupported('未建立该主体的来源绑定贯穿力投影。')
  if (
    actor.source.commit !== sheerForceCommonSource32.commit ||
    effects.source.commit !== sheerForceCommonSource32.commit ||
    actor.source.repository !== sheerForceCommonSource32.repository ||
    effects.source.repository !== sheerForceCommonSource32.repository ||
    actor.source.formulaSha256 !== review[0] ||
    effects.source.formulaSha256 !== review[0] ||
    actor.source.statsSha256 !== reviewedStatHashes.get(actor.upstreamKey) ||
    effects.runtimeDefaults.source.mappedStatsSha256 !== review[1] ||
    !(
      effects.runtimeDefaults.source.mappedStatsPath.endsWith(
        `libs/zzz/stats/src/mappedStats/char/maps/${actor.upstreamKey}.ts`,
      ) ||
      effects.runtimeDefaults.source.mappedStatsPath ===
        reviewedPublicMappedStatLocators32[
          actor.upstreamKey as keyof typeof reviewedPublicMappedStatLocators32
        ]
    ) ||
    actor.source.formulaPath !== effects.source.formulaPath ||
    actor.source.formulaPath !== `libs/zzz/formula/src/data/char/sheets/${actor.upstreamKey}.ts`
  )
    return unsupported('贯穿力公式来源身份不匹配。')
  if (
    !Number.isInteger(input.level) ||
    input.level < 1 ||
    input.level > 60 ||
    !Number.isInteger(input.coreLevel) ||
    input.coreLevel < 2 ||
    input.coreLevel > 7 ||
    ![
      input.initialStats.atk,
      input.initialStats.hp,
      input.finalStats.atk,
      input.finalStats.hp,
    ].every((value) => Number.isFinite(value) && value >= 0)
  )
    return unsupported('贯穿力投影需有效实际等级、核心等级和初始/最终攻血。')
  const initialEffects = effects.effects.filter((effect) => {
    const ir = effect.numericExpression.expressionIr as UpstreamExpressionIR
    return (
      ir.kind === 'call' &&
      ir.receiver?.kind === 'reference' &&
      ir.receiver.path === 'ownBuff.initial.sheerForce'
    )
  })
  if (!initialEffects.length) return unsupported('缺少已核验的主体初始贯穿力表达式。')
  let personal = 0
  const sourceRefs = [
    `${sheerForceCommonSource32.repository}@${sheerForceCommonSource32.commit}`,
    `${sheerForceCommonSource32.path}#${sheerForceCommonSource32.sha256}`,
    `${actor.source.statsPath}#${actor.source.statsSha256}`,
    `libs/zzz/stats/src/mappedStats/char/maps/${actor.upstreamKey}.ts#${review[1]}`,
  ]
  for (const effect of initialEffects) {
    if (
      effect.applicationScope !== 'generic' ||
      effect.numericExpression.todoBoundary ||
      effect.numericExpression.genericConditionalIdentifiers.length
    )
      return unsupported('初始贯穿力表达式含未核验条件。')
    const blueprint = getCurrentAgentPlanningEffectBlueprint(`${input.agentId}:${effect.effectId}`)
    if (!blueprint) return unsupported('初始贯穿力表达式尚未编译。')
    const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
    if (extracted.status === 'unsupported') return extracted
    const value = evaluateUpstreamExpressionIr(
      extracted.value as UpstreamExpressionIR,
      createPlanningExpressionDomainRuntime({
        references: {
          ...effects.runtimeDefaults.references,
          'char.lvl': input.level,
          // Learned account levels2..7 map to0..5; UI1/skip is unsupported here.
          'char.core': input.coreLevel - 2,
          'own.initial.atk': input.initialStats.atk,
          'own.initial.hp': input.initialStats.hp,
          'own.final.atk': input.finalStats.atk,
          'own.final.hp': input.finalStats.hp,
        },
      }),
    )
    if (value.status === 'unsupported') return value
    if (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0)
      return unsupported('来源贯穿力贡献必须为有限非负值。')
    personal += value.value
    sourceRefs.push(...blueprint.sourceRefs)
  }
  // common: initialATK*.3 + (finalATK-initialATK)*.3. Personal
  // initial.sheerForce explicitly depends on finalHP, so recompute it per event.
  const initialAttackContribution = input.initialStats.atk * 0.3
  const combatAttackContribution = (input.finalStats.atk - input.initialStats.atk) * 0.3
  let bindingHash = bindingHashes.get(effects)
  if (!bindingHash) {
    bindingHash = stableContentHash({
      algorithm: sourceBoundSheerForceHash32,
      source: actor.source,
      effects: initialEffects,
      references: effects.runtimeDefaults.references,
      mappedSha256: review[1],
    })
    bindingHashes.set(effects, bindingHash)
  }
  return {
    status: 'supported' as const,
    sheerForce: initialAttackContribution + combatAttackContribution + personal,
    initialAttackContribution,
    combatAttackContribution,
    personalContribution: personal,
    sourceRefs: [...new Set(sourceRefs)],
    bindingHash,
  }
}

/** Explicit final observations are preserved. Derived menu values may be recomputed. */
export function resolvePlanningEventSheerForce32(input: {
  member: PlanningEffectRuntimeMember
  attack: number
  hp: number
  combatSheerForce: number
}) {
  const stats = input.member.finalStats
  if (stats.sheerForce !== undefined && !stats.sheerForceBasis) {
    if (input.attack !== stats.atk || input.hp !== stats.hp || input.combatSheerForce !== 0)
      return unsupported('显式最终贯穿力已包含未知窗口，不能静默叠加或重推。')
    return Number.isFinite(stats.sheerForce) && stats.sheerForce >= 0
      ? { status: 'supported' as const, sheerForce: stats.sheerForce }
      : unsupported('显式最终贯穿力无效。')
  }
  const projected = evaluateSourceBoundSheerForce32({
    agentId: input.member.agentId,
    level: input.member.level ?? Number.NaN,
    coreLevel: input.member.coreLevel,
    initialStats: input.member.initialStats,
    finalStats: { atk: input.attack, hp: input.hp },
  })
  if (projected.status === 'unsupported') return projected
  if (stats.sheerForceBasis && stats.sheerForceBasis.bindingHash !== projected.bindingHash)
    return unsupported('派生贯穿力来源绑定已过期。')
  if (stats.sheerForceBasis) {
    const staticProjection = evaluateSourceBoundSheerForce32({
      agentId: input.member.agentId,
      level: input.member.level ?? Number.NaN,
      coreLevel: input.member.coreLevel,
      initialStats: input.member.initialStats,
      finalStats: stats,
    })
    if (
      staticProjection.status === 'unsupported' ||
      stats.sheerForce === undefined ||
      Math.abs(staticProjection.sheerForce - stats.sheerForce) > 1e-8
    )
      return unsupported('派生贯穿力值与具名静态计算基准不一致。')
  }
  return { ...projected, sheerForce: projected.sheerForce + input.combatSheerForce }
}
