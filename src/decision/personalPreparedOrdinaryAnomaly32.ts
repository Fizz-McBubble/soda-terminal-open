import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from './developmentPreparedAnomalyBenchmark32'
import {
  personalOrdinaryAnomalyDeclarationSchema32,
  type PersonalOrdinaryAnomalyDeclaration32,
} from '../calculation/personalOrdinaryAnomalyDeclaration32'
import type { PreparedAnomalyPreparation32 } from '../calculation/reviewedPreparedAnomalyDeclarations32'

type BenchmarkInput = Parameters<typeof evaluateDevelopmentPreparedAnomalyBenchmarkSide32>[0]

/** Ordinary single-owner burn/shock/corruption/wind settlement only. */
export function evaluatePersonalPreparedOrdinaryAnomalyBenchmarkSide32(
  input: Omit<BenchmarkInput, 'members' | 'preparation' | 'originalEquipment'> & {
    declaration: PersonalOrdinaryAnomalyDeclaration32
  },
) {
  const parsed = personalOrdinaryAnomalyDeclarationSchema32.safeParse(input.declaration)
  return evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
    ...input,
    members: [input.member],
    // Never manufacture a declared state from the panel or a malformed value.
    preparation: parsed.success
      ? { kind: 'personal_single_ordinary_anomaly', ...parsed.data }
      : ({
          kind: 'personal_single_ordinary_anomaly',
          acceptedSingleOwnerSettlement: false,
          sourceRefs: [],
        } as unknown as PreparedAnomalyPreparation32),
  })
}
