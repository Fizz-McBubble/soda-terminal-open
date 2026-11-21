import { getDevelopmentPriorityAgentIds } from '../accounts/developmentPlanning'
import { getActiveAccount } from '../accounts/repository'
import { loadCoreRoster } from '../accounts/coreWarehouse'
import type { AccountRoster } from '../assault/types'

export type DevelopmentDirectoryScaffoldReady = {
  status: 'ready'
  accountId: string
  roster: AccountRoster
  priorityAgentIds: string[]
}

export type DevelopmentDirectoryScaffoldReadResult =
  | DevelopmentDirectoryScaffoldReady
  | { status: 'no_account' }
  | { status: 'account_changed' }
  | { status: 'failed' }

/**
 * Directory-only progressive input. It intentionally excludes discs, drafts and calculation
 * projections so it cannot be used as a formal Account Decision input.
 */
export async function loadDevelopmentDirectoryScaffold(
  expectedAccountId: string,
): Promise<DevelopmentDirectoryScaffoldReadResult> {
  try {
    const scope = await loadCoreRoster()
    if (!scope.accountId) return { status: 'no_account' }
    if (scope.accountId !== expectedAccountId) return { status: 'account_changed' }
    const priorityAgentIds = await getDevelopmentPriorityAgentIds(expectedAccountId)
    const latestAccount = await getActiveAccount()
    if (latestAccount?.id !== expectedAccountId) return { status: 'account_changed' }
    return {
      status: 'ready',
      accountId: expectedAccountId,
      roster: scope.roster,
      priorityAgentIds,
    }
  } catch {
    return { status: 'failed' }
  }
}
