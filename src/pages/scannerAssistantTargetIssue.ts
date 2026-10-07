import type { ScannerTargetAccountBinding } from '../scanner/targetAccountBinding'
import type { ScannerAccounts } from './ScannerAccountHydrationGate'

export function createFrozenScannerTargetIssue(
  targetBinding: ScannerTargetAccountBinding | null,
  frozenTargetValidation: { valid: boolean; code?: string },
  accountState: ScannerAccounts,
) {
  if (!targetBinding || frozenTargetValidation.valid) return null
  const activeName = accountState?.activeAccount?.displayName ?? '尚未选择账户'
  const currentTarget = accountState?.accounts.find(
    (account) => account.id === targetBinding.accountId,
  )
  const currentDiscCount = accountState?.discCounts.get(targetBinding.accountId)
  const issueCode =
    'code' in frozenTargetValidation ? frozenTargetValidation.code : 'binding_missing'
  switch (issueCode) {
    case 'active_account_changed':
      return {
        title: '扫描目标与当前账户不一致',
        message: `本次扫描锁定“${targetBinding.displayName}”，当前账户为“${activeName}”。`,
      }
    case 'baseline_changed':
      return {
        title: '目标账户的仓库已经变化',
        message: `本次扫描锁定“${targetBinding.displayName}”时有 ${targetBinding.baselineDiscCount} 张驱动盘，当前为 ${currentDiscCount ?? 0} 张。`,
      }
    case 'target_account_changed':
      return {
        title: '目标账户资料已经变化',
        message: `本次扫描锁定“${targetBinding.displayName}”，当前账户名称为“${currentTarget?.displayName ?? activeName}”。`,
      }
    case 'target_account_missing':
      return {
        title: '扫描目标账户已不可用',
        message: `本次扫描锁定“${targetBinding.displayName}”，但该账户已不存在或不可用。`,
      }
    default:
      return {
        title: '需要重新确认扫描目标',
        message: `本次扫描原先锁定“${targetBinding.displayName}”。`,
      }
  }
}
