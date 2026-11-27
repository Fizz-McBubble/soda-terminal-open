import { it, expect } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { analyzeAccountWarehouse } from './discWarehouseAnalysis'
import { getGameData33BuildGuidance } from '../gameDataPacks/gameData33BuildGuidance'
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionPolicy as policy,
  toAbsoluteRetentionDisc,
} from './absoluteDiscRetentionCatalog'
import { assessDisc } from './absoluteDiscRetentionKernel'
import { warehouseTestDisc } from './discWarehouseAnalysis.testFixtures'

it('uses Severian’s sourced Salon pair to observe a legal level-zero disc', () => {
  const disc = warehouseTestDisc('severian-salon-seed', {
    setId: 'set-wuthering-salon',
    slot: 1,
    mainStat: 'hp_flat',
    level: 0,
    rarity: 'S',
    subStats: [
      { stat: 'atk_flat', value: 19, upgrades: 0 },
      { stat: 'atk_percent', value: 3, upgrades: 0 },
      { stat: 'crit_rate', value: 2.4, upgrades: 0 },
    ],
  })
  const result = assessDisc(toAbsoluteRetentionDisc(disc), catalog, policy)
  expect(result.qualityDisposition).toBe('observe')
  const roster = createEmptyRoster('2026-11-27T00:00:00Z')
  const severian = roster.agents.find((agent) => agent.agentId === 'agent-severian')!
  severian.owned = true
  const decision = analyzeAccountWarehouse({
    accountId: 'severian-salon-fixture',
    roster,
    discs: [disc],
    drafts: [],
  }).decisions[0]!
  expect(decision.category).toBe('enhance_watch')
  expect(decision.absoluteRetention?.nextAction?.kind).not.toBe('try_upgrade')
  expect(result.evidence).toContainEqual(
    expect.objectContaining({
      agentId: 'agent-severian',
      useState: 'valid',
      branchSetPlan: expect.objectContaining({
        primarySetIds: ['set-dawns-bloom'],
        secondarySetIds: ['set-wuthering-salon'],
      }),
      sourceIds: expect.arrayContaining([
        expect.stringContaining('prydwen-severian-salon-20261127'),
        expect.stringContaining('icy-veins-severian-salon-20261127'),
      ]),
    }),
  )

  const official = getGameData33BuildGuidance('agent-severian')
  expect(official?.setPlans.flatMap((plan) => plan.secondarySetIds)).not.toContain(
    'set-wuthering-salon',
  )
})
