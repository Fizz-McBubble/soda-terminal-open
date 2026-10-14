import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
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

export function registerScannerDiagnosticReceiptCases() {
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
}
