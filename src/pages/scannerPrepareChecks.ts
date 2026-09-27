import { type ScannerAssistantSnapshot } from '../scanner/runtime'
import { type PrepareCheck, type PrepareCheckStatus } from './scannerAssistantPresentation'

function checkStatus(
  snapshot: ScannerAssistantSnapshot,
  ready: boolean,
  requiresPrepareEvidence = true,
): PrepareCheckStatus {
  if (snapshot.state === 'unchecked') return 'unchecked'
  if (
    snapshot.state === 'connecting' ||
    snapshot.state === 'checking' ||
    snapshot.state === 'awaiting_elevation'
  )
    return 'checking'
  if (requiresPrepareEvidence && !snapshot.prepare && snapshot.state === 'ready') return 'unchecked'
  return ready ? 'ready' : 'blocked'
}

export function createPrepareChecks(snapshot: ScannerAssistantSnapshot): PrepareCheck[] {
  const errors = snapshot.prepare?.errors ?? []
  const clientWidth = snapshot.prepare?.geometry?.client?.width
  const clientHeight = snapshot.prepare?.geometry?.client?.height
  const observedTotal = snapshot.prepare?.observedTotal
  const playerChecks = snapshot.prepare?.playerChecks
  const distributionReady = snapshot.distribution?.state === 'ready'
  const gameFound =
    Boolean(snapshot.prepare) &&
    !errors.includes('game_window_not_found') &&
    snapshot.readiness.helperConnected
  const foregroundReady =
    gameFound &&
    !errors.includes('game_window_not_foreground') &&
    !errors.includes('window_geometry_changed')
  const clientReady = clientWidth === 1920 && clientHeight === 1080
  const warehouseReady =
    Boolean(snapshot.prepare) &&
    observedTotal !== null &&
    observedTotal !== undefined &&
    !errors.includes('warehouse_page_not_recognized')
  const warehouseCountReadable =
    observedTotal !== null &&
    observedTotal !== undefined &&
    observedTotal >= 0 &&
    playerChecks?.inventoryCapacity === 3000
  const warehouseTaskReady =
    foregroundReady && clientReady && warehouseReady && warehouseCountReadable
  const warehouseTaskResult = !foregroundReady
    ? '还没有找到可用的驱动仓库画面'
    : !clientReady
      ? clientWidth && clientHeight
        ? `当前画面为 ${clientWidth} × ${clientHeight}`
        : '还没有读到游戏画面尺寸'
      : !warehouseReady
        ? '当前没有显示驱动仓库完整列表'
        : !warehouseCountReadable
          ? '还没有读到当前仓库数量'
          : `驱动仓库已打开 · ${observedTotal} / 3000`

  return [
    {
      id: 'warehouse-ready',
      label: '启动绝区零',
      status: checkStatus(snapshot, warehouseTaskReady),
      instruction: '使用 1920 × 1080 无边框窗口打开“驱动仓库”完整列表',
      feedback: warehouseTaskResult,
    },
    {
      id: 'filters',
      label: '清除筛选',
      status: checkStatus(snapshot, playerChecks?.filtersClear === true),
      instruction: '让仓库显示全部驱动盘',
      feedback:
        playerChecks?.filtersClear === true
          ? '已确认没有筛选条件'
          : playerChecks?.filtersClear === false
            ? '仍有筛选条件'
            : '还没有确认筛选是否清除',
    },
    {
      id: 'overlay',
      label: '关闭遮挡',
      status: checkStatus(snapshot, playerChecks?.overlayClear === true),
      instruction: '关闭弹窗、筛选面板和其他遮挡',
      feedback:
        playerChecks?.overlayClear === true
          ? '已确认列表完整可见'
          : playerChecks?.overlayClear === false
            ? '还有弹窗或面板挡住列表'
            : '还没有确认列表是否被遮挡',
    },
    {
      id: 'local-scanner',
      label: '准备本机扫描',
      status: checkStatus(snapshot, snapshot.readiness.helperConnected && distributionReady, false),
      instruction: snapshot.readiness.helperConnected
        ? distributionReady
          ? '扫描助手已连接'
          : '扫描组件未就绪，修复后重新连接'
        : '扫描助手未就绪，可重新连接',
      feedback:
        snapshot.readiness.helperConnected && distributionReady
          ? '扫描组件已准备好'
          : snapshot.readiness.helperConnected
            ? '扫描组件未通过检查'
            : '尚未连接扫描助手',
    },
  ]
}
