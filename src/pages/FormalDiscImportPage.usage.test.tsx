import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  current: null as unknown,
  stage: vi.fn(),
  preflight: vi.fn(),
  arm: vi.fn(),
  replace: vi.fn(),
  usageBegin: vi.fn(),
  usageOutcome: vi.fn(),
}))
vi.mock('../usageStatistics/client', () => ({
  beginUsageOperation: (action: string) => {
    mocks.usageBegin(action)
    let finished = false
    return (outcome: string) => {
      if (finished) return
      finished = true
      mocks.usageOutcome(outcome)
    }
  },
}))

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => mocks.current }))
vi.mock('../db/databaseCore', () => ({ database: {} }))
vi.mock('../db/accountScanImport', () => ({
  stageAccountPaddleScanImport: mocks.stage,
  armAccountScanReviewImport: mocks.arm,
  replaceReadyAccountScanStaging: mocks.replace,
  preflightAccountScanReviewBatch: mocks.preflight,
}))

import { FormalDiscImportPage } from './FormalDiscImportPage'
import { createSyntheticFormalImportCurrent as currentState } from './formalDiscImportTestFixture'
describe('FormalDiscImportPage usage', () => {
  it('keeps a committed import successful when clearing browser storage or notifying the parent fails', async () => {
    const user = userEvent.setup()
    const onError = vi.fn()
    const onImportSuccess = vi.fn(() => {
      throw new Error('presentation failed')
    })
    render(
      <BrowserRouter>
        <FormalDiscImportPage
          embedded
          compact
          onError={onError}
          onImportSuccess={onImportSuccess}
        />
      </BrowserRouter>,
    )
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage disabled', 'SecurityError')
    })
    try {
      await user.click(screen.getByRole('button', { name: '确认更新驱动盘' }))
      expect(
        await screen.findByRole('heading', { name: '已更新 343 张驱动盘' }),
      ).toBeInTheDocument()
      expect(mocks.replace).toHaveBeenCalledTimes(1)
      expect(onImportSuccess).toHaveBeenCalledWith(343)
      expect(onError).not.toHaveBeenCalled()
      expect(screen.queryByText(/更新失败/)).not.toBeInTheDocument()
    } finally {
      remove.mockRestore()
    }
  })

  it('does not record opening and cancelling the confirmation dialog', () => {
    render(
      <BrowserRouter>
        <FormalDiscImportPage />
      </BrowserRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '查看更新确认' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(mocks.usageBegin).not.toHaveBeenCalled()
    expect(mocks.usageOutcome).not.toHaveBeenCalled()
  })

  it('does not record an imported completion callback replayed on mount', async () => {
    const state = currentState()
    mocks.current = {
      ...state,
      discs: 343,
      summary: { ...state.summary, imported: 343 },
      batch: {
        ...state.batch,
        importHistory: [{ action: 'imported', importedCount: 343, skippedCount: 0 }],
      },
    }
    const callback = vi.fn()
    render(
      <BrowserRouter>
        <FormalDiscImportPage embedded onImportSuccess={callback} />
      </BrowserRouter>,
    )
    await waitFor(() => expect(callback).toHaveBeenCalledWith(343))
    expect(mocks.usageBegin).not.toHaveBeenCalled()
    expect(mocks.usageOutcome).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    window.history.pushState({}, '', '/system/data/import-discs')
    mocks.current = currentState()
    mocks.stage.mockReset()
    mocks.preflight.mockReset()
    mocks.arm.mockReset()
    mocks.replace.mockReset()
    mocks.usageBegin.mockClear()
    mocks.usageOutcome.mockClear()
    mocks.arm.mockResolvedValue(undefined)
    mocks.replace.mockResolvedValue({ imported: 343, previous: 0, preservedMetadata: 343 })
  })

  it('reports successful persistence even when the following completion callback fails', async () => {
    const callback = vi.fn(() => {
      throw new Error('completion refresh failed')
    })
    render(
      <BrowserRouter>
        <FormalDiscImportPage embedded compact onImportSuccess={callback} />
      </BrowserRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '确认更新驱动盘' }))
    await waitFor(() => expect(callback).toHaveBeenCalledOnce())
    expect(mocks.usageBegin.mock.calls).toEqual([['disc_import']])
    expect(mocks.usageOutcome.mock.calls).toEqual([['success']])
  })

  it('claims only one import when confirmation is clicked twice before persistence resolves', async () => {
    let resolveImport!: (value: { imported: number }) => void
    mocks.replace.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve
        }),
    )
    render(
      <BrowserRouter>
        <FormalDiscImportPage embedded compact />
      </BrowserRouter>,
    )
    const confirm = screen.getByRole('button', { name: '确认更新驱动盘' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledOnce())
    expect(mocks.usageBegin).toHaveBeenCalledOnce()
    resolveImport({ imported: 343 })
    await waitFor(() => expect(mocks.usageOutcome.mock.calls).toEqual([['success']]))
  })
})
