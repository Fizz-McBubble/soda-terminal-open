import { withScannerRequestDeadline } from './requestDeadline'

/** Read-only deadline: cancellation settles even if a transport ignores its signal. */
export async function readScannerResultWithDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = 15000,
): Promise<T> {
  return withScannerRequestDeadline(operation, signal, timeoutMs, () => {
    const error = new Error('扫描结果读取超时，请重试或选择扫描结果文件。')
    error.name = 'ScannerResultTimeoutError'
    return error
  })
}
