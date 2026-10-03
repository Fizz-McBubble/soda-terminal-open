import { z } from 'zod'

export const koledaFixedEventConditionsContract32 =
  'soda-koleda-uniform-fixed-event-conditions32/v1' as const

/** A uniform state for a finite benchmark, separate from a legal rotation. */
export const koledaFixedEventConditionsInputSchema32 = z
  .object({
    contract: z.literal(koledaFixedEventConditionsContract32),
    sourceFingerprint: z.string().trim().min(1),
    confirmedUniformConditions: z.boolean(),
    furnaceConsumptionBuffActive32: z.boolean(),
    furnaceConsumedStacks32: z.number().int().min(0).max(2).optional(),
  })
  .strict()

export type KoledaFixedEventConditionsInput32 = z.infer<
  typeof koledaFixedEventConditionsInputSchema32
>

export type KoledaFixedEventConditionsMetadata32 = {
  contract: typeof koledaFixedEventConditionsContract32
  sourceFingerprint: string
  providerAgentId: 'agent-koleda'
  scope: 'all_fixed_events'
  declaredDurationSeconds: number
  windowDurationSeconds: 40
  consumptionEventIds: string[]
  requiresWindowState: boolean
  requiresConsumedStackState: boolean
}
