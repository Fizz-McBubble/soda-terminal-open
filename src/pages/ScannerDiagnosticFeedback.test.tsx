import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ScannerDiagnosticFeedback } from './ScannerDiagnosticFeedback'
import { sanitizeScanDiagnostic } from '../scanner/diagnostics'
const makeReport = () =>
  sanitizeScanDiagnostic({
    schema: 1,
    reportId: crypto.randomUUID(),
    release: 'test',
    outcome: 'failed',
    code: 'panel_capture_timeout',
    stage: 'capture',
    counts: { processed: 4, total: null },
  })!
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('keeps submission explicit, disables duplicate pending clicks, and shows only a matching receipt', async () => {
  const report = makeReport()
  let resolve!: (response: Response) => void
  const fetcher = vi.fn().mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={report} />)
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeVisible()
  expect(screen.getByText(/不含账户和驱动盘资料/)).toBeVisible()
  expect(screen.getByText(/总数未知/)).not.toBeVisible()
  expect(screen.getByText(/Cloudflare/)).not.toBeVisible()
  expect(screen.getByLabelText('扫描技术诊断内容')).not.toBeVisible()
  expect(screen.getByRole('button', { name: '复制诊断' })).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  fireEvent.click(screen.getByRole('button', { name: '发送中…' }))
  expect(fetcher).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '发送中…' })).toBeDisabled()
  resolve(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-07T00:00:00Z',
      }),
    ),
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反馈已收到'))
  expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled()
  expect(screen.getByLabelText('扫描技术诊断内容')).not.toBeVisible()
  expect(screen.queryByText(/回执编号/)).not.toBeInTheDocument()
})
it('retains report and copy/download options after a network failure, then retries in-page', async () => {
  const report = makeReport()
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline private error'))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    )
  vi.stubGlobal('fetch', fetcher)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const createObjectURL = vi.fn().mockReturnValue('blob:diagnostic')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('发送失败'))
  expect(screen.getByRole('status')).not.toHaveTextContent('private')
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/总数未知/)).toBeVisible()
  expect(screen.getByText(/Cloudflare/)).toHaveTextContent('保存 30 天')
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(report)
  fireEvent.click(screen.getByRole('button', { name: '下载诊断' }))
  expect(createObjectURL).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostic')
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反馈已收到'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('ignores late receipt for an earlier failure while a newer report remains independently submit-ready', async () => {
  const first = makeReport()
  const next = makeReport()
  let resolve!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    ),
  )
  const { rerender } = render(<ScannerDiagnosticFeedback report={first} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  rerender(<ScannerDiagnosticFeedback report={next} />)
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  await act(async () => {
    resolve(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: first.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    )
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText(/回执编号/)).not.toBeInTheDocument()
  expect(screen.getByLabelText('扫描技术诊断内容')).toHaveTextContent(next.reportId)
})

it.each([
  [404, '反馈暂时无法发送，请稍后再试'],
  [409, '这份反馈已更新，请重新尝试'],
])(
  'preserves offline diagnosis and gives an actionable message for HTTP %s',
  async (status, message) => {
    const report = makeReport()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })))
    render(<ScannerDiagnosticFeedback report={report} />)
    fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(message))
    fireEvent.click(screen.getByText('查看诊断信息'))
    expect(screen.getByRole('button', { name: '下载诊断' })).toBeEnabled()
    expect(screen.getByLabelText('扫描技术诊断内容')).toHaveTextContent(report.reportId)
    expect(screen.queryByText(/回执编号/)).not.toBeInTheDocument()
  },
)
