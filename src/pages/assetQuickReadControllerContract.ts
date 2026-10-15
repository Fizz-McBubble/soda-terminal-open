import type { ReactNode } from 'react'
import type { AssetQuickReadBridgeClient, AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import type { AssetQuickReadState } from './AssetQuickReadEntry'
import {
  AssetQuickReadRequestError,
  type AssetDiagnosticReport,
} from '../assetQuickRead/diagnostics'

export type Bridge = Pick<
  AssetQuickReadBridgeClient,
  'connect' | 'start' | 'status' | 'cancel' | 'result'
>
export type AssetQuickReadWorkbenchView = {
  preparation: ReactNode
  task: ReactNode | null
  recovery: ReactNode | null
  state: AssetQuickReadState
  busy: boolean
  hasTask: boolean
  stageActive: boolean
  inspectFile: (file: File) => Promise<void>
}
export type AssetQuickReadControllerProps = {
  blocked?: boolean
  preparationCondensed?: boolean
  onViewAssets?: () => void
  riskNoticeHref?: string
  workbench?: (view: AssetQuickReadWorkbenchView) => ReactNode
  targetAccountId?: string
  targetAccountName?: string
  activeAccountId?: string
  onImported?: () => void
  onTaskStart?: () => void
  client?: Bridge
}
export const assetQuickReadErrorMessage = (error: unknown) =>
  error instanceof Error && !error.name.startsWith('Zod')
    ? error.message
    : '结果结构不符合当前资产快读合同，未写入账户。'
const connectionGuidance: Record<string, { problem: string; nextAction: string }> = {
  bridge_unavailable: {
    problem: '未能连接资产快读。',
    nextAction:
      '请确认工具已运行，并在浏览器的网站权限中允许本站访问本机设备后重试；仍失败时可查看诊断并反馈。',
  },
  bridge_incompatible: {
    problem: '资产快读版本不兼容。',
    nextAction: '请更新资产快读后重新连接。',
  },
  origin_not_allowed: {
    problem: '资产快读尚未允许当前站点连接。',
    nextAction: '请核对工具版本与当前页面地址后重新连接。',
  },
  session_invalid: {
    problem: '资产快读连接已失效。',
    nextAction: '请重新连接资产快读。',
  },
}
export const assetQuickReadConnectionGuidance = (code: string) =>
  Object.hasOwn(connectionGuidance, code) ? connectionGuidance[code] : undefined
export function assetQuickReadConnectionMessage(code: string) {
  const hint = assetQuickReadConnectionGuidance(code) ?? connectionGuidance.bridge_unavailable!
  return hint.problem + hint.nextAction
}
/** Only finite diagnostic codes choose copy. Raw exceptions can contain private
 * paths, server responses or browser details and never become connection copy. */
export const assetQuickReadConnectionErrorMessage = (error: unknown) =>
  assetQuickReadConnectionMessage(
    error instanceof AssetQuickReadRequestError ? error.diagnosticCode : 'bridge_unavailable',
  )
export const assetQuickReadConnectionStatus = (
  error: string,
  diagnostic: AssetDiagnosticReport | null,
) =>
  error &&
  diagnostic &&
  (diagnostic.stage === 'connection' || diagnostic.code === 'origin_not_allowed')
    ? assetQuickReadConnectionMessage(diagnostic.code)
    : ''
export const assetQuickReadJobActive = (job: AssetBridgeJob | null) =>
  job?.state === 'starting' || job?.state === 'capturing'
