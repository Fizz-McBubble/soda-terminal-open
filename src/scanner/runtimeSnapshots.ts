import type { ScannerAssistantSnapshot } from './runtime'
import { initialDistributionSnapshot } from './distribution'

export const connectingSnapshot: ScannerAssistantSnapshot = {
  state: 'unchecked',
  permission: 'checking',
  readiness: {
    helperConnected: false,
    gameFrameReadable: false,
    accountWriteEnabled: false,
  },
  config: {
    scopeLabel: '完整驱动盘仓库 · 等待检测数量',
    localOnly: true,
    reviewPolicyLabel: '低置信与冲突项保留检查',
    safeStopAvailable: true,
  },
  distribution: initialDistributionSnapshot,
}

const devReadySnapshot: ScannerAssistantSnapshot = {
  ...connectingSnapshot,
  state: 'ready',
  permission: 'granted',
  readiness: {
    helperConnected: true,
    gameFrameReadable: true,
    accountWriteEnabled: false,
  },
  prepare: {
    observedTotal: 384,
    expectedTotal: 384,
    totalSource: 'warehouse_counter',
    requiresElevation: false,
    geometry: { client: { width: 1920, height: 1080 } },
    errors: [],
    checkedAt: '2026-07-31T10:00:00.000Z',
    playerChecks: {
      filtersClear: true,
      overlayClear: true,
      inventoryCapacity: 3000,
    },
  },
  config: {
    ...connectingSnapshot.config,
    scopeLabel: '完整驱动盘仓库 · 384 张',
  },
  distribution: {
    state: 'ready',
    installedVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc6',
    targetVersion: 'soda-scanner-zzz-next-ppocrv6-18-rc6',
    progressPercent: null,
    action: 'open',
    message: 'PP-OCRv6 扫描组件已校验，可由网页直接使用。',
  },
}

export function createDevSnapshot(state: string | null): ScannerAssistantSnapshot | null {
  if (!state) return null
  if (state === 'unchecked') return connectingSnapshot
  if (state === 'checking' || state === 'connecting')
    return {
      ...connectingSnapshot,
      state: 'connecting',
      readiness: { ...connectingSnapshot.readiness, helperConnected: true },
      distribution: {
        ...initialDistributionSnapshot,
        state: 'verifying',
        action: 'none',
        message: '正在校验本机扫描组件和离线模型。',
      },
    }
  if (state === 'ready') return devReadySnapshot
  if (state === 'blocked' || state === 'failed')
    return {
      ...devReadySnapshot,
      state: 'connection_failed',
      permission: 'denied',
      readiness: {
        ...devReadySnapshot.readiness,
        gameFrameReadable: false,
      },
      prepare: {
        ...devReadySnapshot.prepare,
        observedTotal: 267,
        expectedTotal: 267,
        geometry: { client: { width: 1600, height: 900 } },
        errors: ['client_size_changed'],
        playerChecks: {
          filtersClear: false,
          overlayClear: false,
          inventoryCapacity: 3000,
        },
      },
      config: {
        ...devReadySnapshot.config,
        scopeLabel: '完整驱动盘仓库 · 检测到 267 张',
      },
      error: {
        userMessage: '游戏窗口尺寸、筛选和遮挡还没有准备好。',
        recoveryAction: 'retry',
      },
    }
  if (state === 'scanning')
    return {
      ...devReadySnapshot,
      state: 'scanning',
      progress: {
        processed: 128,
        total: 384,
        stageLabel: '正在读取驱动盘详情',
        etaSeconds: null,
      },
    }
  if (state === 'complete' || state === 'completed')
    return {
      ...devReadySnapshot,
      state: 'completed',
      summary: {
        reliable: 350,
        needsReview: 30,
        unreadable: 4,
        resultFileHandle: 'dev-readonly-staging.json',
        resultStatus: 'needs_review',
        uniqueRecords: 384,
        totalSeconds: 100,
      },
    }
  return null
}

export const failedSnapshot: ScannerAssistantSnapshot = {
  ...connectingSnapshot,
  state: 'connection_failed',
  permission: 'denied',
  error: {
    userMessage: '扫描助手未就绪，可重新连接。仍无法连接时，请重新打开 Soda Terminal。',
    recoveryAction: 'retry',
    diagnosticCode: 'helper_unavailable',
  },
}
