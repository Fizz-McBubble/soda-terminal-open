import { useEffect, useRef, type RefObject } from 'react'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import type { HandoffState } from './scannerAssistantPresentation'

export function useScannerJsonReadIdentity({
  snapshot,
  effectiveSelectedAccountId,
  filePendingRef,
  setFilePending,
  setSelectedJson,
  setTaskSource,
  setHandoffState,
}: {
  snapshot: ScannerAssistantSnapshot
  effectiveSelectedAccountId: string
  filePendingRef: RefObject<boolean>
  setFilePending: (pending: boolean) => void
  setSelectedJson: (file: File | null) => void
  setTaskSource: (source: 'scanner' | 'scan-file' | 'quick-read' | 'backup') => void
  setHandoffState: (state: HandoffState) => void
}) {
  const jsonReadRef = useRef(0)
  const fileReadMountedRef = useRef(false)
  useEffect(() => {
    fileReadMountedRef.current = true
    return () => {
      fileReadMountedRef.current = false
    }
  }, [])
  const jsonTargetRef = useRef(effectiveSelectedAccountId)
  const jsonRuntimeIdentityRef = useRef(
    JSON.stringify([
      snapshot.state,
      snapshot.diagnostics?.reportId,
      snapshot.summary?.resultFileHandle,
    ]),
  )
  useEffect(() => {
    const identity = JSON.stringify([
      snapshot.state,
      snapshot.diagnostics?.reportId,
      snapshot.summary?.resultFileHandle,
    ])
    if (identity !== jsonRuntimeIdentityRef.current) {
      jsonReadRef.current += 1
      if (filePendingRef.current) {
        filePendingRef.current = false
        setFilePending(false)
        setSelectedJson(null)
        setHandoffState({ status: 'idle' })
      }
    }
    jsonRuntimeIdentityRef.current = identity
  }, [
    snapshot.state,
    snapshot.diagnostics?.reportId,
    snapshot.summary?.resultFileHandle,
    setHandoffState,
    filePendingRef,
    setFilePending,
    setSelectedJson,
  ])
  useEffect(() => {
    const previous = jsonTargetRef.current
    jsonTargetRef.current = effectiveSelectedAccountId
    if (previous && previous !== effectiveSelectedAccountId && filePendingRef.current) {
      jsonReadRef.current += 1
      filePendingRef.current = false
      setFilePending(false)
      setTaskSource('scan-file')
      setHandoffState({
        status: 'error',
        message: '目标账户已变化，请重新选择文件。账户资产尚未更新。',
        issueCode: 'scan_file_invalid',
      })
    }
  }, [effectiveSelectedAccountId, setHandoffState, filePendingRef, setFilePending, setTaskSource])

  return { jsonReadRef, fileReadMountedRef }
}
