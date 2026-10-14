import { describe, expect, it } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import type { DriveDisc } from '../domain/schemas'
import type { AccountDecisionRun } from './calculationQueryContract'
import { developmentPanelDiscFingerprint } from './publicDevelopmentComparisonPanels'
import { projectDevelopmentWorkbenchRoute } from './developmentWorkbenchRouteProjection'
import { isCurrentDevelopmentWorkbenchRoute } from './publicDevelopmentWorkbenchRoute'
import { projectDevelopmentCandidateAlternatives } from '../decision/developmentCandidateAlternatives'
import {
  candidateSetPlansForConstraint,
  getCandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { createAgentDevelopmentPanelProjection } from '../pages/agentDevelopmentPanelProjection'
import { createDevelopmentPanelContext } from '../pages/agentDevelopmentPanelContext'
import { candidateDiscRecommendations } from '../pages/candidateDiscRecommendations'
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
const astraDiscs = discs.map((disc, index) => ({
  ...disc,
  mainStat: ['hp_flat', 'atk_flat', 'def_flat', 'atk_percent', 'atk_percent', 'energy_regen'][
    index
  ] as DriveDisc['mainStat'],
}))
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

function astraAgent(mindscape: number | undefined, equipped = astraDiscs) {
  const row = createEmptyRoster().agents.find((item) => item.agentId === 'agent-astra')!
  row.owned = true
  row.level = 60
  row.skillLevels.core = 7
  row.wEngineDetails = { id: 'wengine-14002', name: '逍遥游球', level: 60, refinement: 1 }
  row.equippedDiscIds = equipped.map((disc) => disc.id)
  row.mindscape = mindscape as number
  return row as typeof agent
}

function runWithAgent(routeAgent: typeof agent, warehouseDiscs = astraDiscs) {
  return {
    runId: 'route-run-astra',
    capturedAt: '2026-09-24T00:00:00Z',
    input: {
      warehouse: {
        accountId: 'account-a',
        roster: { agents: [routeAgent], wEngines: [] },
        discs: warehouseDiscs,
      },
      drafts: [],
      activePlanIds: {},
      developmentPriorityAgentIds: [],
      preference: {},
    },
    snapshot: { fingerprint: { inputHash: 'route-hash-astra' } },
  } as unknown as AccountDecisionRun
}

describe('captured workbench route presentation', () => {
  it('passes the captured Astra Mindscape into two-piece policy resolution', () => {
    const project = (mindscape: number | undefined) =>
      projectDevelopmentWorkbenchRoute(runWithAgent(astraAgent(mindscape)), {
        ...currentSelection,
        agentId: 'agent-astra',
      })
    const m0 = project(0)
    const m2 = project(2)
    const unknown = project(undefined)
    expect(m0.status).toBe('ready')
    expect(m2.status).toBe('ready')
    expect(
      m0.setRecommendations?.some((row) => row.twoPiecePriority?.reason.includes('3429')),
    ).toBe(true)
    expect(
      m2.setRecommendations?.some((row) => row.twoPiecePriority?.reason.includes('2963')),
    ).toBe(true)
    expect(
      unknown.setRecommendations?.some(
        (row) =>
          row.twoPiecePriority?.label === '来源条件参考' &&
          row.twoPiecePriority.reason.includes('先确认影画等级') &&
          !row.twoPiecePriority.reason.includes('可执行目标'),
      ),
    ).toBe(true)

    const knownAgent = astraAgent(2)
    const panelProjection = createAgentDevelopmentPanelProjection({
      agent: knownAgent,
      discs: astraDiscs,
    })
    expect(panelProjection.result.status).toBe('ok')
    const context = createDevelopmentPanelContext({
      panelProjection,
      hasComparablePlan: false,
      candidateChoices: [],
      currentDiscIds: knownAgent.equippedDiscIds,
      data: { discs: astraDiscs },
      coreLevel: 7,
      mindscape: knownAgent.mindscape,
    })
    expect(context?.mindscape).toBe(2)
    const rows = candidateDiscRecommendations(
      candidateSetPlansForConstraint(getCandidateWarehouseConstraint('agent-astra')!),
      getCandidateWarehouseConstraint('agent-astra'),
      context,
    )
    expect(rows.some((row) => row.twoPiecePriority?.reason.includes('2963'))).toBe(true)
  })

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

describe('explicit equipped comparison return', () => {
  it('keeps equipped identity ahead of a saved reference and asserts it in route freshness', () => {
    const alternatives = discs.map((disc) => ({ ...disc, id: `saved-${disc.id}` }))
    const run = runWith([...discs, ...alternatives])
    run.input.drafts = [
      { ...savedPlan, warehouseRefs: alternatives.map((disc) => disc.id) },
    ] as unknown as typeof run.input.drafts
    run.input.activePlanIds = { [agent.agentId]: savedPlan.id }
    const selection = { ...currentSelection, preferEquipped: true as const }
    const actual = projectDevelopmentWorkbenchRoute(run, selection)
    expect(actual.status).toBe('ready')
    expect(actual.source).toBe('当前已装备')
    expect(actual.discFacts.map((disc) => disc.id)).toEqual(discs.map((disc) => disc.id))
    const legacy = projectDevelopmentWorkbenchRoute(run, currentSelection)
    expect(legacy.source).toBe('当前方案')
    expect(legacy.discFacts.map((disc) => disc.id)).toEqual(alternatives.map((disc) => disc.id))
    expect(
      isCurrentDevelopmentWorkbenchRoute(
        actual,
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
  })
})
