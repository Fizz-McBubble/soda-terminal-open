import type { ScannerAssistantSnapshot } from '../scanner/runtime'

export const discardedScannerResultHandleKey = 'soda.scanner.discardedResultHandle'
export const completedScannerImportKey = 'soda.scanner.completedImport'

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
            : '等待本机核验',
        title: targetReady ? '切换到游戏，开始本地扫描' : '选择账户，再检查游戏',
        body: targetReady
          ? '已选择接收结果的本地账户。扫描只在本机读取，正式导入前仍会让你检查。'
          : '画面扫描已连接。选择接收结果的账户后，再检查游戏并开始扫描。',
      }
    case 'checking':
      return {
        eyebrow: '正在核验',
        title: '画面扫描正在检查游戏与权限',
        body: '请求处理中不会重复创建扫描会话；检查通过后会自动进入扫描。',
      }
    case 'awaiting_elevation':
      return {
        eyebrow: '等待 Windows 权限',
        title: '请确认管理员权限提示',
        body: '画面扫描保持普通权限；只会为本次扫描启动一次受控的管理员子进程。',
      }
    case 'scanning':
      return {
        eyebrow: '正在本机处理',
        title: '正在读取游戏中的资产',
        body: '保持游戏窗口可见。扫描结果会先保存在本机，确认导入前不会改动账户。',
      }
    case 'completed':
      return {
        eyebrow: '扫描已完成',
        title: '结果已生成，先检查再导入',
        body: '扫描结果已保存在本机。请核对数量与接收账户，再确认导入。',
      }
    default:
      return {
        eyebrow: '正在接管并核验',
        title: '画面扫描正在检查游戏画面',
        body: '画面扫描会在全部准备门通过后立即开始；未通过时保持零输入并给出原因。',
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
        : '已有账户中的驱动盘会保留。先创建接收账户；新扫描结果需检查并确认后才会更新账户。',
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
      eyebrow: '先确定接收账户',
      title: '创建账户后检查本次结果',
      body: '扫描结果已保存在本机。先创建接收账户，再检查结果；创建账户不会自动导入。',
    }
  }
  if (visualState === 'review_required') {
    return {
      eyebrow: '账户需要复核',
      title: '先确认这是你的本地账户',
      body: `扫描识别为${scanIdentityEvidenceValue}，当前接收账户是${currentReceivingAccountName}。确认归属前，不开放正式导入。`,
    }
  }
  if (visualState === 'import_ready') {
    return {
      eyebrow: '归属检查已通过',
      title: '结果已就绪，请检查导入条件',
      body: '接收账户已确认，下一步检查识别结果是否完整。',
    }
  }
  return stateCopy
}
