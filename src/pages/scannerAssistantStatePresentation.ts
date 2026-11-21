import type { ScannerAssistantSnapshot } from '../scanner/runtime'

export const discardedScannerResultHandleKey = 'soda.scanner.discardedResultHandle'
export const completedScannerImportKey = 'soda.scanner.completedImport'

export function getScannerPreparationBody(
  snapshot: ScannerAssistantSnapshot,
  hasScannerTask: boolean,
  fallbackBody: string,
) {
  if (hasScannerTask && snapshot.state === 'connection_failed') {
    return '本次扫描未完成，处理情况与恢复操作见下方任务。'
  }
  if (snapshot.error?.userMessage != null) return snapshot.error.userMessage
  if (!snapshot.readiness.helperConnected) return '首次使用先下载并安装画面扫描，再连接。'
  return snapshot.distribution?.state === 'ready'
    ? '点击开始扫描，自动检查游戏画面后读取。'
    : (snapshot.distribution?.message ?? fallbackBody)
}

export function playerResultMessage(message: string) {
  if (message.includes('不完整的同源识别结果'))
    return '上次保存的扫描结果不完整。可以重新读取本次结果，账户仓库尚未更新。'
  if (message.includes('不完整扫描草稿包含已导入记录'))
    return '这份扫描结果已有导入记录，不能清除。请恢复结果状态后继续，账户仓库不会被重复更新。'
  return message
}

export type CompletedScannerImport = {
  count: number
  accountId: string
  attemptReportId?: string
  resultFileHandle?: string
}

export function readCompletedScannerImport(): CompletedScannerImport | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(completedScannerImportKey) ?? 'null')
    if (
      value &&
      typeof value.count === 'number' &&
      Number.isFinite(value.count) &&
      value.count >= 0 &&
      typeof value.accountId === 'string'
    )
      return value
  } catch {
    // A malformed local flag should never block a fresh scanner journey.
  }
  return null
}

export function saveCompletedScannerImport(value: CompletedScannerImport) {
  // The committed import and live UI remain authoritative when
  // optional browser storage is full or disabled.
  try {
    window.localStorage.setItem(completedScannerImportKey, JSON.stringify(value))
  } catch {
    // Formal import proof in IndexedDB can restore completion.
  }
}

export function getScannerStateCopy(
  snapshot: ScannerAssistantSnapshot,
  targetReady: boolean,
  prepareGateReady: boolean,
) {
  switch (snapshot.state) {
    case 'connecting':
      return {
        eyebrow: '正在连接',
        title: '画面扫描正在准备',
        body: '请保持画面扫描运行。连接完成后，选择账户并点击开始扫描。',
      }
    case 'unchecked':
      return {
        eyebrow: '等待画面扫描',
        title: '连接画面扫描，选择账户后开始扫描',
        body:
          window.location.protocol === 'https:'
            ? '连接后选择账户，检查游戏并开始扫描。'
            : '点击后会切换到游戏，并自动检查扫描准备情况。',
      }
    case 'connection_failed':
      return snapshot.readiness.helperConnected
        ? {
            eyebrow: '扫描恢复',
            title: '本次扫描未完成',
            body: `${snapshot.error?.userMessage ?? '本机扫描没有完成。'}${snapshot.progress?.processed ? ` 本次已处理 ${snapshot.progress.processed} 张，部分结果不会作为完整仓库导入。` : ''} 请确认游戏已启动并显示完整驱动仓库，再重新切换到游戏。现有账户与上次结果不会被覆盖。`,
          }
        : {
            eyebrow: '连接恢复',
            title: '画面扫描尚未连接',
            body: `${snapshot.error?.userMessage ?? '画面扫描未就绪，可重新连接。'}${window.location.protocol === 'https:' ? ' 首次连接时，请允许浏览器访问本机设备；如果曾拒绝，请到此网站的浏览器权限设置中改为允许，再点击重新连接。' : ''}`,
          }
    case 'ready':
      return {
        eyebrow: !targetReady
          ? '等待选择账户'
          : prepareGateReady
            ? '准备检查已通过'
            : '等待画面检查',
        title: targetReady ? '切换到游戏，开始本地扫描' : '选择账户，再检查游戏',
        body: targetReady
          ? '已选择要导入的本机账户。扫描只读取当前游戏画面，确认导入前仍会先让你检查结果。'
          : '画面扫描已连接。选择要导入的本机账户后，再检查游戏并开始扫描。',
      }
    case 'checking':
      return {
        eyebrow: '正在核验',
        title: '画面扫描正在检查游戏与权限',
        body: '正在检查游戏画面和所需权限；检查通过后会自动开始扫描。',
      }
    case 'awaiting_elevation':
      return {
        eyebrow: '等待 Windows 权限',
        title: '请确认管理员权限提示',
        body: 'Windows 可能要求管理员权限。请按系统提示确认；本次只会为扫描请求一次权限。',
      }
    case 'scanning':
      return {
        eyebrow: '正在本机处理',
        title: '正在读取游戏中的驱动盘',
        body: '保持游戏窗口可见。扫描结果会先保存在本机，确认导入前不会改动账户。',
      }
    case 'paused':
      return {
        eyebrow: '扫描已暂停',
        title: '本次扫描已暂停',
        body: snapshot.progress?.stageLabel || '扫描已暂停，可停止本次扫描后重新开始。',
      }
    case 'completed':
      return {
        eyebrow: '扫描已完成',
        title: '结果已生成，先检查再导入',
        body: '扫描结果已保存在本机。请核对数量与接收账户，再确认导入。',
      }
    default:
      return {
        eyebrow: '正在检查游戏画面',
        title: '画面扫描正在检查游戏画面',
        body: '画面扫描会先检查游戏窗口、可见区域和所需权限；全部通过后才会开始。',
      }
  }
}

