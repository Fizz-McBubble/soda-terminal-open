import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { saveAccountPlanningDraft } from '../accounts/planningDrafts'
import type { AccountPlanningDraft } from '../accounts/types'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  readLatestAssetQuickReadRecovery,
  restoreAssetQuickReadImport,
} from './accountImport'
import {
  accountId,
  agentId,
  candidate,
  now,
  otherAccountId,
  storedDisc,
} from './accountImport.fixtures'
import type { AccountImportTransactionsFixture } from './accountImportTransactionsFixture'

export function registerAccountImportTransactionsCases3(fixture: AccountImportTransactionsFixture) {
  it('keeps the local ID and metadata when a stable UID is upgraded', async () => {
    const { db, agent, apply } = fixture

    await db.accountDriveDiscs.put(storedDisc('my-retained-local-id', 'asset-quick-read:880001'))
    const input = candidate()
    input.discs.discs[0].level = 15
    input.discs.discs[0].subStats.push({ stat: 'crit_dmg', value: 9.6, upgrades: 1 })
    const result = await apply(input)
    expect(result).toMatchObject({ newDiscs: 0, updatedDiscs: 1, totalDiscs: 1 })
    const disc = (await db.accountDriveDiscs.where('accountId').equals(accountId).toArray())[0]
    expect(disc).toMatchObject({
      id: 'my-retained-local-id',
      level: 15,
      locked: false,
      favorite: true,
      tags: ['保留'],
    })
    expect(disc.discVersion).not.toBe('old-my-retained-local-id')
    expect((await agent()).equippedDiscIds).toEqual(['my-retained-local-id'])
  })
  it('rejects an older observation that would downgrade the same physical disc without any writes', async () => {
    const { db, facts, apply } = fixture

    const saved = storedDisc('newer-observation', 'asset-quick-read:880001')
    saved.level = 15
    saved.importSource!.capturedAt = '2026-10-11T00:00:00.000Z'
    saved.updatedAt = saved.importSource!.capturedAt
    await db.accountDriveDiscs.put(saved)
    const before = await facts()
    await expect(apply()).rejects.toThrow('早于或冲突')
    expect(await facts()).toEqual(before)
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toBeNull()
  })
  it('keeps the provenance and metadata of an identical newer disc while linking equipment', async () => {
    const { db, agent, apply } = fixture

    const saved = storedDisc('newer-observation', 'asset-quick-read:880001')
    saved.importSource!.capturedAt = '2026-10-11T00:00:00.000Z'
    saved.updatedAt = saved.importSource!.capturedAt
    await db.accountDriveDiscs.put(saved)
    await apply()
    expect(await db.accountDriveDiscs.get(saved.scopedId)).toEqual(saved)
    expect((await agent()).equippedDiscIds).toEqual([saved.id])
  })
  it('accepts a newer observation after metadata edits without rewinding the edit timestamp', async () => {
    const { db, apply } = fixture

    const saved = storedDisc('metadata-edited', 'asset-quick-read:880001')
    saved.updatedAt = '2026-10-11T00:00:00.000Z'
    await db.accountDriveDiscs.put(saved)
    const input = candidate()
    input.discs.discs[0].level = 15
    input.discs.discs[0].subStats.push({ stat: 'crit_dmg', value: 9.6, upgrades: 1 })
    await apply(input)
    expect(await db.accountDriveDiscs.get(saved.scopedId)).toMatchObject({
      level: 15,
      updatedAt: saved.updatedAt,
      favorite: true,
      tags: ['保留'],
      importSource: { capturedAt: now },
    })
  })
  it('adds a distinct UID even when an unobserved prior quick-read disc has identical properties', async () => {
    const { db, apply } = fixture

    const preserved = storedDisc('existing-distinct-uid', 'asset-quick-read:880555')
    await db.accountDriveDiscs.put(preserved)
    const result = await apply()
    expect(result).toMatchObject({ newDiscs: 1, updatedDiscs: 0, retainedDiscs: 1, totalDiscs: 2 })
    expect(await db.accountDriveDiscs.get(preserved.scopedId)).toEqual(preserved)
    const sources = (await db.accountDriveDiscs.where('accountId').equals(accountId).toArray()).map(
      (row) => row.importSource?.sourceId,
    )
    expect(new Set(sources).size).toBe(2)
  })
  it('rejects stale plans, mutated candidates and wrong confirmation digest without writes', async () => {
    const { db, facts, patchAgent } = fixture

    const input = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    const confirmation = {
      accountId,
      snapshotSha256: input.snapshotSha256,
      sameGameAccountAndCounts: true as const,
    }
    let before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { ...confirmation, snapshotSha256: 'b'.repeat(64) },
        db,
      ),
    ).rejects.toThrow('快照已变化')
    await expect(
      confirmAssetQuickReadImport(
        { ...input, capturedAt: '2026-10-11T00:00:00.000Z' },
        plan,
        confirmation,
        db,
      ),
    ).rejects.toThrow('快照已变化')
    expect(await facts()).toEqual(before)
    await patchAgent({ priority: 1 })
    before = await facts()
    await expect(confirmAssetQuickReadImport(input, plan, confirmation, db)).rejects.toThrow(
      '检查后发生了变化',
    )
    expect(await facts()).toEqual(before)
  })
  it('rolls back discs, roster and recovery together when the commit boundary fails', async () => {
    const { db, facts } = fixture

    const input = candidate()
    const plan = await prepareAssetQuickReadImport(accountId, input, db)
    const before = await facts()
    await expect(
      confirmAssetQuickReadImport(
        input,
        plan,
        { accountId, snapshotSha256: input.snapshotSha256, sameGameAccountAndCounts: true },
        db,
        () => {
          throw new Error('synthetic transaction failure')
        },
      ),
    ).rejects.toThrow('synthetic transaction failure')
    expect(await facts()).toEqual(before)
    expect(await db.accountPreferences.count()).toBe(0)
  })
  it('explicit restore returns account assets and roster exactly while retaining the recovery record', async () => {
    const { db, facts, apply } = fixture

    await db.accountDriveDiscs.put(storedDisc('existing-before', 'asset-quick-read:880001'))
    const before = await facts()
    const result = await apply()
    expect(await db.accountPreferences.count()).toBe(1)
    await restoreAssetQuickReadImport(accountId, result.recoveryKey, 'restore_asset_quick_read', db)
    const restored = await facts()
    expect(restored.discs).toEqual(before.discs)
    expect(restored.rosters).toEqual(before.rosters)
    expect(restored.accounts).toEqual(before.accounts)
    expect(restored.settings).toEqual(before.settings)
    expect(restored.preferences).toHaveLength(1)
  })
  it('blocks preview and restore when a newly saved plan references an introduced disc', async () => {
    const { db, apply, planningInput, expectPlanningRestoreBlocked } = fixture

    const receipt = await apply()
    await saveAccountPlanningDraft(
      accountId,
      planningInput('new-disc-plan', ['asset-disc-880001']),
      db,
    )
    await expectPlanningRestoreBlocked(receipt.recoveryKey, 'new-disc-plan')
  })
  it('rechecks an old plan changed to reference an introduced disc after the recovery preview', async () => {
    const { db, apply, planningInput, expectPlanningRestoreBlocked } = fixture

    await saveAccountPlanningDraft(accountId, planningInput('edited-plan', []), db)
    const receipt = await apply()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      canRestore: true,
    })
    await saveAccountPlanningDraft(
      accountId,
      planningInput('edited-plan', ['asset-disc-880001']),
      db,
    )
    await expectPlanningRestoreBlocked(receipt.recoveryKey, 'edited-plan')
  })
  it('protects union references in a legacy inconsistent candidate snapshot without changing that plan', async () => {
    const { db, apply, planningInput, expectPlanningRestoreBlocked } = fixture

    const receipt = await apply()
    const saved = await saveAccountPlanningDraft(accountId, planningInput('legacy-plan', []), db)
    await db.accountPlanningDrafts.update(saved.scopedId, {
      candidateWarehouse: {
        scope: 'agent',
        totalScore: 1,
        loadouts: [
          {
            agentId,
            totalScore: 1,
            discIds: ['asset-disc-880001'],
            effectiveRolls: 0,
            setPattern: 'scattered',
            degraded: true,
          },
        ],
        boundary: 'synthetic legacy history',
      },
    })
    await expectPlanningRestoreBlocked(receipt.recoveryKey, 'legacy-plan')
  })
  it.each(['teamPortfolioSnapshot', 'teamPortfolioDiscChoices'] as const)(
    'blocks recovery for a compatible plan referenced only in %s',
    async (source) => {
      const { db, apply, planningInput, expectPlanningRestoreBlocked } = fixture

      const receipt = await apply()
      const saved = await saveAccountPlanningDraft(
        accountId,
        planningInput('partial-portfolio', []),
        db,
      )
      const patch: Partial<AccountPlanningDraft> =
        source === 'teamPortfolioSnapshot'
          ? {
              teamPortfolioSnapshot: {
                executions: [{ members: [{ suggested: { discIds: ['asset-disc-880001'] } }] }],
              } as AccountPlanningDraft['teamPortfolioSnapshot'],
            }
          : {
              teamPortfolioDiscChoices: {
                contract: 'soda-team-portfolio-disc-choices/r1',
                loadouts: [{ choices: [{ discId: 'asset-disc-880001' }] }],
              } as AccountPlanningDraft['teamPortfolioDiscChoices'],
            }
      await db.accountPlanningDrafts.update(saved.scopedId, patch)
      await expectPlanningRestoreBlocked(receipt.recoveryKey, 'partial-portfolio')
    },
  )
  it('blocks restoring changed disc facts used by a plan even when the local disc ID survives', async () => {
    const { db, apply, planningInput, expectPlanningRestoreBlocked } = fixture

    await db.accountDriveDiscs.put(storedDisc('upgraded-disc', 'asset-quick-read:880001'))
    const input = candidate()
    input.discs.discs[0].level = 15
    input.discs.discs[0].subStats.push({ stat: 'crit_dmg', value: 9.6, upgrades: 1 })
    const receipt = await apply(input)
    await saveAccountPlanningDraft(accountId, planningInput('upgraded-plan', ['upgraded-disc']), db)
    await expectPlanningRestoreBlocked(receipt.recoveryKey, 'upgraded-plan')
  })
  it('allows unrelated and unchanged-fact plan references and preserves all plans through restore', async () => {
    const { db, facts, apply, planningInput } = fixture

    await db.accountDriveDiscs.bulkPut([
      storedDisc('same-facts-disc', 'asset-quick-read:880001'),
      storedDisc('unrelated-disc', 'asset-quick-read:880999'),
    ])
    const before = await facts()
    const receipt = await apply()
    await saveAccountPlanningDraft(
      accountId,
      planningInput('unrelated-plan', ['unrelated-disc']),
      db,
    )
    await saveAccountPlanningDraft(
      accountId,
      planningInput('same-facts-plan', ['same-facts-disc']),
      db,
    )
    // Foreign account history is outside this recovery, even with the same local ID string.
    await db.accountPlanningDrafts.put({
      ...(await db.accountPlanningDrafts.get(`${accountId}:same-facts-plan`))!,
      scopedId: `${otherAccountId}:foreign-plan`,
      accountId: otherAccountId,
      id: 'foreign-plan',
      warehouseRefs: ['asset-disc-880001'],
    })
    const plans = await db.accountPlanningDrafts.toArray()
    expect(await readLatestAssetQuickReadRecovery(accountId, db)).toMatchObject({
      canRestore: true,
    })
    await restoreAssetQuickReadImport(
      accountId,
      receipt.recoveryKey,
      'restore_asset_quick_read',
      db,
    )
    expect((await facts()).discs).toEqual(before.discs)
    expect(await db.accountPlanningDrafts.toArray()).toEqual(plans)
    const restored = await facts()
    await expect(
      restoreAssetQuickReadImport(accountId, receipt.recoveryKey, 'restore_asset_quick_read', db),
    ).rejects.toThrow('已恢复')
    expect(await facts()).toEqual(restored)
  })
}
