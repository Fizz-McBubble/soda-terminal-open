import type { ScannerAssistantSnapshot, useScannerAssistantRuntime } from '../scanner/runtime'
import type { ScannerAccounts } from './ScannerAccountHydrationGate'
import type { CompletedScannerImport } from './scannerAssistantStatePresentation'

export type ScannerTargetBindingOptions = {
  account: {
    accountState: ScannerAccounts
    refreshAccounts: () => void
    selectedAccount: ScannerAccounts['accounts'][number] | undefined
    newAccountName: string
    selectedJson: File | null
  }
  runtime: {
    snapshot: ScannerAssistantSnapshot
    commands: ReturnType<typeof useScannerAssistantRuntime>['commands']
    runScannerAction: (action: () => void | Promise<void>) => Promise<void>
    stageFocusRequestedRef: { current: boolean }
  }
  update: {
    setSelectedAccountId: (id: string) => void
    setNewAccountName: (name: string) => void
    setAccountMessage: (msg: string) => void
    setCompletedImport: (val: CompletedScannerImport | null) => void
    setPreparingAnotherScan: (val: boolean) => void
    setInlineImportOpen: (val: boolean) => void
  }
}
