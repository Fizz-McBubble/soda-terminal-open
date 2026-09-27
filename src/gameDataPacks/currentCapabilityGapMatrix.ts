import {
  calculationSupportKinds,
  type CalculationSupportKind,
} from '../calculation/planningDpsContract'
import { getAgentProfile, type AgentProfile, type AgentProfileField } from './agentProfile'
import {
  currentBuildFieldIds,
  getCurrentBuildAuthorityProfile,
  type CurrentBuildAuthorityField,
} from './currentBuildAuthority'
import { currentAssetProjection, type CurrentAssetProjectionEntry } from './currentAssetProjection'
import { resolveCurrentReleasedIdentity } from './currentReleasedIdentityMap'
import { stableContentHash } from './types'
import {
  planningDirectBillySupportAdoption,
  planningDirectNekomataEventAdoption,
} from '../calculation/planningDirectSupportAdoption'
import { planningSheerManatoSupportAdoption } from '../calculation/planningSheerSupportAdoption'
import { planningAnomalyPiperSupportAdoption } from '../calculation/planningAnomalySupportAdoption'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'

/**
 * A read-only coverage view over the current asset projection. It records
 * evidence gaps for planning work; it neither changes catalog authority nor
 * qualifies a character, formula, or recommendation for production use.
 */
export const capabilityGapStatuses = [
  'ready',
  'missing',
  'stale',
  'conflict',
  'not_applicable',
] as const
export type CapabilityGapStatus = (typeof capabilityGapStatuses)[number]

export type CapabilityGapDetail = {
  status: CapabilityGapStatus
  blockers: readonly string[]
  nextEvidence: readonly string[]
}

export type CurrentCapabilityBuildField = CapabilityGapDetail & {
  fieldId:
    | 'progression.lv60_and_ascension'
    | 'progression.skill_core_cinema'
    | 'progression.potential_overlay'
    | 'build.wengines'
    | 'build.drive_disc_sets'
    | 'build.main_sub_stats'
    | 'build.progression'
    | 'build.team_bangboo_scenario'
    | 'build.target_panel'
    | 'build.version_change_impact'
  sourceStatus: AgentProfileField['status'] | 'missing'
}

export type CurrentCapabilitySupportDimension = CapabilityGapDetail & {
  kind: CalculationSupportKind
}

export type CurrentCapabilityGapRow = {
  stableId: string
  displayName: string
  identity: {
    status: CapabilityGapStatus
    evidence: CurrentAssetProjectionEntry['evidence']
    releaseState: CurrentAssetProjectionEntry['releaseState']
    accountOwnable: boolean
    blockers: readonly string[]
    nextEvidence: readonly string[]
  }
  build: {
    fields: readonly CurrentCapabilityBuildField[]
    status: CapabilityGapStatus
    blockers: readonly string[]
    nextEvidence: readonly string[]
  }
  calculation: CapabilityGapDetail & {
    /** No typed formula-family authority currently supplies a value. */
    formulaFamily: string | null
    directDamageSourceStatus: AgentProfile['directDamageStatus']
  }
  eventCalculation: CapabilityGapDetail & {
    numericEventCount: number
    sourceFormulaSheetVerified: boolean
  }
  planningSupport: readonly CurrentCapabilitySupportDimension[]
}

export type CurrentCapabilityGapMatrix = {
  schema: 'soda-current-capability-gap-matrix/v1'
  source: {
    projectionId: typeof currentAssetProjection.id
    gameVersion: typeof currentAssetProjection.gameVersion
    note: string
  }
  coverage: {
    directoryTotal: number
    releasedScope: number
    accountOwnable: number
  }
  rows: readonly CurrentCapabilityGapRow[]
  contentHash: string
}

function detail(
  status: CapabilityGapStatus,
  blockers: readonly string[] = [],
  nextEvidence: readonly string[] = [],
): CapabilityGapDetail {
  return { status, blockers, nextEvidence }
}

function buildFieldDetail(field: CurrentBuildAuthorityField): CurrentCapabilityBuildField {
  return {
    fieldId: field.fieldId,
    sourceStatus: field.sourceStatus,
    ...detail(field.state, field.blockers, field.nextEvidence),
  }
}

function combinedStatus(items: readonly CapabilityGapDetail[]): CapabilityGapStatus {
  if (items.some((item) => item.status === 'conflict')) return 'conflict'
  if (items.some((item) => item.status === 'missing')) return 'missing'
  if (items.some((item) => item.status === 'stale')) return 'stale'
  if (items.every((item) => item.status === 'not_applicable')) return 'not_applicable'
  return 'ready'
}

function combinedDetail(items: readonly CapabilityGapDetail[]): CapabilityGapDetail {
  const status = combinedStatus(items)
  return detail(
    status,
    items.flatMap((item) => item.blockers),
    items.flatMap((item) => item.nextEvidence),
  )
}

function planningSupportDetail(kind: CalculationSupportKind): CurrentCapabilitySupportDimension {
  return {
    kind,
    ...detail(
      'missing',
      [`${kind} has no current planning formula-family evidence.`],
      [`Collect a versioned ${kind} definition, applicability conditions, and calculation inputs.`],
    ),
  }
}

