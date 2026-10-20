import { z } from 'zod'
import { publicCommonAnomalySettlementInputSchema32 } from './publicCommonAnomalySettlement32'

const id = z.string().trim().min(1)
const time = z.number().finite().nonnegative()
const attribute = z.enum(['physical', 'fire', 'ice', 'electric', 'ether', 'wind'])
const original = publicCommonAnomalySettlementInputSchema32.shape.settlement
const contribution = original.shape.contributions.element.extend({
  attribute,
  instance: z
    .object({
      kind: z.literal('anomaly'),
      motionValueMultiplier: z.union([z.literal(0), z.literal(1)]),
    })
    .strict(),
})
/** Wire vocabulary only. Private production validates source identity, accepted
 * buildup, snapshot conservation and the exact consuming occurrence. */
export const publicPlanningAnomalyLifecycleSchema32 = z
  .object({
    sourceIdentityHash: id,
    application: original.extend({ attribute, contributions: z.array(contribution).min(1) }),
    activeUntilSeconds: time,
    endedAtSeconds: time.nullable(),
    event: z.object({ eventId: id, ownerAgentId: id, targetId: id, atSeconds: time }).strict(),
    sourceRefs: z.array(id).min(1),
  })
  .strict()
export type PublicPlanningAnomalyLifecycle32 = z.infer<
  typeof publicPlanningAnomalyLifecycleSchema32
>
