import { useCallback, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveAccount } from '../accounts/repository'
import type { AccountProfile } from '../accounts/types'
import { loadWorldInput, type AccountDecisionWorldInput } from './accountDecisionWorldModel'

/** A personal fact read does not subscribe to the full warehouse until an explicit analysis. */
export function useAccountDecisionObservation({
  accountId,
  activeAccount,
  observeInput,
}: {
  accountId: string | null
  activeAccount: AccountProfile | null
  observeInput: boolean | 'disabled'
}) {
  const [requestedInput, setRequestedInput] = useState<AccountDecisionWorldInput | null>(null)
  const retainedInput = requestedInput?.warehouse.accountId === accountId ? requestedInput : null
  const observingInput = observeInput !== 'disabled' && (observeInput || retainedInput !== null)
  const observed = useLiveQuery(async () => {
    if (!observingInput) return undefined
    try {
      const input = await loadWorldInput(activeAccount)
      return input?.warehouse.accountId === accountId ? input : null
    } catch (error) {
      const current = await getActiveAccount()
      if ((current?.id ?? null) !== accountId) return null
      throw error
    }
  }, [accountId, activeAccount, observingInput])
  const rememberRequestedInput = useCallback(
    (input: AccountDecisionWorldInput) => {
      if (accountId && input.warehouse.accountId === accountId) setRequestedInput(input)
    },
    [accountId],
  )
  return {
    liveInput: !observingInput
      ? undefined
      : observed === undefined
        ? (retainedInput ?? undefined)
        : observed?.warehouse.accountId === accountId
          ? observed
          : null,
    observingInput,
    rememberRequestedInput,
  }
}
