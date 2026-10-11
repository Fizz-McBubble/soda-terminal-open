import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { loadAssetAccountIdentity, loadAssetAccountOptions, loadAssetData } from './assetCenterData'

/** Keep the last confirmed read while errors terminate only this subscription. */
function useAssetRead<T>(load: () => Promise<T>, revision: number) {
  const [attempt, setAttempt] = useState(0)
  const key = `${revision}:${attempt}`
  const [result, setResult] = useState<{ key: string; failed: boolean; data?: T }>({
    key: '',
    failed: false,
  })
  useEffect(() => {
    let active = true
    const subscription = liveQuery(load).subscribe({
      next: (data) => {
        if (active) setResult({ key, failed: false, data })
      },
      error: () => {
        if (active) setResult((previous) => ({ ...previous, key, failed: true }))
      },
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [load, key])
  return {
    data: result.data,
    pending: result.key !== key,
    failed: result.key === key && result.failed,
    retry: () => setAttempt((value) => value + 1),
  }
}

export function useAssetCenterData(revision: number) {
  const assetRead = useAssetRead(loadAssetData, revision)
  const accounts = useAssetRead(loadAssetAccountOptions, 0)
  // Identity follows the active-account table itself; a same-account asset retry
  // must not invalidate it or unmount the retained editor.
  const identity = useAssetRead(loadAssetAccountIdentity, 0)
  const identityKnown = !identity.pending && !identity.failed
  const matchingAccount =
    identityKnown &&
    assetRead.data !== undefined &&
    (assetRead.data.account?.id ?? null) === identity.data
  const assets = {
    ...assetRead,
    data: matchingAccount ? assetRead.data : undefined,
    // Only for keeping the editor mounted inside a hidden, inert container.
    retainedData: assetRead.data,
    pending: assetRead.pending || (!assetRead.failed && !matchingAccount),
  }
  return {
    assets,
    accounts,
    identity,
    blocked:
      assets.failed || accounts.failed || assets.pending || accounts.pending || identity.failed,
  }
}
