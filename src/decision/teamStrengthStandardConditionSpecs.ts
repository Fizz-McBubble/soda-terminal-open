import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import { requiredReferences } from '../calculation/currentPlanningEffectExpressions'

export type ConditionBindingSpec = {
  providerAgentId: string
  recipientAgentIds: readonly string[]
  referenceKey: string
  value: boolean | number
  effectIds: readonly string[]
  sourceRefs: readonly string[]
  owner: 'upstream_go_condition' | 'reviewed_template_window' | 'reviewed_recipient_window'
}

export const comparisonSourceRefs = [
  'https://www.prydwen.gg/zenless/characters/ye-shunguang',
  'https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-teams',
] as const

export const conditionSpecs = [
  {
    providerAgentId: 'agent-dialyn',
    recipientAgentIds: ['team'],
    referenceKey: 'overwhelmingly_positive',
    value: true,
    effectIds: ['agent-dialyn:ability_common_dmg_', 'agent-dialyn:m1_resIgn_'],
    sourceRefs: ['https://www.prydwen.gg/zenless/characters/dialyn', ...comparisonSourceRefs],
    owner: 'upstream_go_condition',
  },
  {
    providerAgentId: 'agent-dialyn',
    recipientAgentIds: ['team'],
    referenceKey: 'malicious_complaint',
    value: true,
    effectIds: ['agent-dialyn:m2_common_dmg_'],
    sourceRefs: ['https://www.prydwen.gg/zenless/characters/dialyn', ...comparisonSourceRefs],
    owner: 'upstream_go_condition',
  },
  {
    providerAgentId: 'agent-sunna',
    recipientAgentIds: ['team'],
    referenceKey: 'sunnaAngelicChordination32',
    value: true,
    effectIds: ['agent-sunna:reviewed_angelic_chord_attack32'],
    sourceRefs: ['https://www.prydwen.gg/zenless/characters/sunna', ...comparisonSourceRefs],
    owner: 'reviewed_template_window',
  },
  {
    providerAgentId: 'agent-trigger',
    recipientAgentIds: ['enemy'],
    referenceKey: 'aftershock_hit',
    value: true,
    effectIds: ['agent-trigger:core_stun_', 'agent-trigger:m1_stun_'],
    sourceRefs: ['https://www.prydwen.gg/zenless/characters/trigger', ...comparisonSourceRefs],
    owner: 'upstream_go_condition',
  },
  {
    providerAgentId: 'agent-zhao',
    recipientAgentIds: ['team'],
    referenceKey: 'zhaoWellspringAttackWindow32',
    value: true,
    effectIds: ['agent-zhao:reviewed_wellspring_attack32'],
    sourceRefs: ['https://www.prydwen.gg/zenless/characters/zhao', ...comparisonSourceRefs],
    owner: 'reviewed_template_window',
  },
  {
    providerAgentId: 'agent-ye-shunguang',
    recipientAgentIds: ['self'],
    referenceKey: 'yeShunguangUnity32',
    value: true,
    effectIds: [
      'agent-ye-shunguang:reviewed_unity_crit32',
      'agent-ye-shunguang:reviewed_unity_damage32',
    ],
    sourceRefs: comparisonSourceRefs,
    owner: 'reviewed_template_window',
  },
] as const satisfies readonly ConditionBindingSpec[]

export const upstreamConditionKeys = new Set([
  'overwhelmingly_positive',
  'malicious_complaint',
  'aftershock_hit',
  'tanuki_wish',
  'sweet_scare',
  'exSpecial_ult_hit',
  'prophecy',
  'abloom',
  'exSpecial_used',
  'clarity',
  'thermal_penetration',
  'jougen',
  'kagen',
])

// Opt-in Phoenix comparison windows, validated through the existing pinned
// condition catalog. Booleans describe the one evaluated snapshot. Thermal
// Penetration explicitly declares ONE stack in its 0..5 source domain, not
// maximum stacks, a hit count, duration, observed uptime or a rotation.
const phoenixWindowDeclarations: readonly [string, string, boolean | number][] = [
  ['agent-yuzuha', 'tanuki_wish', true],
  ['agent-yuzuha', 'sweet_scare', true],
  ['agent-yuzuha', 'exSpecial_ult_hit', true],
  ['agent-vivian', 'prophecy', true],
  ['agent-vivian', 'abloom', true],
  ['agent-yanagi', 'exSpecial_used', true],
  ['agent-yanagi', 'clarity', true],
  ['agent-yanagi', 'jougen', true],
  ['agent-yanagi', 'kagen', false],
  ['agent-burnice', 'thermal_penetration', 1],
]

export const phoenixWindowSpecs: ConditionBindingSpec[] = phoenixWindowDeclarations.map(
  ([providerAgentId, referenceKey, value]) => ({
    providerAgentId,
    referenceKey,
    value,
    recipientAgentIds: ['team'],
    effectIds: currentAgentPlanningEffectBlueprints
      .filter(
        (entry) =>
          entry.providerAgentId === providerAgentId &&
          requiredReferences(entry.numericExpression.expressionIr).includes(referenceKey),
      )
      .map((entry) => entry.effectKey),
    sourceRefs: blueprintSourceRefs(providerAgentId, referenceKey),
    owner: 'upstream_go_condition',
  }),
)

export const veilProviderIds = new Set(['agent-sunna', 'agent-zhao'])

export function blueprintSourceRefs(agentId: string, referenceKey: string) {
  return currentAgentPlanningEffectBlueprints
    .filter(
      (entry) =>
        entry.providerAgentId === agentId &&
        requiredReferences(entry.numericExpression.expressionIr).includes(referenceKey),
    )
    .flatMap((entry) => entry.sourceRefs)
}
