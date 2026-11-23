import { getActiveAccount, getAccountRoster, getAccountPreference } from '../accounts/repository'
import { listAccountPlanningDrafts } from '../accounts/planningDrafts'
import { createPublicScannerEmptyRoster as createEmptyRoster } from '../accounts/publicScannerAccountCreation'
import { database } from '../db/databaseCore'
import type { DriveDisc } from '../domain/schemas'
import type { AccountPlanningDraft } from '../accounts/types'

export const lastSelectedAgentPreference = 'assets.agents.last-selected-agent-v1'

export async function loadAssetAccountIdentity() {
  return (await getActiveAccount())?.id ?? null
}

export async function loadAssetData(rosterOnly = false) {
  const account = await getActiveAccount()
  if (!account)
    return {
      account: null,
      roster: createEmptyRoster(),
      discs: [] as DriveDisc[],
      planningDrafts: [] as AccountPlanningDraft[],
      lastSelectedAgentId: null,
    }
  // The three catalogs show a count in their navigation. Only disc management needs the rows.
  const discRecords = database.accountDriveDiscs.where('accountId').equals(account.id)
  const [roster, discRead, planningDrafts, preferredAgent] = await Promise.all([
    getAccountRoster(account.id),
    rosterOnly ? discRecords.count() : discRecords.toArray(),
    rosterOnly ? [] : listAccountPlanningDrafts(account.id),
    getAccountPreference(account.id, lastSelectedAgentPreference),
  ])
  return {
    account,
    roster,
    discs: typeof discRead === 'number' ? [] : discRead,
    ...(typeof discRead === 'number' ? { discCount: discRead } : {}),
    planningDrafts,
    lastSelectedAgentId: typeof preferredAgent === 'string' ? preferredAgent : null,
  }
}

export async function loadAssetLastSelectedAgentPreference() {
  const account = await getActiveAccount()
  if (!account) return null
  const preferredAgent = await getAccountPreference(account.id, lastSelectedAgentPreference)
  return typeof preferredAgent === 'string' ? preferredAgent : null
}

export async function loadAssetAccountOptions() {
  const accounts = await database.accounts
    .filter((account) => account.status === 'active')
    .toArray()
  return accounts
    .sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-CN'))
    .map((account) => ({ id: account.id, displayName: account.displayName }))
}
