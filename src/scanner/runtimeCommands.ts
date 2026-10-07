export type ScannerAssistantCommands = {
  openHelper(launchImmediately?: boolean): Promise<void>
  retryConnection(): Promise<void>
  startScan(): Promise<void>
  safeStop(): Promise<void>
  revokePairing(): Promise<void>
  requestResultFile(signal?: AbortSignal): Promise<{
    resultFileHandle: string
    resultStatus: string
    accountWriteEnabled: false
  }>
  requestResultStaging(resultFileHandle: string, signal?: AbortSignal): Promise<unknown>
  requestResultEvidence(
    resultFileHandle: string,
    itemId: string,
  ): Promise<{
    availability: 'available'
    detailSrc: string
    cardSrc: string
    visualDetailHash: string
    revoke(): void
  }>
}
