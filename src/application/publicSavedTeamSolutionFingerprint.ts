import type { AccountPlanningDraft } from '../accounts/types'
import type { BuildAccountDecisionInput } from '../decision/accountDecisionSnapshotContract'
import type { PortfolioJointBuildIntent } from '../decision/buildIntent'
import { contentHash } from './contentHash'
import { rosterFingerprintFacts } from './publicRosterFingerprintFacts'

export const savedTeamFingerprintPrefix = 'saved-team/v2:'
export const savedTeamPortfolioFingerprintPrefix = 'saved-team-portfolio/v1:'

function sortedRecord(input: Readonly<Record<string, unknown>>) {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
  )
}

/** Replace exactly those v2 component hashes whose original facts stay only on this device. */
export function localPrivateNonPlanningComponents(
  serverComponents: Readonly<Record<string, string>>,
  decisionInput: Pick<BuildAccountDecisionInput, 'warehouse' | 'preference'>,
) {
  const { warehouse, preference } = decisionInput
  if (!warehouse.accountId) throw new Error('当前账户未就绪，不能确认方案版本。')
  return {
    ...serverComponents,
    accountHash: contentHash({ accountId: warehouse.accountId }),
    warehouseHash: contentHash(
      [...warehouse.discs].sort((left, right) => left.id.localeCompare(right.id)),
    ),
    rosterHash: contentHash(rosterFingerprintFacts(warehouse.roster)),
    preferenceHash: contentHash({
      teamCount: preference.teamCount,
      templateIds: [...preference.templateIds].sort(),
      fixedAgentIds: [...preference.fixedAgentIds].sort(),
      fixedBangbooIds: [...preference.fixedBangbooIds].sort(),
      planIdsByAgent: sortedRecord(preference.planIdsByAgent),
    }),
  }
}

/** The local text fields remain in the browser when creating a v2 plan identity. */
export function materialCompetingPlan(plan: AccountPlanningDraft) {
  return {
    id: plan.id,
    kind: plan.kind,
    state: plan.state,
    savedRole: plan.savedRole ?? null,
    selection: plan.selection,
    manualOverrides: plan.manualOverrides,
    warehouseRefs: [...plan.warehouseRefs].sort(),
    candidateWarehouse: plan.candidateWarehouse
      ? {
          scope: plan.candidateWarehouse.scope,
          loadouts: plan.candidateWarehouse.loadouts
            .map((loadout) => ({
              agentId: loadout.agentId,
              discIds: [...loadout.discIds].sort(),
              setPattern: loadout.setPattern,
              degraded: loadout.degraded,
            }))
            .sort((left, right) => left.agentId.localeCompare(right.agentId)),
        }
      : null,
    teamExecutionSnapshot: plan.teamExecutionSnapshot
      ? {
          ...(plan.teamExecutionSnapshot.authorComparisonMembership
            ? {
                authorComparisonMembership: plan.teamExecutionSnapshot.authorComparisonMembership,
                accountFactBinding: plan.teamAccountFactBinding,
              }
            : {}),
          status: plan.teamExecutionSnapshot.status,
          scenario: plan.teamExecutionSnapshot.scenario,
          bangbooId: plan.teamExecutionSnapshot.bangbooId,
          physicalDiscIds: [...plan.teamExecutionSnapshot.physicalDiscIds].sort(),
          members: plan.teamExecutionSnapshot.members
            .map((member) => ({
              agentId: member.agentId,
              discIds: [...member.suggested.discIds].sort(),
              wEngine: member.suggested.wEngine
                ? {
                    engineId: member.suggested.wEngine.engineId,
                    copyId: member.suggested.wEngine.copyId,
                    refinement: member.suggested.wEngine.refinement,
                  }
                : null,
            }))
            .sort((left, right) => left.agentId.localeCompare(right.agentId)),
        }
      : null,
    teamPortfolioSnapshot: plan.teamPortfolioSnapshot
      ? plan.teamPortfolioSnapshot.executions
          .map((execution) => ({
            candidateId: execution.candidateId,
            memberIds: [...execution.memberIds].sort(),
            bangbooId: execution.bangbooId,
            bangbooStar: execution.bangbooStar ?? null,
            physicalDiscIds: [...execution.physicalDiscIds].sort(),
          }))
          .sort((left, right) => left.candidateId.localeCompare(right.candidateId))
      : null,
    teamPortfolioBuildIntentFingerprint: plan.teamPortfolioBuildIntent?.fingerprint ?? null,
  }
}

