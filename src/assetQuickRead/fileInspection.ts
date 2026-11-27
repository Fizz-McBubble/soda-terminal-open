import { assetSnapshotMaxBytes } from '../application/localDataFile'
import { readPendingAssetResult, savePendingAssetResult } from './pendingResult'
import { convertAssetSnapshot } from './snapshotAdapter'
import { matchesUnverifiedPendingAssetSnapshot } from './snapshotRecovery'

type InspectedAssetFile =
  | { kind: 'ready'; raw: unknown; sha256: string; fromPending: boolean }
  | { kind: 'blocked'; message: string; refreshPending?: boolean }

export async function inspectAssetQuickReadFile(
  file: File,
  accountId: string,
  isCurrent: () => boolean,
  pendingSnapshotSha256?: string,
): Promise<InspectedAssetFile | null> {
  let saved
  try {
    saved = await readPendingAssetResult(accountId)
  } catch {
    return {
      kind: 'blocked',
      refreshPending: true,
      message: '暂时无法恢复上次结果，原记录保留。请重试核对后再打开文件。',
    }
  }
  if (!isCurrent()) return null
  if (saved && !pendingSnapshotSha256)
    return {
      kind: 'blocked',
      refreshPending: true,
      message: '上次读取结果仍保留，请先继续检查并导入、导出或放弃，再打开其他文件。',
    }
  const changedPending = {
    kind: 'blocked',
    message: '本机待导入结果已变化。请重新打开本页核对。',
  } as const
  if (pendingSnapshotSha256 && saved?.snapshotSha256 !== pendingSnapshotSha256)
    return changedPending

  if (file.size > assetSnapshotMaxBytes) throw new Error('候选文件超过 16 MiB，未读取。')
  const bytes = await file.arrayBuffer()
  if (!isCurrent()) return null
  const raw: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (saved) {
    if (
      !matchesUnverifiedPendingAssetSnapshot(saved.snapshot, raw) ||
      !convertAssetSnapshot(raw, saved).importable
    )
      return {
        kind: 'blocked',
        message: '所选文件与上次读取结果不符或仍有待核对项。请选用当时导出的原文件。',
      }
    const replaced = await savePendingAssetResult(
      accountId,
      raw,
      saved.snapshotSha256,
      undefined,
      true,
    )
    if (!isCurrent()) return null
    return replaced
      ? { kind: 'ready', raw, sha256: saved.snapshotSha256, fromPending: true }
      : changedPending
  }
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return { kind: 'ready', raw, sha256, fromPending: false }
}
