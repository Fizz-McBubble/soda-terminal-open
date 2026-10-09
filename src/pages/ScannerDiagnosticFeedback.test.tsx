import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ScannerDiagnosticFeedback } from './ScannerDiagnosticFeedback'
import { sanitizeScanDiagnostic } from '../scanner/diagnostics'
import contract from '../scanner/scanFeedback.contract.json'
import { scannerDiagnosticGuidance } from './scannerDiagnosticGuidance'
import { readLastScanDiagnostic, saveLastScanDiagnostic } from '../scanner/scanFeedback'
// jsdom does not implement the native Popover API. The browser regression covers
// its actual positioning, dismissal and unchanged page geometry.
vi.mock('../components/ExplanationPopover', () => ({
  ExplanationPopover: ({
    label,
    children,
  }: {
    label: string
    children: import('react').ReactNode
  }) => (
    <details>
      <summary>{label}</summary>
      {children}
    </details>
  ),
}))
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
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it('copies, downloads and restores the acknowledged ID after a conflict retry', async () => {
  const report = makeReport()
  saveLastScanDiagnostic(report)
  let receivedId = ''
  const fetcher = vi.fn().mockImplementation((_url, init) => {
    const outgoing = JSON.parse(init.body)
    if (fetcher.mock.calls.length === 1)
      return Promise.resolve(new Response('conflict', { status: 409 }))
    receivedId = outgoing.reportId
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: receivedId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    )
  })
  vi.stubGlobal('fetch', fetcher)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const createObjectURL = vi.fn().mockReturnValue('blob:diagnostic')
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    filename = this.download
  })
  const { unmount } = render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('反馈已收到'))
  fireEvent.click(screen.getByText('查看诊断信息'))
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({ ...report, reportId: receivedId })
  fireEvent.click(screen.getByRole('button', { name: '下载诊断' }))
  expect(filename).toBe(`soda-scan-diagnostic-${receivedId}.json`)
  const downloaded = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(createObjectURL.mock.calls[0][0])
  })
  expect(JSON.parse(downloaded).reportId).toBe(receivedId)
  expect(readLastScanDiagnostic()).toEqual({ ...report, reportId: receivedId })
  expect(receivedId).not.toBe(report.reportId)
  expect(fetcher).toHaveBeenCalledTimes(2)
  unmount()
  const restored = readLastScanDiagnostic()!
  const helpCard = render(<ScannerDiagnosticFeedback report={restored} />)
  expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(receivedId)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
  expect(JSON.parse(writeText.mock.calls[1][0])).toEqual(restored)
  fireEvent.click(screen.getByRole('button', { name: '下载诊断' }))
  expect(filename).toBe(`soda-scan-diagnostic-${receivedId}.json`)
  expect(fetcher).toHaveBeenCalledTimes(2)
  helpCard.unmount()
  render(<ScannerDiagnosticFeedback report={report} />)
  expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(receivedId)).toBeVisible()
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
  expect(screen.getByText(/未能及时读取/)).not.toBeVisible()
  expect(screen.getByText(/保留 30 天/)).not.toBeVisible()
  expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
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
  expect(screen.getByText(report.reportId)).not.toBeVisible()
  expect(screen.getByText('回执编号')).not.toBeVisible()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(report.reportId)).toBeVisible()
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
  expect(screen.getByText(/已处理 4 张/)).toBeVisible()
  expect(screen.getByText(/未能及时读取/)).toBeVisible()
  expect(screen.getByText(/更新扫描助手后重试/)).toBeVisible()
  expect(screen.getByText(/保留 30 天/)).toBeVisible()
  expect(screen.queryByText(/未知|错误码|Cloudflare/)).not.toBeInTheDocument()
  expect(screen.queryByText(report.code)).not.toBeInTheDocument()
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
  expect(screen.queryByText(next.reportId)).not.toBeInTheDocument()
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
    expect(screen.getByText(/未能及时读取/)).toBeVisible()
    expect(screen.queryByText(report.reportId)).not.toBeInTheDocument()
    expect(screen.queryByText(/回执编号/)).not.toBeInTheDocument()
  },
)

