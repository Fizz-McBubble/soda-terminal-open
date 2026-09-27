export function scanResultHandleSettingKey(accountId: string, batchId: string) {
  return `scanner-result-handle:${accountId}:${batchId}`
}

export function activeScannerResultBatchSettingKey(accountId: string) {
  return `scanner-active-result-batch:${accountId}`
}