function calculationDetail(profile: AgentProfile): CurrentCapabilityGapRow['calculation'] {
  if (profile.agentId === planningDirectBillySupportAdoption.agentId)
    return {
      formulaFamily: planningDirectBillySupportAdoption.formulaFamily,
      directDamageSourceStatus: profile.directDamageStatus,
      ...detail('ready', [], []),
    }
  if (profile.agentId === planningDirectNekomataEventAdoption.agentId)
    return {
      formulaFamily: planningDirectNekomataEventAdoption.formulaFamily,
      directDamageSourceStatus: profile.directDamageStatus,
      ...detail('ready', [], []),
    }
  if (profile.agentId === planningSheerManatoSupportAdoption.agentId)
    return {
      formulaFamily: planningSheerManatoSupportAdoption.formulaFamily,
      directDamageSourceStatus: profile.directDamageStatus,
      ...detail('ready', [], []),
    }
  if (profile.agentId === planningAnomalyPiperSupportAdoption.agentId)
    return {
      formulaFamily: planningAnomalyPiperSupportAdoption.formulaFamily,
      directDamageSourceStatus: profile.directDamageStatus,
      ...detail('ready', [], []),
    }
  const directDamageSourceStatus = profile.directDamageStatus
  const sourceBlocker =
    directDamageSourceStatus === 'formal'
      ? 'Direct-damage evidence exists, but it is not a Planning DPS formula-family adapter.'
      : directDamageSourceStatus === 'candidate'
        ? 'Direct-damage evidence remains candidate and is not a Planning DPS formula-family adapter.'
        : 'No direct-damage source slice is available for this stable identity.'
  return {
    formulaFamily: null,
    directDamageSourceStatus,
    ...detail(
      'missing',
      [sourceBlocker, 'No executable Planning DPS formula family is supplied by this matrix.'],
      [
        'Provide a versioned PlanningBaseline and formula-family adapter with reproducible inputs.',
        'Map source fields to the formula family without promoting candidate evidence.',
      ],
    ),
  }
}

function identityDetail(asset: CurrentAssetProjectionEntry, stableId: string) {
  if (stableId) {
    return {
      status: 'ready' as const,
      evidence: asset.evidence,
      releaseState: asset.releaseState,
      accountOwnable: asset.accountOwnable,
      blockers: [],
      nextEvidence: [],
    }
  }
  return {
    status: 'missing' as const,
    evidence: asset.evidence,
    releaseState: asset.releaseState,
    accountOwnable: asset.accountOwnable,
    blockers: ['Current asset projection row has no stable identity.'],
    nextEvidence: ['Resolve the intake alias through the released identity map.'],
  }
}

function makeRow(asset: CurrentAssetProjectionEntry): CurrentCapabilityGapRow {
  const stableId = resolveCurrentReleasedIdentity(asset.stableId)
  const profile = getAgentProfile(stableId)
  const eventContract = getCurrentAgentEventContract(stableId)
  const buildProfile = getCurrentBuildAuthorityProfile(stableId)
  if (!buildProfile) throw new Error(`current build authority missing ${stableId}`)
  const fields = currentBuildFieldIds.map((fieldId) => {
    const field = buildProfile.guidance.fields.find((candidate) => candidate.fieldId === fieldId)
    if (!field) throw new Error(`current build authority missing ${stableId}:${fieldId}`)
    return buildFieldDetail(field)
  })
  return {
    stableId,
    displayName: asset.playerName,
    identity: identityDetail(asset, stableId),
    build: {
      fields,
      ...combinedDetail(fields),
    },
    calculation: calculationDetail(profile),
    eventCalculation: eventContract
      ? {
          numericEventCount: eventContract.eventContract.events.length,
          sourceFormulaSheetVerified: true,
          ...detail('ready', [], []),
        }
      : {
          numericEventCount: 0,
          sourceFormulaSheetVerified: false,
          ...detail(
            'missing',
            ['No source-compiled character event contract is available.'],
            ['Compile the locked character stats JSON and formula sheet.'],
          ),
        },
    planningSupport: calculationSupportKinds.map(planningSupportDetail),
  }
}

function currentAgentRows() {
  const rows = currentAssetProjection.agents.map(makeRow)
  const identities = new Set(rows.map((row) => row.stableId))
  if (identities.size !== rows.length)
    throw new Error('current asset projection has duplicate normalized agent identities')
  return rows
}

const rows = currentAgentRows()
const coverage = {
  directoryTotal: rows.length,
  releasedScope: currentAssetProjection.agents.filter((asset) => asset.releaseState === 'released')
    .length,
  accountOwnable: currentAssetProjection.agents.filter((asset) => asset.accountOwnable).length,
}

const matrixCore = {
  schema: 'soda-current-capability-gap-matrix/v1' as const,
  source: {
    projectionId: currentAssetProjection.id,
    gameVersion: currentAssetProjection.gameVersion,
    note: 'Derived from currentAssetProjection.agents; it is a capability-gap view, not catalog or production authority.',
  },
  coverage,
  rows,
}

export const currentCapabilityGapMatrix: CurrentCapabilityGapMatrix = {
  ...matrixCore,
  contentHash: stableContentHash(matrixCore),
}
