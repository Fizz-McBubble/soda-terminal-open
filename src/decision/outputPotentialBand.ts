import { z } from 'zod'

import { stableContentHash } from '../gameDataPacks/types'
import type { TeamFeatureBand } from './teamDecisionAuthority'

export const outputPotentialBandContractId = 'soda-output-potential-band/v1' as const

const cohortSchema = z
  .object({
    gameVersion: z.string().min(1),
    baselineId: z.string().min(1),
    cohortId: z.string().min(1),
    candidates: z
      .array(
        z
          .object({
            candidateId: z.string().min(1),
            output: z.number().finite().nonnegative(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = input.candidates.map((candidate) => candidate.candidateId)
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        path: ['candidates'],
        message: 'Output Potential cohort 不能包含重复 candidate。',
      })
  })

export type OutputPotentialCohortInput = z.input<typeof cohortSchema>

const thresholds = Object.freeze({ excellent: 0.85, good: 0.65, mixed: 0.4 })

function bandFor(outputIndex: number): Exclude<TeamFeatureBand, 'unknown'> {
  if (outputIndex >= thresholds.excellent) return 'excellent'
  if (outputIndex >= thresholds.good) return 'good'
  if (outputIndex >= thresholds.mixed) return 'mixed'
  return 'weak'
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function projectOutputPotentialBands(raw: OutputPotentialCohortInput) {
  const input = cohortSchema.parse(raw)
  const bestOutput = Math.max(...input.candidates.map((candidate) => candidate.output))
  const candidates = [...input.candidates]
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId))
    .map((candidate) => {
      const outputIndex = bestOutput === 0 ? 0 : round(candidate.output / bestOutput)
      return {
        candidateId: candidate.candidateId,
        output: candidate.output,
        outputIndex,
        band: bandFor(outputIndex),
      }
    })
  const projection = {
    contract: outputPotentialBandContractId,
    gameVersion: input.gameVersion,
    baselineId: input.baselineId,
    cohortId: input.cohortId,
    bestOutput,
    thresholds,
    candidates,
    boundary:
      'Output Index 仅为同版本、同 baseline、同 cohort 下相对最佳值的比率；使用宽阈值分带，不把微小数值差直接变成 Team Rating 名次。',
  }
  return { ...projection, fingerprint: stableContentHash(projection) }
}
