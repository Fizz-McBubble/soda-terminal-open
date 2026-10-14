import type { ReactNode } from 'react'
import type { AssetQuickReadBridgeClient, AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import type { AssetQuickReadState } from './AssetQuickReadEntry'

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
export const assetQuickReadJobActive = (job: AssetBridgeJob | null) =>
  job?.state === 'starting' || job?.state === 'capturing'
