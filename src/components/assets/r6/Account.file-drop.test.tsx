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
