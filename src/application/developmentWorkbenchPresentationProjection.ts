import type { AccountDecisionRun } from './calculationQueryContract'
import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'
import { isPotentialImageAgent } from '../assault/planningCatalog'
import { resolvePotentialImage } from '../assault/agentCapabilities'
import { resolveWEngine } from '../decision/wEngineResolver'
import {
  getCurrentBuildAuthorityProfile,
  getCurrentBuildTargetPanel,
  getCurrentPotentialSkillReference,
} from '../gameDataPacks/currentBuildAuthority'
import { getL3AgentDevelopmentEvidence } from '../gameDataPacks/l3ProductionProjection'
import {
  getCurrentBuildProfile,
  getBuildRecommendation,
  getSelectedBuildBranchId,
} from '../assault/currentBuildProfiles'
import { getProjectedBuildKnowledgeProfile } from '../gameDataPacks/agentProfile'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { agentDevelopmentSkillRecommendations } from '../pages/agentDevelopmentSkillRecommendations'
import { authorityConsumerRecommendations } from './authorityConsumerRecommendations'
import { createWEngineSelectionOptions } from '../pages/agentDevelopmentWEngineSelection'
import {
  resolveWorkbenchRecommendedEngines,
  skillLabels,
  skillTargetsFromDirections,
  graduationTeamDirections,
  discSetRecommendation,
  displayStat,
} from '../pages/agentDevelopmentWorkbenchModel'
import type { DevelopmentWorkbenchPresentation } from './publicDevelopmentWorkbenchPresentation'

