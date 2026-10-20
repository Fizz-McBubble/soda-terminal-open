import { z } from 'zod'
import { contentHash } from '../application/contentHash'
import { declaredRemielleResourceLedgerSchema32 } from './remielleResourceLedgerContract32'

const finite = z.number().finite().nonnegative()
const id = z.string().trim().min(1)
/** Structural/historical contract only. Current source and execution legality
 * are checked by compileDeclaredResourceTimeline32 before numerical adoption. */
export const resourceTimelineDeclarationSchema32 = z
  .object({
    contract: z.literal('soda-declared-resource-timeline32/v1'),
    sourceIdentityHash: id,
    memberAgentIds: z.tuple([id, id, id]),
    durationSeconds: finite.positive(),
    initialResourceValues: z.record(id, finite).optional(),
    events: z.array(
      z
        .object({
          id,
          ownerAgentId: id,
          eventKey: id,
          atSeconds: finite,
          quantity: finite.positive().optional(),
          conditions: z.record(id, z.boolean()),
          sourceRefs: z.array(id).min(1),
        })
        .strict(),
    ),
    remielle: declaredRemielleResourceLedgerSchema32.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const same = (left: readonly string[], right: readonly string[]) =>
      left.join(':') === right.join(':')
    if (
      new Set(value.memberAgentIds).size !== 3 ||
      new Set(value.events.map((row) => row.id)).size !== value.events.length ||
      value.events.some(
        (row, index) =>
          !value.memberAgentIds.includes(row.ownerAgentId) ||
          row.atSeconds > value.durationSeconds ||
          (index > 0 && row.atSeconds < value.events[index - 1]!.atSeconds),
      ) ||
      (value.remielle &&
        (!same(value.remielle.memberAgentIds, value.memberAgentIds) ||
          value.remielle.durationSeconds !== value.durationSeconds))
    )
      context.addIssue({ code: 'custom', message: '资源事件的队伍、时长、身份或顺序不一致。' })
  })
export type ResourceTimelineDeclaration32 = z.infer<typeof resourceTimelineDeclarationSchema32>

export function normalizeResourceTimelineDeclaration32(
  raw: unknown,
  memberIds: readonly string[],
  durationSeconds = 30,
) {
  if (raw === undefined) return undefined
  const declaration = resourceTimelineDeclarationSchema32.parse(raw)
  if (
    declaration.memberAgentIds.join(':') !== memberIds.join(':') ||
    declaration.durationSeconds !== durationSeconds
  )
    throw new Error('资源事件声明的队伍或时长与本次计算不一致。')
  return declaration
}

export function resourceTimelineDeclarationIdentity32(raw: unknown) {
  return raw === undefined ? undefined : contentHash(resourceTimelineDeclarationSchema32.parse(raw))
}
