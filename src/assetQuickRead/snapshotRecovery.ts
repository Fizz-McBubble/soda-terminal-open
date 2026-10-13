import { assetSnapshotSchema, pendingAssetSnapshotSchema } from './snapshotProtocolSchema'

/** Local download only. This broader recovery schema never authorizes account import. */
export function prepareAssetSnapshotExport(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  // Free-form capture issues are not needed for asset recovery and may contain private text.
  const input = { ...raw, issues: [] }
  const current = assetSnapshotSchema.safeParse(input)
  if (current.success) return { snapshot: current.data, pendingUpdate: false }
  const pending = pendingAssetSnapshotSchema.safeParse(input)
  return pending.success
    ? {
        snapshot: {
          ...pending.data,
          ready_for_account_import: false,
          recovery_status: 'pending_adaptation' as const,
        },
        pendingUpdate: true,
      }
    : null
}

export function assetCompatibilityMessage(code?: string | null): string | null {
  return code === 'client_dispatch_version_or_seed_shape_rejected'
    ? '游戏客户端版本或配置与当前资产快读适配不一致，请等待资产快读适配更新后再试；账户未修改。'
    : null
}
