import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getActiveAccount } from '../accounts/repository'
import { CalculationQueryClientContext } from '../application/accountDecisionWorldHooks'
import { calculationQueryContractVersion } from '../application/calculationQueryContract'
import { loadDevelopmentDirectoryFactsInput } from '../application/developmentDirectoryFactsInput'
import {
  isCurrentDevelopmentDirectoryFacts,
  type DevelopmentDirectoryFacts,
  type DevelopmentDirectoryFactsRequest,
} from '../application/publicDevelopmentDirectoryFacts'

export function useDevelopmentDirectoryFacts() {
  const client = useContext(CalculationQueryClientContext)
  const query = client?.queryDevelopmentDirectoryFacts
  const [revision, setRevision] = useState(0)
  const read = useLiveQuery(async () => {
    if (!query) return { query, revision, status: 'disabled' as const }
    try {
      const account = await getActiveAccount()
      if (!account) return { query, revision, status: 'no_account' as const }
      const input = await loadDevelopmentDirectoryFactsInput(account.id)
      return { query, revision, status: 'ready' as const, input }
    } catch {
      return { query, revision, status: 'error' as const }
    }
  }, [query, revision])
  const scoped = read && read.query === query && read.revision === revision ? read : undefined
  const request = useMemo<DevelopmentDirectoryFactsRequest | null>(
    () => (scoped?.status === 'ready' ? { input: scoped.input } : null),
    [scoped],
  )
  const [projection, setProjection] = useState<{
    request: DevelopmentDirectoryFactsRequest
    value?: DevelopmentDirectoryFacts
    failed?: true
  } | null>(null)
  const execute = useCallback(
    async (next: DevelopmentDirectoryFactsRequest, signal: AbortSignal) => {
      if (!query) throw new Error('当前目录资料服务不可用。')
      const value = await query(
        {
          ...next,
          kind: 'development_directory_facts',
          contractVersion: calculationQueryContractVersion,
          operationId: crypto.randomUUID(),
        },
        { signal },
      )
      if (!isCurrentDevelopmentDirectoryFacts(value, next))
        throw new Error('目录资料已变化，请重新读取。')
      return value
    },
    [query],
  )
  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    void execute(request, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setProjection({ request, value })
      })
      .catch(() => {
        if (!controller.signal.aborted) setProjection({ request, failed: true })
      })
    return () => controller.abort()
  }, [request, execute])
  return {
    enabled: Boolean(query),
    input: scoped?.status === 'ready' ? scoped.input : null,
    value: request && projection?.request === request ? (projection.value ?? null) : null,
    loading:
      Boolean(query) &&
      (!scoped || (scoped.status === 'ready' && (!projection || projection.request !== request))),
    error:
      scoped?.status === 'error' ||
      Boolean(request && projection?.request === request && projection.failed),
    noAccount: scoped?.status === 'no_account',
    retry: () => setRevision((value) => value + 1),
  }
}
