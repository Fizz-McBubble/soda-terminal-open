import { stableContentHash } from '../gameDataPacks/types'
import type { TargetTeamPlanningContextInput } from './targetTeamPlanningContextInput'
import {
  prepareReviewedTemplateEvents32,
  reviewedTemplateWindowStateNames32,
} from '../calculation/reviewedTemplatePreparedEvents32'

const unique = (values: readonly string[]) => [...new Set(values)]
type Preparation = NonNullable<ReturnType<typeof prepareReviewedTemplateEvents32>> & {
  agentId: string
}

export function rejectTargetTeamTemplateConditions32(
  input: TargetTeamPlanningContextInput,
  templatePreparations: readonly Preparation[],
  scenarioIdentity: string,
) {
  const unknownTemplateStateBlockers = unique(
    templatePreparations.flatMap((row) =>
      row.declarations.flatMap((declaration) => {
        const stateNames = new Set(reviewedTemplateWindowStateNames32(row.agentId))
        return Object.entries(declaration.states)
          .filter(([name, state]) => stateNames.has(name) && state === null)
          .map(([name]) => `${row.agentId}：${name} 为显式 unknown，不能用默认窗口状态补算。`)
      }),
    ),
  )
  if (unknownTemplateStateBlockers.length)
    return {
      status: 'unsupported' as const,
      blockers: unknownTemplateStateBlockers,
      fingerprint: stableContentHash({
        input,
        blockers: unknownTemplateStateBlockers,
      }),
    }
  const conditionBlockers = templatePreparations.flatMap(
    (row) => row.conditionPreparation?.blockers ?? [],
  )
  if (conditionBlockers.length)
    return {
      status: 'unsupported' as const,
      blockers: unique(conditionBlockers),
      fingerprint: stableContentHash({
        scenario: scenarioIdentity,
        conditionBlockers,
        declarations: input.eventConditionDeclarationsByAgentId,
      }),
    }
  return null
}
