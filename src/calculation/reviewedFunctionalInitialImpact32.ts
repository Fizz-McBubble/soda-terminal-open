import { stableContentHash } from '../gameDataPacks/types'
import { canonicalJson, sha256 } from '../application/contentHash'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import { bindReviewedFunctionalSource32 } from './reviewedFunctionalSource32'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

export function evaluateReviewedDialynInitialImpact32(input: {
  initialCritRate: number
  coreLevel: number
  potential?: number | null
}) {
  const unsupported = (reason: string) => ({ status: 'unsupported' as const, blockers: [reason] })
  if (
    !Number.isInteger(input.coreLevel) ||
    input.coreLevel < 1 ||
    input.coreLevel > 7 ||
    !Number.isFinite(input.initialCritRate) ||
    input.initialCritRate < 0 ||
    (input.potential != null &&
      (!Number.isInteger(input.potential) || input.potential < 0 || input.potential > 6))
  )
    return unsupported('琉音初始冲击转换缺少合法核心技、初始暴击率或潜能身份。')
  const source = bindReviewedFunctionalSource32('agent-dialyn')
  if (source.status !== 'supported') return source
  const effectKey = 'agent-dialyn:core_impact'
  const blueprint = getCurrentAgentPlanningEffectBlueprint(effectKey)
  if (
    !blueprint ||
    blueprint.numericExpression.todoBoundary !== null ||
    blueprint.numericExpression.originalSource?.formulaSha256 !== source.source.formulaSha256 ||
    blueprint.numericExpression.originalSource.expressionSha256 !==
      '0D38CB711B3B37ACAEB71ABB9664A744E2677736D9BF056AF3515CD9DA7DBC35' ||
    sha256(canonicalJson(blueprint.numericExpression.expressionIr)) !==
      blueprint.numericExpression.expressionSha256
  )
    return unsupported('琉音初始冲击转换缺少已纠偏并锁定的生产表达式。')
  const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
  if (extracted.status !== 'supported') return extracted
  const result = evaluateUpstreamExpressionIr(
    extracted.value as UpstreamExpressionIR,
    createPlanningExpressionDomainRuntime({
      references: {
        ...source.references,
        'char.core': input.coreLevel - 1,
        'own.initial.crit_': input.initialCritRate,
      },
    }),
  )
  if (result.status !== 'supported') return result
  if (typeof result.value !== 'number' || !Number.isFinite(result.value) || result.value < 0)
    return unsupported('琉音冲击转换必须为有限非负点数。')
  return {
    status: 'supported' as const,
    effectKey,
    impactIncrease: result.value,
    bindingHash: stableContentHash({
      input: { ...input, potential: input.potential ?? null },
      source: source.source,
      expression: blueprint.numericExpression.expressionSha256,
    }),
    sourceRefs: blueprint.sourceRefs,
  }
}
