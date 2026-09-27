import type { Dispatch, SetStateAction } from 'react'
import type { ScannerAssistantCommands, ScannerAssistantSnapshot } from './runtime'

/** Local preview actions change only the rendered snapshot and never start the native scanner. */
export function createDevelopmentScannerCommands(
  setSnapshot: Dispatch<SetStateAction<ScannerAssistantSnapshot>>,
): ScannerAssistantCommands {
  return {
    async openHelper() {
      setSnapshot((current) => ({ ...current, state: 'connecting', error: undefined }))
    },
    async retryConnection() {
      setSnapshot((current) => ({
        ...current,
        state: 'connecting',
        error: undefined,
      }))
    },
    async startScan() {
      setSnapshot((current) => ({
        ...current,
        state: 'scanning',
        progress: {
          processed: 0,
          total: current.prepare?.observedTotal ?? null,
          stageLabel: '正在启动扫描',
          etaSeconds: null,
        },
      }))
    },
    async safeStop() {
      setSnapshot((current) => ({
        ...current,
        state: 'ready',
        progress: undefined,
      }))
    },
    async revokePairing() {},
    async requestResultFile() {
      return {
        resultFileHandle: 'dev-readonly-staging.json',
        resultStatus: 'needs_review',
        accountWriteEnabled: false,
      }
    },
    async requestResultStaging() {
      throw new Error('开发态样板没有本机扫描结果。')
    },
    async requestResultEvidence() {
      throw new Error('开发态样板没有本机盘面证据。')
    },
  }
}
