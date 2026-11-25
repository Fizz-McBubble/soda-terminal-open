import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { HelpAndPrivacyPage } from './HelpAndPrivacyPage'
import { useAppHealth } from '../appHealthContext'
import { OnlineCalculationConsent } from '../components/OnlineCalculationConsent'
import { calculationProcessingDisclosures } from '../application/calculationProcessingDisclosure'
import { saveLastScanDiagnostic } from '../scanner/scanFeedback'
import { sanitizeScanDiagnostic } from '../scanner/diagnostics'
import userEvent from '@testing-library/user-event'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'
import { assetFailureDiagnostic } from '../assetQuickRead/diagnostics'
import {
  assetDiagnosticKey,
  saveAssetDiagnostic,
  submitAssetFeedback,
} from '../assetQuickRead/feedback'
vi.mock('../appHealthContext', () => ({
  useAppHealth: vi.fn(() => ({ currentVersion: null, dataStatus: 'ready' })),
}))

// jsdom has no native Popover API; the production-browser check covers its geometry.
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.mocked(useAppHealth).mockReturnValue({ currentVersion: null, dataStatus: 'ready' } as never)
  localStorage.clear()
})

it('uses the online processing disclosure in public help and consent without granting consent', async () => {
  vi.stubEnv('VITE_SODA_PUBLIC_BUILD', 'true')
  const allow = vi.fn()
  const help = render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.getByText(calculationProcessingDisclosures.online.processing)).toBeInTheDocument()
  expect(screen.queryByText(/计算在本机完成/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('简要诊断'))
  await choosePlayerSelect(screen.getByRole('combobox', { name: '错误阶段' }), '在线计算')
  expect(screen.getByLabelText('简要诊断内容')).toHaveTextContent('错误阶段：在线计算')
  help.unmount()
  render(
    <MemoryRouter>
      <OnlineCalculationConsent onAllow={allow} />
    </MemoryRouter>,
  )
  expect(screen.getByText(calculationProcessingDisclosures.online.processing)).toBeInTheDocument()
  expect(allow).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '了解并开始在线计算' }))
  expect(allow).toHaveBeenCalledOnce()
})

it('copies game-data and last observed tool versions separately without raw diagnostic fields', async () => {
  vi.mocked(useAppHealth).mockReturnValue({
    currentVersion: { gameVersion: '3.3' },
    dataStatus: 'error',
  } as never)
  saveLastScanDiagnostic(
    sanitizeScanDiagnostic({
      schema: 1,
      reportId: crypto.randomUUID(),
      release: 'test',
      outcome: 'failed',
      code: 'panel_capture_timeout',
      stage: 'capture',
      counts: { processed: 3, total: null },
      versions: { helper: '1.0.1', scanner: 'ZZZ-Scanner.Next-1.0.49-soda-r4', protocol: '1' },
    })!,
  )
  saveAssetDiagnostic(assetFailureDiagnostic('waiting', undefined, null, '1.1.1'))
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const fetcher = vi.spyOn(globalThis, 'fetch')
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.getByLabelText('简要诊断内容')).not.toBeVisible()
  await userEvent.click(screen.getByText('简要诊断'))
  fireEvent.click(screen.getByRole('button', { name: '复制简要诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  const copied = writeText.mock.calls[0][0] as string
  expect(copied).toContain('游戏资料版本：3.3（加载失败）')
  expect(copied).toContain('上次画面扫描Helper版本：1.0.1')
  expect(copied).toContain('上次画面扫描扫描核心版本：ZZZ-Scanner.Next-1.0.49-soda-r4')
  expect(copied).toContain('上次资产快读 Bridge 版本：1.1.1')
  expect(copied).not.toMatch(/reportId|panel_capture_timeout|UID|token|snapshot/i)
  expect(fetcher).not.toHaveBeenCalled()
})

it('opens the public feedback Issues and copies only selected, non-account diagnostic fields', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: '问题与建议反馈' })).toHaveAttribute(
    'href',
    'https://github.com/Fizz-McBubble/soda-terminal-feedback/issues/new/choose',
  )
  expect(screen.getByRole('combobox', { name: '错误阶段' })).not.toBeVisible()
  expect(screen.getByLabelText('简要诊断内容')).not.toBeVisible()
  await userEvent.click(screen.getByText('简要诊断'))
  expect(screen.getByRole('combobox', { name: '错误阶段' })).toBeVisible()
  expect(screen.getByLabelText('简要诊断内容')).toBeVisible()
  await choosePlayerSelect(screen.getByRole('combobox', { name: '错误阶段' }), '本机计算')
  fireEvent.click(screen.getByRole('button', { name: '复制简要诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  const copied = writeText.mock.calls[0][0] as string
  expect(copied).toContain('错误阶段：本机计算')
  expect(copied).toContain('Soda Terminal 版本：')
  expect(copied).toContain('可重试提示：')
  expect(copied).not.toMatch(/UID|账号|账户标识|备份内容|截图|token/i)
  expect(copied.split('\n')).toHaveLength(3)
})

it('keeps the local data and confirmed-import boundaries in a concise three-section page', () => {
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
  const topics = screen.getByRole('navigation', { name: '帮助主题' })
  expect(
    within(topics)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['资料保存', '扫描与风险', '问题与反馈'])
  expect(within(topics).getByRole('link', { name: '扫描与风险' })).toHaveAttribute(
    'href',
    '#help-scanner',
  )
  expect(screen.getByRole('heading', { name: '资料保存与备份' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '扫描与风险' })).toBeInTheDocument()
  const methods = screen.getByLabelText('扫描方式')
  expect(methods).toHaveTextContent('支持本机和云游戏，只扫描 S 级驱动盘')
  expect(methods).toHaveTextContent('在本机游戏登录时读取代理人养成')
  expect(screen.getByText(/先选择要更新的 Soda 账户/)).toHaveTextContent('打开“导入记录”')
  expect(screen.getByText('画面扫描指南').closest('details')).not.toHaveAttribute('open')
  expect(screen.queryByText(/本机版建议使用 1920 × 1080 或 1600 × 900/)).not.toBeInTheDocument()
  expect(screen.getByText(/计算在本机完成，不上传账户或资产资料/)).toBeInTheDocument()
  expect(screen.getByText(/清除站点数据或切换浏览器前，请先导出备份/)).toBeInTheDocument()
  expect(screen.getByText(/存在账号处罚风险，且没有官方书面授权/)).toBeInTheDocument()
  expect(screen.queryByText(/Cloudflare/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: window.location.origin })).toHaveAttribute(
    'href',
    window.location.origin,
  )
  expect(screen.getByRole('link', { name: '我的资产 · 账户' })).toHaveAttribute(
    'href',
    '/assets/account',
  )
  expect(screen.getByRole('link', { name: '第三方软件声明' })).toHaveAttribute(
    'href',
    '/third-party-notices.txt',
  )
  expect(document.body.textContent).not.toMatch(/Railway|在线计算服务|允许在线计算|美国西部|5 分钟/)
})

