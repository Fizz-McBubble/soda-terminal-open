/** Shared synthetic account material for production R6 adapter tests. */
import { createAccount, saveAccountDriveDisc, saveAccountRoster } from '../accounts/repository'
import { createEmptyRoster } from '../assault/catalog'
import { makeWEngineCopyId } from '../assault/wEngineInstances'
import { database } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { clearCatalogBrowseContexts } from '../components/assets/r6/useCatalogBrowseState'

export const firstWEngineId = currentAssetProjection.wEngines.find(
  (item) => item.releaseState === 'released' && item.accountOwnable,
)!.stableId
export const agentTabName = `代理人${currentAssetProjection.agents.filter((agent) => agent.releaseState === 'released' && agent.accountOwnable).length}`

export async function resetDatabase() {
  clearCatalogBrowseContexts()
  await database.transaction('rw', database.tables, async () => {
    await Promise.all(database.tables.map((table) => table.clear()))
  })
}

export async function seed() {
  const account = await createAccount('动态资产账户', database, {
    id: 'account-r6-adapter',
    makeDefault: true,
    now: new Date('2026-08-14T00:00:00.000Z'),
  })
  const roster = createEmptyRoster('2026-08-14T00:00:00.000Z')
  roster.agents[0] = { ...roster.agents[0], owned: true }
  roster.wEngines = [
    {
      copyId: makeWEngineCopyId(firstWEngineId, 1),
      engineId: firstWEngineId,
      level: 60,
      refinement: 1,
      equippedAgentId: null,
      manualSource: 'manual_override',
    },
  ]
  await saveAccountRoster(account.id, roster)
  const disc = {
    ...sampleDiscs.treasureCandidate,
    id: 'r6-disc-dynamic',
    tags: [],
    updatedAt: '2026-08-14T00:00:00.000Z',
  }
  await saveAccountDriveDisc(account.id, disc)
  return { account, disc }
}
