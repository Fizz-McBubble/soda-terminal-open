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

  it('shows one account without a selector', () => {
    render(
      <ScannerTargetAccountPicker
        accounts={[accounts[0]]}
        selectedAccountId="account-a"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('· 12 张驱动盘')).toBeInTheDocument()
  })
})
