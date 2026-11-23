import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { readPendingAssetResult, type PendingAssetResult } from '../assetQuickRead/pendingResult'
import { readEntryState } from '../application/entryReadState'

export type PendingResultRead =
  | { status: 'loading' | 'none' }
  | { status: 'available'; result: PendingAssetResult }
  | { status: 'error'; message: string }

export function usePendingAssetResult(accountId: string | undefined, enabled: boolean) {
  const [revision, setRevision] = useState(0)
  const loaded = useLiveQuery(
    async () => ({
      accountId,
      revision,
      read:
        enabled && accountId
          ? await readEntryState(
              () => readPendingAssetResult(accountId),
              '暂时无法恢复上次结果，原记录保留。请重试核对，恢复前不能重新读取或打开其他文件。',
            )
          : null,
    }),
    [accountId, enabled, revision],
  )
  const read =
    enabled && loaded?.accountId === accountId && loaded?.revision === revision ? loaded.read : null
  const state: PendingResultRead =
    !read || read.status === 'loading'
      ? { status: 'loading' }
      : read.status === 'error'
        ? read
        : read.data
          ? { status: 'available', result: read.data }
          : { status: 'none' }
  return { state, retry: () => setRevision((value) => value + 1) }
}
