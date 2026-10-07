import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { HelpAndPrivacyPage } from './HelpAndPrivacyPage'
import { saveLastScanDiagnostic } from '../scanner/scanFeedback'
import { sanitizeScanDiagnostic } from '../scanner/diagnostics'
import userEvent from '@testing-library/user-event'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
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
    'https://github.com/Fizz-McBubble/soda-terminal-feedback/issues',
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
  expect(screen.getByRole('heading', { name: '资料保存与备份' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '本机扫描' })).toBeInTheDocument()
  expect(screen.getByText(/计算在本机完成，不上传账户或资产资料/)).toBeInTheDocument()
  expect(screen.getByText(/清除站点数据、更换浏览器前，请先导出备份/)).toBeInTheDocument()
  expect(screen.getByText(/须经你检查并确认导入/)).toBeInTheDocument()
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
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('复制失败'))
  expect(screen.getByLabelText('简要诊断内容')).toBeVisible()
  expect(screen.getByLabelText('简要诊断内容')).toHaveAttribute('tabindex', '0')
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
  expect(screen.getByText('上次扫描遇到问题？可在这里反馈。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '反馈此问题' })).toBeEnabled()
  expect(screen.queryByLabelText('扫描技术诊断内容')).not.toBeInTheDocument()
  expect(screen.getByText(/Cloudflare/)).toHaveTextContent('30 天')
  fireEvent.click(screen.getByText('查看诊断信息'))
  expect(screen.getByText(/未能及时读取到可识别/)).toBeVisible()
  expect(screen.queryByText(report.reportId)).not.toBeInTheDocument()
  expect(screen.queryByText(report.code)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '复制诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(report)
})
