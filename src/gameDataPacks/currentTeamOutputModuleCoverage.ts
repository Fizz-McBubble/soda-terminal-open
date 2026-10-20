import { currentReviewedTeamSourceDirections } from './reviewedTeamSourceDirections'
import {
  teamOutputModuleContractId,
  teamOutputModuleTaxonomy,
  type TeamPrimaryOutputKind,
} from './teamOutputModuleContract'
import { stableContentHash } from './types'
import { currentAgentEventContracts } from '../calculation/currentAgentMechanicContracts'
import { currentAgentDecisionMechanicContracts } from '../calculation/currentAgentDecisionMechanicContracts'
import { resolveSourceBoundAdditionalAbility } from './reviewedSourceBoundAdditionalAbility'

type CoverageDirection = ReturnType<typeof currentReviewedTeamSourceDirections>[number]

function primaryKindCounts(directions: readonly CoverageDirection[]) {
  const counts = Object.fromEntries(
    teamOutputModuleTaxonomy.requiredPrimaryOutputKinds.map((kind) => [kind, 0]),
  ) as Record<TeamPrimaryOutputKind, number>
  for (const direction of directions) {
    if (direction.outputModule?.status !== 'classified') continue
    counts[direction.outputModule.module.primaryOutputKind] += 1
  }
  return counts
}

function classificationLedger(directions: readonly CoverageDirection[]) {
  return directions
    .map((direction) => ({
      memberIds: [...direction.memberIds].sort(),
      outputModule:
        direction.outputModule?.status === 'classified'
          ? {
              status: direction.outputModule.status,
              classification: direction.outputModule.classification,
              module: {
                id: direction.outputModule.module.id,
                primaryOutputKind: direction.outputModule.module.primaryOutputKind,
                reactionMechanisms: [...direction.outputModule.module.reactionMechanisms],
                executionChannels: [...direction.outputModule.module.executionChannels],
                teamFunctions: [...direction.outputModule.module.teamFunctions],
              },
            }
          : (direction.outputModule ?? { status: 'unknown' as const }),
      sourceRefs: direction.sourceRefs
        .map((source) => ({
          id: source.id,
          sourceVersion: source.sourceVersion,
          verificationStatus: source.verificationStatus ?? null,
          observationRole: source.observationRole ?? null,
          contentHash: source.contentHash,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      conditions: [...direction.conditions].sort(),
      sourceBangbooOptionIds: [...(direction.sourceBangbooOptionIds ?? [])].sort(),
    }))
    .sort((left, right) => left.memberIds.join('|').localeCompare(right.memberIds.join('|')))
}

function isCurrentExactTeam(direction: CoverageDirection) {
  return direction.sourceRefs.some(
    (source) =>
      source.verificationStatus === 'reviewed_exact_team_current_32' ||
      source.verificationStatus === 'reviewed_current_aggregate_composition_32' ||
      (source.sourceVersion === '3.2' && source.observationRole !== 'author_comparison_setup'),
  )
}

function activationContractCoverage() {
  const items = currentAgentEventContracts
  const hasEffectiveActivation = (item: (typeof items)[number]) =>
    item.teamActivationContract?.status === 'compiled' ||
    Boolean(resolveSourceBoundAdditionalAbility(item.stableId, item.identity, 'attack'))
  const compiledAgentIds = items.filter(hasEffectiveActivation).map((item) => item.stableId)
  const missingAgentIds = items
    .filter((item) => !hasEffectiveActivation(item))
    .map((item) => item.stableId)
  return {
    status: missingAgentIds.length ? ('incomplete' as const) : ('complete' as const),
    totalAgentCount: items.length,
    compiledAgentCount: compiledAgentIds.length,
    missingAgentIds,
  }
}

function teamSynergyContractCoverage() {
  const compiledAgentIds = currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.teamSynergy === 'compiled_seed')
    .map((item) => item.agentId)
  const missingAgentIds = currentAgentDecisionMechanicContracts
    .filter((item) => item.readiness.teamSynergy !== 'compiled_seed')
    .map((item) => item.agentId)
  return {
    status: missingAgentIds.length ? ('incomplete' as const) : ('complete' as const),
    totalAgentCount: currentAgentDecisionMechanicContracts.length,
    compiledAgentCount: compiledAgentIds.length,
    missingAgentIds,
  }
}

function coordinationContractCoverage() {
  const activationContracts = activationContractCoverage()
  const teamSynergyContracts = teamSynergyContractCoverage()
  return {
    status:
      activationContracts.status === 'complete' && teamSynergyContracts.status === 'complete'
        ? ('complete' as const)
        : ('incomplete' as const),
    activationContracts,
    teamSynergyContracts,
    boundary:
      'Activation predicates prove an additional ability can execute; they do not prove a reviewed core pairing or substitute relationship.',
  }
}

export function buildCurrentTeamOutputModuleCoverage(
  directions: readonly CoverageDirection[] = currentReviewedTeamSourceDirections(),
) {
  const current = directions.filter(isCurrentExactTeam)
  const classified = directions.filter(
    (direction) => direction.outputModule?.status === 'classified',
  )
  const currentClassified = current.filter(
    (direction) => direction.outputModule?.status === 'classified',
  )
  const currentUnknown = current.filter(
    (direction) => !direction.outputModule || direction.outputModule.status === 'unknown',
  )
  const currentConflicts = current.filter(
    (direction) => direction.outputModule?.status === 'conflict',
  )
  const classifiedPrimaryOutputKindCounts = primaryKindCounts(directions)
  const currentPrimaryOutputKindCounts = primaryKindCounts(current)
  const coordinationContracts = coordinationContractCoverage()
  const classificationEvidenceHash = stableContentHash(classificationLedger(directions))
  const missingPrimaryOutputKinds = teamOutputModuleTaxonomy.requiredPrimaryOutputKinds.filter(
    (kind) => classifiedPrimaryOutputKindCounts[kind] === 0,
  )
  const missingCurrentPrimaryOutputKinds =
    teamOutputModuleTaxonomy.requiredPrimaryOutputKinds.filter(
      (kind) => currentPrimaryOutputKindCounts[kind] === 0,
    )
  const summary = {
    contract: teamOutputModuleContractId,
    sourceObservationCount: directions.length,
    classifiedExactTeamCount: classified.length,
    unclassifiedExactTeamCount: directions.length - classified.length,
    currentExactTeamCount: current.length,
    currentClassifiedTeamCount: currentClassified.length,
    currentUnknownTeamCount: currentUnknown.length,
    currentConflictTeamCount: currentConflicts.length,
    coordinationContracts,
    primaryOutputKindCounts: classifiedPrimaryOutputKindCounts,
    currentPrimaryOutputKindCounts,
    classificationEvidenceHash,
    missingPrimaryOutputKinds,
    missingCurrentPrimaryOutputKinds,
    complete:
      current.length > 0 &&
      currentUnknown.length === 0 &&
      currentConflicts.length === 0 &&
      directions.length === classified.length &&
      coordinationContracts.status === 'complete' &&
      missingPrimaryOutputKinds.length === 0 &&
      missingCurrentPrimaryOutputKinds.length === 0,
    boundary:
      'This gate audits exact-team output-module semantics. Anonymous member observations and character specialties do not become team modules. Scenario, enemy, buff, score and cycle fields belong to separate scenario packs.',
  } as const
  return {
    ...summary,
    identity: stableContentHash(summary),
  }
}

export const currentTeamOutputModuleCoverage = buildCurrentTeamOutputModuleCoverage()
