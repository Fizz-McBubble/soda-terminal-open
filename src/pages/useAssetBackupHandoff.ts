import { useCallback, useState } from 'react'
import { useLocalDataFileHandoff } from '../application/useLocalDataFileHandoff'

interface AssetBackupHandoffInput {
  knownIdentity: string | null | undefined
  currentAccountId: string | null | undefined
  blocked: boolean
}

/** Isolate scan-to-account backup handoff state while preserving account identity checks. */
export function useAssetBackupHandoff({
  knownIdentity,
  currentAccountId,
  blocked,
}: AssetBackupHandoffInput) {
  const [incomingBackup, setIncomingBackup] = useState<{
    file: File
    accountId?: string | null
  } | null>(null)

  const forwardDataFile = useLocalDataFileHandoff('account-backup', (file) =>
    setIncomingBackup((current) =>
      current?.file === file ? current : { file, accountId: knownIdentity },
    ),
  )

  if (incomingBackup && knownIdentity !== undefined) {
    if (incomingBackup.accountId === undefined) {
      setIncomingBackup({ ...incomingBackup, accountId: knownIdentity })
    } else if (incomingBackup.accountId !== knownIdentity) {
      setIncomingBackup(null)
    }
  }

  const deliverableBackupFile =
    currentAccountId !== undefined &&
    !blocked &&
    incomingBackup &&
    (incomingBackup.accountId === undefined || incomingBackup.accountId === currentAccountId)
      ? incomingBackup.file
      : null

  const clearIncomingBackup = useCallback(() => {
    setIncomingBackup(null)
  }, [])

  const markIncomingBackupHandled = useCallback(() => {
    setIncomingBackup((current) => (current?.file === deliverableBackupFile ? null : current))
  }, [deliverableBackupFile])

  const openScanFile = useCallback(
    (file: File) => {
      forwardDataFile(file, 'scan-result')
    },
    [forwardDataFile],
  )

  return {
    deliverableBackupFile,
    clearIncomingBackup,
    markIncomingBackupHandled,
    openScanFile,
  }
}
