import type { CandidateWarehouseConstraint } from './candidateWarehouseConstraints'
import { gameData32BuildGuidance, gameData32BuildSources } from './gameData32BuildGuidance'
import { stableContentHash } from './types'

/** Every explicitly useful roll counts once. Source order remains prose, never damage weights. */
export const candidateWarehouseConstraints32: readonly CandidateWarehouseConstraint[] =
  Object.values(gameData32BuildGuidance).map((guidance) => {
    const setPlans = guidance.setPlans.map((plan) => structuredClone(plan))
    const first = setPlans[0]
    const input: Omit<CandidateWarehouseConstraint, 'contentHash'> = {
      agentId: guidance.agentId,
      agentName: guidance.agentName,
      gameVersion: '3.2',
      status: 'candidate',
      sources: guidance.sourceKeys.map((key) => ({
        ...gameData32BuildSources[key]!,
        verified: true,
      })),
      setIds: [
        ...new Set(setPlans.flatMap((plan) => [...plan.primarySetIds, ...plan.secondarySetIds])),
      ],
      setPlans,
      setPlanReadiness: first
        ? {
            status: 'executable',
            pattern: first.pattern,
            primarySetIds: first.primarySetIds,
            secondarySetIds: first.secondarySetIds,
          }
        : {
            status: 'non_executable',
            reason: 'unresolved_set_roles',
            missingEvidence: '来源未给出可验证的主副套角色。',
          },
      unresolvedSetDirections: [...guidance.unresolvedSetDirections],
      mainStats: Object.fromEntries(
        Object.entries(guidance.mainStats).map(([slot, stats]) => [slot, [...stats]]),
      ),
      subStatWeights: Object.fromEntries(guidance.subStatPriorities.map((stat) => [stat, 1])),
      wEngineDirections: [...guidance.wEngineDirections],
      teamAndBangbooPreconditions: [
        ...guidance.teamAndBangbooPreconditions,
        ...guidance.conditions,
        ...guidance.mainStatLines,
        ...guidance.subStatLines,
      ],
      progressionDirection: [...guidance.progressionDirections],
      gaps: [],
      boundary:
        '3.2 来源候选约束：每项明确有用副词条按既有有效词条计数政策记 1；来源顺序只保留文字，不转成伤害系数。锋御使用防御方向，暴伤仅经初始暴击率转换成为有用词条。不含毕业面板、全局排序或 Formal 精确结论。条件套装的动作及效果覆盖未知时保留合法库存分支。',
    }
    return { ...input, contentHash: stableContentHash(input) }
  })
