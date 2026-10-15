import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AccountWorkspace } from './Account'
import { assetGoldenProps } from './AssetMaintenanceGolden.testFixtures'

it('drops a backup into the existing read-only review without restoring account data', async () => {
  const props = assetGoldenProps([])
  const file = new File(['{}'], 'synthetic-backup.json', { type: 'application/json' })
  const onInspectBackup = vi.fn().mockResolvedValue({
    fileName: file.name,
    accountName: '合成备份账户',
    exportedAt: '2026-10-10T00:00:00Z',
    scope: '单账户',
    payload: {},
  })
  render(<AccountWorkspace props={{ ...props, onInspectBackup }} />)
  await act(async () =>
    fireEvent.drop(screen.getByRole('region', { name: '选择或拖入本机备份' }), {
      dataTransfer: { files: [file], types: ['Files'] },
    }),
  )
  expect(onInspectBackup).toHaveBeenCalledExactlyOnceWith(file)
  expect(props.onRestore).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toHaveTextContent('合成备份账户')
})

it('rejects multiple dropped backups without inspecting or restoring either file', () => {
  const props = assetGoldenProps([])
  render(<AccountWorkspace props={props} />)
  fireEvent.drop(screen.getByRole('region', { name: '选择或拖入本机备份' }), {
    dataTransfer: {
      files: [new File(['{}'], 'a.json'), new File(['{}'], 'b.json')],
      types: ['Files'],
    },
  })
  expect(props.onInspectBackup).not.toHaveBeenCalled()
  expect(props.onRestore).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('请一次拖入一个 JSON 文件')
})

it('uses the same dialog for a separately named independent restore', async () => {
  const props = assetGoldenProps([])
  vi.mocked(props.onRestore).mockResolvedValue(undefined)
  const preview = {
    fileName: 'independent.json',
    accountName: '同名合成账户',
    exportedAt: '2026-10-10T00:00:00Z',
    scope: '完整单账户',
    payload: {},
    identity: 'same_name_different_id' as const,
    restoreDisplayName: '同名合成账户（恢复副本）',
  }
  const onInspectBackup = vi.fn().mockResolvedValue(preview)
  render(<AccountWorkspace props={{ ...props, onInspectBackup }} />)
  await act(async () =>
    fireEvent.drop(screen.getByRole('region', { name: '选择或拖入本机备份' }), {
      dataTransfer: { files: [new File(['{}'], preview.fileName)], types: ['Files'] },
    }),
  )
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('dialog')).toHaveTextContent('现有同名账户不会被合并或覆盖')
  fireEvent.change(screen.getByLabelText('恢复后的本地显示名称'), { target: { value: '独立副本' } })
  fireEvent.click(screen.getByRole('button', { name: '作为独立账号恢复' }))
  expect(props.onRestore).toHaveBeenCalledWith(
    { ...preview, restoreDisplayName: '独立副本' },
    expect.any(Function),
  )
})

it('invalidates a pending restore commit after its workspace unmounts', async () => {
  const props = assetGoldenProps([])
  let guard!: () => void
  let finish!: () => void
  const onRestore = vi.fn((_preview, beforeCommit?: () => void) => {
    guard = beforeCommit!
    return new Promise<void>((resolve) => {
      finish = resolve
    })
  })
  const onInspectBackup = vi.fn().mockResolvedValue({
    fileName: 'guard.json',
    accountName: '合成账户',
    exportedAt: '2026-10-10',
    scope: '单账户',
    payload: {},
  })
  const view = render(<AccountWorkspace props={{ ...props, onRestore, onInspectBackup }} />)
  await act(async () =>
    fireEvent.drop(screen.getByRole('region', { name: '选择或拖入本机备份' }), {
      dataTransfer: { files: [new File(['{}'], 'guard.json')], types: ['Files'] },
    }),
  )
  const button = screen.getByRole('button', { name: '恢复这份备份' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(onRestore).toHaveBeenCalledOnce()
  expect(() => guard()).not.toThrow()
  view.unmount()
  expect(() => guard()).toThrow('本次恢复已失效')
  await act(async () => finish())
})
