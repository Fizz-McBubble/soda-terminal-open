import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ScannerHandoffSection } from './ScannerHandoffSection'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import { createScannerTargetAccountBinding } from '../scanner/targetAccountBinding'
import { createScannerRuntimeSnapshot } from './scannerAssistantTestFixture'

vi.mock('./FormalDiscImportPage', () => ({
  FormalDiscImportPage: ({ secondaryAction }: { secondaryAction: React.ReactNode }) => (
    <div>一次导入区域{secondaryAction}</div>
  ),
}))

function props(): ComponentProps<typeof ScannerHandoffSection> {
  const snapshot = createScannerRuntimeSnapshot('completed') as ScannerAssistantSnapshot
  snapshot.summary = {
    ...snapshot.summary!,
    needsReview: 0,
    unreadable: 0,
    reliable: 384,
    resultStatus: 'ready_for_review',
  }
  return {
    inlineImportOpen: false,
    snapshot,
    accountState: { activeAccount: undefined, accounts: [], discCounts: new Map() },
    selectedAccount: undefined,
    effectiveSelectedAccountId: 'account-test',
    frozenTargetValidation: {
      valid: true,
      binding: createScannerTargetAccountBinding({
        account: { id: 'account-test', displayName: '测试目标' },
        baselineDiscCount: 12,
      }),
    },
    resultEligibleForFormalReview: true,
    completedBindingIssue: null,
    scanIdentityEvidence: { source: 'synthetic', value: '测试目标' },
    currentReceivingAccountName: '测试目标',
    resultSummary: <div>冗长明细不应出现</div>,
    handoffState: { status: 'idle' },
    discardDraftConfirmationOpen: false,
    onSelectAccountId: vi.fn(),
    onReturnToTargetSelection: vi.fn(),
    onImportSuccess: vi.fn(),
    onHandOffResult: vi.fn(),
    onBindCompletedResult: vi.fn(),
    onSetDiscardDraftConfirmationOpen: vi.fn(),
    onDiscardIncompleteDraftAndRetry: vi.fn(),
    onRepairCompletedBatchAndRetry: vi.fn(),
    sharedTargetSelection: true,
  }
}

describe('OCR card result handoff', () => {
  it('shows account and count while automatic checking runs, without another result-opening step', () => {
    const input = props()
    render(<ScannerHandoffSection {...input} />)
    expect(screen.getByText('测试目标')).toBeInTheDocument()
    expect(screen.getByText('384 张 S 级驱动盘')).toBeInTheDocument()
    expect(screen.queryByText('冗长明细不应出现')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /查看扫描结果|导入/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('尚未导入')
    fireEvent.click(screen.getByRole('button', { name: '放弃' }))
    expect(input.onReturnToTargetSelection).toHaveBeenCalledOnce()
    expect(input.onHandOffResult).not.toHaveBeenCalled()
  })

  it('offers an explicit checking retry on failure', () => {
    const input = props()
    input.handoffState = { status: 'error', message: '读取失败，请重试' }
    render(<ScannerHandoffSection {...input} />)
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }))
    expect(input.onHandOffResult).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toHaveTextContent('读取失败')
    expect(screen.getByRole('alert').tagName).toBe('P')
    expect(document.querySelector('.scanner-handoff__recovery-actions')).toBeNull()
  })

  it('leaves an inline import failure in its form without a second error block', () => {
    const input = props()
    input.handoffState = { status: 'error', message: '更新失败，请重试' }
    input.diagnosticFeedback = <span>发送本次诊断</span>
    render(<ScannerHandoffSection {...input} inlineImportOpen />)
    expect(screen.getByText('一次导入区域')).toBeVisible()
    expect(screen.queryByText('更新失败，请重试')).not.toBeInTheDocument()
    expect(document.querySelector('details')).toBeNull()
    expect(document.querySelector('.scanner-handoff__recovery-actions')).toBeNull()
    expect(screen.getByText('发送本次诊断')).toBeVisible()
  })

  it('retains calibration details and the guarded review action for abnormal results', () => {
    const input = props()
    input.snapshot.summary!.needsReview = 2
    render(<ScannerHandoffSection {...input} />)
    expect(screen.getByText('冗长明细不应出现')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '检查需确认的记录' }))
    expect(input.onHandOffResult).toHaveBeenCalledOnce()
  })

  it('keeps the standalone result-opening contract', () => {
    render(<ScannerHandoffSection {...props()} sharedTargetSelection={false} />)
    expect(screen.getByRole('button', { name: '查看扫描结果' })).toBeInTheDocument()
    expect(screen.getByText('冗长明细不应出现')).toBeInTheDocument()
  })

  it('places discard beside the compact import action', () => {
    const input = props()
    render(<ScannerHandoffSection {...input} inlineImportOpen />)
    fireEvent.click(screen.getByRole('button', { name: '放弃' }))
    expect(input.onReturnToTargetSelection).toHaveBeenCalledOnce()
  })
})
