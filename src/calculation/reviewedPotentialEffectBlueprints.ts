import { canonicalJson, sha256 } from '../evaluation/contentHash'
import type { CurrentAgentPlanningEffectBlueprint } from './currentAgentPlanningEffectBlueprint'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'
import { reviewedPotentialDefinitions } from '../gameDataPacks/reviewedPotentialDefinitions'

const literal = (value: number): UpstreamExpressionIR => ({ kind: 'literal', value })
const reference = (path: string): UpstreamExpressionIR => ({ kind: 'reference', path })
const call = (operator: string, ...args: UpstreamExpressionIR[]): UpstreamExpressionIR => ({
  kind: 'call',
  operator,
  arguments: args,
})

// Parameters retain their source-specific receiver. A daze, interval, Assault,
// or action-restricted value must never be relabelled as ordinary damage.
export const reviewedPotentialParameterBlueprints: readonly CurrentAgentPlanningEffectBlueprint[] =
  reviewedPotentialDefinitions.flatMap((definition) =>
    definition.effects
      .filter(() => definition.agentId !== 'agent-jane')
      .map((effect) => {
        let value: UpstreamExpressionIR = call('subscript', reference('char.potential'), {
          kind: 'array',
          items: effect.valueByLevel.map(literal),
        })
        const conversion = effect.conversion
        if (conversion) {
          const isPenetration = conversion.inputStat === 'penetration_ratio_fraction'
          const input = isPenetration
            ? reference('own.initial.pen_')
            : reference('own.initial.enerRegen')
          value = call(
            'prod',
            value,
            call('max', literal(0), call('sum', input, literal(-(conversion.threshold ?? 0)))),
            literal(1 / (conversion.step ?? 1)),
          )
          if (conversion.cap !== null) value = call('min', value, literal(conversion.cap))
        }
        const activationReference = `potential.${effect.effectId}.active`
        if (effect.formulaBinding.compilationDisposition !== 'requires_potential_level_only')
          value = call(
            'prod',
            value,
            call('cmpEq', reference(activationReference), literal(1), literal(1), literal(0)),
          )
        const expression: UpstreamExpressionIR = {
          kind: 'call',
          operator: 'add',
          receiver: reference(
            `${effect.targetKind === 'team' ? 'teamBuff' : 'ownBuff'}.potential.parameters.${effect.effectId}`,
          ),
          arguments: [value],
        }
        return {
          effectKey: `${definition.agentId}:${effect.effectId}`,
          providerAgentId: definition.agentId,
          effectId: effect.effectId,
          targetKinds: [effect.targetKind],
          snapshotPolicy: 'recompute_per_event',
          activationBoundary: 'explicit_planning_baseline_disposition_required',
          numericExpression: {
            sourceStatus: 'declarative_baseline_input',
            operators: ['add', 'subscript', 'prod', 'sum', 'min', 'max', 'cmpEq'],
            dependencyKinds: [
              'char.potential',
              ...(conversion ? ['own.initial'] : []),
              activationReference,
            ],
            expressionSha256: sha256(canonicalJson(expression)),
            expressionIr: expression,
            expressionIrReady: true,
            todoBoundary: `Source parameter only; ${effect.formulaBinding.compilationDisposition}; ${effect.activationRequirement}`,
          },
          sourceRefs: [
            `${definition.source.url}#sourceVersion=${definition.source.sourceVersion}`,
            `sha256:${definition.source.contentHash}`,
            `upstream-sha256:${definition.source.upstreamRawSha256}`,
            ...(definition.source.supplementarySources ?? []).flatMap((source) => [
              `${source.url}#sourceVersion=${source.sourceVersion}`,
              `sha256:${source.contentHash}`,
            ]),
          ],
        }
      }),
  )

const janePotentialAssaultCritDamageExpression: UpstreamExpressionIR = {
  kind: 'call',
  operator: 'add',
  receiver: { kind: 'reference', path: 'ownBuff.potential.assault_crit_dmg_' },
  arguments: [
    {
      kind: 'call',
      operator: 'subscript',
      arguments: [
        { kind: 'reference', path: 'char.potential' },
        {
          kind: 'array',
          items: [0, 0, 0.1, 0.15, 0.2, 0.25, 0.3].map((value) => ({
            kind: 'literal' as const,
            value,
          })),
        },
      ],
    },
  ],
}

/**
 * Reviewed prose evidence is deliberately kept separate from the frozen
 * upstream formula corpus. It proves this one self-only potential value, not
 * Jane's whole damage model, activation window, or a Formal CalculationContext.
 */
export const reviewedPotentialEffectBlueprints: readonly CurrentAgentPlanningEffectBlueprint[] =
  Object.freeze([
    {
      effectKey: 'agent-jane:potential_assault_crit_dmg_',
      providerAgentId: 'agent-jane',
      effectId: 'potential_assault_crit_dmg_',
      targetKinds: ['self'],
      snapshotPolicy: 'recompute_per_event',
      activationBoundary: 'explicit_planning_baseline_disposition_required',
      numericExpression: {
        // This deterministic IR is a local, source-backed expression, not an
        // assertion that the upstream repository supplied an equivalent AST.
        sourceStatus: 'declarative_baseline_input',
        operators: ['add', 'subscript'],
        dependencyKinds: ['char.potential'],
        expressionSha256: sha256(canonicalJson(janePotentialAssaultCritDamageExpression)),
        expressionIr: janePotentialAssaultCritDamageExpression,
        expressionIrReady: true,
        todoBoundary: null,
      },
      sourceRefs: [
        'https://www.miyoushe.com/zzz/article/76957755#sourceVersion=3.1',
        'sha256:77b16c49d2dab1cb859099da5d7835fd2b22d8e94b772d44e41d7148dc2aeab4',
        'fact-miyoushe-3.1-delta-3ac6d324d33b27396831',
      ],
    },
  ])
