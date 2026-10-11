import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { DriveDisc } from '../domain/schemas'
import type { AccountDecisionRun } from './calculationQueryContract'
import { developmentPanelDiscFingerprint } from './publicDevelopmentComparisonPanels'
import { projectDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteProjection'
import { isCurrentDevelopmentWorkbenchRoute } from './publicDevelopmentWorkbenchRoute'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import { getCandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { contentHash } from './contentHash'
import {
  developmentCurrentRecordAgent,
  developmentCurrentRecordBinding,
} from './publicDevelopmentWorkbenchRoute'

const discs = [1, 2, 3, 4, 5, 6].map((slot) => ({
  id: `route-disc-${slot}`,
  slot,
  setId: 'set-swing-jazz',
  level: 15,
  rarity: 'S',
  mainStat: 'atk_percent',
  subStats: [],
  locked: false,
  favorite: false,
  tags: [],
  createdAt: '2026-09-24T00:00:00Z',
  updatedAt: '2026-09-24T00:00:00Z',
  dataVersion: '3.1',
})) as DriveDisc[]
const agent = {
  ...createEmptyRoster().agents.find((item) => item.agentId === 'agent-aria')!,
  owned: true,
  equippedDiscIds: discs.map((disc) => disc.id),
}
const savedPlan = {
  id: 'saved-route',
  name: '保存的比利方案',
  accountId: 'account-a',
  kind: 'agent',
  state: 'saved',
  selection: { agentIds: [agent.agentId] },
  warehouseRefs: discs.map((disc) => disc.id),
}
function runWith(warehouseDiscs = discs) {
  return {
    runId: 'route-run',
    capturedAt: '2026-09-24T00:00:00Z',
    input: {
      warehouse: {
        accountId: 'account-a',
        roster: { agents: [agent], wEngines: [] },
        discs: warehouseDiscs,
      },
      drafts: [savedPlan],
      activePlanIds: {},
      developmentPriorityAgentIds: [],
      preference: {},
    },
    snapshot: { fingerprint: { inputHash: 'route-hash' } },
  } as unknown as AccountDecisionRun
}
const currentSelection = {
  agentId: agent.agentId,
  requestedPlanId: null,
  candidateRank: null,
  candidateLoadoutFingerprint: null,
}

describe('captured workbench route presentation', () => {
  it('refreshes a saved record panel without replacing the captured run or candidate authority', () => {
    const run = runWith()
    const savedAgent = developmentCurrentRecordAgent({ ...agent, level: 59 })
    const record = {
      accountId: 'account-a',
      agent: savedAgent,
      revision: contentHash(savedAgent),
      selectedDiscIds: discs.map((disc) => disc.id),
    }
    const projection = projectDevelopmentWorkbenchRoute(run, currentSelection, record)
    expect(projection.status).toBe('ready')
    expect(projection.currentRecordBinding).toBe(developmentCurrentRecordBinding(record))
    expect(projection.workbench?.slices.currentCombination.level).toBe(59)
    expect(run.input.warehouse.roster.agents[0].level).toBe(agent.level)
    expect(
      isCurrentDevelopmentWorkbenchRoute(
        projection,
        {
          runId: run.runId,
          accountId: 'account-a',
          inputFingerprint: 'route-hash',
          selection: currentSelection,
          selectedDiscs: discs,
        },
        developmentPanelDiscFingerprint,
      ),
    ).toBe(false)
    for (const invalid of [
      { ...record, accountId: 'account-b' },
      { ...record, revision: 'wrong' },
      { ...record, selectedDiscIds: ['missing-disc'] },
      { ...record, agent: { ...record.agent, agentId: 'agent-billy' } },
    ])
      expect(projectDevelopmentWorkbenchRoute(run, currentSelection, invalid).status).toBe(
        'references_changed',
      )
    expect(
      projectDevelopmentWorkbenchRoute(run, { ...currentSelection, candidateRank: 1 }, record)
        .status,
    ).toBe('references_changed')
  })
  it('projects current equipped discs and a chosen saved plan with serializable identity', () => {
    const run = runWith()
    const current = projectDevelopmentWorkbenchRoute(run, currentSelection)
    const saved = projectDevelopmentWorkbenchRoute(run, {
      ...currentSelection,
      requestedPlanId: 'saved-route',
    })
    expect(current.status).toBe('ready')
    expect(current.source).toBe('当前已装备')
    expect(saved.status).toBe('ready')
    expect(saved.source).toBe('当前方案')
    expect(saved.selectedDiscFingerprint).toBe(developmentPanelDiscFingerprint(discs))
    const restored = JSON.parse(JSON.stringify(saved)) as typeof saved
    expect(
      isCurrentDevelopmentWorkbenchRoute(
        restored,
        {
          runId: run.runId,
          accountId: 'account-a',
          inputFingerprint: 'route-hash',
          selection: { ...currentSelection, requestedPlanId: 'saved-route' },
          selectedDiscs: discs,
        },
        developmentPanelDiscFingerprint,
      ),
    ).toBe(true)
    expect(restored.discFacts).toHaveLength(6)
  })

  it('fails closed for changed references, missing plan, stale account, or unasserted candidate', () => {
    const run = runWith(discs.slice(0, 5))
    expect(
      projectDevelopmentWorkbenchRoute(run, { ...currentSelection, requestedPlanId: 'saved-route' })
        .status,
    ).toBe('references_changed')
    expect(
      projectDevelopmentWorkbenchRoute(run, { ...currentSelection, requestedPlanId: 'absent' })
        .status,
    ).toBe('missing')
    expect(
      projectDevelopmentWorkbenchRoute(runWith(), { ...currentSelection, candidateRank: 1 }).status,
    ).toBe('candidate_mismatch')
    const current = projectDevelopmentWorkbenchRoute(runWith(), currentSelection)
    expect(
      isCurrentDevelopmentWorkbenchRoute(
        current,
        {
          runId: 'route-run',
          accountId: 'other-account',
          inputFingerprint: 'route-hash',
          selection: currentSelection,
          selectedDiscs: discs,
        },
        developmentPanelDiscFingerprint,
      ),
    ).toBe(false)
  })

  it('accepts only the exact candidate loadout solved from the captured run', () => {
    const constraint = getCandidateWarehouseConstraint('agent-billy')!
    const plan = constraint.setPlans![0]!
    const warehouseDiscs = Array.from({ length: 12 }, (_, index) => {
      const slot = ((index % 6) + 1) as DriveDisc['slot']
      return {
        ...discs[slot - 1]!,
        id: `billy-${index}`,
        setId: slot <= 4 ? plan.primarySetIds[0]! : plan.secondarySetIds[0]!,
        mainStat:
          slot <= 3
            ? (['hp_flat', 'atk_flat', 'def_flat'][slot - 1] as DriveDisc['mainStat'])
            : constraint.mainStats[String(slot) as '4' | '5' | '6']![0]!,
      }
    })
    const billy = {
      ...createEmptyRoster().agents.find((item) => item.agentId === 'agent-billy')!,
      owned: true,
    }
    const run = runWith(warehouseDiscs)
    run.input.warehouse.roster.agents = [billy]
    const candidates = projectDevelopmentCandidateAlternatives(run.input, billy.agentId)
    expect(candidates.status).toBe('ready')
    const loadout = candidates.candidates[0]?.loadouts[0]
    expect(loadout).toBeDefined()
    const selection = {
      agentId: billy.agentId,
      requestedPlanId: null,
      candidateRank: 1,
      candidateLoadoutFingerprint: contentHash(loadout),
    }
    const result = projectDevelopmentWorkbenchRoute(run, selection)
    expect(result.status).toBe('ready')
    expect(result.source).toBe('仓库候选')
    expect(result.discFacts).toHaveLength(6)
    expect(
      projectDevelopmentWorkbenchRoute(run, { ...selection, candidateLoadoutFingerprint: 'wrong' })
        .status,
    ).toBe('candidate_mismatch')
  })
})