it('matches review guidance to manual calibration and displays the affected count without requiring feedback', () => {
  const report = {
    ...makeReport(),
    code: 'scan_import_review_required',
    stage: 'import',
    counts: { processed: 12, total: 12, reviewRequired: 11 },
  }
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/对照盘面手动校准，再确认导入/)).toBeVisible()
  expect(screen.getByText('需校准 11 张')).toBeVisible()
  expect(fetcher).not.toHaveBeenCalled()
})

it('does not suggest accepting an incomplete batch or force a particular supported resolution', () => {
  expect(
    scannerDiagnosticGuidance({ ...makeReport(), code: 'direct_fork_partial' }).nextAction,
  ).toContain('暂不能更新仓库')
  const geometry = scannerDiagnosticGuidance({
    ...makeReport(),
    code: 'ppocrv6_detail_geometry_incompatible',
  })
  expect(geometry.nextAction).toContain('16:9')
  expect(geometry.nextAction).not.toContain('1920')
})

it('keeps unknown failures neutral and omits unknown metadata', () => {
  const report = sanitizeScanDiagnostic({
    ...makeReport(),
    code: 'unknown',
    stage: 'unknown',
    counts: {},
  })!
  render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/暂时无法确定原因/)).toBeVisible()
  expect(screen.getByLabelText('本次扫描概况')).toBeEmptyDOMElement()
  expect(screen.queryByText(/未知|权限|未打开|错误码/)).not.toBeInTheDocument()
  expect(document.querySelector('pre')).toBeNull()
})

it('explains duplicate protection, preserves its diagnosis, and waits for explicit submission', () => {
  const report = sanitizeScanDiagnostic({
    ...makeReport(),
    code: 'duplicate_guard',
    stage: 'ocr',
    counts: { processed: 507, total: 2566, visited: 509, queued: 508, failed: 0 },
    evidence: { itemIndex: 508, targetVerificationKind: 'ChangedText' },
  })!
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<ScannerDiagnosticFeedback report={report} />)
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/将相同属性判断为重复/)).toBeVisible()
  expect(screen.getByText(/更新扫描助手后重试/)).toBeVisible()
  expect(screen.queryByText(/权限|未能及时读取/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  saveLastScanDiagnostic(report)
  expect(readLastScanDiagnostic()?.evidence).toEqual(report.evidence)
})

it('collapses details when a new report arrives and hides old local messages', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  const { rerender } = render(<ScannerDiagnosticFeedback report={makeReport()} />)
  fireEvent.click(screen.getByText('查看诊断信息'))
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(screen.getByText('诊断已复制。')).toBeVisible())
  rerender(<ScannerDiagnosticFeedback report={makeReport()} />)
  expect(screen.getByText(/未能及时读取/)).not.toBeVisible()
  expect(screen.queryByText('诊断已复制。')).not.toBeInTheDocument()
})

it.each(contract.codes.filter((code) => !['none', 'unknown'].includes(code)))(
  'gives a concrete problem and next action for safe code %s',
  (code) => {
    const result = scannerDiagnosticGuidance({ ...makeReport(), code })
    expect(result.problem).toBeTruthy()
    expect(result.nextAction).toBeTruthy()
    expect(result.problem).not.toContain('没有取得足够信息')
    expect(result.problem).not.toContain(code)
  },
)

