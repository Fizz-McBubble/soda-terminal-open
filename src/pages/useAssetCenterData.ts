import { useCallback, useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { createPublicScannerEmptyRoster as createEmptyRoster } from '../accounts/publicScannerAccountCreation'
import { useOptionalAccountDecisionWorld } from '../application/accountDecisionWorldHooks'
import type { DriveDisc } from '../domain/schemas'
import {
  loadAssetAccountIdentity,
  loadAssetAccountOptions,
  loadAssetData,
  loadAssetLastSelectedAgentPreference,
} from './assetCenterData'

/** Keep the last confirmed read while errors terminate only this subscription. */
function useAssetRead<T>(load: () => Promise<T>, revision: number, enabled = true, scope = '') {
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([scope, revision, attempt])
  const [result, setResult] = useState<{ key: string; failed: boolean; data?: T }>({
    key: '',
    failed: false,
  })
  useEffect(() => {
    if (!enabled) return
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
  }, [enabled, load, key])
  return {
    data: enabled ? result.data : undefined,
    current: enabled && result.key === key && !result.failed,
    pending: enabled && result.key !== key,
    failed: enabled && result.key === key && result.failed,
    retry: () => setAttempt((value) => value + 1),
  }
}

export function useAssetCenterData(revision: number, rosterOnly = false) {
  const decisionWorld = useOptionalAccountDecisionWorld()
  const usesSharedRead = decisionWorld !== null && !rosterOnly
  const sharedInput = decisionWorld?.liveInput
  const readAssets = useCallback(() => loadAssetData(rosterOnly), [rosterOnly])
  const assetRead = useAssetRead(
    readAssets,
    revision,
    !usesSharedRead,
    rosterOnly ? 'catalog' : 'assets',
  )
  const sharedPreference = useAssetRead(
    loadAssetLastSelectedAgentPreference,
    revision,
    usesSharedRead && sharedInput !== undefined,
    sharedInput?.warehouse.accountId ?? 'no-account',
  )
  const {
    data: selectedAgentPreference,
    current: sharedPreferenceCurrent,
    pending: sharedPreferencePending,
  } = sharedPreference
  const sharedData = useMemo(() => {
    if (!usesSharedRead || sharedInput === undefined || sharedPreferencePending) return undefined
    if (sharedInput === null)
      return {
        account: null,
        roster: createEmptyRoster(),
        discs: [] as DriveDisc[],
        planningDrafts: [],
        lastSelectedAgentId: null,
      }
    return {
      account: sharedInput.warehouse.account,
      roster: sharedInput.warehouse.roster,
      discs: sharedInput.warehouse.discs,
      planningDrafts: sharedInput.drafts,
      lastSelectedAgentId: sharedPreferenceCurrent ? (selectedAgentPreference ?? null) : null,
    }
  }, [
    usesSharedRead,
    sharedInput,
    sharedPreferencePending,
    sharedPreferenceCurrent,
    selectedAgentPreference,
  ])
  const [retainedSharedData, setRetainedSharedData] = useState<typeof sharedData>()
  // Keep the frame mounted while the current account is revalidated. The page
  // hides and disables retained data until its account identity matches.
  if (sharedData && sharedData !== retainedSharedData) setRetainedSharedData(sharedData)
  const selectedAssetRead = usesSharedRead
    ? {
        data: sharedData && { ...sharedData, discCount: sharedData.discs.length },
        retainedData: sharedData ?? retainedSharedData,
        pending: sharedData === undefined,
        failed: sharedPreference.failed,
        retry: sharedPreference.retry,
      }
    : { ...assetRead, retainedData: assetRead.data }
  const accounts = useAssetRead(loadAssetAccountOptions, 0)
  // Identity follows the active-account table itself; a same-account asset retry
  // must not invalidate it or unmount the retained editor.
  const identity = useAssetRead(loadAssetAccountIdentity, 0)
  const identityKnown = !identity.pending && !identity.failed
  const matchingAccount =
    identityKnown &&
    selectedAssetRead.data !== undefined &&
    (selectedAssetRead.data.account?.id ?? null) === identity.data
  const assets = {
    ...selectedAssetRead,
    data: matchingAccount ? selectedAssetRead.data : undefined,
    // Only for keeping the editor mounted inside a hidden, inert container.
    retainedData: selectedAssetRead.retainedData,
    pending: selectedAssetRead.pending || (!selectedAssetRead.failed && !matchingAccount),
  }
  return {
    assets,
    accounts,
    identity,
    blocked:
      assets.failed || accounts.failed || assets.pending || accounts.pending || identity.failed,
  }
}
