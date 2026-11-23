import type { AssetBridgeJob } from '../assetQuickRead/bridgeClient'

export { syntheticAssetSnapshot as syntheticWorkbenchQuickSnapshot } from '../assetQuickRead/syntheticAssetSnapshotTestFixture'

export function syntheticWorkbenchBridgeJob(accountId: string): AssetBridgeJob {
  return {
    jobId: 'b41d3a49-e16c-4d14-98a5-afbfdbad1cba',
    targetAccountId: accountId,
    state: 'starting',
    phase: 'awaiting_elevation',
    code: null,
    startedAt: '2026-10-10T00:00:00Z',
    readyAt: null,
    deadline: null,
    remainingSeconds: null,
    counts: { agents: 0, discs: 0, engines: 0 },
    candidateAvailable: false,
  }
}
