import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { contentHash } from '../application/contentHash'
import { developmentCurrentRecordAgent } from '../application/publicDevelopmentWorkbenchRoute'
import type { SaveRefresh } from './agentDevelopmentWorkbenchViewState'
import type { useDevelopmentWorkbenchFacts } from './useDevelopmentWorkbenchFacts'

export function useDevelopmentCurrentRecordReconciliation(
  facts: ReturnType<typeof useDevelopmentWorkbenchFacts>,
  saveRefresh: SaveRefresh | null,
  setSaveRefresh: Dispatch<SetStateAction<SaveRefresh | null>>,
) {
  useEffect(() => {
    if (
      !facts.enabled ||
      !facts.value ||
      facts.value.status !== 'ready' ||
      saveRefresh?.kind !== 'current_record' ||
      !saveRefresh.record
    )
      return
    const agent = facts.input?.warehouse.roster.agents.find(
      (item) => item.agentId === saveRefresh.agentId,
    )
    if (
      agent &&
      facts.input?.warehouse.accountId === saveRefresh.accountId &&
      contentHash(developmentCurrentRecordAgent(agent)) ===
        contentHash(developmentCurrentRecordAgent(saveRefresh.record))
    )
      setSaveRefresh(null)
  }, [facts.enabled, facts.value, facts.input, saveRefresh, setSaveRefresh])
}
