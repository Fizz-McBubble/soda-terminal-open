import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'
import { ScannerTargetAccountPicker } from './ScannerTargetAccountPicker'

const accounts = [
  { id: 'account-a', displayName: '账户 A', discCount: 12 },
  { id: 'account-b', displayName: '账户 B', discCount: 34 },
]

describe('ScannerTargetAccountPicker', () => {
  it('keeps the account identity and disc count visible when selecting another account', async () => {
    const onSelect = vi.fn()
    render(
      <ScannerTargetAccountPicker
        accounts={accounts}
        selectedAccountId="account-a"
        onSelect={onSelect}
      />,
    )
    const picker = screen.getByRole('combobox', { name: '本次扫描保存到' })
    expect(picker).toHaveValue('account-a')
    expect(picker).toHaveTextContent('账户 A · 12 张驱动盘')
    await choosePlayerSelect(picker, 'account-b')
    expect(onSelect).toHaveBeenCalledWith('account-b')
  })

  it('keeps a selector visible with only one account', () => {
    render(
      <ScannerTargetAccountPicker
        accounts={[accounts[0]]}
        selectedAccountId="account-a"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('combobox', { name: '本次扫描保存到' })).toHaveValue('account-a')
    expect(screen.getByRole('combobox')).toHaveTextContent('账户 A · 12 张驱动盘')
  })

  it('shows account names without repeating counts when the shared row hides counts', () => {
    render(
      <ScannerTargetAccountPicker
        accounts={accounts}
        selectedAccountId="account-b"
        onSelect={vi.fn()}
        showCount={false}
      />,
    )
    expect(screen.getByRole('combobox')).toHaveValue('account-b')
    expect(screen.getByRole('combobox')).toHaveTextContent('账户 B')
    expect(screen.queryByText(/张驱动盘/)).not.toBeInTheDocument()
  })

  it('keeps an empty disabled selector before an account is created', () => {
    render(<ScannerTargetAccountPicker accounts={[]} selectedAccountId="" onSelect={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByRole('combobox')).toHaveTextContent('请先创建账户')
  })

  it('locks the selector during a task even with only one account', () => {
    render(
      <ScannerTargetAccountPicker
        accounts={[accounts[0]]}
        selectedAccountId="account-a"
        onSelect={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