/** Private Account Decision producer. Keep capability and recommendation rules off the page. */
export function projectDevelopmentWorkbenchPresentation(
  run: AccountDecisionRun,
): DevelopmentWorkbenchPresentation {
  const warehouse = run.input.warehouse
  const catalogById = new Map<string, (typeof publicDevelopmentDirectoryCatalog)[number]>(
    publicDevelopmentDirectoryCatalog.map((entry) => [entry.stableId, entry]),
  )
  return {
    contract: 'soda-development-workbench/v1',
    runId: run.runId,
    accountId: warehouse.accountId ?? '',
    inputFingerprint: run.snapshot.fingerprint.inputHash,
    agents: warehouse.roster.agents
      .filter((agent) => agent.owned)
      .map((agent) => {
        const agentId = agent.agentId
        const resolution = resolveWEngine({ agent, legacyWEngines: warehouse.roster.wEngines })
        const profile = getProjectedBuildKnowledgeProfile(agentId)
        const buildProfile = getCurrentBuildProfile(agentId)
        const recommendation = buildProfile
          ? getBuildRecommendation(
              buildProfile,
              getSelectedBuildBranchId(agent) ?? buildProfile.defaultBranchId,
            )
          : null
        const constraint = getCandidateWarehouseConstraint(agentId)
        const guidanceFields = getCurrentBuildAuthorityProfile(agentId)?.guidance.fields ?? []
        const currentSkillGuidance = guidanceFields.find(
          (field) => field.fieldId === 'progression.skill_core_cinema',
        )
        const currentSkillDirections =
          currentSkillGuidance?.state === 'ready' &&
          currentSkillGuidance.value &&
          typeof currentSkillGuidance.value === 'object' &&
          Array.isArray(
            (currentSkillGuidance.value as { sourceDirections?: unknown }).sourceDirections,
          )
            ? (
                currentSkillGuidance.value as { sourceDirections: unknown[] }
              ).sourceDirections.filter(
                (direction): direction is string => typeof direction === 'string',
              )
            : []
        const skillRecommendation = agentDevelopmentSkillRecommendations(
          agentId,
          [
            ...currentSkillDirections,
            ...(profile.recommendation?.skillPriority ?? constraint?.progressionDirection ?? []),
          ],
          recommendation?.skillPriority ?? [],
          {
            skillLevels: agent.skillLevels,
            mindscape: agent.mindscape,
          },
        )
        const graduationTeams = graduationTeamDirections(
          agentId,
          authorityConsumerRecommendations(run.snapshot.decisionAuthority),
          recommendation?.teamConstraints.teammateNotes ??
            profile.recommendation?.teammates ??
            constraint?.teamAndBangbooPreconditions ??
            [],
        )
        const setNames = Object.fromEntries(
          (constraint?.setIds ?? []).map((id) => [id, discSetRecommendation(id).name]),
        )
        const mainStats = constraint
          ? (['4', '5', '6'] as const).map((slot) => ({
              slot: `${slot}号位`,
              value: (constraint.mainStats[slot] ?? []).map(displayStat).join(' / '),
            }))
          : (['4', '5', '6'] as const).map((slot) => ({
              slot: `${slot}号位`,
              value: profile.recommendation?.mainStats[slot].join(' / ') || '资料待补齐',
            }))
        const setUnavailableReason =
          constraint?.setPlanReadiness.status === 'non_executable'
            ? (constraint.setPlanReadiness.missingEvidence ??
              `已知套装：${constraint.setIds.map((id) => setNames[id] ?? id).join('、')}。${constraint.setPlanReadiness.reason === 'unresolved_set_roles' ? '主套与副套的完整搭配尚待确认。' : '副套装尚待确认。'}`)
            : '完整套装搭配资料待补齐。'
        const targetPanel = getCurrentBuildTargetPanel(agentId)
        const readyConditions = (fieldId: string) => {
          const field = guidanceFields.find((item) => item.fieldId === fieldId)
          return field?.state === 'ready' ? [...field.conditions] : []
        }
        const discGuidance = guidanceFields.find((item) => item.fieldId === 'build.drive_disc_sets')
        const historicalDiscPrefix = '历史来源参考（当前适用性待核验，不参与自动配装）：'
        const historicalDiscReferences =
          discGuidance?.state === 'ready' && Array.isArray(discGuidance.value)
            ? discGuidance.value
                .filter(
                  (value): value is string =>
                    typeof value === 'string' && value.startsWith(historicalDiscPrefix),
                )
                .map((value) => value.slice(historicalDiscPrefix.length))
            : []
        const potentialSkillReference = getCurrentPotentialSkillReference(agentId)
        const potentialSkillTargets = potentialSkillReference
          ? skillTargetsFromDirections(potentialSkillReference.skillDirections)
          : null
        const skillEvidence = getL3AgentDevelopmentEvidence(agentId)
        const hasMechanicsWithoutPriority = [
          ...(skillEvidence?.verifiedFacts ?? []),
          ...(skillEvidence?.candidateFacts ?? []),
        ].some((fact) => fact.fieldPath.startsWith('skills.') || fact.fieldPath.startsWith('core.'))
        const currentEngineId = resolution.current?.engineId ?? agent.wEngineDetails.id
        const currentEngineName =
          resolution.current?.name ??
          (currentEngineId ? (agent.wEngineDetails.name ?? '已记录音擎') : '未记录音擎')
        const mappedEngines = resolveWorkbenchRecommendedEngines({
          agentId,
          resolution,
          directions: [
            ...(profile.recommendation?.wEngines ?? []),
            ...(constraint?.wEngineDirections ?? []),
          ],
        })
        return {
          agentId,
          supportsPotential: isPotentialImageAgent(agentId),
          potential: resolvePotentialImage(agentId, agent.potentialImage) ?? null,
          skillRecommendation,
          graduationTeams,
          setNames,
          profileSave: {
            scenario: profile.scenario,
            profileId: profile.id,
            status: profile.status,
            version: profile.packageVersion,
            source: profile.sources
              .map((source) => source.label ?? '')
              .filter(Boolean)
              .join('、'),
            progressionDirections: [
              ...(profile.recommendation?.skillPriority ?? constraint?.progressionDirection ?? []),
            ],
          },
          graduationDisplay: {
            mainStats,
            mainStatAlternatives: constraint?.mainStatAlternatives?.map((entry) => ({
              label: `${entry.slot}号位 · ${entry.stats.map(displayStat).join(' / ')}`,
              condition: entry.condition,
              sourceUrl: entry.source.url,
              sourceVersion: entry.source.sourceVersion,
            })),
            subStats: constraint
              ? Object.entries(constraint.subStatWeights)
                  .filter(([, weight]) => weight > 0)
                  .map(([stat]) => displayStat(stat))
                  .join(' / ')
              : (profile.recommendation?.subStats.join(' / ') ?? '资料待补齐'),
            unresolvedSetDirections: [...(constraint?.unresolvedSetDirections ?? [])],
            setUnavailableReason,
            gaps: [...(constraint?.gaps ?? [])],
            sources: profile.sources.map((source) => ({
              label: source.label,
              kind: source.kind,
              updatedAt: source.updatedAt,
            })),
            constraintSources: (constraint?.sources ?? []).map((source) => ({
              id: source.id,
              sourceVersion: source.sourceVersion,
            })),
          },
          targetPanel: targetPanel
            ? {
                value: targetPanel.value,
                status: targetPanel.status,
                conditions: [...targetPanel.conditions],
              }
            : null,
          potentialSkillReference: potentialSkillReference
            ? {
                conditionLabel: potentialSkillReference.conditionLabel,
                skills: Object.entries(skillLabels).map(([rawKey, label]) => ({
                  label,
                  recommended:
                    potentialSkillTargets?.[rawKey as keyof typeof skillLabels] ?? '待确认',
                })),
              }
            : null,
          hasMechanicsWithoutPriority,
          historicalDiscReferences,
          discSetConditions: [
            ...new Set([
              ...readyConditions('build.drive_disc_sets'),
              ...readyConditions('build.main_sub_stats'),
            ]),
          ],
          engineConditions: readyConditions('build.wengines'),
          engine: {
            name: currentEngineName,
            detail: resolution.current
              ? `当前实际 · Lv.${resolution.current.level} · 精炼${resolution.current.refinement} · ${
                  resolution.matchStatus === 'matches_primary'
                    ? '已达标'
                    : resolution.matchStatus === 'matches_alternative'
                      ? '可用替代'
                      : '仍有提升空间'
                }`
              : currentEngineId
                ? '音擎参数未确认；请在“编辑当前状态”补充等级、突破与精炼。'
                : '当前音擎未记录；可在本页“编辑当前状态”中直接录入',
            copyLabel: '当前音擎 · 代理人维护共享',
            copyId: null,
            copies: [],
            currentId: currentEngineId,
            level: resolution.current?.level ?? agent.wEngineDetails.level,
            refinement: resolution.current?.refinement ?? agent.wEngineDetails.refinement,
            options: createWEngineSelectionOptions({
              specialty: catalogById.get(agentId)?.specialty ?? null,
              resolution,
            }),
            ...(currentEngineId
              ? {
                  visual: {
                    entityId: currentEngineId,
                    name: currentEngineName,
                  },
                }
              : {}),
          },
          graduationEngines: mappedEngines.length
            ? mappedEngines
            : [
                {
                  tier: '候选方向' as const,
                  name: '音擎方向资料待补齐',
                  bonus: '没有可映射的音擎候选，不使用其他代理人的示例。',
                },
              ],
        }
      }),
  }
}
