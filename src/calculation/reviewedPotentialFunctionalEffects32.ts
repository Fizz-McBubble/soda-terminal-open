import { stableContentHash } from '../gameDataPacks/types'
import { getReviewedPotentialDefinition } from '../gameDataPacks/reviewedPotentialDefinitions'
import {
  bindReviewedPotentialApplications,
  type PotentialApplicationEvent,
  type PotentialInitialStatsProvenance,
} from './potentialApplicationBinding'
import { functionalEquipmentGaps32 } from './reviewedFunctionalEquipmentDependencies32'
import type {
  evaluateReviewedFunctionalCapacity32,
  ReviewedFunctionalCapacity32,
} from './reviewedFunctionalCapacity32'

export const reviewedPotentialFunctionalIdentity32 = Object.freeze({
  revision: 'reviewed-potential-functional-effects-r1',
  burnice: {
    effectId: 'potential_energy_regen_to_anomaly_mastery',
    threshold: 1.8,
    step: 0.1,
    cap: 25,
  },
})

export type ReviewedPotentialFunctionalInput32 = Parameters<
  typeof evaluateReviewedFunctionalCapacity32
>[0] & {
  initialStatsProvenance?: PotentialInitialStatsProvenance
}

/**
 * Functional capacity expressing completed combat Anomaly Mastery from
 * legitimate calculated initial stats and explicit potentialEvent preparation states.
 * Does not price damage or infer an anomaly cycle.
 */
