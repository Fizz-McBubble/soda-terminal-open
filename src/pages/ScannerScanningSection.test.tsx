import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScannerScanningSection } from './ScannerScanningSection'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import { createScannerTargetAccountBinding } from '../scanner/targetAccountBinding'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'

const snapshot = () => createScannerRuntimeSnapshot('scanning') as ScannerAssistantSnapshot
const binding = () =>
  createScannerTargetAccountBinding({
    account: { id: 'account-test', displayName: '测试目标' },
    baselineDiscCount: 12,
  })

describe('OCR in-card scanning progress', () => {
  it('shows the target and live progress with a working safe-stop action', () => {
    const stop = vi.fn()
    render(
      <ScannerScanningSection
        targetBinding={binding()}
        frozenTargetIssue={null}
        snapshot={snapshot()}
        onReturnToTargetSelection={vi.fn()}
        onSafeStop={stop}
      />,
    )
    expect(screen.getByText('目标账户：测试目标')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '128')
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '384')
    expect(screen.getByRole('alert')).toHaveTextContent('扫描期间请不要操作、切换或最小化游戏')
    fireEvent.click(screen.getByRole('button', { name: '停止本次扫描' }))
    expect(stop).toHaveBeenCalledOnce()
  })

  it('does not invent a percentage or total when the scanner has not observed one', () => {
    const current = snapshot()
    current.progress!.total = null
    render(
      <ScannerScanningSection
        targetBinding={binding()}
        frozenTargetIssue={null}
        snapshot={current}
        onReturnToTargetSelection={vi.fn()}
        onSafeStop={vi.fn()}
      />,
    )
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('已处理 128，总量待确认')
  })

  it('keeps missing binding and changed-target protection visible beside progress', () => {
    const back = vi.fn()
    render(
      <ScannerScanningSection
        targetBinding={null}
        frozenTargetIssue={{ title: '账户已切换', message: '请重新选择扫描目标' }}
        snapshot={snapshot()}
        onReturnToTargetSelection={back}
        onSafeStop={vi.fn()}
      />,
    )
    expect(screen.getByText(/缺少目标账户绑定/)).toHaveAttribute('role', 'alert')
    expect(screen.getByText('请重新选择扫描目标')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回准备步骤重新选择' }))
    expect(back).toHaveBeenCalledOnce()
  })
})
