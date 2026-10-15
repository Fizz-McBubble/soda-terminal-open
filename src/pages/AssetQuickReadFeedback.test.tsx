import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AssetQuickReadFeedback } from './AssetQuickReadFeedback'
import { assetFailureDiagnostic } from '../assetQuickRead/diagnostics'
vi.mock('../components/ExplanationPopover', () => import('../testing/ExplanationPopoverStub'))

import { saveAssetDiagnostic } from '../assetQuickRead/feedback'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('never sends on mount, opens folded summary, sends only on click and restores receipt after refresh', async () => {
  const report = assetFailureDiagnostic('waiting')
  saveAssetDiagnostic(report)
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-11T00:00:00Z',
      }),
    ),
  )
  vi.stubGlobal('fetch', fetcher)
  const view = render(<AssetQuickReadFeedback report={report} />)
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.getByRole('region', { name: '资产快读诊断' })).toHaveClass(
    'scanner-diagnostic-entry',
  )
  expect(screen.getByText('查看诊断')).toBeInTheDocument()
  expect(view.container.querySelector('pre')).toBeNull()
  fireEvent.click(screen.getByText('查看诊断'))
  fireEvent.click(screen.getByText('发送反馈'))
  await screen.findByText('已发送')
  expect(screen.getByText(report.reportId)).toBeInTheDocument()
  view.unmount()
  render(<AssetQuickReadFeedback report={report} />)
  expect(screen.getByText('已发送')).toBeDisabled()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('ignores old receipt after report changes and retries failed send with same ID', async () => {
  const report = assetFailureDiagnostic('startup')
  const next = assetFailureDiagnostic('import')
  let complete!: (response: Response) => void
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    .mockResolvedValue(new Response('', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<AssetQuickReadFeedback report={report} />)
  fireEvent.click(screen.getByText('发送反馈'))
  view.rerender(<AssetQuickReadFeedback report={next} />)
  await act(async () =>
    complete(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-11T00:00:00Z',
        }),
      ),
    ),
  )
  expect(screen.queryByText('已发送')).toBeNull()
  fireEvent.click(screen.getByText('发送反馈'))
  await screen.findByText('反馈服务暂不可用，请复制或下载诊断保留，稍后再试。')
  fireEvent.click(screen.getByText('发送反馈'))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  expect(JSON.parse(fetcher.mock.calls[1][1].body).reportId).toBe(next.reportId)
  expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[2][1].body)
})
it('copies and downloads the same sanitized report identity without sending', async () => {
  const report = assetFailureDiagnostic('result')
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const create = vi.fn().mockReturnValue('blob:synthetic')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<AssetQuickReadFeedback report={report} />)
  fireEvent.click(screen.getByText('复制诊断'))
  await screen.findByText('已复制诊断。')
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(report)
  fireEvent.click(screen.getByText('下载诊断'))
  expect(create).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledOnce()
  expect(fetcher).not.toHaveBeenCalled()
  click.mockRestore()
})

it('keeps a named local planning reason out of the anonymous feedback payload', async () => {
  const report = assetFailureDiagnostic('import')
  const localReason = '规划“合成私有周末队”（plan-private-synthetic）引用了将移除的盘，请调整用盘。'
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-12T00:00:00Z',
      }),
    ),
  )
  vi.stubGlobal('fetch', fetcher)
  render(
    <AssetQuickReadFeedback
      report={report}
      workspaceMessage={localReason}
      workspaceMessageRole="alert"
    />,
  )
  expect(screen.getByRole('alert')).toHaveTextContent(localReason)
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('发送反馈'))
  await screen.findByText('已发送')
  const body = fetcher.mock.calls[0][1].body as string
  expect(JSON.parse(body)).toEqual(report)
  expect(body).not.toContain('合成私有周末队')
  expect(body).not.toContain('plan-private-synthetic')
})

it.each([
  [429, '反馈提交过于频繁，请至少等待 30 秒后重试。诊断仍保留在本机。'],
  [413, '本次诊断未通过接收检查，请复制或下载保留，并通过问题与反馈入口说明提交问题。'],
  [409, '反馈编号与已接收内容冲突，请保留诊断并通过问题与反馈入口说明，避免反复提交。'],
])(
  'shows actionable HTTP %i feedback failure separately from the original diagnostic',
  async (status, message) => {
    const report = assetFailureDiagnostic('waiting')
    saveAssetDiagnostic(report)
    const fetcher = vi.fn().mockResolvedValue(
      new Response('private server message', {
        status: Number(status),
        headers: { 'Retry-After': '30' },
      }),
    )
    vi.stubGlobal('fetch', fetcher)
    render(<AssetQuickReadFeedback report={report} />)
    fireEvent.click(screen.getByText('发送反馈'))
    await screen.findByText(message)
    expect(screen.getByRole('button', { name: '发送反馈', hidden: true })).toBeEnabled()
    expect(screen.getByText('复制诊断')).toBeEnabled()
    expect(screen.getByText('下载诊断')).toBeEnabled()
    expect(screen.getAllByText('资产快读未收到完整数据。')).toHaveLength(2)
    expect(screen.queryByText('private server message')).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledOnce()
  },
)
