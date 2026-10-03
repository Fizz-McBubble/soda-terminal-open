/**
 * Category sums include self. These adopted teammate conditions must exceed
 * self's contribution: Pulchra contributes faction once; Piper faction + attribute.
 * Sources already reviewed in current31CompiledAgentRules:
 * miyoushe/62601585, image222308369; miyoushe/66657195, structured_content op28.
 * Preserve the current category terms, including Pulchra's rupture expansion.
 */
import type { AgentTeamActivationTerm } from '../calculation/currentAgentMechanicContracts'
import { reviewedPotentialTeamActivation } from './reviewedPotentialTeamActivation'

export function reviewedTeammateActivationMinimum(agentId: string, sourceMinimum: number) {
  return agentId === 'agent-pulchra' ? 2 : agentId === 'agent-piper' ? 3 : sourceMinimum
}

/** The locked Piper formula predates the 3.1 other-Anomaly teammate option. */
export function reviewedTeammateActivationTerms(
  agentId: string,
  sourceTerms: readonly AgentTeamActivationTerm[],
  potentialImage = 0,
): AgentTeamActivationTerm[] {
  const expansion = reviewedPotentialTeamActivation.find((entry) => entry.agentId === agentId)
  const terms = expansion
    ? sourceTerms.filter(
        (term) => !(term.kind === 'specialty' && term.value === expansion.specialty),
      )
    : [...sourceTerms]
  if (expansion && potentialImage >= expansion.minimum)
    terms.push({ kind: 'specialty', value: expansion.specialty })
  if (
    agentId === 'agent-piper' &&
    !terms.some((term) => term.kind === 'specialty' && term.value === 'anomaly')
  )
    terms.push({ kind: 'specialty', value: 'anomaly' })
  return terms
}

// Piper's adopted formula embeds the old count check instead of abilityCheck.
export const reviewedInlineAbilityEffectSources: Readonly<Record<string, string>> = {
  'agent-piper:ability_common_dmg_': 'miyoushe-66657195-piper-additional-ability',
}
