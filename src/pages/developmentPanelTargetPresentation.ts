import type { GoldenWorkbenchData } from '../features/agentDevelopmentGolden/types'
import type { TargetPanel } from '../application/buildTargetPresentation'
import type { ReviewedTargetContext } from '../gameDataPacks/reviewedContextualTargetPanel'
import {
  readTargetPanelMetricSemantic,
  targetPanelMetricKeys,
  type TargetPanelMetricKey,
} from '../gameDataPacks/targetPanelSemantics'
import { reviewedSupplementaryPanelTargets } from '../gameDataPacks/reviewedTargetPanelGuidance'
import { getCharacterPanelFields } from '../application/characterPanelFields'
import { getCharacterPanelDisplayContract } from '../application/characterPanelMenuPresentation'

type Target = GoldenWorkbenchData['graduation']['panel'][number]
type SourceFact = { label: string; key?: string; target: string }
type NumericTarget = number | { min?: number; max?: number; upperOpen?: boolean }

const contextualMetrics: Readonly<Record<string, readonly string[]>> = {
  'agent-roxy': ['critRate', 'energyRegen'],
  'agent-sigrid': ['critRate'],
  'agent-yuzuha': ['atk'],
  'agent-astra': ['atk'],
  'agent-rina': ['penRatio'],
  'agent-pan-yinhu': ['atk'],
  'agent-soukaku': ['atk'],
  'agent-lucy': ['atk'],
}

function formatSupplementaryTarget(value: NumericTarget, percent: boolean) {
  const display = (amount: number) => `${Number(amount.toFixed(2))}${percent ? '%' : ''}`
  if (typeof value === 'number') return display(value)
  if (value.min === undefined) return `≤${display(value.max!)}`
  if (value.max === undefined) return `${display(value.min)}+`
  return `${display(value.min)}–${display(value.max)}${value.upperOpen ? '+' : ''}`
}

/**
 * Compact placement is separate from source adoption and scoring relevance.
 * Every adopted value survives in this list, including optional/combat references.
 */
export function developmentPanelTargetPresentation({
  facts,
  relevantFacts,
  panel,
  context,
}: {
  facts: readonly SourceFact[]
  relevantFacts: readonly Pick<SourceFact, 'label'>[]
  panel: TargetPanel
  context: ReviewedTargetContext
}): GoldenWorkbenchData['graduation']['panel'] {
  if (!panel || panel.status === 'missing') return []
  const raw =
    panel.value && typeof panel.value === 'object' && !Array.isArray(panel.value)
      ? (panel.value as Record<string, unknown>)
      : {}
  const fields = getCharacterPanelFields(context.agentId)
  const relevant = new Set(relevantFacts.map((fact) => fact.label))
  const sourceIds = panel.sourceRefs?.map((ref) => ref.id) ?? []
  const mechanicValues = raw.contextualMechanicTargets as Record<string, unknown> | undefined
  const cultivation = raw.cultivationReference as { keys?: string[] } | undefined
  const targets: Target[] = facts.map((fact) => {
    const field = fields.find((item) => item.key === fact.key || item.label === fact.label)
    const key = field?.key ?? fact.key
    const typed =
      key && targetPanelMetricKeys.includes(key as TargetPanelMetricKey)
        ? readTargetPanelMetricSemantic(raw, key as TargetPanelMetricKey)
        : null
    const reviewedRemielle =
      context.agentId === 'agent-remielle' &&
      ((key === 'atk' &&
        raw.atk === 4000 &&
        sourceIds.includes('gameland-remielle-build-2026-07-27')) ||
        (key === 'anomalyProficiency' &&
          raw.anomalyProficiency === 412 &&
          sourceIds.includes('gamewith-remielle-build-2026-07-30')))
    // Source-backed display variants/legacy observations remain references;
    // they are never promoted to unconditional numeric requirements.
    const semantic = typed ?? {
      requirement: 'required' as const,
      boundary: 'minimum' as const,
      observation: 'reference' as const,
    }
    const mechanic = Boolean(key && typeof mechanicValues?.[key] === 'number')
    const requiresContext = Boolean(key && contextualMetrics[context.agentId]?.includes(key))
    const referenceOnly =
      (!typed && !reviewedRemielle) ||
      (requiresContext && !mechanic) ||
      Boolean(cultivation?.keys && key && !cultivation.keys.includes(key))
    let value = fact.target
    if (mechanic && key) {
      // Show a reachable menu threshold, preserving the precise mechanic value
      // in the adopted source. Integer ATK cannot meet 3428.571... at 3428.
      const scale = getCharacterPanelDisplayContract(key, field?.unit).scale
      const exact = mechanicValues![key] as number
      value = `${Math.ceil((exact - 1e-9) * scale) / scale}${field?.unit ?? ''}`
      if (semantic.requirement === 'optional') value += '（可选）'
    }
    return {
      name: fact.label,
      value,
      key,
      unit:
        key === 'energyRegen' ? 'points_per_second' : field?.unit === '%' ? 'percent' : 'points',
      semantic,
      mechanic,
      placement: referenceOnly ? 'reference' : undefined,
    }
  })
  for (const extra of reviewedSupplementaryPanelTargets(context.agentId, sourceIds)) {
    targets.push({
      ...extra,
      value: formatSupplementaryTarget(extra.value, extra.unit === 'regen_bonus_percent'),
      mechanic: false,
      placement: extra.unit === 'regen_bonus_percent' ? 'reference' : undefined,
    })
  }

  const rupture = fields.some((field) => field.key === 'sheerForce')
  const ruptureOrder = ['sheerForce', 'hp', 'critRate', 'critDamage', 'atk']
  const rank = (target: Target) => {
    if (target.mechanic) return 0
    if (rupture) {
      const index = ruptureOrder.indexOf(target.key ?? '')
      return index < 0 ? 30 : 10 + index
    }
    return relevant.has(target.name) ? 20 : 30
  }
  let primary = targets.filter(
    (target) =>
      target.placement !== 'reference' &&
      target.semantic?.requirement !== 'optional' &&
      target.semantic?.observation !== 'in_combat',
  )
  // An all-optional build (Nicole) still has useful, explicitly optional advice.
  if (!primary.length)
    primary = targets.filter(
      (target) =>
        target.placement !== 'reference' &&
        target.semantic?.observation === 'out_of_combat' &&
        relevant.has(target.name),
    )
  const selected = new Set(primary.toSorted((a, b) => rank(a) - rank(b)).slice(0, 4))
  return targets.map((target) => ({
    ...target,
    placement: selected.has(target) ? 'primary' : 'reference',
  }))
}
