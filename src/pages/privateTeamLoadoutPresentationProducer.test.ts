import { describe, expect, it } from 'vitest'
import { loadCoreWarehouse } from '../accounts/coreFlow'
import { listAccountPlanningDrafts } from '../accounts/planningDrafts'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import { query } from '../application/localCalculationQueryClient.testFixture'
import { authorityConsumerRecommendations } from '../decision/accountDecisionAuthorityConsumers'
import { seedTeamWarehouse, setupOptimizerFlowTestIsolation } from './optimizerFlowTestFixtures'
import {
  acceptTeamExecutionPresentation,
  acceptTeamOverviewPresentation,
} from './teamLoadoutPresentationDto'
import {
  projectPrivateTeamExecution,
  projectPrivateTeamOverview,
} from './privateTeamLoadoutPresentationProducer'
import { resolveTargetTeamFitEntry } from './teamTargetFitEntry'
import {
  buildTeamLoadoutOverviewModel,
  projectTargetTeamFitsIntoOverviewModel,
} from './teamLoadoutOverviewModel'
import { createTeamExecutionAttributePanel } from './teamExecutionAttributePanel'
import { SodaDatabase } from '../db/database'
import { createLocalCalculationQueryClient } from '../application/localCalculationQueryClient'
import { prepareRemainingBox } from '../application/remainingBox'
import { ensureBundledGameDataPacks } from '../gameDataPacks/repository'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import { sampleDiscs } from '../evaluation/fixtures'
import type { AccountPlanningDraft } from '../accounts/types'

