export function ScannerTargetAccountSummary({
  account,
  discCount,
}: {
  account: { displayName: string }
  discCount: number
}) {
  return (
    <p className="scanner-target-account__summary">
      <strong>{discCount === 0 ? '建立此账户的 S 级驱动盘记录' : '更新此账户的 S 级驱动盘'}</strong>
      <span>
        “{account.displayName}”当前
        {discCount === 0 ? '尚无驱动盘记录' : `已记录 ${discCount} 张驱动盘`}
        ；确认导入后只替换其中已确认的 S 级记录，A/B 级和品质未确认记录保留；此前不会改动账户。
      </span>
    </p>
  )
}