/** Only physical account facts are needed here; no score or recommendation is calculated. */
export function physicalEquipmentFacts(decisionInput: BuildAccountDecisionInput) {
  const roster = decisionInput.warehouse.roster
  return {
    bangboos: [...roster.bangboos]
      .sort((left, right) => left.bangbooId.localeCompare(right.bangbooId))
      .map(
        ({
          bangbooId,
          owned,
          level,
          stars,
          skillLevel,
          additionalAbilityLevel,
          manualSource,
          starsManuallySet,
        }) => ({
          bangbooId,
          owned,
          level,
          stars,
          skillLevel,
          additionalAbilityLevel,
          manualSource,
          starsManuallySet: starsManuallySet === true,
        }),
      ),
    wEngines: [...(roster.wEngines ?? [])]
      .sort((left, right) => left.copyId.localeCompare(right.copyId))
      .map(
        ({
          copyId,
          engineId,
          level,
          refinement,
          equippedAgentId,
          manualSource,
          refinementManuallySet,
        }) => ({
          copyId,
          engineId,
          level,
          refinement,
          equippedAgentId,
          manualSource,
          refinementManuallySet: refinementManuallySet === true,
        }),
      ),
    agentEquipment: [...roster.agents]
      .sort((left, right) => left.agentId.localeCompare(right.agentId))
      .map(({ agentId, wEngineCopyId, equippedDiscIds }) => ({
        agentId,
        wEngineCopyId,
        equippedDiscIds: equippedDiscIds ? [...equippedDiscIds].sort() : null,
      })),
  }
}

export function buildSavedTeamPlanSolutionFingerprintFromComponents({
  decisionInput,
  planId,
  buildIntentFingerprint,
  nonPlanningComponents,
}: {
  decisionInput: Pick<
    BuildAccountDecisionInput,
    'warehouse' | 'drafts' | 'activePlanIds' | 'developmentPriorityAgentIds' | 'preference'
  >
  planId: string
  buildIntentFingerprint: string
  nonPlanningComponents: Readonly<Record<string, string>>
}) {
  const { drafts, activePlanIds, developmentPriorityAgentIds = [], preference } = decisionInput
  return `${savedTeamFingerprintPrefix}${contentHash({
    contract: savedTeamFingerprintPrefix.slice(0, -1),
    nonPlanningComponents,
    activePlanIds: sortedRecord(activePlanIds),
    developmentPriorityAgentIds: [...developmentPriorityAgentIds].sort(),
    preference: {
      teamCount: preference.teamCount,
      templateIds: [...preference.templateIds].sort(),
      fixedAgentIds: [...preference.fixedAgentIds].sort(),
      fixedBangbooIds: [...preference.fixedBangbooIds].sort(),
      planIdsByAgent: sortedRecord(preference.planIdsByAgent),
    },
    physicalEquipment: physicalEquipmentFacts(decisionInput),
    competingPlans: drafts
      .filter((draft) => draft.id !== planId)
      .map(materialCompetingPlan)
      .sort((left, right) => left.id.localeCompare(right.id)),
    buildIntentFingerprint,
  })}`
}

/** The portfolio variant retains the same local-only facts with its original v1 identity. */
export function buildSavedTeamPortfolioPlanSolutionFingerprintFromComponents({
  decisionInput,
  planId,
  buildIntent,
  nonPlanningComponents,
}: {
  decisionInput: Pick<
    BuildAccountDecisionInput,
    'warehouse' | 'drafts' | 'activePlanIds' | 'developmentPriorityAgentIds' | 'preference'
  >
  planId: string
  buildIntent: PortfolioJointBuildIntent
  nonPlanningComponents: Readonly<Record<string, string>>
}) {
  const { drafts, activePlanIds, developmentPriorityAgentIds = [], preference } = decisionInput
  return `${savedTeamPortfolioFingerprintPrefix}${contentHash({
    contract: savedTeamPortfolioFingerprintPrefix.slice(0, -1),
    nonPlanningComponents,
    activePlanIds: sortedRecord(activePlanIds),
    developmentPriorityAgentIds: [...developmentPriorityAgentIds].sort(),
    preference: {
      teamCount: preference.teamCount,
      templateIds: [...preference.templateIds].sort(),
      fixedAgentIds: [...preference.fixedAgentIds].sort(),
      fixedBangbooIds: [...preference.fixedBangbooIds].sort(),
      planIdsByAgent: sortedRecord(preference.planIdsByAgent),
    },
    physicalEquipment: physicalEquipmentFacts(decisionInput),
    competingPlans: drafts
      .filter((draft) => draft.id !== planId)
      .map(materialCompetingPlan)
      .sort((left, right) => left.id.localeCompare(right.id)),
    buildIntent,
  })}`
}
