import { stableContentHash } from '../gameDataPacks/types'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { currentWEngineStaticCatalog } from '../gameDataPacks/currentWEngineStaticCatalog'
import { currentDriveDiscFormulaCatalog } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { currentAgentPlanningEffectBlueprints } from '../calculation/currentAgentPlanningEffectBlueprint'
import {
  currentAgentMechanicIdentity,
  resolveCurrentAgentEvent,
} from '../calculation/currentAgentMechanicContracts'
import { currentNormalizedPlanningBaseline } from '../calculation/currentNormalizedPlanningBaseline'
import { projectFixedEventSupportContribution32 } from '../calculation/fixedEventSupportContribution32'
import { bindDeclaredTeamStrengthSupportInput } from './teamStrengthSupportContribution'
import { teamStrengthEquippedReferenceBuildPolicy } from './teamStrengthReferenceBuild'
import { teamStrengthReferenceStateIdentity } from './teamStrengthReferenceState'
import { getCandidateWarehouseConstraintForTeam } from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveTeamStrengthReferencePotential } from './teamStrengthReferenceState'
import type { TeamStrengthReferenceConditions } from './teamStrengthReferenceConditionsTypes'
import type { TeamStrengthSourceAction } from './teamStrengthActionFacts'

const providers = new Set([
  'agent-sunna',
  'agent-zhao',
  'agent-astra',
  'agent-yuzuha',
  'agent-lucy',
  'agent-nicole',
])
/** A declared support-active contact, not observed uptime or an account build.
 * Unspecified self/party mechanics remain unknown in the shared event runtime. */
export const teamStrengthSupportContactPolicy = {
  id: 'six-provider-static-equipped-single-source-contact/v1',
  eventSelection: 'largest-coefficient-use-in-selected-source-action',
  occurrences: 1,
  enemy: 'current-normalized-target-not-stunned',
  conditionalEquipment: 'not-in-this-static-panel-slice',
  aggregation: 'maximum-provider-marginal-per-recipient-never-summed-across-recipients',
  frequency: null,
  numericalStrengthAdjudication: false,
} as const
export const teamStrengthSupportContactIdentity = stableContentHash({
  policy: teamStrengthSupportContactPolicy,
  version: currentVersionProjection.gameVersion,
  events: currentAgentMechanicIdentity,
  equipped: teamStrengthEquippedReferenceBuildPolicy,
  reference: teamStrengthReferenceStateIdentity,
  engineCatalog: currentWEngineStaticCatalog.contentHash,
  discCatalog: currentDriveDiscFormulaCatalog.contentHash,
  effects: currentAgentPlanningEffectBlueprints.map((row) => [
    row.effectKey,
    row.numericExpression.expressionSha256,
  ]),
})

type References = Readonly<Record<string, Readonly<Record<string, unknown>>>>
export type TeamStrengthSupportContactInput = {
  memberIds: readonly string[]
  recipients: readonly { agentId: string; action: TeamStrengthSourceAction | null }[]
  referenceConditions?: TeamStrengthReferenceConditions
  /** Overrides the declared contact window; absent numeric state stays absent. */
  references?: References
}
export type TeamStrengthSupportContactRow = {
  recipientAgentId: string
  status: 'supported' | 'partial' | 'unsupported' | 'not_applicable'
  packet: {
    eventId: string
    attribute: string
    formulaFamily: string
    skillLevel: 11
    occurrences: 1
    quantityUnit: 'coefficient_uses'
  } | null
  withProvidersEventValue: number | null
  relativeGain: number | null
  settledSliceRelativeGain: number | null
  providers: {
    providerAgentId: string
    status: string
    withoutProviderEventValue: number | null
    delta: number | null
    settledSliceDelta: number | null
    relativeGain: number | null
    settledSliceRelativeGain: number | null
    sourceRefs: string[]
  }[]
  gaps: string[]
  referenceIdentity: string | null
  referenceBuilds?: {
    agentId: string
    engineId: string
    refinement: number
    equipmentIdentity: string
  }[]
}
export type TeamStrengthSupportContactEvidence = {
  policy: typeof teamStrengthSupportContactPolicy
  identity: string
  primary: TeamStrengthSupportContactRow | null
  secondary: TeamStrengthSupportContactRow | null
}
const cache = new Map<string, TeamStrengthSupportContactEvidence>()
const cacheLimit = 256
export function clearTeamStrengthSupportContactCache() {
  cache.clear()
}
export function teamStrengthSupportContactCacheSize() {
  return cache.size
}

