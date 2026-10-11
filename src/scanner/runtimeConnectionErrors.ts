import { failedSnapshot } from './runtimeSnapshots'
import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'
import { sanitizeScanDiagnostic } from './diagnostics'

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

export function connectionFailure(
  error: unknown,
  context?: {
    step: 'identity' | 'pairing' | 'command' | 'events'
    reportId: string
    lastSnapshot?: ScannerAssistantSnapshot
    versions?: Record<string, string>
  },
): ScannerAssistantSnapshot {
  const base = connectionFailureMessage(error)
  if (!context) return base
  const previous = context.lastSnapshot
  const duringScan =
    previous && ['scanning', 'checking', 'awaiting_elevation'].includes(previous.state)
  const failure =
    error instanceof Error
      ? error.name === 'ScannerHelperTimeoutError' || error.message === 'helper_events_timeout'
        ? 'timeout'
        : isAuthenticationFailure(error) || error.message === 'helper_events_failed_401'
          ? 'authentication'
          : error.name === 'ScannerHelperCompatibilityError'
            ? 'compatibility'
            : error instanceof TypeError
              ? 'network'
              : error instanceof SyntaxError
                ? 'invalid_response'
                : /^helper_(?:request|events)_failed_\d{3}$/.test(error.message)
                  ? 'http'
                  : error.message === 'helper_events_disconnected'
                    ? 'disconnected'
                    : 'unknown'
      : 'unknown'
  const safe = sanitizeScanDiagnostic({
    schema: 1,
    reportId: context.reportId,
    release: 'local-development',
    outcome: 'failed',
    stage: 'connection',
    code: base.error?.diagnosticCode,
    versions: context.versions ?? {},
    counts: duringScan ? (previous.diagnostics?.counts ?? previous.progress) : {},
    durationMs: duringScan ? previous.diagnostics?.durationMs : null,
    environment: duringScan ? previous.diagnostics?.environment : {},
    evidence: {
      diagnosticSource: 'browser_connection',
      connectionStep: context.step,
      connectionFailure: failure,
    },
  })!
  return { ...base, diagnostics: { ...safe, outcome: 'failed' } }
}

function connectionFailureMessage(error: unknown): ScannerAssistantSnapshot {
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