describe('private team presentation Query result', () => {
  setupOptimizerFlowTestIsolation()

  it('keeps saved-team authority from the source BOX while recommending only remaining members', async () => {
    const db = new SodaDatabase(`saved-team-authority-${crypto.randomUUID()}`)
    try {
      await db.open()
      await ensureBundledGameDataPacks(db)
      const reservedTeams: [string, string, string][] = [
        ['agent-aria', 'agent-remielle', 'agent-velina'],
        ['agent-dialyn', 'agent-sunna', 'agent-ye-shunguang'],
      ]
      const reservedIds = reservedTeams.flat()
      const remainingIds = ['agent-miyabi', 'agent-yuzuha', 'agent-burnice']
      const request = query(`saved-team-source-${crypto.randomUUID()}`, [
        ...reservedIds,
        ...remainingIds,
      ])
      request.input.warehouse.roster.bangboos = request.input.warehouse.roster.bangboos.map(
        (bangboo) => ({ ...bangboo, owned: true, stars: 5 }),
      )
      request.input.warehouse.discs = [...reservedIds, ...remainingIds].flatMap((agentId) =>
        Array.from({ length: 6 }, (_, index) => ({
          ...sampleDiscs.treasureCandidate,
          id: `saved-authority-${agentId}-${index}`,
          slot: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6,
        })),
      )
      const client = createLocalCalculationQueryClient({
        readRuntimeSelection: () => readCurrentGameDataRuntimeSelection(db),
      })
      const initial = await client.calculateAccountDecision(request)
      request.input.drafts = reservedTeams.map((agentIds, index): AccountPlanningDraft => {
        const authority = authorityConsumerRecommendations(initial.snapshot.decisionAuthority).find(
          (item) => item.bangbooId && agentIds.every((id) => item.memberIds.includes(id)),
        )
        if (!authority)
          throw new Error('Reserved exact team authority is missing from the fixture.')
        const members = agentIds.map((agentId) => ({
          agentId,
          current: { wEngineCopyId: null, discIds: [] },
          status: 'ready' as const,
          actions: [],
          impacts: [],
          suggested: {
            wEngine: null,
            discIds: request.input.warehouse.discs
              .filter((disc) => disc.id.startsWith(`saved-authority-${agentId}-`))
              .map((disc) => disc.id),
          },
        }))
        const physicalDiscIds = members.flatMap((member) => member.suggested.discIds)
        return {
          id: `saved-authority-${index}`,
          scopedId: `${request.input.warehouse.accountId}:saved-authority-${index}`,
          accountId: request.input.warehouse.accountId!,
          kind: 'team',
          name: `保留队伍 ${index + 1}`,
          state: 'saved',
          selection: { agentIds, bangbooId: authority.bangbooId, scenario: 'general' },
          manualOverrides: {
            wEngineDirection: '',
            discDirection: '',
            progressionDirection: '',
            notes: '',
          },
          knowledgeRefs: [],
          warehouseRefs: physicalDiscIds,
          teamExecutionSnapshot: {
            contract: 'soda-team-execution/r1',
            candidateId: authority.candidateId,
            reusePolicy: 'cross_scenario_reuse',
            scenario: { identity: 'synthetic-saved-team', tags: [] },
            bangbooId: authority.bangbooId,
            memberIds: agentIds,
            members,
            physicalDiscIds,
            status: 'ready',
            blockers: [],
            confirmedWEngineCopyIds: [],
            sideEffect: 'read_only',
          },
          candidateWarehouse: {
            scope: 'team',
            totalScore: 0,
            boundary: 'Synthetic saved references; no equipment optimization score is claimed.',
            loadouts: members.map((member) => ({
              agentId: member.agentId,
              discIds: member.suggested.discIds,
              totalScore: 0,
              effectiveRolls: 0,
              setPattern: '4+2',
              degraded: false,
            })),
          },
          comparisonCapability: 'direction',
          createdAt: '2026-10-12T00:00:00.000Z',
          updatedAt: '2026-10-12T00:00:00.000Z',
          revision: 1,
        }
      })
      const source = await client.calculateAccountDecision({
        ...request,
        runId: `${request.runId}-with-saved`,
      })
      const before = JSON.stringify(source.input)
      const prepared = prepareRemainingBox(
        source.input,
        request.input.drafts.map((plan) => plan.id),
      )
      const remaining = await client.calculateAccountDecision({
        ...request,
        runId: `${request.runId}-remaining`,
        input: prepared.input,
      })
      const full = projectPrivateTeamOverview(source).overviewModel
      const overview = projectPrivateTeamOverview(remaining, undefined, source)
      const savedItems = (model: typeof full) =>
        model.groups
          .filter((group) => group.kind === 'saved')
          .flatMap((group) => group.items.flatMap((family) => family.variants))
      expect(savedItems(full)).toHaveLength(2)
      expect(savedItems(overview.overviewModel)).toEqual(savedItems(full))
      const missingSourceAuthority = buildTeamLoadoutOverviewModel({
        decision: remaining.snapshot,
        savedPlans: source.input.drafts,
        warehouse: source.input.warehouse,
      })
      expect(
        savedItems(missingSourceAuthority).every((item) => item.cultivationPriority === null),
      ).toBe(true)
      for (const item of savedItems(overview.overviewModel)) {
        expect(item.bangbooId).not.toBeNull()
        expect(item.bangbooAuthority).toBe('authoritative')
        expect(item.cultivationPriority).not.toBeNull()
        expect(item.authorityReasons.length).toBeGreaterThan(0)
        expect(item.authorityNextAction).not.toBeNull()
      }
      const remainingItems = overview.overviewModel.groups
        .filter((group) => group.kind === 'recommended')
        .flatMap((group) => group.items.flatMap((family) => family.variants))
      expect(remainingItems.length).toBeGreaterThan(0)
      expect(
        remainingItems.some((item) => item.agentIds.some((id) => reservedIds.includes(id))),
      ).toBe(false)
      expect(overview.runId).toBe(remaining.runId)
      expect(overview.inputFingerprint).toBe(remaining.snapshot.fingerprint.inputHash)
      expect(JSON.stringify(source.input)).toBe(before)
      expect(() =>
        projectPrivateTeamOverview(remaining, undefined, {
          ...source,
          input: { ...source.input, warehouse: { ...source.input.warehouse, accountId: 'other' } },
        }),
      ).toThrow(/source account/)
    } finally {
      await db.delete()
    }
  }, 60_000)

  it('serializes the real run and exact 18-disc target fit without changing account data', async () => {
    await seedTeamWarehouse()
    const request = query(`team-presentation-${crypto.randomUUID()}`)
    request.input.warehouse = await loadCoreWarehouse()
    request.input.drafts = await listAccountPlanningDrafts(request.input.warehouse.accountId!)
    const before = JSON.stringify(request.input.warehouse)
    const run = await localCalculationQueryClient.calculateAccountDecision(request)

    const overview = projectPrivateTeamOverview(run)
    const identity = {
      runId: run.runId,
      accountId: run.input.warehouse.accountId!,
      inputFingerprint: run.snapshot.fingerprint.inputHash,
    }
    const serializedOverview = JSON.parse(JSON.stringify(overview)) as unknown
    expect(
      acceptTeamOverviewPresentation(serializedOverview, {
        ...identity,
        agentId: null,
        planId: null,
        discId: null,
      }),
    ).not.toBeNull()
    expect(overview.overviewModel.groups.some((group) => group.kind === 'recommended')).toBe(true)
    expect(
      acceptTeamOverviewPresentation(undefined, {
        ...identity,
        agentId: null,
        planId: null,
        discId: null,
      }),
    ).toBeNull()
    expect(
      acceptTeamOverviewPresentation(serializedOverview, {
        ...identity,
        inputFingerprint: 'stale',
        agentId: null,
        planId: null,
        discId: null,
      }),
    ).toBeNull()

    const variant = overview.overviewModel.groups
      .flatMap((group) => group.items.flatMap((family) => family.variants))
      .find((item) => item.kind !== 'saved' && item.detailCandidateId && item.bangbooId)
    if (!variant?.detailCandidateId) throw new Error('No exact team recommendation in real run.')
    const entry = resolveTargetTeamFitEntry(
      run.snapshot,
      variant.detailCandidateId,
      run.input.warehouse,
    )
    if (!entry.targetCandidateId) throw new Error('No target candidate in real run.')
    const fit = await localCalculationQueryClient.calculateTargetTeamWarehouseFit({
      contractVersion: request.contractVersion,
      kind: 'target_team_warehouse_fit',
      runId: run.runId,
      candidateId: entry.targetCandidateId,
    })
    const fitOverview = await localCalculationQueryClient.queryTeamOverviewPresentation({
      contractVersion: request.contractVersion,
      kind: 'team_overview_presentation',
      runId: run.runId,
      context: { agentId: null, planId: null, discId: null },
      fitCandidateIds: [fit.candidateId],
    })
    expect(fitOverview.overviewModel).toEqual(
      projectTargetTeamFitsIntoOverviewModel(
        overview.overviewModel,
        { exact: fit },
        run.input.warehouse,
      ),
    )
    const presentation = projectPrivateTeamExecution(run, fit)
    const serializedFit = JSON.parse(JSON.stringify(presentation)) as unknown
    const accepted = acceptTeamExecutionPresentation(serializedFit, {
      ...identity,
      candidateId: fit.candidateId,
      memberIds: fit.memberIds,
    })
    expect(accepted).not.toBeNull()
    const discIds = accepted!.view.members.flatMap((member) => member.discIds)
    expect(discIds).toHaveLength(18)
    expect(new Set(discIds).size).toBe(18)
    expect(accepted!.view.members.flatMap((member) => member.discFacts)).toHaveLength(18)
    for (const member of fit.targetExecution.members) {
      const agent = request.input.warehouse.roster.agents.find(
        (item) => item.agentId === member.agentId,
      )
      if (!agent) throw new Error('Target fit member is missing from the test roster')
      expect(accepted!.attributePanelsByAgent?.[member.agentId]).toEqual(
        createTeamExecutionAttributePanel({
          agent,
          member,
          discs: request.input.warehouse.discs,
          wEngines: request.input.warehouse.roster.wEngines,
          memberIds: fit.targetExecution.memberIds,
        }),
      )
    }
    expect(
      acceptTeamExecutionPresentation(serializedFit, {
        ...identity,
        candidateId: 'different-candidate',
        memberIds: fit.memberIds,
      }),
    ).toBeNull()
    expect(JSON.stringify(request.input.warehouse)).toBe(before)
    const archivedFit = structuredClone(fit)
    archivedFit.targetExecution.members = archivedFit.targetExecution.members.map((member) => ({
      ...member,
      current: {
        ...member.current,
        discIds: Array.from({ length: 6 }, (_, index) => `archived-${member.agentId}-${index}`),
      },
      actions: [{ kind: 'keep_current_build', agentId: member.agentId }],
    }))
    const archivedOverview = projectPrivateTeamOverview(run, undefined, undefined, [archivedFit])
    const archivedVariant = archivedOverview.overviewModel.groups
      .flatMap((group) => group.items.flatMap((family) => family.variants))
      .find((item) => item.detailCandidateId === variant.detailCandidateId)
    expect(archivedVariant?.readiness).toContain('当前装备记录待更新')
    expect(archivedVariant?.executionStatus).toBe('adjust')
    expect(archivedVariant?.primaryActions?.join(' ')).not.toContain('保持')
    expect(JSON.stringify(request.input.warehouse)).toBe(before)
    localCalculationQueryClient.releaseAccountDecisionRun?.(run.runId)
  }, 60_000)

  it('keeps the ready 18-disc chain 3x6 end to end and fails closed when the presentation loses discs', async () => {
    const materialized = await seedTeamWarehouse()
    const request = query(`team-presentation-chain-${crypto.randomUUID()}`)
    request.input.warehouse = await loadCoreWarehouse()
    const run = await localCalculationQueryClient.calculateAccountDecision(request)
    const memberKey = [...materialized.memberIds].sort().join('|')
    const candidate = authorityConsumerRecommendations(run.snapshot.decisionAuthority).find(
      (item) => [...item.memberIds].sort().join('|') === memberKey,
    )
    if (!candidate) throw new Error('Seeded team is missing from the real run.')
    const fit = await localCalculationQueryClient.calculateTargetTeamWarehouseFit({
      contractVersion: request.contractVersion,
      kind: 'target_team_warehouse_fit',
      runId: run.runId,
      candidateId: candidate.candidateId,
    })

    // Layer 1: the solved plan itself.
    expect({
      status: fit.status,
      discCount: fit.discCount,
      uniqueDiscCount: fit.uniqueDiscCount,
    }).toEqual({ status: 'ready', discCount: 18, uniqueDiscCount: 18 })
    expect(fit.warehousePlan.loadouts.map((loadout) => loadout.discs.length)).toEqual([6, 6, 6])
    expect(new Set(fit.loadouts.flatMap((loadout) => loadout.discIds)).size).toBe(18)

    // Layer 2: the exact execution consumed by every consumer.
    expect(fit.targetExecution.members.map((member) => member.suggested.discIds.length)).toEqual([
      6, 6, 6,
    ])

    // Layer 3: the transported presentation the public panel renders.
    const presentation = projectPrivateTeamExecution(run, fit)
    expect(presentation.view.members.map((member) => member.discIds.length)).toEqual([6, 6, 6])
    expect(presentation.view.members.map((member) => member.discFacts.length)).toEqual([6, 6, 6])
    const presentedIds = presentation.view.members.flatMap((member) => member.discIds)
    expect(new Set(presentedIds).size).toBe(18)

    // Fail closed: a "ready 18" fit whose execution lost its discs must not be transported.
    const tampered = {
      ...fit,
      warehousePlan: { ...fit.warehousePlan, loadouts: [] },
      targetExecution: {
        ...fit.targetExecution,
        members: fit.targetExecution.members.map((member) => ({
          ...member,
          suggested: { ...member.suggested, discIds: [] },
        })),
      },
    } as typeof fit
    expect(() => projectPrivateTeamExecution(run, tampered)).toThrow(/展示投影丢失/)
    localCalculationQueryClient.releaseAccountDecisionRun?.(run.runId)
  }, 60_000)
})
