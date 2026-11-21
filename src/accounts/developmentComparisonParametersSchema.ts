import { z } from 'zod'

/** The existing personal comparison snapshot; old snapshots need no new fields. */
export const developmentComparisonParametersSchema = z.object({
  wEngine: z
    .object({
      engineId: z.string().min(1),
      level: z.number().int().min(0).max(60),
      ascension: z.number().int().min(0).max(5).optional(),
      refinement: z.number().int().min(1).max(5),
    })
    .optional(),
  potential: z.number().int().min(0).max(6).optional(),
  independentDirection: z
    .object({
      directionId: z.string().trim().min(1),
      conditionState: z.enum(['met', 'not_met', 'unknown']),
    })
    .strict()
    .optional(),
})

/** Validate each explicit scenario while preserving the rank keys for the solver's range check. */
export function parseDevelopmentParametersByRank(
  parameters?: Record<
    number,
    import('../decision/developmentValueBenchmark').DevelopmentComparisonParameters
  >,
) {
  return Object.fromEntries(
    Object.entries(parameters ?? {}).map(([rank, value]) => [
      rank,
      developmentComparisonParametersSchema.parse(value),
    ]),
  )
}