export function getScannerPresentedStateCopy({
  restartingAfterCompletedResult,
  preparingNewScan,
  selectedAccount,
  completedImportCount,
  snapshotState,
  visualState,
  scanIdentityEvidenceValue,
  currentReceivingAccountName,
  stateCopy,
}: {
  restartingAfterCompletedResult: boolean
  preparingNewScan: boolean
  selectedAccount: boolean
  completedImportCount: number | null
  snapshotState: string
  visualState: string
  scanIdentityEvidenceValue: string
  currentReceivingAccountName: string
  stateCopy: { eyebrow: string; title: string; body: string }
}) {
  if (restartingAfterCompletedResult || preparingNewScan) {
    return {
      eyebrow: '开始新的扫描',
      title: selectedAccount ? '确认账户，然后开始本地扫描' : '创建账户，然后开始本地扫描',
      body: selectedAccount
        ? '已导入的驱动盘会保留；新扫描结果需检查并确认后才会更新账户。'
        : '已有账户中的驱动盘会保留。先创建要导入的本机账户；新扫描结果需检查并确认后才会更新账户。',
    }
  }
  if (completedImportCount !== null) {
    return {
      eyebrow: '驱动盘已更新',
      title: '驱动盘已进入当前账户',
      body: `已更新 ${completedImportCount} 张驱动盘。现在可以继续配队或检查仓库建议。`,
    }
  }
  if (snapshotState === 'completed' && !selectedAccount) {
    return {
      eyebrow: '先确定导入账户',
      title: '创建账户后检查本次结果',
      body: '扫描结果已保存在本机。先创建要导入的本机账户，再检查结果；创建账户不会自动导入。',
    }
  }
  if (visualState === 'review_required') {
    return {
      eyebrow: '请确认导入账户',
      title: '确认这份结果要导入哪个本机账户',
      body: `本次扫描关联的账户是“${scanIdentityEvidenceValue}”，当前选择的是“${currentReceivingAccountName}”。请核对名称后继续；确认前不会导入。`,
    }
  }
  if (visualState === 'import_ready') {
    return {
      eyebrow: '账户已确认',
      title: '结果已就绪，请检查导入条件',
      body: '导入账户已确认，下一步检查扫描结果是否完整。',
    }
  }
  return stateCopy
}

export function getCompletedScannerImportCount(
  completedImport: CompletedScannerImport | null,
  importedThisVisit: boolean,
  snapshot: ScannerAssistantSnapshot,
  selectedAccountId: string | undefined,
) {
  return completedImport &&
    (importedThisVisit ||
      (snapshot.state === 'completed' &&
        Boolean(completedImport.resultFileHandle) &&
        completedImport.resultFileHandle === snapshot.summary?.resultFileHandle)) &&
    completedImport.accountId === selectedAccountId &&
    !['checking', 'awaiting_elevation', 'scanning', 'paused'].includes(snapshot.state) &&
    !(
      completedImport.attemptReportId &&
      snapshot.diagnostics?.reportId &&
      completedImport.attemptReportId !== snapshot.diagnostics.reportId
    ) &&
    !(
      completedImport.resultFileHandle &&
      snapshot.summary?.resultFileHandle &&
      completedImport.resultFileHandle !== snapshot.summary.resultFileHandle
    )
    ? completedImport.count
    : null
}

export function shouldPrepareAnotherScannerRun(snapshot: ScannerAssistantSnapshot) {
  return ![
    'completed',
    'checking',
    'awaiting_elevation',
    'scanning',
    'paused',
    'connection_failed',
  ].includes(snapshot.state)
}

export function scannerActionIssueCode(error: unknown, fallback: string) {
  return error instanceof Error && error.name === 'ScannerHelperCompatibilityError'
    ? 'helper_incompatible'
    : error instanceof Error && error.message === 'helper_pairing_denied'
      ? 'helper_pairing_denied'
      : fallback
}

export function scannerActionErrorMessage(error: unknown) {
  return error instanceof Error && error.message.includes('扫描')
    ? error.message
    : window.location.protocol === 'https:'
      ? '未能连接画面扫描。请确认画面扫描已运行，并允许本站连接本机设备后重试。'
      : '未能连接画面扫描，请确认画面扫描已运行后重试。'
}