it.each([
  [
    'panel_capture_timeout',
    'acceptGateReason',
    'waiting_for_target_selection_stability',
    '没有确认目标盘已稳定选中',
  ],
  ['panel_capture_timeout', 'acceptGateReason', 'required_core_missing', '必要文字不完整'],
  ['scan_navigation_failed', 'reason', 'scrollbar_position_missing', '未能确认仓库滚动条'],
  ['scan_navigation_failed', 'reason', 'unexpected_scroll_during_row', '非预期的仓库滚动'],
  ['scan_navigation_failed', 'reason', 'scroll_top_position_unconfirmed', '未能确认已回到仓库顶部'],
])(
  'explains observed diagnostic detail without claiming the underlying cause: %s/%s',
  (code, key, value, problem) => {
    const report = sanitizeScanDiagnostic({ ...makeReport(), code, evidence: { [key]: value } })!
    const result = scannerDiagnosticGuidance(report)
    expect(result.problem).toContain(problem)
    expect(result.problem).not.toMatch(/截图|权限|用户|遮挡/)
    expect(result.nextAction).toContain('更新扫描助手后重试')
  },
)

it('binds the receipt to exact submitted content when terminal details arrive with the same ID', async () => {
  const report = { ...makeReport(), code: 'scanner_failure' }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    ),
  )
  const { rerender } = render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '已反馈' })).toBeDisabled())
  rerender(
    <ScannerDiagnosticFeedback
      report={{
        ...report,
        code: 'panel_capture_timeout',
        evidence: {
          diagnosticSource: 'terminal_details',
          acceptGateReason: 'required_core_missing',
        },
      }}
    />,
  )
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  expect(screen.queryByText('回执编号')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('ignores a stale pending receipt after the same attempt is enriched', async () => {
  const report = makeReport()
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
  const { rerender } = render(<ScannerDiagnosticFeedback report={report} />)
  fireEvent.click(screen.getByRole('button', { name: '反馈此问题' }))
  rerender(
    <ScannerDiagnosticFeedback
      report={{ ...report, evidence: { acceptGateReason: 'required_core_missing' } }}
    />,
  )
  await act(async () =>
    resolve(
      new Response(
        JSON.stringify({
          status: 'received',
          reportId: report.reportId,
          receivedAt: '2026-10-07T00:00:00Z',
        }),
      ),
    ),
  )
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  expect(screen.queryByText('回执编号')).not.toBeInTheDocument()
})

it.each(['terminal_details', 'legacy_log', 'unavailable'])(
  'chooses a supported next action for the same concrete reason from %s',
  (diagnosticSource) => {
    const report = sanitizeScanDiagnostic({
      ...makeReport(),
      code: 'scan_navigation_failed',
      evidence: { diagnosticSource, reason: 'scroll_top_position_unconfirmed' },
    })!
    const result = scannerDiagnosticGuidance(report)
    expect(result.problem).toBe('未能确认已回到仓库顶部。')
    if (diagnosticSource === 'terminal_details') {
      expect(result.nextAction).toBe('请反馈此问题；准备好后可重新扫描。')
      expect(result.nextAction).not.toContain('更新')
    } else expect(result.nextAction).toContain('更新扫描助手后重试')
  },
)
it.each([
  ['native_edge_position_unverified', '翻行后仓库位置未能确认。'],
  ['native_edge_position_release_unverified', '翻行后仓库稳定位置未能确认。'],
])('describes the observed row-transition confirmation %s accurately', (reason, problem) => {
  const result = scannerDiagnosticGuidance({
    ...makeReport(),
    code: 'scan_navigation_failed',
    evidence: { reason, diagnosticSource: 'terminal_details' },
  })
  expect(result.problem).toBe(problem)
  expect(result.nextAction).toBe('请反馈此问题；准备好后可重新扫描。')
})
it.each([
  'panel_capture_timeout',
  'scan_navigation_failed',
  'warehouse_context_lost',
  'visual_preflight_failed',
])('does not prescribe a helper update for structured current failure %s', (code) => {
  expect(
    scannerDiagnosticGuidance({
      ...makeReport(),
      code,
      evidence: { diagnosticSource: 'terminal_details' },
    }).nextAction,
  ).toBe('请反馈此问题；准备好后可重新扫描。')
})
