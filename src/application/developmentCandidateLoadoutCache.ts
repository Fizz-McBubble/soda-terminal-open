import type { CandidateWarehousePlan } from '../optimizer/candidateWarehouseSolver'
import type { AccountDecisionRun } from './calculationQueryContract'
import type { DevelopmentWorkbenchRouteSelection } from './publicDevelopmentWorkbenchRoute'
import { contentHash } from './contentHash'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'

type Loadout = CandidateWarehousePlan['loadouts'][number]
const binding = (run: AccountDecisionRun) =>
  // Local callers can retain the captured input object. A changed input must not
  // reuse a previously issued loadout merely because its scalar identity is unchanged.
  JSON.stringify([
    run.runId,
    run.inputFingerprint,
    run.input.warehouse.accountId,
    contentHash(run.input),
  ])
const key = (agentId: string, rank: number, fingerprint: string) =>
  JSON.stringify([agentId, rank, fingerprint])

/** Private, issued default loadouts only. A miss keeps the original fresh-solve validation. */
export function createDevelopmentCandidateLoadoutCache() {
  let runs = new WeakMap<
    AccountDecisionRun,
    {
      binding: string
      loadouts: Map<string, { loadout: Loadout; guidanceHash: string | null }>
    }
  >()
  return {
    remember(run: AccountDecisionRun, agentId: string, candidates: CandidateWarehousePlan[]) {
      const identity = binding(run)
      let entry = runs.get(run)
      if (!entry || entry.binding !== identity) {
        entry = { binding: identity, loadouts: new Map() }
        runs.set(run, entry)
      }
      const loadouts = entry.loadouts
      candidates.forEach((candidate, index) => {
        const loadout = candidate.loadouts[0]
        if (!loadout || loadout.agentId !== agentId) return
        // The client can return its projection to local callers without exposing this copy.
        const snapshot = structuredClone(loadout)
        const id = key(agentId, index + 1, contentHash(snapshot))
        loadouts.delete(id)
        loadouts.set(id, {
          loadout: snapshot,
          guidanceHash: getCandidateWarehouseConstraint(agentId)?.contentHash ?? null,
        })
        while (loadouts.size > 128) loadouts.delete(loadouts.keys().next().value!)
      })
    },
    read(run: AccountDecisionRun, selection: DevelopmentWorkbenchRouteSelection) {
      if (
        selection.candidateRank === null ||
        !Number.isSafeInteger(selection.candidateRank) ||
        selection.candidateRank < 1 ||
        !selection.candidateLoadoutFingerprint
      )
        return undefined
      const entry = runs.get(run)
      if (!entry || entry.binding !== binding(run)) return undefined
      const cached = entry.loadouts.get(
        key(selection.agentId, selection.candidateRank, selection.candidateLoadoutFingerprint),
      )
      if (
        !cached ||
        cached.guidanceHash !==
          (getCandidateWarehouseConstraint(selection.agentId)?.contentHash ?? null)
      )
        return undefined
      return structuredClone(cached.loadout)
    },
    forget(run: AccountDecisionRun) {
      runs.delete(run)
    },
    clear() {
      runs = new WeakMap()
    },
  }
}
