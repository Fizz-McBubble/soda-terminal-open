import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { createAccount, setActiveAccount } from '../accounts/repository'
import { database } from '../db/database'
import { baseScannerSnapshot as baseSnapshot } from './scannerAssistantTestFixture'
import { readLastScanDiagnostic } from '../scanner/scanFeedback'
import {
  createScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import {
  createReadyScannerStaging,
  type createScannerRuntimeCommands,
} from './scannerAssistantPageTestSupport'

export function registerScannerRecoveryTests({
  App,
  runtimeMock,
  setRuntimeState,
}: {
  App: ComponentType
  runtimeMock: {
    snapshot: Record<string, unknown>
    commands: ReturnType<typeof createScannerRuntimeCommands>
  }
  setRuntimeState: (state: string) => void
}) {
  it('offers updating a connected old Helper and prevents starting another scan', async () => {
    const account = await createAccount('主账号', database, { id: 'account-main' })
    await setActiveAccount(account.id, database)
    setRuntimeState('ready')
    runtimeMock.snapshot = {
      ...runtimeMock.snapshot,
      distribution: {
        ...baseSnapshot.distribution,
        state: 'update_available',
        action: 'update',
        message: '请更新扫描助手后再扫描。',
      },
    }
    render(<App />)
    await screen.findByRole('status', { name: '本次扫描保存到' })
    expect(screen.getByRole('button', { name: '更新扫描助手' })).toBeVisible()
    expect(screen.getByRole('button', { name: '开始扫描' })).toBeDisabled()
    expect(screen.getByText('请更新扫描助手后再扫描')).toBeInTheDocument()
    expect(runtimeMock.commands.startScan).not.toHaveBeenCalled()
  })

  it('offers updating and blocks another start when the connected Helper becomes outdated', async () => {
    const account = await createAccount('主账号', database, { id: 'account-main' })
    await setActiveAccount(account.id, database)
    setRuntimeState('ready')
    const error = new Error('请更新扫描助手后再扫描。')
    error.name = 'ScannerHelperCompatibilityError'
    runtimeMock.commands.startScan.mockRejectedValueOnce(error)
    render(<App />)
    await screen.findByRole('status', { name: '本次扫描保存到' })
    const start = screen.getByRole('button', { name: '开始扫描' })
    await waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    await screen.findByRole('button', { name: '更新扫描助手' })
    expect(start).toBeDisabled()
    expect(await screen.findByRole('alert')).toHaveTextContent('请更新扫描助手后再扫描')
    expect(runtimeMock.commands.startScan).toHaveBeenCalledTimes(1)
  })

  it('hides JSON recovery while a scan is running', async () => {
    setRuntimeState('scanning')
    render(<App />)
    await screen.findByRole('button', { name: '停止本次扫描' })
    expect(screen.queryByLabelText('选择本机文件（JSON）')).not.toBeInTheDocument()
  })
  it.each([500, 401])(
    'recovers a completed result HTTP %s without exposing raw helper errors',
    async (status) => {
      const account = await createAccount('恢复账户', database, { id: 'account-recovery-account' })
      await setActiveAccount(account.id, database)
      saveScannerTargetAccountBinding(
        createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
      )
      setRuntimeState('completed')
      runtimeMock.commands.requestResultFile.mockRejectedValueOnce(
        new Error(`helper_request_failed_${status}`),
      )
      render(<App />)
      fireEvent.click(await screen.findByRole('button', { name: '检查需确认的记录' }))
      expect(await screen.findByText(/暂时无法读取本次扫描结果。请重试/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '检查需确认的记录' })).toBeEnabled()
      expect(screen.getByLabelText('选择本机文件（JSON）')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
      await waitFor(() => expect(readLastScanDiagnostic()?.code).toBe('scan_result_read_failed'))
      expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
      expect(screen.getByText(/仅在点击时发送，不含账户和驱动盘资料/)).toBeVisible()
      expect(screen.queryByText(`helper_request_failed_${status}`)).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.count()).toBe(0)
      expect(await database.accountScanImportBatches.count()).toBe(0)
    },
  )

  it('bounds a pending result read and ignores its late response before staging', async () => {
    const account = await createAccount('超时恢复账户', database, { id: 'account-timeout-account' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    setRuntimeState('completed')
    let resolveResult!: (
      value: Awaited<ReturnType<typeof runtimeMock.commands.requestResultFile>>,
    ) => void
    runtimeMock.commands.requestResultFile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResult = resolve
        }),
    )
    render(<App />)
    const trigger = await screen.findByRole('button', { name: '检查需确认的记录' })
    vi.useFakeTimers()
    try {
      fireEvent.click(trigger)
      expect(screen.getByRole('button', { name: '取消读取并返回准备' })).toBeEnabled()
      await act(() => vi.advanceTimersByTimeAsync(15001))
      expect(screen.getByText(/扫描结果读取超时，请重试/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '检查需确认的记录' })).toBeEnabled()
      expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
      expect(readLastScanDiagnostic()?.code).toBe('scan_result_timeout')
      expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
      await act(async () =>
        resolveResult({
          resultFileHandle: 'local-staging.json',
          resultStatus: 'needs_review',
          accountWriteEnabled: false,
        }),
      )
      expect(runtimeMock.commands.requestResultStaging).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('cancels a pending staging read and prevents its late data entering the next scan', async () => {
    const account = await createAccount('取消恢复账户', database, { id: 'account-cancel-account' })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    setRuntimeState('completed')
    let resolveStaging!: (
      value: Awaited<ReturnType<typeof runtimeMock.commands.requestResultStaging>>,
    ) => void
    runtimeMock.commands.requestResultStaging.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStaging = resolve
        }),
    )
    const rendered = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '检查需确认的记录' }))
    await waitFor(() => expect(runtimeMock.commands.requestResultStaging).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '取消读取并返回准备' }))
    expect(
      await screen.findByRole('heading', { name: '确认账户，然后开始本地扫描' }),
    ).toBeInTheDocument()
    setRuntimeState('scanning')
    await setActiveAccount(account.id, database)
    rendered.rerender(<App />)
    await act(async () => resolveStaging(createReadyScannerStaging()))
    expect(await screen.findByRole('heading', { name: '正在读取游戏中的资产' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认更新驱动盘' })).not.toBeInTheDocument()
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('shows formal import feedback while a failed database write preserves the account warehouse', async () => {
    const account = await createAccount('导入失败恢复账户', database, {
      id: 'account-import-failure-feedback',
    })
    await setActiveAccount(account.id, database)
    saveScannerTargetAccountBinding(
      createScannerTargetAccountBinding({ account, baselineDiscCount: 0 }),
    )
    setRuntimeState('completed')
    runtimeMock.commands.requestResultStaging.mockResolvedValueOnce(createReadyScannerStaging())
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '检查需确认的记录' }))
    const confirm = await screen.findByRole('button', { name: '确认更新驱动盘' })
    await waitFor(() => expect(confirm).toBeEnabled())
    const before = await database.accountDriveDiscs.toArray()
    const profilesBefore = await database.accounts.toArray()
    const failWrite = () => {
      throw new Error('synthetic write rejected')
    }
    database.accountDriveDiscs.hook('creating', failWrite)
    try {
      fireEvent.click(confirm)
      expect(await screen.findByRole('button', { name: '反馈此问题' })).toBeEnabled()
      expect(readLastScanDiagnostic()?.code).toBe('scan_import_failed')
      expect(JSON.stringify(readLastScanDiagnostic())).not.toContain('synthetic write rejected')
      expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before)
      expect(await database.accounts.toArray()).toEqual(profilesBefore)
      expect(localStorage.getItem('soda.scanner.completedImport')).toBeNull()
      expect(screen.getByRole('button', { name: '返回准备，重新扫描' })).toBeEnabled()
    } finally {
      database.accountDriveDiscs.hook('creating').unsubscribe(failWrite)
    }
  })
}
