import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useDataCenterFileOperations } from './useDataCenterFileOperations'

const recognize = vi.hoisted(() => vi.fn())
vi.mock('../../accounts/dataCenter', () => ({
  recognizeDataCenterFile: recognize,
  importRecognizedScanDataToActiveAccount: vi.fn(),
}))
type Props = Parameters<typeof useDataCenterFileOperations>[0]
function props(id: string): Props {
  return {
    accountState: { active: { id, displayName: id } } as Props['accountState'],
    data: { driveDiscSets: [] } as unknown as Props['data'],
    discData: { rules: [], dataVersion: 'isolated' } as unknown as Props['discData'],
    setBusy: vi.fn(),
    setMessage: vi.fn(),
    setRevision: vi.fn(),
  }
}
it.each(['account', 'reset', 'new-file'] as const)(
  'ignores a late file preflight after %s',
  async (change) => {
    let finish!: (value: unknown) => void
    recognize.mockReset().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    recognize.mockResolvedValue({ kind: 'unknown', label: 'new', errors: [] })
    const view = renderHook(useDataCenterFileOperations, { initialProps: props('isolated-a') })
    const file = { name: 'old.json', size: 2, text: async () => '{}' } as File
    let pending!: Promise<void>
    await act(async () => {
      pending = view.result.current.inspectFile(file)
      await Promise.resolve()
    })
    expect(recognize).toHaveBeenCalledOnce()
    if (change === 'account') view.rerender(props('isolated-b'))
    else if (change === 'reset')
      act(() =>
        view.result.current.setFileState({
          phase: 'idle',
          fileName: '',
          fileSize: 0,
          recognition: null,
          success: null,
        }),
      )
    else
      await act(async () => {
        await view.result.current.inspectFile({ ...file, name: 'new.json' } as File)
      })
    await act(async () => {
      finish({ kind: 'unknown', label: 'old', errors: [] })
      await pending
    })
    expect(view.result.current.fileState.recognition?.label).not.toBe('old')
    expect(view.result.current.fileState.fileName).toBe(
      change === 'new-file' ? 'new.json' : change === 'account' ? null : '',
    )
  },
)
