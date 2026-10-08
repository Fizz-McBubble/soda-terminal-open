import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ScannerGuide } from './ScannerGuide'

it('keeps detailed support boundaries collapsed until the player opens the guide', () => {
  render(<ScannerGuide />)
  const details = screen.getByText('扫描指南').closest('details')!
  expect(details).not.toHaveAttribute('open')
  expect(screen.getByText(/不是显示器分辨率/)).not.toBeVisible()
  fireEvent.click(screen.getByText('扫描指南'))
  expect(details).toHaveAttribute('open')
  expect(screen.getByText(/不是显示器分辨率/)).toBeVisible()
  expect(screen.getByText(/无需放在默认桌面位置/)).toBeVisible()
  expect(screen.getByText(/已实测 1920 × 1080 和 1600 × 900/)).toBeVisible()
  expect(screen.getByText(/已有扫描结果也可通过 JSON 文件导入/)).toBeVisible()
})