export function evaluateReviewedBurniceAnomalyMasteryCapacity32(
  input: ReviewedPotentialFunctionalInput32,
): {
  status: 'supported' | 'unsupported'
  capacities: ReviewedFunctionalCapacity32[]
  blockers: string[]
} {
  const member = input.member
  const agentId = member.agentId
  if (agentId !== 'agent-burnice') {
    return { status: 'supported', capacities: [], blockers: [] }
  }

  if (
    !Number.isInteger(member.coreLevel) ||
    member.coreLevel < 1 ||
    member.coreLevel > 7 ||
    !Number.isInteger(member.mindscape) ||
    member.mindscape < 0 ||
    member.mindscape > 6 ||
    (member.potential != null &&
      (!Number.isInteger(member.potential) || member.potential < 0 || member.potential > 6))
  ) {
    return {
      status: 'unsupported',
      capacities: [],
      blockers: ['功能容量缺少合法核心技/影画/潜能身份。'],
    }
  }

  if (
    !Number.isFinite(member.initialStats.enerRegen) ||
    member.initialStats.enerRegen < 0 ||
    !Number.isFinite(member.initialStats.anomMas) ||
    member.initialStats.anomMas < 0
  ) {
    return {
      status: 'unsupported',
      capacities: [],
      blockers: ['功能容量缺少合法初始属性：enerRegen/anomMas。'],
    }
  }

  const equipmentGaps = functionalEquipmentGaps32(input.equipmentExclusions, agentId, [
    'initial.enerRegen',
    'combat.enerRegen',
    'initial.anomMas',
    'combat.anomMas',
  ])

  const provenance = input.initialStatsProvenance ?? 'calculation_context'
  const trusted = provenance === 'account_observation' || provenance === 'calculation_context'
  const burniceUsages = (input.eventUsages ?? []).filter((u) => u.ownerAgentId === agentId)

  let potEvent: PotentialApplicationEvent | undefined
  let eventConflict = false
  let conflictReason: string | undefined

  if (input.potentialEvents) {
    let candidate: PotentialApplicationEvent | undefined
    if (input.potentialEvents[`${agentId}:potential`]) {
      candidate = input.potentialEvents[`${agentId}:potential`]
    } else if (input.potentialEvents[`${agentId}:event`]) {
      candidate = input.potentialEvents[`${agentId}:event`]
    } else if (input.potentialEvents[agentId]) {
      candidate = input.potentialEvents[agentId]
    } else if (burniceUsages.length > 0) {
      for (const usage of burniceUsages) {
        const ev =
          input.potentialEvents[`${agentId}:${usage.eventId}`] ??
          input.potentialEvents[usage.eventId]
        if (ev) {
          candidate = ev
          break
        }
      }
    }

    if (candidate) {
      const declaredOwner = (candidate as { ownerAgentId?: string }).ownerAgentId
      if (declaredOwner && declaredOwner !== agentId) {
        eventConflict = true
        conflictReason = `burnice_potential_event_owner_mismatch:${declaredOwner}`
      } else if (burniceUsages.length > 0) {
        if (!candidate.eventId || !burniceUsages.some((u) => u.eventId === candidate!.eventId)) {
          eventConflict = true
          conflictReason = `burnice_potential_event_id_mismatch:${candidate.eventId ?? 'missing'}`
        } else {
          potEvent = candidate
        }
      } else {
        if (candidate.eventId && candidate.eventId.trim().length > 0) {
          potEvent = candidate
        } else {
          eventConflict = true
          conflictReason = 'burnice_potential_event_id_empty'
        }
      }
    }
  }

  const bindingEvent: PotentialApplicationEvent = potEvent
    ? {
        eventId: potEvent.eventId,
        actionFamilies: potEvent.actionFamilies ?? [],
        providerStateKeys: potEvent.providerStateKeys ?? [],
        targetStateKeys: potEvent.targetStateKeys ?? [],
        providerStateStacks: potEvent.providerStateStacks,
        sourceRefs: potEvent.sourceRefs?.length ? potEvent.sourceRefs : [],
      }
    : {
        eventId: '',
        actionFamilies: [],
        providerStateKeys: [],
        targetStateKeys: [],
        sourceRefs: [],
      }

  const applications = bindReviewedPotentialApplications({
    member: {
      agentId,
      potential: member.potential ?? 0,
      initialStats: {
        pen_: member.initialStats.pen_ ?? 0,
        enerRegen: member.initialStats.enerRegen,
      },
      provenance,
    },
    event: bindingEvent,
  })

  const amApp = applications.find(
    (row) => row.effectId === 'potential_energy_regen_to_anomaly_mastery',
  )

  const definition = getReviewedPotentialDefinition(agentId)
  const defaultRefs = definition
    ? [
        `${definition.source.url}#sourceVersion=${definition.source.sourceVersion}`,
        `sha256:${definition.source.contentHash}`,
        `upstream-sha256:${definition.source.upstreamRawSha256}`,
        `${definition.source.upstreamRawPath}#${definition.source.upstreamRawSha256}`,
      ]
    : []

  let bonusAm = 0
  const included: string[] = ['completed_initial_anomaly_mastery']
  const excludedReasons: string[] = []
  const blockers = [...new Set(equipmentGaps)]
  const sourceRefs = [...defaultRefs]

  const hasPotential = (member.potential ?? 0) > 0
  const meetsEnergyThreshold = member.initialStats.enerRegen >= 1.8

  if (eventConflict && conflictReason) {
    excludedReasons.push(conflictReason)
  }
  if (hasPotential && !potEvent) {
    excludedReasons.push('burnice_potential_event_missing')
  }

  if (amApp?.status === 'applied') {
    bonusAm = amApp.value
    included.push(amApp.effectKey)
    sourceRefs.push(...amApp.sourceRefs)
  } else if (amApp?.status === 'excluded') {
    excludedReasons.push(`${amApp.effectKey}:${amApp.reason}`)
  } else {
    excludedReasons.push('burnice_potential_am_conversion_unbound')
  }

  let value: number | null = null
  if (equipmentGaps.length === 0) {
    if (!hasPotential) {
      value = member.initialStats.anomMas
    } else if (meetsEnergyThreshold) {
      if (amApp?.status === 'applied') {
        value = member.initialStats.anomMas + bonusAm
      } else {
        value = null
        const specificBlocker =
          eventConflict && conflictReason
            ? conflictReason
            : !potEvent
              ? 'burnice_potential_event_missing'
              : amApp
                ? `${amApp.effectKey}:${amApp.reason}`
                : 'burnice_potential_event_missing'
        blockers.push(specificBlocker)
      }
    } else {
      if (trusted) {
        value = member.initialStats.anomMas
      } else {
        value = null
        if (amApp) blockers.push(`${amApp.effectKey}:${amApp.reason}`)
        else blockers.push('burnice_potential_initial_stats_untrusted')
      }
    }
  }

  const contextKey = stableContentHash({
    actor: {
      agentId,
      level: member.level ?? null,
      coreLevel: member.coreLevel,
      mindscape: member.mindscape,
      potential: member.potential ?? null,
    },
    declaration: 'completed_combat_anomaly_mastery_from_initial_panel_and_potential_conversion',
    // Equipment operands change between candidates. The comparison identity
    // fixes the actor and declared event, not the panel being optimized.
    provenance,
    event: potEvent
      ? {
          eventId: potEvent.eventId,
          actionFamilies: potEvent.actionFamilies ?? [],
          sourceRefs: potEvent.sourceRefs ?? [],
        }
      : null,
    sourceRefs: defaultRefs,
    identity: reviewedPotentialFunctionalIdentity32.revision,
  })

  const capacity: ReviewedFunctionalCapacity32 = {
    key: `${agentId}:anomaly_mastery`,
    kind: 'anomaly_mastery',
    value,
    contextKey,
    sourceRefs: [...new Set(sourceRefs)],
    included,
    excluded: [
      ...new Set(equipmentGaps),
      ...excludedReasons,
      'enemy_anomaly_resistance_and_buildup_threshold',
      'anomaly_buildup_frequency_and_damage_cycle',
      'anomaly_mastery_to_damage_conversion',
    ],
  }

  return {
    status: 'supported',
    capacities: [capacity],
    blockers: [...new Set(blockers)],
  }
}

/**
 * Dispatches reviewed potential functional effects across registered agents.
 */
export function evaluateReviewedPotentialFunctionalEffects32(
  input: ReviewedPotentialFunctionalInput32,
): {
  status: 'supported' | 'unsupported'
  capacities: ReviewedFunctionalCapacity32[]
  blockers: string[]
} {
  if (input.member.agentId === 'agent-burnice') {
    return evaluateReviewedBurniceAnomalyMasteryCapacity32(input)
  }
  return {
    status: 'supported',
    capacities: [],
    blockers: [],
  }
}
