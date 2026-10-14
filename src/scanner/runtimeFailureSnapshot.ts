import { connectionFailure } from './runtimeConnectionErrors'
import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'

export function presentRuntimeConnectionFailure(
  error: unknown,
  state: {
    step: 'identity' | 'pairing' | 'command' | 'events'
    connectionAttemptId: string
    lastSnapshot?: ScannerAssistantSnapshot
    nativeHelperVersion: string | null
    nativeInstallerVersion: string | null
  },
) {
  return connectionFailure(error, {
    step: state.step,
    reportId: state.connectionAttemptId,
    lastSnapshot: state.lastSnapshot,
    versions: {
      ...state.lastSnapshot?.connectedVersions,
      ...(state.nativeHelperVersion ? { helper: state.nativeHelperVersion, protocol: '5' } : {}),
      ...(state.nativeInstallerVersion ? { installer: state.nativeInstallerVersion } : {}),
    },
  })
}
