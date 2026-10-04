export const baseScannerSnapshot = {
  state: 'unchecked',
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
    errors: [] as string[],
    checkedAt: '2026-07-31T10:00:00.000Z',
    playerChecks: {
      filtersClear: true,
      overlayClear: true,
      inventoryCapacity: 3000,
    },
  },
  config: {
    scopeLabel: '完整驱动盘仓库 · 384 张',
    localOnly: true,
    reviewPolicyLabel: '低置信与冲突项保留检查',
    safeStopAvailable: true,
  },
  distribution: {
    state: 'ready',
    installedVersion: 'soda-scanner-ppocrv6-1',
    targetVersion: 'soda-scanner-ppocrv6-1',
    progressPercent: null,
    action: 'open',
    message: 'PP-OCRv6 扫描组件已校验，可由网页直接使用。',
  },
}

export function createScannerRuntimeSnapshot(state: string) {
  return {
    ...baseScannerSnapshot,
    state,
    ...(state === 'connection_failed'
      ? {
          readiness: {
            ...baseScannerSnapshot.readiness,
            gameFrameReadable: false,
          },
          prepare: {
            ...baseScannerSnapshot.prepare,
            geometry: { client: { width: 1600, height: 900 } },
            errors: ['client_size_changed'],
            playerChecks: {
              filtersClear: false,
              overlayClear: false,
              inventoryCapacity: 3000,
            },
          },
          error: {
            userMessage: '游戏窗口尺寸、筛选和遮挡还没有准备好。',
            recoveryAction: 'retry',
          },
        }
      : {}),
    ...(state === 'scanning' || state === 'paused'
      ? {
          progress: {
            processed: 128,
            total: 384,
            stageLabel: state === 'paused' ? '已安全暂停' : '读取驱动盘详情',
            etaSeconds: null,
          },
        }
      : {}),
    ...(state === 'completed'
      ? {
          summary: {
            reliable: 350,
            needsReview: 30,
            unreadable: 4,
            resultFileHandle: 'local-staging.json',
            resultStatus: 'needs_review',
            uniqueRecords: 384,
            totalSeconds: 100,
          },
        }
      : {}),
  }
}
