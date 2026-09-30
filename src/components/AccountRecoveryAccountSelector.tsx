import type { Dispatch, SetStateAction } from 'react'
import { getAccountDisplayLabel, type AccountProfile } from '../accounts/types'
export function AccountRecoveryAccountSelector({
  accounts,
  activeAccountId,
  renameValue,
  setRenameValue,
  onSelectAccount,
  onSaveRename,
}: {
  accounts: AccountProfile[]
  activeAccountId: string
  renameValue: string
  setRenameValue: Dispatch<SetStateAction<string>>
  onSelectAccount: (id: string) => void
  onSaveRename: () => void
}) {
  const selectAccount = onSelectAccount,
    saveRename = onSaveRename
  return (
    accounts.length > 0 && (
      <div className="preflight-card">
        <h3>账号选择与显示名</h3>
        <label>
          当前账号
          <select
            aria-label="当前账号"
            value={activeAccountId}
            onChange={(event) => void selectAccount(event.target.value)}
          >
            <option value="">请选择账号</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {getAccountDisplayLabel(account)}
              </option>
            ))}
          </select>
        </label>
        {activeAccountId && (
          <div className="inline-form">
            <label>
              显示名
              <input
                aria-label="账号显示名"
                maxLength={40}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
              />
            </label>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => void saveRename()}
            >
              保存显示名
            </button>
          </div>
        )}
      </div>
    )
  )
}
