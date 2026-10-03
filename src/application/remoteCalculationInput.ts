import type { AccountDecisionQueryInput } from './calculationQueryContract'
import { normalizeTargetTeamEquipmentParameters } from './publicTargetTeamEquipmentFingerprint'

/** Keep calculation facts and saved physical references; leave personal labels in IndexedDB. */
export function projectRemoteAccountDecisionInput(
  input: AccountDecisionQueryInput,
): AccountDecisionQueryInput {
  return {
    warehouse: {
      accountId: input.warehouse.accountId,
      account: null,
      discs: input.warehouse.discs.map((disc) => ({
        id: disc.id,
        setId: disc.setId,
        slot: disc.slot,
        level: disc.level,
        rarity: disc.rarity,
        mainStat: disc.mainStat,
        subStats: disc.subStats.map(({ stat, value, upgrades }) => ({ stat, value, upgrades })),
        locked: disc.locked,
        favorite: disc.favorite,
        tags: [],
        discVersion: disc.discVersion,
        createdAt: disc.createdAt,
        updatedAt: disc.updatedAt,
        dataVersion: disc.dataVersion,
      })),
      roster: {
        schemaVersion: input.warehouse.roster.schemaVersion,
        sourceCompleteness: input.warehouse.roster.sourceCompleteness,
        agents: input.warehouse.roster.agents.map((agent) => ({
          agentId: agent.agentId,
          owned: agent.owned,
          priority: agent.priority,
          level: agent.level,
          ascension: agent.ascension,
          mindscape: agent.mindscape,
          potentialImage: agent.potentialImage,
          skills: '',
          wEngine: '',
          refinement: agent.refinement,
          agentVersion: agent.agentVersion,
          completeness: agent.completeness,
          currentEquipment: agent.currentEquipment,
          source: agent.source,
          manualSource: agent.manualSource,
          progressionManuallySet: agent.progressionManuallySet,
          syncedAt: agent.syncedAt,
          lockedFields: [],
          skillLevels: {
            basic: agent.skillLevels.basic,
            dodge: agent.skillLevels.dodge,
            assist: agent.skillLevels.assist,
            special: agent.skillLevels.special,
            chain: agent.skillLevels.chain,
            core: agent.skillLevels.core,
          },
          wEngineDetails: {
            id: agent.wEngineDetails.id,
            name: null,
            level: agent.wEngineDetails.level,
            ascension: agent.wEngineDetails.ascension,
            refinement: agent.wEngineDetails.refinement,
          },
          wEngineCopyId: agent.wEngineCopyId,
          equippedDiscIds: agent.equippedDiscIds ? [...agent.equippedDiscIds] : null,
        })),
        bangboos: input.warehouse.roster.bangboos.map((bangboo) => ({
          bangbooId: bangboo.bangbooId,
          owned: bangboo.owned,
          level: bangboo.level,
          stars: bangboo.stars,
          skillLevel: bangboo.skillLevel,
          additionalAbilityLevel: bangboo.additionalAbilityLevel,
          manualSource: bangboo.manualSource,
          starsManuallySet: bangboo.starsManuallySet,
        })),
        wEngines: input.warehouse.roster.wEngines?.map((engine) => ({
          copyId: engine.copyId,
          engineId: engine.engineId,
          level: engine.level,
          refinement: engine.refinement,
          equippedAgentId: engine.equippedAgentId,
          manualSource: engine.manualSource,
          refinementManuallySet: engine.refinementManuallySet,
        })),
        updatedAt: input.warehouse.roster.updatedAt,
      },
    },
    drafts: input.drafts.map((draft) => ({
      scopedId: draft.scopedId,
      accountId: draft.accountId,
      id: draft.id,
      kind: draft.kind,
      name: '已存方案',
      state: draft.state,
      selection: {
        agentIds: [...draft.selection.agentIds],
        bangbooId: draft.selection.bangbooId,
        scenario: '',
      },
      manualOverrides: {
        wEngineDirection: '',
        discDirection: '',
        progressionDirection: '',
        notes: '',
      },
      knowledgeRefs: [],
      warehouseRefs: [...draft.warehouseRefs],
      solutionContext: draft.solutionContext
        ? {
            contract: draft.solutionContext.contract,
            scope: draft.solutionContext.scope,
            resourcePolicy: draft.solutionContext.resourcePolicy,
            sourceCandidateId: draft.solutionContext.sourceCandidateId,
            inputFingerprint: draft.solutionContext.inputFingerprint,
            solverMethod: draft.solutionContext.solverMethod,
            gameVersion: draft.solutionContext.gameVersion,
            knowledgeVersion: draft.solutionContext.knowledgeVersion,
            exactVariantKey: draft.solutionContext.exactVariantKey,
            comparisonParameters: draft.solutionContext.comparisonParameters
              ? {
                  potential: draft.solutionContext.comparisonParameters.potential,
                  wEngine: draft.solutionContext.comparisonParameters.wEngine
                    ? {
                        engineId: draft.solutionContext.comparisonParameters.wEngine.engineId,
                        level: draft.solutionContext.comparisonParameters.wEngine.level,
                        ascension: draft.solutionContext.comparisonParameters.wEngine.ascension,
                        refinement: draft.solutionContext.comparisonParameters.wEngine.refinement,
                      }
                    : undefined,
                }
              : undefined,
          }
        : undefined,
      savedRole: draft.savedRole,
      candidateWarehouse: draft.candidateWarehouse
        ? {
            inventoryTransition: draft.candidateWarehouse.inventoryTransition,
            scope: draft.candidateWarehouse.scope,
            totalScore: draft.candidateWarehouse.totalScore,
            loadouts: draft.candidateWarehouse.loadouts.map((loadout) => ({
              agentId: loadout.agentId,
              totalScore: loadout.totalScore,
              discIds: [...loadout.discIds],
              effectiveRolls: loadout.effectiveRolls,
              setPattern: loadout.setPattern,
              degraded: loadout.degraded,
            })),
            boundary: '',
          }
        : undefined,
      teamEquipmentParameters: draft.teamEquipmentParameters
        ? {
            ...normalizeTargetTeamEquipmentParameters(draft.teamEquipmentParameters),
            source: draft.teamEquipmentParameters.source,
          }
        : undefined,
      comparisonCapability: draft.comparisonCapability,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      revision: draft.revision,
    })),
    activePlanIds: { ...input.activePlanIds },
    developmentPriorityAgentIds: [...input.developmentPriorityAgentIds],
    preference: {
      teamCount: input.preference.teamCount,
      templateIds: [...input.preference.templateIds],
      favoriteAgentIds: [...input.preference.favoriteAgentIds],
      fixedAgentIds: [...input.preference.fixedAgentIds],
      fixedBangbooIds: [...input.preference.fixedBangbooIds],
      planIdsByAgent: { ...input.preference.planIdsByAgent },
    },
  }
}
