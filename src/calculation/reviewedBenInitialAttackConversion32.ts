import { canonicalJson, sha256 } from '../application/contentHash'
import { stableContentHash } from '../gameDataPacks/types'
import { getCurrentAgentDecisionMechanicContract } from './currentAgentDecisionMechanicContracts'
import { getCurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from './currentUpstreamExpressionIR'

export const reviewedBenInitialAttackConversionIdentity32 = Object.freeze({
  revision: 'ben-completed-initial-defense-to-initial-attack-once-r1',
  effectKey: 'agent-ben:core_atk',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaPath: 'libs/zzz/formula/src/data/char/sheets/Ben.ts',
  formulaSha256: '395B208714B28F4B9FCDDCC6FD328424443E8AC42147D1E4DD68569E0E3A7FDF',
  expressionSha256: '282284512459EA83CE62D4C05480590C0822F533C93C973D14CEFF59B12A2C4C',
  originalIrSha256: 'd465e7127e89d9212f34989594e9309ebce01e18ee122860773d4515aad46590',
})

/** Own initial DEF is the completed unconditional defense panel. This adds a
 * source initial ATK contribution once; neither combat DEF nor white base ATK
 * is rewritten, and this entry is never reapplied as a combat modifier. */
export function evaluateReviewedBenInitialAttackConversion32(input: {
  coreLevel: number
  initialDefense: number
}) {
  const unsupported = (...blockers: string[]) => ({ status: 'unsupported' as const, blockers })
  if (!Number.isInteger(input.coreLevel) || input.coreLevel < 1 || input.coreLevel > 7)
    return unsupported('Ben initial conversion requires core 1..7')
  if (!Number.isFinite(input.initialDefense) || input.initialDefense < 0)
    return unsupported('Ben initial defense must be finite and nonnegative')
  const source = reviewedBenInitialAttackConversionIdentity32
  const blueprint = getCurrentAgentPlanningEffectBlueprint(source.effectKey)
  const contract = getCurrentAgentDecisionMechanicContract('agent-ben')
  if (
    !blueprint ||
    !contract ||
    blueprint.numericExpression.todoBoundary !== null ||
    contract.effectContract.source.commit !== source.commit ||
    contract.effectContract.source.formulaPath !== source.formulaPath ||
    contract.effectContract.source.formulaSha256 !== source.formulaSha256 ||
    blueprint.numericExpression.expressionSha256 !== source.expressionSha256 ||
    sha256(canonicalJson(blueprint.numericExpression.expressionIr)) !== source.originalIrSha256
  )
    return unsupported('Ben initial conversion source changed')
  const extracted = extractUpstreamEffectValueIr(blueprint.numericExpression.expressionIr)
  if (extracted.status !== 'supported') return extracted
  const evaluated = evaluateUpstreamExpressionIr(
    extracted.value as UpstreamExpressionIR,
    createPlanningExpressionDomainRuntime({
      references: {
        ...contract.effectContract.runtimeDefaults.references,
        'char.core': input.coreLevel - 1,
        'own.initial.def': input.initialDefense,
      },
    }),
  )
  if (evaluated.status !== 'supported') return evaluated
  if (
    typeof evaluated.value !== 'number' ||
    !Number.isFinite(evaluated.value) ||
    evaluated.value < 0
  )
    return unsupported('Ben initial conversion must return finite attack points')
  return {
    status: 'supported' as const,
    effectKey: source.effectKey,
    attackIncrease: evaluated.value,
    bindingHash: stableContentHash({ source, ...input, attackIncrease: evaluated.value }),
    sourceRefs: blueprint.sourceRefs,
    boundary: 'unconditional_initial_conversion_once; combat-defense-buffs-excluded',
  }
}
