import { assetSnapshotSchema, pendingAssetSnapshotSchema } from './snapshotProtocolSchema'
import { canonicalJson } from '../application/contentHash'

export function isUnverifiedPendingAssetSnapshot(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || !('issues' in raw) || !Array.isArray(raw.issues))
    return false
  if (raw.issues.length !== 1) return false
  const issue = raw.issues[0]
  return (
    issue?.asset === 'snapshot' &&
    issue.field === '' &&
    ['legacy_observation_unverified', 'incomplete_observation'].includes(issue.code)
  )
}

/** A separate clean file must match the saved capture before it can be reviewed in its place. */
export function matchesUnverifiedPendingAssetSnapshot(saved: unknown, file: unknown): boolean {
  if (!isUnverifiedPendingAssetSnapshot(saved)) return false
  const pending = assetSnapshotSchema.safeParse(saved)
  const candidate = assetSnapshotSchema.safeParse(file)
  if (!pending.success || !candidate.success || candidate.data.issues.length > 0) return false
  return canonicalJson({ ...pending.data, issues: [] }) === canonicalJson(candidate.data)
}

/** Local download only. This broader recovery schema never authorizes account import. */
export function prepareAssetSnapshotExport(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  // Keep the import restriction for each affected asset without retaining diagnostic text.
  const nativeIssues = 'issues' in raw ? raw.issues : null
  const affected = new Set<'snapshot' | 'engine' | 'agent'>()
  if (!Array.isArray(nativeIssues) || nativeIssues.length > 100) affected.add('snapshot')
  else {
    for (const issue of nativeIssues) {
      const asset =
        typeof issue?.code === 'string' && typeof issue?.field === 'string' ? issue.asset : null
      affected.add(asset === 'engine' || asset === 'agent' ? asset : 'snapshot')
    }
  }
  const issues = Array.from(affected, (asset) => ({
    code: 'incomplete_observation',
    asset,
    field: '',
  }))
  const input = { ...raw, issues }
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
  switch (code) {
    case 'client_dispatch_version_rejected':
      return '游戏客户端配置版本与当前资产快读适配不一致，请等待资产快读适配更新后再试；账户未修改。'
    case 'client_dispatch_seed_shape_rejected':
      return '游戏客户端配置中的请求参数格式未通过检查，请发送诊断以便核对适配；账户未修改。'
    case 'client_dispatch_version_and_seed_shape_rejected':
      return '游戏客户端配置版本和请求参数格式均未通过检查，请发送诊断以便核对适配；账户未修改。'
    case 'client_dispatch_version_or_seed_shape_rejected':
      return '游戏客户端版本或配置与当前资产快读适配不一致，请等待资产快读适配更新后再试；账户未修改。'
    default:
      return null
  }
}
