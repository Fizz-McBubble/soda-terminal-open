import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScannerAccountBackupReview } from './ScannerAccountBackupReview'

const mocks = vi.hoisted(() => ({ recognize: vi.fn(), restore: vi.fn(), independent: vi.fn() }))
vi.mock('../accounts/accountBackupRecognition', () => ({
  recognizeAccountBackupFile: mocks.recognize,
}))
vi.mock('../accounts/backup', () => ({
  restoreAccountBackup: mocks.restore,
  restoreAccountBackupIndependently: mocks.independent,
}))
vi.mock('../appHealthContext', () => ({ useAppHealth: () => ({ databaseStatus: 'ready' }) }))
vi.mock('../components/dataCenter/useDataCenterAccountState', () => ({
  useDataCenterAccountState: () => ({
    accounts: [
      { id: 'local-id', displayName: '合成账户', discs: 2, agents: 0, createdAt: '2026-01-01' },
    ],
  }),
}))

const counts = {
  driveDiscs: 3,
  discEvaluations: 1,
  scanBatches: 0,
  scanItems: 0,
  optimizationResults: 0,
  planningDrafts: 0,
  preferences: 1,
}
function recognition(identity = 'same_id') {
  const backup = {
    account: { id: identity === 'same_id' ? 'local-id' : 'backup-id', displayName: '合成账户' },
    exportedAt: '2026-10-01',
    counts,
    data: { roster: null },
  }
  return {
    kind: 'account_backup',
    input: { format: 'soda-terminal-account-backup' },
    targetAccountName: '合成账户',
    errors: [],
    risks: [],
    backupPreflight: { backup, identity },
  }
}
function file(format = 'soda-terminal-account-backup') {
  return {
    name: 'synthetic.json',
    size: 100,
    text: vi.fn().mockResolvedValue(JSON.stringify({ format })),
  } as unknown as File
}
function props(input: File = file()) {
  return {
    file: input,
    scopeKey: 'local-id:1',
    onClose: vi.fn(),
    onRestored: vi.fn(),
    onStateChange: vi.fn(),
  }
}
async function confirm() {
  fireEvent.click(await screen.findByRole('button', { name: '确认恢复范围' }))
  fireEvent.click(screen.getByRole('button', { name: '完整替换此账号' }))
}

