import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { HelpAndPrivacyPage } from './HelpAndPrivacyPage'

afterEach(() => vi.restoreAllMocks())

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
  fireEvent.change(screen.getByLabelText('错误阶段'), { target: { value: '本机计算' } })
  fireEvent.click(screen.getByRole('button', { name: '复制简要诊断' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
  const copied = writeText.mock.calls[0][0] as string
  expect(copied).toContain('错误阶段：本机计算')
  expect(copied).toContain('Soda Terminal 版本：')
  expect(copied).toContain('可重试提示：')
  expect(copied).not.toMatch(/UID|账号|账户标识|备份内容|截图|token/i)
})
