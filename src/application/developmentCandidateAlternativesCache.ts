import { contentHash } from './contentHash'
import type {
  AccountDecisionRun,
  DevelopmentCandidateAlternativesQueryResult,
} from './calculationQueryContract'

type Entry = {
  binding: string
  results: Map<string, DevelopmentCandidateAlternativesQueryResult>
}

const maxResultsPerRun = 8

function runBinding(run: AccountDecisionRun) {
  return JSON.stringify([
    run.runId,
    run.inputFingerprint,
    run.input.warehouse.accountId,
    run.snapshot.fingerprint.components.rosterHash,
    run.snapshot.fingerprint.components.warehouseHash,
    run.snapshot.fingerprint.components.planningHash,
    contentHash(run.input),
  ])
}

/** Successful and deterministic Query results only; callers always receive a detached copy. */
export function createDevelopmentCandidateAlternativesCache() {
  let runs = new WeakMap<AccountDecisionRun, Entry>()
  return {
    read(run: AccountDecisionRun, key: string) {
      const entry = runs.get(run)
      if (!entry || entry.binding !== runBinding(run)) return undefined
      const result = entry.results.get(key)
      if (!result) return undefined
      entry.results.delete(key)
      entry.results.set(key, result)
      return structuredClone(result)
    },
    remember(
      run: AccountDecisionRun,
      key: string,
      result: DevelopmentCandidateAlternativesQueryResult,
    ) {
      const binding = runBinding(run)
      let entry = runs.get(run)
      if (!entry || entry.binding !== binding) {
        entry = { binding, results: new Map() }
        runs.set(run, entry)
      }
      entry.results.delete(key)
      entry.results.set(key, structuredClone(result))
      while (entry.results.size > maxResultsPerRun)
        entry.results.delete(entry.results.keys().next().value!)
    },
    forget(run: AccountDecisionRun) {
      runs.delete(run)
    },
    clear() {
      runs = new WeakMap()
    },
  }
}
