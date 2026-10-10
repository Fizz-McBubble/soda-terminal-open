import { failedSnapshot } from './runtimeSnapshots'

export function isAuthenticationFailure(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === 'helper_request_failed_401' || error.message === 'helper_pairing_denied')
  )
}

export function isCompatibilityFailure(error: unknown) {
  return (
    error instanceof Error &&
    ['ScannerHelperCompatibilityError', 'ScannerHelperTimeoutError'].includes(error.name)
  )
}

export function connectionFailure(error: unknown) {
  if (error instanceof Error && error.message === 'helper_pairing_denied')
    return {
      ...failedSnapshot,
      error: {
        ...failedSnapshot.error!,
        userMessage: '画面扫描拒绝了此网站，请更新画面扫描后重新连接。',
        diagnosticCode: 'helper_pairing_denied',
      },
    }
  return isCompatibilityFailure(error)
    ? {
        ...failedSnapshot,
        error: {
          ...failedSnapshot.error!,
          userMessage: (error as Error).message,
          diagnosticCode:
            (error as Error).name === 'ScannerHelperTimeoutError'
              ? 'helper_unavailable'
              : 'helper_incompatible',
        },
      }
    : failedSnapshot
}
