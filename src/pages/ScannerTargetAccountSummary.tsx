export function ScannerTargetAccountSummary({
  account,
  discCount,
}: {
  account: { displayName: string }
  discCount: number
}) {
  return (
    <p className="scanner-target-account__summary">
      <strong>{discCount === 0 ? '建立驱动盘仓库' : '更新此账户仓库'}</strong>
      <span>
        “{account.displayName}”当前
        {discCount === 0 ? '为空仓库' : `有 ${discCount} 张驱动盘`}
        ；确认后完整替换此账户的驱动盘，不合并。扫描期间不会改动账户。
      </span>
    </p>
  )
}