describe('scanner single-account backup review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.recognize.mockResolvedValue(recognition())
    mocks.restore.mockResolvedValue(counts)
    mocks.independent.mockResolvedValue({
      counts,
      account: { id: 'synthetic-new-id', displayName: '独立合成副本' },
    })
    window.history.pushState({}, '', '/system/scanner')
  })

  it('inspects read-only on the scanner URL and requires the existing final confirmation', async () => {
    const input = props()
    render(<ScannerAccountBackupReview {...input} />)
    await screen.findByRole('button', { name: '确认恢复范围' })
    expect(mocks.restore).not.toHaveBeenCalled()
    expect(mocks.independent).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/system/scanner')
    fireEvent.click(screen.getByRole('button', { name: '确认恢复范围' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '完整替换此账号' }))
    await waitFor(() => expect(input.onRestored).toHaveBeenCalledOnce())
    expect(mocks.restore).toHaveBeenCalledWith(
      { format: 'soda-terminal-account-backup' },
      undefined,
      expect.any(Function),
    )
    expect(screen.getByText(/恢复完成：3 张正式驱动盘/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/system/scanner')
  })

  it('keeps same-name different-ID backups independent and names the real target', async () => {
    mocks.recognize.mockResolvedValue(recognition('same_name_different_id'))
    render(<ScannerAccountBackupReview {...props()} />)
    await screen.findByText(/新建独立账户/)
    fireEvent.click(screen.getByRole('button', { name: '确认恢复范围' }))
    fireEvent.change(screen.getByLabelText('恢复后的本地显示名称'), {
      target: { value: '独立合成副本' },
    })
    fireEvent.click(screen.getByRole('button', { name: '作为独立账号恢复' }))
    await waitFor(() => expect(mocks.independent).toHaveBeenCalledOnce())
    expect(mocks.independent).toHaveBeenCalledWith(
      expect.any(Object),
      { displayName: '独立合成副本' },
      undefined,
      expect.any(Function),
    )
    expect(mocks.restore).not.toHaveBeenCalled()
  })

  it.each(['soda-terminal-vault-backup', 'soda-terminal-backup', 'ScanData', 'arbitrary'])(
    'rejects unsupported format %s before recognition or restore',
    async (format) => {
      render(<ScannerAccountBackupReview {...props(file(format))} />)
      expect(await screen.findByRole('alert')).toHaveTextContent('只能恢复 Soda 单账户备份')
      expect(mocks.recognize).not.toHaveBeenCalled()
      expect(mocks.restore).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: '确认恢复范围' })).not.toBeInTheDocument()
    },
  )

  it('ignores late file reads after scope change', async () => {
    let finish!: (value: string) => void
    const input = props({
      name: 'late.json',
      text: () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    } as File)
    const view = render(<ScannerAccountBackupReview {...input} />)
    view.rerender(
      <ScannerAccountBackupReview {...input} file={file('arbitrary')} scopeKey="different:2" />,
    )
    await screen.findByRole('alert')
    await act(async () => {
      finish(JSON.stringify({ format: 'soda-terminal-account-backup' }))
    })
    expect(mocks.recognize).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '确认恢复范围' })).not.toBeInTheDocument()
  })

  it('ignores late recognized preflight and discards an open confirmation on scope change', async () => {
    let finish!: (value: ReturnType<typeof recognition>) => void
    mocks.recognize.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const input = props()
    const view = render(<ScannerAccountBackupReview {...input} />)
    await waitFor(() => expect(mocks.recognize).toHaveBeenCalledOnce())
    view.rerender(
      <ScannerAccountBackupReview {...input} file={file('arbitrary')} scopeKey="different:2" />,
    )
    await screen.findByRole('alert')
    await act(async () => {
      finish(recognition())
    })
    expect(screen.queryByRole('button', { name: '确认恢复范围' })).not.toBeInTheDocument()
    view.rerender(<ScannerAccountBackupReview {...input} scopeKey="local-id:3" />)
    fireEvent.click(await screen.findByRole('button', { name: '确认恢复范围' }))
    view.rerender(<ScannerAccountBackupReview {...input} scopeKey="other:4" />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.restore).not.toHaveBeenCalled()
  })

  it('rechecks identity and requires another confirmation when local identity changed', async () => {
    mocks.recognize
      .mockResolvedValueOnce(recognition())
      .mockResolvedValue(recognition('same_name_different_id'))
    render(<ScannerAccountBackupReview {...props()} />)
    await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('本机账户身份已变化')
    expect(mocks.restore).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认恢复范围' }))
    fireEvent.click(screen.getByRole('button', { name: '作为独立账号恢复' }))
    await waitFor(() => expect(mocks.independent).toHaveBeenCalledOnce())
  })

  it('closes final confirmation after failure and requires a new explicit confirmation', async () => {
    mocks.restore.mockRejectedValueOnce(new Error('合成事务失败'))
    render(<ScannerAccountBackupReview {...props()} />)
    await confirm()
    expect(await screen.findByRole('alert')).toHaveTextContent('再次明确确认')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.restore).toHaveBeenCalledOnce()
    await confirm()
    await screen.findByText(/恢复完成/)
    expect(mocks.restore).toHaveBeenCalledTimes(2)
  })

  it('locks duplicate restores and supplies a beforeCommit rollback guard when scope is invalidated', async () => {
    let finish!: () => void
    mocks.restore.mockImplementation(
      (_input, _db, beforeCommit: () => void) =>
        new Promise((resolve, reject) => {
          finish = () => {
            try {
              beforeCommit()
              resolve(counts)
            } catch (error) {
              reject(error)
            }
          }
        }),
    )
    const input = props()
    const view = render(<ScannerAccountBackupReview {...input} />)
    await confirm()
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: '关闭检查' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '确认恢复范围' })).toBeDisabled()
    view.unmount()
    await act(async () => {
      finish()
    })
    expect(input.onRestored).not.toHaveBeenCalled()
  })

  it('reports malformed JSON with an actionable retry', async () => {
    render(
      <ScannerAccountBackupReview
        {...props({ name: 'broken.json', text: async () => '{' } as File)}
      />,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('本地账户数据未改动')
    expect(mocks.restore).not.toHaveBeenCalled()
  })
})
