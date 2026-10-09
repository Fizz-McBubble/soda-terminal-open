import { useLocalDataFileHandoff } from '../application/useLocalDataFileHandoff'

export function useScannerDataFileHandoff(state: string, onReceive: (file: File) => void) {
  return useLocalDataFileHandoff(
    'scan-result',
    onReceive,
    !['checking', 'awaiting_elevation', 'scanning', 'paused'].includes(state),
  )
}
