import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ScannerGuide } from './ScannerGuide'

it('provides the supported scanning instructions through the shared popover', () => {
  render(<ScannerGuide />)
  const trigger = screen.getByRole('button', { name: '扫描指南' })
  expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(/无需放在默认桌面位置/)).toBeInTheDocument()
  expect(screen.getByText(/已实测 1920 × 1080 和 1600 × 900/)).toBeInTheDocument()
  expect(screen.getByText(/已有扫描结果也可通过 JSON 文件导入/)).toBeInTheDocument()
})
