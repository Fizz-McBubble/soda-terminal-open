import { useEffect, useMemo, useState } from 'react'
import { createDevelopmentScannerCommands } from './runtimeDevelopmentCommands'
import { connectingSnapshot, createDevSnapshot } from './runtimeSnapshots'

import { createScannerAssistantRuntime } from './runtime'
import type { ScannerAssistantSnapshot } from './runtimeSnapshotTypes'

export function useScannerAssistantRuntime() {
  const runtime = useMemo(
    () =>
      createScannerAssistantRuntime({
        deferInitialConnection: true,
      }),
    [],
  )
  const devState = useMemo(() => {
    if (!import.meta.env.DEV) return null
    const params = new URLSearchParams(window.location.search)
    return createDevSnapshot(params.get('prepareState') ?? params.get('assistantState'))
  }, [])
  const [snapshot, setSnapshot] = useState<ScannerAssistantSnapshot>(
    () => devState ?? connectingSnapshot,
  )

  useEffect(() => {
    if (devState) return
    return runtime.subscribe(setSnapshot)
  }, [devState, runtime])

  const devCommands = useMemo(() => createDevelopmentScannerCommands(setSnapshot), [])

  return { snapshot, commands: devState ? devCommands : runtime.commands }
}