it('leaves expanded diagnostic text available when clipboard access fails', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByText('简要诊断'))
  fireEvent.click(screen.getByRole('button', { name: '复制简要诊断' }))
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('复制未完成，请手动选择下方文字'),
  )
  expect(screen.getByLabelText('简要诊断内容')).toBeVisible()
  expect(screen.getByLabelText('简要诊断内容')).toHaveAttribute('tabindex', '0')
})

it('shows actual copying progress before reporting a completed copy', async () => {
  let finish!: () => void
  const writeText = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )

  await userEvent.click(screen.getByText('简要诊断'))
  fireEvent.click(screen.getByRole('button', { name: '复制简要诊断' }))
  expect(screen.getByRole('button', { name: '正在复制…' })).toBeDisabled()
  expect(writeText).toHaveBeenCalledOnce()

  finish()
  expect(await screen.findByRole('status')).toHaveTextContent('已复制')
})

it('does not attribute a delayed clipboard result to a newly selected stage', async () => {
  let finish!: () => void
  const writeText = vi.fn().mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )

  await userEvent.click(screen.getByText('简要诊断'))
  fireEvent.click(screen.getByRole('button', { name: '复制简要诊断' }))
  await choosePlayerSelect(screen.getByRole('combobox', { name: '错误阶段' }), '图片加载')
  expect(screen.getByRole('button', { name: '正在复制…' })).toBeDisabled()
  expect(screen.getByLabelText('简要诊断内容')).toHaveTextContent('错误阶段：图片加载')

  await act(async () => finish())
  expect(screen.queryByText(/已复制，请检查后/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制简要诊断' })).toBeEnabled()
  expect(writeText).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('错误阶段：页面启动'))
})

it('offers the sanitized last failed scan directly on the Help page without requiring external contact', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const report = sanitizeScanDiagnostic({
    schema: 1,
    reportId: crypto.randomUUID(),
    release: 'test',
    outcome: 'failed',
    code: 'panel_capture_timeout',
    stage: 'capture',
    counts: { processed: 3, total: null },
  })!
  saveLastScanDiagnostic(report)
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('region', { name: '扫描问题反馈' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
  expect(screen.getAllByText(/Cloudflare/)).toHaveLength(1)
  expect(screen.getByText(/Cloudflare/)).toHaveTextContent('30 天')
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/未能及时读取到可识别/)).toBeVisible()
  expect(screen.queryByText(report.reportId)).not.toBeInTheDocument()
  expect(screen.queryByText(report.code)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(report)
})

it('restores only the matching last quick-read receipt without sending on help mount or refresh', async () => {
  const report = assetFailureDiagnostic('waiting')
  saveAssetDiagnostic(report)
  const acknowledge = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'received',
        reportId: report.reportId,
        receivedAt: '2026-10-15T00:00:00Z',
      }),
    ),
  )
  await submitAssetFeedback(report, acknowledge)
  const fetcher = vi.spyOn(globalThis, 'fetch')
  const view = render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('region', { name: '上次资产快读诊断' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '已发送', hidden: true })).toBeDisabled()
  expect(fetcher).not.toHaveBeenCalled()
  view.unmount()
  saveAssetDiagnostic(assetFailureDiagnostic('result'))
  const next = render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('button', { name: '已发送', hidden: true })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: '上次资产快读诊断' })).toHaveTextContent(
    '上次记录：资产快读结果未通过读取检查。',
  )
  expect(fetcher).not.toHaveBeenCalled()
  next.unmount()
  localStorage.setItem(assetDiagnosticKey, JSON.stringify({ ...report, privatePath: 'private' }))
  render(
    <MemoryRouter>
      <HelpAndPrivacyPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('region', { name: '上次资产快读诊断' })).not.toBeInTheDocument()
})
