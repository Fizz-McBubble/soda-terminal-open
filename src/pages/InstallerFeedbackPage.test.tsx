import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallerFeedbackPage } from './InstallerFeedbackPage'
import type { InstallerFeedbackReport } from '../assetQuickRead/installerFeedback'
import { consumeInstallerFeedbackFragment } from '../assetQuickRead/installerFeedback'
import { StrictMode } from 'react'

const mockReport: InstallerFeedbackReport = {
  schema: 1,
  tool: 'asset_quick_read_installer',
  reportId: 'c7b28014-9ff5-4e3a-96e0-20f781df03aa',
  installerVersion: '1.0.9',
  stage: 'protocol',
  code: 'protocol_download_timeout',
  durationMs: 35000,
  attempts: [
    {
      item: 0,
      source: 'github_raw',
      code: 'request_started',
      elapsedMs: 100,
    },
    {
      item: 0,
      source: 'github_raw',
      code: 'protocol_download_timeout',
      elapsedMs: 20000,
    },
  ],
}

describe('InstallerFeedbackPage component', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders safe fallback when no fragment or report is provided', () => {
    render(<InstallerFeedbackPage initialReport={null} />)
    expect(screen.getByText('资产快读安装问题反馈')).toBeInTheDocument()
    expect(screen.getByText(/未检测到有效的安装诊断信息/)).toBeInTheDocument()
    // Does not render send/copy buttons when no report is present
    expect(screen.queryByText('发送反馈')).not.toBeInTheDocument()
  })

  it('keeps the once-consumed report through StrictMode rendering without sending', () => {
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    window.location.hash = encodeURIComponent(JSON.stringify(mockReport))
    const report = consumeInstallerFeedbackFragment()
    render(
      <StrictMode>
        <InstallerFeedbackPage initialReport={report} />
      </StrictMode>,
    )
    expect(window.location.hash).toBe('')
    expect(screen.getByText('代码：protocol_download_timeout')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders safe summary without auto-posting on mount', async () => {
    const fetchMock = vi.fn()
    global.fetch = fetchMock

    render(<InstallerFeedbackPage initialReport={mockReport} />)

    expect(screen.getByText(/安装器版本 1.0.9/)).toBeInTheDocument()
    expect(screen.getByText(/协议数据下载超时/)).toBeInTheDocument()
    expect(screen.getByText('代码：protocol_download_timeout')).toBeInTheDocument()
    expect(screen.getByText('阶段：下载协议数据')).toBeInTheDocument()
    expect(screen.getByText('诊断记录：2 条')).toBeInTheDocument()

    // Explicitly verify NO automatic fetch / post was dispatched
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches feedback only upon explicit user click and displays receipt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'received',
        reportId: mockReport.reportId,
        receivedAt: '2026-10-12T14:30:00.000Z',
      }),
    })
    global.fetch = fetchMock

    render(<InstallerFeedbackPage initialReport={mockReport} />)

    const sendButton = screen.getByRole('button', { name: '发送反馈' })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('反馈已成功接收')).toBeInTheDocument()
    })

    expect(screen.getByText(`回执编号：${mockReport.reportId}`)).toBeInTheDocument()
    expect(screen.getByText('接收时间：2026-10-12T14:30:00.000Z')).toBeInTheDocument()

    // Send button now shows "已发送" and is disabled
    expect(screen.getByRole('button', { name: '已发送' })).toBeDisabled()

    // Verify request format and credentials: omit
    expect(fetchMock).toHaveBeenCalledWith(
      '/_soda/scan-feedback',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify(mockReport),
      }),
    )
  })

  it('copies sanitized diagnostic report to clipboard upon user click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    render(<InstallerFeedbackPage initialReport={mockReport} />)

    const copyButton = screen.getByRole('button', { name: '复制诊断' })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByText('已复制诊断。')).toBeInTheDocument()
    })

    expect(writeTextMock).toHaveBeenCalledWith(JSON.stringify(mockReport, null, 2))
  })

  it('preserves the report and retry action when submission fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('synthetic network failure'))
    global.fetch = fetchMock
    render(<InstallerFeedbackPage initialReport={mockReport} />)
    const details = screen.getByText('查看下载诊断记录').closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '发送反馈' }))
    await screen.findByText('暂未收到回执，请重试或复制诊断。')
    expect(screen.getByRole('button', { name: '发送反馈' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '复制诊断' })).toBeEnabled()
    expect(screen.queryByText('反馈已成功接收')).not.toBeInTheDocument()
    expect(screen.getByText('代码：protocol_download_timeout')).toBeInTheDocument()
  })

  it('downloads diagnostic report upon user click', () => {
    const revokeObjectURLMock = vi.fn()
    const createObjectURLMock = vi.fn().mockReturnValue('blob:test')
    window.URL.createObjectURL = createObjectURLMock
    window.URL.revokeObjectURL = revokeObjectURLMock

    render(<InstallerFeedbackPage initialReport={mockReport} />)

    const downloadButton = screen.getByRole('button', { name: '下载诊断' })
    fireEvent.click(downloadButton)

    expect(createObjectURLMock).toHaveBeenCalled()
  })
})
