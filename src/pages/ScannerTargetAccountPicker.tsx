export type TargetAccountOption = {
  id: string
  displayName: string
  discCount: number
}

export function ScannerTargetAccountPicker({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: TargetAccountOption[]
  selectedAccountId: string
  onSelect: (accountId: string) => void
}) {
  const selectedIndex = Math.max(
    0,
    accounts.findIndex((account) => account.id === selectedAccountId),
  )
  const selectedAccount = accounts[selectedIndex]
  const alternativeAccounts = accounts.filter((account) => account.id !== selectedAccount?.id)
  if (!selectedAccount) return null

  if (!alternativeAccounts.length) {
    return (
      <div className="scanner-account-picker scanner-account-picker--single">
        <span className="scanner-account-picker__label" id="scanner-target-account-heading">
          本次扫描保存到
        </span>
        <output
          className="scanner-account-picker__selected"
          aria-labelledby="scanner-target-account-heading"
        >
          <strong>{selectedAccount.displayName}</strong>
          <small>· {selectedAccount.discCount} 张驱动盘</small>
        </output>
      </div>
    )
  }

  return (
    <div className="scanner-account-picker">
      <span className="scanner-account-picker__label">本次扫描保存到</span>
      <PlayerSelect
        className="scanner-account-picker__control"
        aria-label="本次扫描保存到"
        value={selectedAccount.id}
        onChange={onSelect}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.displayName} · {account.discCount} 张驱动盘
          </option>
        ))}
      </PlayerSelect>
    </div>
  )
}
import { PlayerSelect } from '../components/PlayerSelect'
