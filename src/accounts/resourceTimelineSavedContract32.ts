import type { z } from 'zod'
import {
  normalizeResourceTimelineDeclaration32,
  resourceTimelineDeclarationIdentity32,
} from '../calculation/resourceTimelineDeclarationContract32'

export type ResourceTimelineDraftLike32 = {
  kind: string
  selection: { agentIds: readonly string[] }
  solutionContext?: {
    scope?: string
    resourceTimelineDeclaration32?: unknown
    resourceTimelineDeclarationIdentity32?: unknown
  }
  teamEquipmentParameters?: { resourceTimelineDeclaration32?: unknown }
}

/** Historical sources remain readable; structural identity/ownership still
 * cannot be malformed or silently disagree between saved context and parameters. */
export function readPlanningResourceTimeline32(input: ResourceTimelineDraftLike32) {
  const context = normalizeResourceTimelineDeclaration32(
    input.solutionContext?.resourceTimelineDeclaration32,
    input.selection.agentIds,
  )
  const parameters = normalizeResourceTimelineDeclaration32(
    input.teamEquipmentParameters?.resourceTimelineDeclaration32,
    input.selection.agentIds,
  )
  if (
    context &&
    parameters &&
    resourceTimelineDeclarationIdentity32(context) !==
      resourceTimelineDeclarationIdentity32(parameters)
  )
    throw new Error('资源事件的保存上下文与参数不一致。')
  const declaration = context ?? parameters
  if (
    declaration &&
    (input.kind !== 'team' || (context && input.solutionContext?.scope !== 'team_joint'))
  )
    throw new Error('资源事件声明只能绑定同一三人队伍方案。')
  if (
    input.solutionContext?.resourceTimelineDeclarationIdentity32 !== undefined &&
    input.solutionContext.resourceTimelineDeclarationIdentity32 !==
      resourceTimelineDeclarationIdentity32(declaration)
  )
    throw new Error('资源事件声明指纹与保存内容不一致。')
  return declaration
}

export function refinePlanningResourceTimeline32(
  input: ResourceTimelineDraftLike32,
  context: z.RefinementCtx,
) {
  try {
    readPlanningResourceTimeline32(input)
  } catch {
    context.addIssue({ code: 'custom', message: '资源事件声明的保存结构、队伍、时长或指纹无效。' })
  }
}
