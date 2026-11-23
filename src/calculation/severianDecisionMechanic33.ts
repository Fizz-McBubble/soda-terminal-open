import { canonicalJson, sha256 } from '../application/contentHash'
import parameters from './severianDecisionMechanic33.data.json'
import {
  currentAgentEventContracts,
  evaluateCurrentAgentTeamActivation,
} from './currentAgentMechanicContracts'
import type { UpstreamExpressionIR } from './currentUpstreamExpressionIR'

const ref = (path: string): UpstreamExpressionIR => ({ kind: 'reference', path })
export const severianDecisionSourceRefs33 = [
  `https://static.nanoka.cc/zzz/3.3/zh/character/1631.json#sha256=${parameters.sourceSha256}`,
  `https://static.nanoka.cc/zzz/3.3/zh/character/1631.json#${parameters.sourceLocator}`,
]

function buildEffect(
  effectId: string,
  receiver: string,
  value: UpstreamExpressionIR,
  operators: string[],
  dependencyKinds: string[],
) {
  const expressionIr: UpstreamExpressionIR = {
    kind: 'call',
    operator: 'add',
    receiver: ref(receiver),
    arguments: [value],
  }
  return {
    effectId,
    applicationScope: 'generic' as const,
    recipients: ['self' as const],
    locator: parameters.sourceLocator,
    numericExpression: {
      classification: 'upstream_expression_available' as const,
      operators,
      dependencyKinds,
      genericConditionalIdentifiers: [] as string[],
      todoFlagged: false,
      todoBoundary: null,
      expressionSha256: sha256(canonicalJson(expressionIr)),
      expressionIr,
      expressionIrReady: true,
    },
  }
}

export const severianDecisionEffects33 = [
  buildEffect(
    'core_crit_dmg_',
    'ownBuff.combat.crit_dmg_',
    {
      kind: 'call',
      operator: 'subscript',
      arguments: [
        ref('char.core'),
        {
          kind: 'array',
          items: parameters.critDamageBonusByCoreLevel.map((value) => ({
            kind: 'literal',
            value,
          })),
        },
      ],
    },
    ['add', 'subscript'],
    ['character_state', 'literal'],
  ),
  buildEffect(
    'core_common_dmg_',
    'ownBuff.combat.common_dmg_',
    {
      kind: 'call',
      operator: 'subscript',
      arguments: [
        ref('char.core'),
        {
          kind: 'array',
          items: parameters.damageBonusByCoreLevel.map((value) => ({
            kind: 'literal',
            value,
          })),
        },
      ],
    },
    ['add', 'subscript'],
    ['character_state', 'literal'],
  ),
  buildEffect(
    'core_wind_teammate_common_dmg_',
    'ownBuff.combat.common_dmg_',
    {
      kind: 'call',
      operator: 'cmpGE',
      arguments: [
        ref('team.common.count.wind'),
        { kind: 'literal', value: 2 },
        {
          kind: 'call',
          operator: 'subscript',
          arguments: [
            ref('char.core'),
            {
              kind: 'array',
              items: parameters.windTeammateExtraDamageBonusByCoreLevel.map((value) => ({
                kind: 'literal',
                value,
              })),
            },
          ],
        },
        { kind: 'literal', value: 0 },
      ],
    },
    ['add', 'cmpGE', 'subscript'],
    ['character_state', 'literal', 'team_composition'],
  ),
  buildEffect(
    'ability_atk',
    'ownBuff.combat.atk',
    {
      kind: 'call',
      operator: 'abilityCheck',
      arguments: [
        {
          kind: 'call',
          operator: 'min',
          arguments: [
            { kind: 'literal', value: parameters.additionalAbilityMaxBonusAtk },
            {
              kind: 'call',
              operator: 'prod',
              arguments: [
                ref('own.final.crit_'),
                { kind: 'literal', value: parameters.additionalAbilityMaxBonusAtk },
              ],
            },
          ],
        },
        { kind: 'literal', value: 0 },
      ],
    },
    ['abilityCheck', 'add', 'min', 'prod'],
    ['literal', 'mapped_stat'],
  ),
]

export const severianDecisionFunctionalInputs33 = severianDecisionEffects33.map((entry) => ({
  inputId: entry.effectId,
  kind: 'self_combat_modifier' as const,
  locator: entry.locator,
  numericExpression: {
    classification: entry.numericExpression.classification,
    expressionSha256: entry.numericExpression.expressionSha256,
    expressionIr: entry.numericExpression.expressionIr,
    expressionIrReady: true,
    todoFlagged: entry.numericExpression.todoFlagged,
  },
}))

export const severianDecisionSynergy33 = {
  agentId: 'agent-severian',
  seeds: currentAgentEventContracts
    .filter((partner) => partner.stableId !== 'agent-severian')
    .filter((partner) => {
      const result = evaluateCurrentAgentTeamActivation({
        stableId: 'agent-severian',
        memberIds: ['agent-severian', partner.stableId],
      })
      return result.status === 'supported' && result.active
    })
    .map((partner) => ({
      seedId: `severian-33-static-activation:${partner.stableId}`,
      partnerIds: [partner.stableId],
      system: 'additional_ability_static_activation_only',
      primaryOutputSource: 'direct_wind_attack_not_team_dps',
      sourceMapIds: [...severianDecisionSourceRefs33],
      sourceConfidence: 'registered_static_activation_fact_only',
      applicability: 'current_3_3_activation_only_not_observed_team',
    })),
}
