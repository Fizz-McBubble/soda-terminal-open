import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { getCurrentAgentDecisionMechanicContract } from '../calculation/currentAgentDecisionMechanicContracts'
import type { ReviewedTemplateEventConditionDeclaration32 } from '../calculation/reviewedTemplateEventConditions32'

/** Fixed, source-bound comparison coordinates. They are not observations of
 * the player's current fight, nor a model of acquiring the setup resources. */
export function compilePersonalComparisonPreparation32(input: {
  agentId: string
  engineId: string
  declaration?: ReviewedTemplateEventConditionDeclaration32
}): ReviewedTemplateEventConditionDeclaration32 | undefined {
  const event = getCurrentAgentEventContract(input.agentId)
  const formula = event?.source.formulaSha256
  const existing = input.declaration
  const own = (key: string) => existing !== undefined && Object.hasOwn(existing, key)
  const additions: Partial<ReviewedTemplateEventConditionDeclaration32> = {}
  const refs: string[] = []
  const adopt = (description: string) => {
    if (event) refs.push(`${event.source.formulaPath}#${event.source.formulaSha256}`)
    refs.push(`personal-comparison-preparation32:${description}`)
  }
  const ordinary: Readonly<Record<string, string>> = {
    'agent-burnice': '8A46BA0B3E268C6C2E67C2029E0FA293D3C7C97718BC2063D43FB29EB81D2B3C',
    'agent-grace': '2B4F04621AD8FDCAB017BF64CC071EDCCFADEDC56F10E0DB358664A909B14461',
    'agent-vivian': '89933DF78C2479BAEAD0CF1EC9100332815D549C7DBAB5DFC911EA896392500E',
    'agent-velina': '159122E6D3D10D58E3311F1FD44E193A430343BF58986BD725A3006BBACA20EA',
  }
  const ordinaryHash = ordinary[input.agentId]
  if (ordinaryHash && ordinaryHash === formula && !own('personalOrdinaryAnomaly')) {
    adopt('one-self-owned-ordinary-anomaly-no-acquisition-or-cycle')
    additions.personalOrdinaryAnomaly = {
      acceptedSingleOwnerSettlement: true,
      sourceRefs: [...refs],
    }
  }
  if (
    input.agentId === 'agent-miyabi' &&
    formula === '7C7E1F1AEDA1D38976D4C0B47C111EB0B4FC76DFE0E6554B567D8260DF8127F3' &&
    !own('miyabiShimotsuki')
  ) {
    adopt('one-shimotsuki-six-prepared-frost-no-resource-acquisition')
    additions.miyabiShimotsuki = { fallenFrost: 6, completeContact: true, sourceRefs: [...refs] }
  }
  if (
    input.agentId === 'agent-yanagi' &&
    formula === '5FFF32C390B426C1CAFF95FDD0EE6C744EF8D2FDCBD3A7F24D378C2EDEB921A2' &&
    !own('yanagiPolarity')
  ) {
    adopt('self-owned-shock-at-0-one-ex-at-1-active-at-1-no-inferred-duration-acquisition-or-cycle')
    additions.yanagiPolarity = {
      kind: 'yanagi_ex_single_polarity',
      acceptedSingleOwnerOriginalAnomaly: true,
      snapshotBasis: 'current_declared_panels',
      originalOwnerAgentId: 'agent-yanagi',
      applicationAtSeconds: 0,
      triggerAtSeconds: 1,
      activeUntilSeconds: 2,
      endedAtSeconds: null,
      sourceRefs: [...refs],
    }
  }
  if (
    input.agentId === 'agent-phoenix' &&
    formula === 'D938FDB17DAEB39F37F2939142061F3462D824DC2FEFD4A2A8A2F63127AB6120' &&
    !own('phoenixOwnFireAbloom')
  ) {
    adopt('self-fire-and-scorch-at-0-basic-abloom-at-1-no-acquisition-or-cycle')
    additions.phoenixOwnFireAbloom = {
      acceptedSingleOwnerOriginalAnomaly: true,
      snapshotBasis: 'current_declared_panels',
      originalActiveAtTrigger: true,
      targetConditionsUnchanged: true,
      originalAppliedAtSeconds: 0,
      scorchAppliedAtSeconds: 0,
      triggerAtSeconds: 1,
      sourceRefs: [...refs],
    }
  }
  const supportHashes: Readonly<Record<string, string>> = {
    'agent-zhao': 'D371D769E3EFA7F079DE26EE86762F7001B1025655CAF767D596F79FEF434B15',
    'agent-lucia': 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
  }
  const support = getCurrentAgentDecisionMechanicContract(input.agentId)?.effectContract
  if (
    !own('personalSupportPreparation32') &&
    input.agentId === 'agent-zhao' &&
    support?.source.formulaSha256 === supportHashes[input.agentId]
  ) {
    adopt('zhao-additional-ability-qualified-inside-veil-conditional-comparison')
    additions.personalSupportPreparation32 = {
      zhaoAdditionalAbilityActive: true,
      zhaoInsideEtherVeil: true,
    }
  }
  if (
    !own('personalSupportPreparation32') &&
    input.agentId === 'agent-lucia' &&
    support?.source.formulaSha256 === supportHashes[input.agentId]
  ) {
    adopt('lucia-prepared-darkbreaker-ex-and-dreamers-nursery-rhyme-self-share-no-window-uptime')
    additions.personalSupportPreparation32 = { luciaDarkbreaker: true }
  }
  if (
    !own('personalSupportPreparation32') &&
    input.agentId === 'agent-sunna' &&
    event?.source.formulaSha256 ===
      '90EFAD8D4E9D765E16739629DA3B8FAEC1964C20D0EBAA15F7A9292F520A414B'
  ) {
    adopt('sunna-prepared-chord-no-window-uptime')
    additions.personalSupportPreparation32 = { sunnaAngelicChordActive: true }
  }
  // Refringe's independent coefficient is evaluated at the fixed on-field
  // snapshot. The set's entry/on-field window follows that same snapshot;
  // the equipment resolver applies it only when its four pieces are equipped
  // and the source hash matches. A caller's explicit state always wins.
  if (
    input.agentId === 'agent-remielle' &&
    formula === '75AF20EB1BA2266489D8901F948DB4AE51C73D5DE73C172F09B2349CFD503225' &&
    !own('personalFunctionalConditions32')
  ) {
    adopt('remielle-independent-refringe-on-field-snapshot-no-trigger-or-cycle')
    additions.personalFunctionalConditions32 = {
      flags: { 'FeatheredFate:entersOrActive': true },
    }
  }
  if (!Object.keys(additions).length) return existing
  return {
    ...existing,
    ...additions,
    sourceRefs: [...new Set([...(existing?.sourceRefs ?? []), ...refs])],
  }
}
