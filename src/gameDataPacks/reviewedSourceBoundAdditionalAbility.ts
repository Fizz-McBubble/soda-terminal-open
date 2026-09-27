/**
 * Current source-bound teammate conditions for the 12 agents whose locked raw
 * formulas remain not_expressed. These are activation predicates only, not
 * effect triggers or evidence that the raw formula was extracted.
 * Reviewed against additional_ability_12.json (base 10cfe877, 2026-09-23).
 */
type Category = 'attribute' | 'faction' | 'specialty'
type OwnerIdentity = Record<Category, string>
type SourceTerm = { kind: Category; value: string | 'owner.attribute' | 'owner.faction' }

const sourceBoundTerms: Record<string, readonly SourceTerm[]> = {
  'agent-anby': [
    { kind: 'attribute', value: 'owner.attribute' },
    { kind: 'faction', value: 'owner.faction' },
  ],
  'agent-aria': [
    { kind: 'specialty', value: 'stun' },
    { kind: 'specialty', value: 'support' },
    { kind: 'specialty', value: 'anomaly' },
    { kind: 'faction', value: 'owner.faction' },
  ],
  'agent-astra': ['damage', 'anomaly', 'rupture'].map((value) => ({
    kind: 'specialty' as const,
    value,
  })),
  'agent-nangong': [
    { kind: 'specialty', value: 'anomaly' },
    { kind: 'faction', value: 'owner.faction' },
  ],
  'agent-norma': [
    { kind: 'specialty', value: 'damage' },
    { kind: 'specialty', value: 'rupture' },
    { kind: 'faction', value: 'owner.faction' },
  ],
  'agent-promeia': ['anomaly', 'support'].map((value) => ({
    kind: 'specialty' as const,
    value,
  })),
  'agent-pyrois': ['stun', 'support'].map((value) => ({
    kind: 'specialty' as const,
    value,
  })),
  'agent-remielle': [
    { kind: 'specialty', value: 'anomaly' },
    { kind: 'faction', value: 'owner.faction' },
  ],
  'agent-sunna': [
    { kind: 'specialty', value: 'damage' },
    { kind: 'faction', value: 'owner.faction' },
  ],
  'agent-velina': [
    { kind: 'specialty', value: 'anomaly' },
    { kind: 'attribute', value: 'owner.attribute' },
  ],
  'agent-ye-shunguang': ['support', 'defense'].map((value) => ({
    kind: 'specialty' as const,
    value,
  })),
  'agent-zhao': ['damage', 'anomaly', 'support'].map((value) => ({
    kind: 'specialty' as const,
    value,
  })),
}

export const sourceBoundAdditionalAbilityAgentIds = Object.freeze(Object.keys(sourceBoundTerms))

export function resolveSourceBoundAdditionalAbility(
  agentId: string,
  owner: OwnerIdentity,
  specialtyEncoding: 'damage' | 'attack' = 'damage',
) {
  const terms = sourceBoundTerms[agentId]
  if (!terms) return null
  return {
    kind: 'category_sum_minimum' as const,
    agentId,
    terms: terms.map((term) => ({
      kind: term.kind,
      value:
        term.value === 'owner.attribute'
          ? owner.attribute
          : term.value === 'owner.faction'
            ? owner.faction
            : term.kind === 'specialty' && term.value === 'damage'
              ? specialtyEncoding
              : term.value,
    })),
    minimum: 1,
    dynamicTerms: [],
  }
}
