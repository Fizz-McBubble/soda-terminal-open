import { inactive } from './reviewedPotentialDefinitionContract'
import {
  lycaonPotentialDefinition,
  rinaPotentialDefinition,
} from './reviewedPotentialSupportDefinitions'
import {
  burnicePotentialDefinition,
  ellenPotentialDefinition,
  gracePotentialDefinition,
  harumasaPotentialDefinition,
  janePotentialDefinition,
  nekomataPotentialDefinition,
  soldier0AnbyPotentialDefinition,
  soldier11PotentialDefinition,
} from './reviewedPotentialOffenseDefinitions'

export {
  type PotentialEffectTargetKind,
  type PotentialEffectValueKind,
  type PotentialActivationKey,
  type PotentialLevelValues,
  type PotentialConversion,
  type PotentialFormulaBinding,
  type PotentialValueSemantics,
  type ReviewedPotentialEffectDefinition,
  type ReviewedPotentialDefinition,
} from './reviewedPotentialDefinitionContract'

/**
 * Source-backed potential definitions for every non-empty potentialParams
 * member in the locked 58-character 3.1 snapshot. The source version remains
 * the archive version; current raw presence does not upgrade a guide into a
 * formal value or prove an account owns/activated potential.
 */
export const reviewedPotentialDefinitions = Object.freeze([
  burnicePotentialDefinition,
  ellenPotentialDefinition,
  gracePotentialDefinition,
  harumasaPotentialDefinition,
  janePotentialDefinition,
  lycaonPotentialDefinition,
  nekomataPotentialDefinition,
  rinaPotentialDefinition,
  soldier0AnbyPotentialDefinition,
  soldier11PotentialDefinition,
])

const reviewedPotentialDefinitionByAgentId = new Map(
  reviewedPotentialDefinitions.map((definition) => [definition.agentId, definition]),
)

export function getReviewedPotentialDefinition(agentId: string) {
  return reviewedPotentialDefinitionByAgentId.get(agentId) ?? null
}

export const reviewedPotentialDefinitionCoverage = Object.freeze({
  snapshotCharacterCount: 58,
  potentialSubjectCount: reviewedPotentialDefinitions.length,
  effectCount: reviewedPotentialDefinitions.reduce(
    (count, definition) => count + definition.effects.length,
    0,
  ),
  activationKeysFailClosed: reviewedPotentialDefinitions.every((definition) =>
    definition.effects.every((effect) => effect.activationKey === inactive),
  ),
})
