import { evaluateDevelopmentPreparedAnomalyBenchmarkSide32 } from './developmentPreparedAnomalyBenchmark32'
import type { PreparedYanagiPolarity32 } from '../calculation/reviewedPreparedPolarityObjective32'

type BenchmarkInput = Parameters<typeof evaluateDevelopmentPreparedAnomalyBenchmarkSide32>[0]

/** One explicitly declared self-owned original anomaly, followed by Yanagi's
 * EX polarity. The caller must supply the observation; a panel cannot establish
 * an anomaly, its owner, or its lifetime. */
export function evaluatePersonalPreparedPolarityBenchmarkSide32(
  input: Omit<BenchmarkInput, 'members' | 'preparation' | 'originalEquipment'> & {
    preparation: PreparedYanagiPolarity32
  },
) {
  return evaluateDevelopmentPreparedAnomalyBenchmarkSide32({
    ...input,
    members: [input.member],
  })
}