function declaredReferences(ids: readonly string[], recipient: string): References {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        ...(id === 'agent-sunna'
          ? { sunnaAngelicChordination32: true, sunnaDelusionStunWindow32: false }
          : {}),
        ...(id === 'agent-zhao' ? { zhaoWellspringAttackWindow32: true } : {}),
        ...(id === 'agent-astra' ? { idyllic_cadenza: true } : {}),
        ...(id === 'agent-yuzuha' ? { tanuki_wish: true } : {}),
        ...(id === 'agent-lucy' ? { cheerOn: true } : {}),
        ...(id === 'agent-nicole' ? { bulletsOrFieldHit: true } : {}),
        ...(id === recipient ? { inside_any_ether_veil: true } : {}),
        ...(id === 'agent-ye-shunguang' ? { yeShunguangUnity32: false } : {}),
      },
    ]),
  )
}
function emptyRow(
  recipientAgentId: string,
  status: TeamStrengthSupportContactRow['status'],
  reason: string,
): TeamStrengthSupportContactRow {
  return {
    recipientAgentId,
    status,
    packet: null,
    withProvidersEventValue: null,
    relativeGain: null,
    settledSliceRelativeGain: null,
    providers: [],
    gaps: [reason],
    referenceIdentity: null,
  }
}

export function projectTeamStrengthSupportContactEvidence(
  input: TeamStrengthSupportContactInput,
): TeamStrengthSupportContactEvidence {
  const memberIds = [...input.memberIds].sort()
  const activeProviders = memberIds.filter((id) => providers.has(id))
  if (memberIds.length !== 3 || new Set(memberIds).size !== 3) {
    const rows = input.recipients
      .slice(0, 2)
      .map(({ agentId }) => emptyRow(agentId, 'unsupported', '需要精确三名不同成员。'))
    return {
      policy: teamStrengthSupportContactPolicy,
      primary: rows[0] ?? null,
      secondary: rows[1] ?? null,
      identity: stableContentHash({ source: teamStrengthSupportContactIdentity, input, rows }),
    }
  }
  // Most legal trios have none of the six adopted providers. They never bind
  // equipment or evaluate effect IR and do not churn the numerical LRU.
  if (activeProviders.length === 0) {
    const rows = input.recipients
      .slice(0, 2)
      .map(({ agentId }) =>
        emptyRow(agentId, 'not_applicable', '本局部协议没有已接通的其他提供者。'),
      )
    return {
      policy: teamStrengthSupportContactPolicy,
      primary: rows[0] ?? null,
      secondary: rows[1] ?? null,
      identity: stableContentHash({
        source: teamStrengthSupportContactIdentity,
        memberIds,
        recipients: input.recipients.map((row) => row.agentId),
        conditions: input.referenceConditions,
        rows,
      }),
    }
  }
  // Source equipment recipes are team/condition dependent. Include their hashes,
  // explicit potential and packet identity before accepting a cached result.
  const states = Object.fromEntries(
    memberIds.map((id) => [
      id,
      { potentialImage: resolveTeamStrengthReferencePotential(id, input.referenceConditions) },
    ]),
  )
  const equipment = activeProviders.length
    ? memberIds.map((id) => [
        id,
        getCandidateWarehouseConstraintForTeam(id, { memberIds, agentStateById: states })
          ?.contentHash ?? null,
      ])
    : []
  const key = stableContentHash({
    source: teamStrengthSupportContactIdentity,
    memberIds,
    recipients: input.recipients,
    conditions: input.referenceConditions,
    equipment,
    references: input.references,
  })
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    return cached
  }
  const rows = input.recipients
    .slice(0, 2)
    .map(({ agentId, action }): TeamStrengthSupportContactRow => {
      if (!activeProviders.some((id) => id !== agentId))
        return emptyRow(agentId, 'not_applicable', '本局部协议没有已接通的其他提供者。')
      if (!action || action.quantities.some((q) => q.unit !== 'coefficient_uses' || q.value !== 1))
        return emptyRow(
          agentId,
          'unsupported',
          '没有可用的单次来源动作；不猜每秒曝光或异常结算频率。',
        )
      const events = action.eventIds
        .map((eventId) => resolveCurrentAgentEvent({ stableId: agentId, eventId, skillLevel: 11 }))
        .filter((row) => row.status === 'supported')
        .sort(
          (a, b) => b.damageMultiplier - a.damageMultiplier || a.eventId.localeCompare(b.eventId),
        )
      const event = events[0]
      if (!event || events.length !== action.eventIds.length || !memberIds.includes(agentId))
        return emptyRow(agentId, 'unsupported', '单次来源事件或精确三人身份缺失。')
      const references = declaredReferences(memberIds, agentId)
      const baselineReferencesByAgentId = Object.fromEntries(
        memberIds.map((id) => [id, { ...references[id], ...input.references?.[id] }]),
      )
      const bound = bindDeclaredTeamStrengthSupportInput({
        memberIds: memberIds as [string, string, string],
        subjectAgentId: agentId,
        eventUsages: [
          {
            ownerAgentId: agentId,
            eventId: event.eventId,
            skillLevel: 11,
            occurrenceCount: 1,
            evidenceRefs: [teamStrengthSupportContactPolicy.id],
          },
        ],
        baseline: {
          ...currentNormalizedPlanningBaseline,
          enemy: { ...currentNormalizedPlanningBaseline.enemy, stunMultiplier: 1 },
        },
        baselineReferencesByAgentId,
        equipmentModifierBuckets: [],
        equipmentEffectExclusions: [],
        referenceConditions: input.referenceConditions,
      })
      if (bound.status === 'unsupported')
        return emptyRow(agentId, 'unsupported', bound.blockers.join('；'))
      const result = projectFixedEventSupportContribution32(bound.input)
      if (result.status === 'unsupported')
        return emptyRow(agentId, 'unsupported', result.blockers.join('；'))
      const components = result.contributions
        .filter((row) => activeProviders.includes(row.providerAgentId))
        .map((row) => {
          const off = row.withoutSupportEventValue
          const sourceRefs = [
            ...new Set(
              result.consumedBuckets
                .filter((bucket) => bucket.providerAgentId === row.providerAgentId)
                .flatMap((bucket) => bucket.sourceRefs),
            ),
          ]
          const settled =
            'settledSliceDelta' in row &&
            off !== null &&
            off > 0 &&
            (sourceRefs.length > 0 || row.status === 'supported')
              ? row.settledSliceDelta / off
              : null
          return {
            providerAgentId: row.providerAgentId,
            status: row.status,
            withoutProviderEventValue: off,
            delta: row.supportDelta,
            settledSliceDelta: 'settledSliceDelta' in row ? (row.settledSliceDelta ?? null) : null,
            relativeGain:
              row.supportDelta !== null && off !== null && off > 0 ? row.supportDelta / off : null,
            settledSliceRelativeGain: settled,
            sourceRefs,
          }
        })
      const complete = components.length > 0 && components.every((row) => row.relativeGain !== null)
      const settled = components.flatMap((row) =>
        row.settledSliceRelativeGain === null ? [] : [row.settledSliceRelativeGain],
      )
      return {
        recipientAgentId: agentId,
        status: complete ? 'supported' : 'partial',
        packet: {
          eventId: event.eventId,
          attribute: event.attribute ?? '',
          formulaFamily: event.formulaFamily ?? '',
          skillLevel: 11,
          occurrences: 1,
          quantityUnit: 'coefficient_uses',
        },
        withProvidersEventValue: result.fixedEventValue,
        relativeGain: complete ? Math.max(...components.map((row) => row.relativeGain!)) : null,
        settledSliceRelativeGain: settled.length ? Math.max(...settled) : null,
        providers: components,
        gaps: [
          ...result.unknownEffects.map((row) => row.effectKey),
          ...result.exclusions.map((row) => `${row.effectKey}:${row.reason}`),
        ],
        referenceIdentity: stableContentHash(bound.builds),
        referenceBuilds: bound.builds.map((row) => ({
          agentId: row.agentId,
          engineId: row.equipment.engineId,
          refinement: row.equipment.refinement,
          equipmentIdentity: row.identity,
        })),
      }
    })
  const evidence = {
    policy: teamStrengthSupportContactPolicy,
    primary: rows[0] ?? null,
    secondary: rows[1] ?? null,
    identity: stableContentHash({ key, rows }),
  }
  cache.set(key, evidence)
  if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!)
  return evidence
}
