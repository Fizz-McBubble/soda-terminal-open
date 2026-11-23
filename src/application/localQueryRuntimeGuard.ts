import { calculationQueryContractVersion } from './calculationQueryContract'

export async function requireCompiledRuntimeWithSignal(
  requireCompiledRuntime: () => Promise<unknown>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  await requireCompiledRuntime()
  signal?.throwIfAborted()
}

export async function requireRunWithSignal<TRun>(
  query: { contractVersion: string; runId: string },
  runs: ReadonlyMap<string, TRun>,
  requireCompiledRuntime: () => Promise<unknown>,
  signal?: AbortSignal,
): Promise<TRun> {
  if (query.contractVersion !== calculationQueryContractVersion)
    throw new Error(`Unsupported Calculation/Query contract: ${query.contractVersion}.`)
  await requireCompiledRuntimeWithSignal(requireCompiledRuntime, signal)
  const run = runs.get(query.runId)
  if (!run) throw new Error(`Account Decision run is unavailable: ${query.runId}.`)
  return run
}
