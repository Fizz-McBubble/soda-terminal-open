import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import type { AssetBridgeJob, AssetQuickReadBridgeClient } from '../assetQuickRead/bridgeClient'
import type { AssetQuickReadCandidate } from '../assetQuickRead/snapshotAdapter'
import { syntheticAssetSnapshot } from '../assetQuickRead/syntheticAssetSnapshotTestFixture'
vi.mock('../assetQuickRead/pendingResult', () => ({
  savePendingAssetResult: vi.fn().mockResolvedValue(true),
  readPendingAssetResult: vi.fn().mockResolvedValue(null),
  clearPendingAssetResult: vi.fn().mockResolvedValue(undefined),
}))

const persistence = vi.hoisted(() => ({
  prepare: vi.fn(),
  confirm: vi.fn(),
  restore: vi.fn(),
  readRecovery: vi.fn(),
  activate: vi.fn(),
}))
vi.mock('../assetQuickRead/accountImport', () => ({
  prepareAssetQuickReadImport: persistence.prepare,
  confirmAssetQuickReadImport: persistence.confirm,
  restoreAssetQuickReadImport: persistence.restore,
  readLatestAssetQuickReadRecovery: persistence.readRecovery,
}))
vi.mock('../accounts/publicScannerAccountCreation', () => ({
  setPublicScannerActiveAccount: persistence.activate,
}))
const converted = vi.hoisted(() => ({
  candidate: null as unknown as AssetQuickReadCandidate,
}))
vi.mock('../assetQuickRead/snapshotAdapter', () => ({
  convertAssetSnapshot: () => converted.candidate,
  assetSnapshotSchema: { parse: (raw: unknown) => raw },
}))
export { persistence, converted }

export const targetAccountId = 'account-synthetic'
export const jobId = '1e80b26d-39fa-41a5-afbf-fca374acb6ee'
export const job: AssetBridgeJob = {
  jobId,
  targetAccountId,
  state: 'starting',
  phase: 'awaiting_elevation',
  code: null,
  startedAt: '2026-10-10T00:00:00Z',
  readyAt: null,
  deadline: null,
  remainingSeconds: null,
  counts: { discs: 0, engines: 0, agents: 0 },
  candidateAvailable: false,
}
export type BridgeHealth = Awaited<ReturnType<AssetQuickReadBridgeClient['connect']>>
export const health: BridgeHealth = {
  service: 'soda-asset-quick-read',
  version: '1.0.0',
  protocolVersion: 1,
  capabilities: ['asset_snapshot', 'explicit_uac_start', 'cancel'],
  state: 'idle',
}
export function bridge() {
  return {
    connect: vi.fn<AssetQuickReadBridgeClient['connect']>().mockResolvedValue(health),
    start: vi.fn().mockResolvedValue(job),
    status: vi.fn().mockResolvedValue({ ...job, state: 'received', candidateAvailable: true }),
    cancel: vi.fn().mockResolvedValue({ ...job, state: 'stopped' }),
    result: vi.fn().mockResolvedValue({
      jobId,
      targetAccountId,
      snapshot: syntheticAssetSnapshot(),
      sha256: 'a'.repeat(64),
      capturedAt: '2026-10-10T00:00:00Z',
    }),
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  localStorage.clear()
  converted.candidate = {
    protocolVersion: '3.2',
    capturedAt: '2026-10-10T00:00:00Z',
    snapshotSha256: 'a'.repeat(64),
    discs: {
      format: 'soda-terminal-drive-disc-import',
      formatVersion: 1,
      source: { adapter: 'asset-quick-read' },
      batch: {},
      discs: [],
    },
    agents: [
      {
        agentId: 'agent-nicole',
        name: '妮可',
        fields: { level: 60, mindscape: 0 },
        observedFields: ['level', 'mindscape'],
        equippedSourceIds: [],
      },
    ],
    counts: { discs: 0, sDiscs: 0, engines: 0, agents: 1, importableAgents: 1 },
    issues: [],
    importable: true,
    fullInventoryVerified: false,
  }
  persistence.prepare.mockResolvedValue({
    accountId: targetAccountId,
    importable: true,
    summary: {
      observedDiscs: 0,
      newDiscs: 0,
      updatedDiscs: 0,
      retainedDiscs: 0,
      observedAgents: 1,
      protectedFields: 0,
      inferredDiscLinks: 0,
    },
  })
  persistence.confirm.mockResolvedValue({
    observedAgents: 1,
    observedDiscs: 0,
    totalDiscs: 0,
    recoveryKey: 'synthetic-recovery',
  })
  persistence.restore.mockResolvedValue({ restoredDiscs: 0 })
  persistence.readRecovery.mockResolvedValue(null)
})
afterEach(() => {
  vi.useRealTimers()
})

export async function prepareStart() {
  fireEvent.change(screen.getByLabelText('游戏安装目录'), {
    target: { value: "soda-source-ref:24d5780e541a1a1ad1393e8962be6e18" },
  })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '连接资产快读' })))
  const standalonePreparation = screen.queryByRole('button', { name: '准备资产快读' })
  if (standalonePreparation) {
    fireEvent.click(standalonePreparation)
    fireEvent.click(screen.getByRole('checkbox', { name: /我已阅读上述风险/ }))
  } else {
    fireEvent.click(screen.getByRole('checkbox', { name: /我已了解上方账号风险/ }))
  }
}
export async function startAndReceive() {
  await prepareStart()
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /^(一键读取|开始本次资产快读|开始读取)$/ })),
  )
  await act(async () => vi.advanceTimersByTimeAsync(1000))
}
