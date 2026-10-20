import { compileDeclaredResourceTimeline32 } from '../calculation/declaredResourceTimeline32'
import {
  readPlanningResourceTimeline32,
  type ResourceTimelineDraftLike32,
} from './resourceTimelineSavedContract32'

/** Invoke before a new database write. Backup recovery uses the historical thin
 * schema instead, preserving old source hashes for explicit stale readback. */
export function assertCurrentPlanningResourceTimeline32(input: ResourceTimelineDraftLike32) {
  const declaration = readPlanningResourceTimeline32(input)
  if (
    declaration &&
    compileDeclaredResourceTimeline32(declaration).status !== 'declared_resource_production'
  )
    throw new Error('资源事件的当前来源或资格无效，方案没有保存。')
  return declaration
}
