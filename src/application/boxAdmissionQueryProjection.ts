import type { AccountDecisionRun, TeamOverviewPresentationQuery } from './calculationQueryContract'
import { savedTeamReplayPlanHash } from './publicSavedTeamReplay'
import { projectAccountDecisionAuthority } from '../decision/accountDecisionAuthority'
import { usesTeamStartupIntrinsicIndex } from '../decision/current31TeamIntrinsicIndex'
import { FullTeamIndexesRequired } from '../decision/currentBoxTeamAdmission'
import { projectCurrent31ProductionDecisionUniverse } from '../decision/exhaustiveAccountCandidateScoring'
import { resolveCurrent31TeamFamily } from '../decision/current31TeamCoreAggregation'
import {
  currentReviewedTeamSourceDirections,
  currentReviewedTeamSourceSlotSiblings,
} from '../gameDataPacks/reviewedTeamSourceDirections'
import {
  enumerateOwnedLegalAgentFormations,
  type LegalAgentFormation,
} from '../teamEngine/current31LegalCandidateUniverse'
import { getAgentName } from './publicRosterNames'
import { resolveTeamPresentationFamily } from '../pages/teamSourceFamilyProjection'

const teamKey = (members: readonly string[]) => [...members].sort().join('|')
const memberIdsFromCandidate = (id: string) => {
  if (!id.startsWith('formation:')) return null
  const members = id.slice('formation:'.length).split('+')
  if (members.length !== 3 || new Set(members).size !== 3 || members.join('|') !== teamKey(members))
    return null
  return members as [string, string, string]
}

function ownedIds(run: AccountDecisionRun) {
  return new Set(
    run.input.warehouse.roster.agents.filter((item) => item.owned).map((item) => item.agentId),
  )
}

function extend(run: AccountDecisionRun, requested: readonly LegalAgentFormation[]) {
  const base = run.snapshot.decisionAuthority
  if (!run.snapshot.boxAdmissionScoped || base.status !== 'ready') return run
  const present = new Set(base.consumerRecommendations.map((item) => teamKey(item.memberIds)))
  const owned = ownedIds(run)
  const missing = new Map<string, LegalAgentFormation>()
  for (const members of requested) {
    if (
      members.length !== 3 ||
      new Set(members).size !== 3 ||
      !members.every((id) => owned.has(id))
    )
      continue
    const key = teamKey(members)
    if (!present.has(key)) missing.set(key, key.split('|') as [string, string, string])
  }
  if (!missing.size) return run
  if (usesTeamStartupIntrinsicIndex()) throw new FullTeamIndexesRequired()
  const supplement = projectAccountDecisionAuthority({
    rankedFormations: projectCurrent31ProductionDecisionUniverse(run.input.warehouse.roster, [
      ...missing.values(),
    ]).authorityFormations,
    roster: run.input.warehouse.roster,
    allocation: run.snapshot.allocation,
    preference: run.snapshot.portfolioInput.preference,
    deferDiagnosticInference: true,
  })
  if (supplement.status !== 'ready') return run
  return {
    ...run,
    snapshot: {
      ...run.snapshot,
      decisionAuthority: {
        ...base,
        consumerRecommendations: [
          ...base.consumerRecommendations,
          ...supplement.consumerRecommendations.map((item) => ({
            ...item,
            defaultEligible: false,
          })),
        ],
        productionWorkset: {
          ...base.productionWorkset,
          candidateIds: [
            ...new Set([
              ...base.productionWorkset.candidateIds,
              ...supplement.productionWorkset.candidateIds,
            ]),
          ],
        },
      },
    },
  }
}

export function loadBoxCandidate(
  run: AccountDecisionRun,
  candidateId: string,
  includeSiblings = false,
) {
  if (!run.snapshot.boxAdmissionScoped) return run
  const direct = memberIdsFromCandidate(candidateId)
  const members =
    direct ??
    run.snapshot.teamEngine.recommendations.find((item) => item.candidateId === candidateId)
      ?.memberIds
  if (!members) return run
  const variants: LegalAgentFormation[] = [members]
  if (includeSiblings) {
    variants.push(...currentReviewedTeamSourceSlotSiblings(members))
    const family = resolveCurrent31TeamFamily(members)
    if (family.slotContract.kind === 'one_agent_variant')
      for (const id of family.slotContract.slots[0].allowedAgentIds) {
        const [first, second] = family.coreAgentIds
        if (first && second) variants.push([first, second, id])
      }
  }
  return extend(run, variants)
}

export function loadSavedBoxCandidate(run: AccountDecisionRun, planId: string, planHash: string) {
  if (!run.snapshot.boxAdmissionScoped) return run
  const plan = run.input.drafts.find((item) => item.kind === 'team' && item.id === planId)
  if (!plan || savedTeamReplayPlanHash(plan) !== planHash) return run
  const id = plan.solutionContext?.sourceCandidateId
  return id ? loadBoxCandidate(run, id) : run
}

export function loadBoxOverviewSelection(
  run: AccountDecisionRun,
  selection: TeamOverviewPresentationQuery['selection'],
  fitIds: readonly string[] = [],
) {
  if (!run.snapshot.boxAdmissionScoped) return run
  const requested = fitIds.flatMap((id) => {
    const members = memberIdsFromCandidate(id)
    return members ? [members] : []
  })
  const text = selection?.text.trim().toLocaleLowerCase()
  if (text) {
    const owned = ownedIds(run)
    const byName = new Set(
      [...owned].filter((id) => getAgentName(id).toLocaleLowerCase().includes(text)),
    )
    for (const members of enumerateOwnedLegalAgentFormations(owned)) {
      const family = resolveTeamPresentationFamily(members)
      if (
        members.some((id) => byName.has(id)) ||
        ('label' in family && family.label?.toLocaleLowerCase().includes(text))
      )
        requested.push([...members])
    }
  }
  if (selection?.includeReference)
    for (const source of currentReviewedTeamSourceDirections()) {
      if (source.memberIds.length === 3)
        requested.push([...source.memberIds] as [string, string, string])
    }
  return extend(run, requested)
}
