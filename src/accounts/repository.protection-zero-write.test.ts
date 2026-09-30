import { describe, expect, it } from 'vitest'
import { SodaDatabase } from '../db/databaseCore'
import { createEmptyRoster } from '../assault/catalog'
import { sampleDiscs } from '../evaluation/fixtures'
import { input as worldInput } from '../decision/warehouseActionProjection.testFixture'
import { saveAccountPlanningDraft } from './planningDrafts'
import {
  createAccount,
  deleteAccountDriveDiscs,
  saveAccountDriveDisc,
  saveAccountRoster,
} from './repository'

describe('protected mixed-batch deletion stays atomic in synthetic storage', () => {
  it.each(Array.from({ length: 7 }, (_, index) => index + 1))(
    'writes nothing for favorite/equipment/saved-plan protection mask %s',
    async (mask) => {
      // Vitest setup installs fake-indexeddb; this named database contains only this test's fixtures.
      const database = new SodaDatabase(`round-four-protection-synthetic-${mask}`)
      try {
        const account = await createAccount('synthetic protection', database, {
          id: `account-synthetic-protection-${mask}`,
        })
        const protectedDisc = {
          ...sampleDiscs.treasureCandidate,
          id: 'protected',
          favorite: Boolean(mask & 1),
          locked: false,
        }
        await saveAccountDriveDisc(account.id, protectedDisc, database)
        await saveAccountDriveDisc(
          account.id,
          { ...protectedDisc, id: 'ordinary', favorite: false },
          database,
        )
        const roster = createEmptyRoster('2026-09-30T00:00:00.000Z')
        roster.agents[0]!.owned = true
        roster.agents[0]!.equippedDiscIds = mask & 2 ? [protectedDisc.id] : []
        await saveAccountRoster(account.id, roster, database)
        if (mask & 4) {
          await saveAccountPlanningDraft(
            account.id,
            { ...worldInput().drafts[0]!, warehouseRefs: [protectedDisc.id] },
            database,
          )
        }
        const snapshot = () => Promise.all(database.tables.map((table) => table.toArray()))
        const before = await snapshot()
        await expect(
          deleteAccountDriveDiscs(account.id, ['ordinary', protectedDisc.id], database),
        ).rejects.toThrow(/收藏保护|当前装备|已保存方案保护/)
        expect(await snapshot()).toEqual(before)
      } finally {
        database.close()
        await database.delete()
      }
    },
  )
})
