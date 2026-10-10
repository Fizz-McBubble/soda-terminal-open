import { PlayerSelect } from '../components/PlayerSelect'

export type TargetAccountOption = {
  id: string
  displayName: string
  discCount: number
}

export function ScannerTargetAccountPicker({
  accounts,
  selectedAccountId,
  onSelect,
  label = '本次扫描保存到',
  disabled = false,
  showCount = true,
}: {
  accounts: TargetAccountOption[]
  selectedAccountId: string
  onSelect: (accountId: string) => void
  label?: string
  disabled?: boolean
  showCount?: boolean
}) {
  const selectedIndex = Math.max(
    0,
    accounts.findIndex((account) => account.id === selectedAccountId),
  )
  const selectedAccount = accounts[selectedIndex]

  return (
    <div className="scanner-account-picker">
      <span className="scanner-account-picker__label">{label}</span>
      <PlayerSelect
        className="scanner-account-picker__control"
        aria-label={label}
        disabled={disabled || !selectedAccount}
        value={selectedAccount?.id ?? ''}
        onChange={onSelect}
      >
        {!selectedAccount && <option value="">请先创建账户</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.displayName}
            {showCount && ` · ${account.discCount} 张驱动盘`}
          </option>
        ))}
      </PlayerSelect>
    </div>
  )
}
