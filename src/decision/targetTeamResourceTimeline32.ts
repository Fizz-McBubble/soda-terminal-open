import { stableContentHash } from '../gameDataPacks/types'
import {
  normalizeResourceTimelineDeclaration32,
  resourceTimelineDeclarationIdentity32,
} from '../calculation/resourceTimelineDeclarationContract32'
import { compileDeclaredResourceTimeline32 } from '../calculation/declaredResourceTimeline32'

export function resolveTargetTeamResourceTimeline32(input: {
  memberIds: readonly string[]
  declaration?: unknown
  parameterDeclaration?: unknown
  durationSeconds: number
}) {
  try {
    const direct = normalizeResourceTimelineDeclaration32(
      input.declaration,
      input.memberIds,
      input.durationSeconds,
    )
    const parameter = normalizeResourceTimelineDeclaration32(
      input.parameterDeclaration,
      input.memberIds,
      input.durationSeconds,
    )
    if (
      direct &&
      parameter &&
      resourceTimelineDeclarationIdentity32(direct) !==
        resourceTimelineDeclarationIdentity32(parameter)
    )
      throw new Error('资源事件声明与方案参数不一致。')
    const declaration = direct ?? parameter
    if (
      declaration &&
      compileDeclaredResourceTimeline32(declaration).status !== 'declared_resource_production'
    )
      throw new Error('资源事件声明的来源或事件资格已失效。')
    return {
      status: 'supported' as const,
      declaration,
      identity: resourceTimelineDeclarationIdentity32(declaration),
    }
  } catch {
    return {
      status: 'unsupported' as const,
      blockers: ['资源事件声明格式、来源、队伍、时长或参数身份无效。'],
      fingerprint: stableContentHash(input),
    }
  }
}
