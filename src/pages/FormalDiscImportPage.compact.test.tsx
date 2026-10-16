import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  current: null as unknown,
  preflight: vi.fn(),
  arm: vi.fn(),
  replace: vi.fn(),
}))
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => mocks.current }))
vi.mock('../db/databaseCore', () => ({ database: {} }))
vi.mock('../db/accountScanImport', () => ({
  stageAccountPaddleScanImport: vi.fn(),
  preflightAccountScanReviewBatch: mocks.preflight,
  armAccountScanReviewImport: mocks.arm,
  replaceReadyAccountScanStaging: mocks.replace,
}))
import { FormalDiscImportPage } from './FormalDiscImportPage'
import { createSyntheticFormalImportCurrent } from './formalDiscImportTestFixture'

function pending() {
  const current = createSyntheticFormalImportCurrent()
  current.batch.reviewState.preflight = 'pending'
  return current
}
const page = (onError = vi.fn()) => (
  <BrowserRouter>
    <FormalDiscImportPage
      embedded
      compact
      onError={onError}
      secondaryAction={<button>放弃</button>}
    />
  </BrowserRouter>
)

describe('compact OCR import preflight', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/system/scanner')
    mocks.current = pending()
    mocks.preflight.mockReset()
    mocks.arm.mockReset()
    mocks.replace.mockReset()
  })

  it('automatically checks a complete result once, shows only counts and never writes before import', async () => {
    const current = pending()
    mocks.current = current
    mocks.preflight.mockImplementation(async () => {
      current.batch.reviewState.preflight = 'complete'
      return { complete: true }
    })
    const view = render(page())
    await waitFor(() => expect(screen.getByRole('button', { name: '导入' })).toBeEnabled())
    expect(screen.getByText('343 张 S 级驱动盘')).toBeInTheDocument()
    expect(screen.getByText('测试账户')).toBeInTheDocument()
    expect(screen.queryByText(/重新检查通过/)).not.toBeInTheDocument()
    view.rerender(page())
    expect(mocks.preflight).toHaveBeenCalledTimes(1)
    expect(mocks.arm).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('keeps failed checking blocked without an automatic loop, and retries explicitly', async () => {
    mocks.preflight.mockRejectedValue(new Error('合成检查失败'))
    render(page())
    expect(await screen.findByRole('alert')).toHaveTextContent('合成检查失败')
    expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
    expect(mocks.preflight).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }))
    await waitFor(() => expect(mocks.preflight).toHaveBeenCalledTimes(2))
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('ignores a late failure after the account and result change, then checks the new result', async () => {
    let rejectOld!: (error: Error) => void
    mocks.preflight.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectOld = reject
        }),
    )
    const onError = vi.fn()
    const view = render(page(onError))
    const next = pending()
    next.account.id = 'account-next'
    next.account.displayName = '另一测试账户'
    next.batch.id = 'next-result'
    mocks.current = next
    mocks.preflight.mockImplementationOnce(async () => {
      next.batch.reviewState.preflight = 'complete'
      return { complete: true }
    })
    view.rerender(page(onError))
    await act(async () => rejectOld(new Error('旧结果失败')))
    await waitFor(() => expect(mocks.preflight).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: '导入' })).toBeEnabled())
    expect(screen.queryByText('旧结果失败')).not.toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled()
    expect(mocks.preflight.mock.calls[1].slice(0, 2)).toEqual(['account-next', 'next-result'])
    expect(mocks.arm).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('blocks repeated import after a transaction failure and requires explicit rechecking', async () => {
    const current = pending()
    current.batch.reviewState.preflight = 'complete'
    mocks.current = current
    mocks.replace.mockRejectedValue(new Error('当前装备无法与扫描结果唯一对应'))
    mocks.preflight.mockResolvedValue({ complete: true })
    render(page())
    fireEvent.click(screen.getByRole('button', { name: '导入' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('当前装备无法与扫描结果唯一对应')
    expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
    expect(mocks.preflight).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '导入' })).toBeEnabled())
    expect(mocks.preflight).toHaveBeenCalledOnce()
    expect(mocks.replace).toHaveBeenCalledOnce()
  })

  it.each(['missing', 'duplicate'])(
    'does not preflight or write a %s source record set',
    async (issue) => {
      const current = pending()
      if (issue === 'missing') current.items.pop()
      else current.items[1].sourceIdentity = current.items[0].sourceIdentity
      mocks.current = current
      render(page())
      expect(screen.getByRole('button', { name: '导入' })).toBeDisabled()
      await act(async () => {})
      expect(mocks.preflight).not.toHaveBeenCalled()
      expect(mocks.replace).not.toHaveBeenCalled()
    },
  )

  it('blocks account binding conflicts before checking or writing', () => {
    mocks.current = { bindingError: '当前账户与扫描目标不符，请重新选择' }
    render(page())
    expect(screen.getByRole('alert')).toHaveTextContent('扫描目标不符')
    expect(screen.queryByRole('button', { name: '导入' })).not.toBeInTheDocument()
    expect(mocks.preflight).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
