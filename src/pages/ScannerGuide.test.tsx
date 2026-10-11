import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ScannerGuide } from './ScannerGuide'

it('provides the supported scanning instructions through the shared popover', () => {
  render(<ScannerGuide />)
  const trigger = screen.getByRole('button', { name: '画面扫描指南' })
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(/保持游戏画面完整可见/)).toBeInTheDocument()
  expect(screen.getByText(/工作区内的“停止”/)).toBeInTheDocument()
  expect(screen.getByText(/自动校验，点击“导入”/)).toBeInTheDocument()
})
