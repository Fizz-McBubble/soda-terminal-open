import { act, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { database } from '../db/database'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import { currentTeamAnalysisSession } from './teamAnalysisSession'
import { choosePlayerSelect } from '../testing/choosePlayerSelect'
import { traceTeamRematch, type TeamRematchTraceWindow } from './optimizer/teamRematchTrace'
import {
  findAnalyzeCurrentTeamButton,
  findFitTeamEquipmentButton,
  findTeamEquipmentHeading,
  optimizerFlowIntegrationTestTimeout,
  seedTeamWarehouse,
  setupOptimizerFlowTestIsolation,
} from './optimizerFlowTestFixtures'

describe('team rematch lifecycle', () => {
  setupOptimizerFlowTestIsolation()
  it(
    'passes real saved player parameters through the reanalyze rematchPlan entry to the actual fit query',
    async () => {
      await seedTeamWarehouse()
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(<App />)
      await user.click(await findAnalyzeCurrentTeamButton())
      await user.click(await findFitTeamEquipmentButton())
      await findTeamEquipmentHeading()
      await user.click(screen.getByRole('button', { name: '保存当前队伍方案' }))
      await screen.findByRole('heading', { name: '当前队伍建议' })
      const stored = (await database.accountPlanningDrafts.toArray()).find(
        (row) => row.kind === 'team',
      )
      if (!stored?.teamEquipmentParameters) throw new Error('Expected real saved team parameters')
      const parameters = {
        ...stored.teamEquipmentParameters,
        source: 'player_confirmed' as const,
        wEngines: stored.teamEquipmentParameters.wEngines.map((row) => ({
          ...row,
          level: 40,
          ascension: 3,
          refinement: 2,
        })),
        potentialByAgentId: { 'agent-yixuan': 2 },
      }
      await database.accountPlanningDrafts.update(stored.scopedId, {
        teamEquipmentParameters: parameters,
      })
      const before = {
        rosters: await database.accountRosters.toArray(),
        discs: await database.accountDriveDiscs.toArray(),
        drafts: await database.accountPlanningDrafts.toArray(),
      }
      const replay = vi.spyOn(localCalculationQueryClient, 'querySavedTeamPlanReplay')
      const fit = vi.spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
      window.history.pushState(
        {},
        '',
        `/loadouts/team?reanalyze=1&rematchPlan=${encodeURIComponent(stored.id)}`,
      )
      window.dispatchEvent(new PopStateEvent('popstate'))
      await waitFor(() => expect(fit).toHaveBeenCalledTimes(1), { timeout: 20_000 })
      await findTeamEquipmentHeading()
      expect(replay).toHaveBeenCalled()
      const replayResult = await replay.mock.results.at(-1)!.value
      expect(replayResult.match?.effectiveEquipmentParameters).toEqual(parameters)
      expect(fit.mock.calls[0]![0].equipmentParameters).toEqual(parameters)
      expect(await database.accountRosters.toArray()).toEqual(before.rosters)
      expect(await database.accountDriveDiscs.toArray()).toEqual(before.discs)
      expect(await database.accountPlanningDrafts.toArray()).toEqual(before.drafts)
    },
    optimizerFlowIntegrationTestTimeout,
  )

  it('collects explicitly enabled debug metadata only in a bounded memory buffer', () => {
    const target = window as TeamRematchTraceWindow
    const readTrace = (): TeamRematchTraceWindow['__sodaTeamRematchTrace'] =>
      target.__sodaTeamRematchTrace
    try {
      delete target.__sodaTeamRematchTraceEnabled
      delete target.__sodaTeamRematchTrace
      traceTeamRematch('disabled', { current: true })
      expect(target.__sodaTeamRematchTrace).toBeUndefined()
      target.__sodaTeamRematchTraceEnabled = true
      for (let generation = 0; generation < 201; generation += 1)
        traceTeamRematch('enabled', { generation })
      expect(readTrace()).toHaveLength(200)
      expect(readTrace()?.[0]?.checks).toEqual({ generation: 1 })
    } finally {
      delete target.__sodaTeamRematchTraceEnabled
      delete target.__sodaTeamRematchTrace
    }
  })
  it(
    'rematches repeatedly through the original detail button under StrictMode while the run stays current',
    async () => {
      await seedTeamWarehouse()
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(
        <StrictMode>
          <App />
        </StrictMode>,
      )
      await user.click(await findAnalyzeCurrentTeamButton())
      await user.click(await findFitTeamEquipmentButton())
      await findTeamEquipmentHeading()
      const teamPath = window.location.pathname
      const before = {
        rosters: await database.accountRosters.toArray(),
        discs: await database.accountDriveDiscs.toArray(),
        drafts: await database.accountPlanningDrafts.toArray(),
      }
      const fit = vi.spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
      const route = vi.spyOn(localCalculationQueryClient, 'queryTeamRoutePresentation')
      const previousFit = Object.values(currentTeamAnalysisSession!.result.targetTeamFits)[0]!
      for (let repeat = 1; repeat <= 2; repeat += 1) {
        await user.click(screen.getByRole('button', { name: '重新搭配' }))
        await waitFor(() => expect(fit).toHaveBeenCalledTimes(repeat), { timeout: 20_000 })
        await findTeamEquipmentHeading()
        expect(window.location.pathname).toBe(teamPath)
        expect(route).toHaveBeenCalledTimes(repeat)
      }
      expect(fit.mock.calls[0]![0].candidateId).toBe(
        decodeURIComponent(teamPath.split('/').at(-1)!),
      )
      expect(fit.mock.calls[1]![0]).toEqual(fit.mock.calls[0]![0])
      expect(fit.mock.calls[0]![0].equipmentParameters).toBeUndefined()
      expect(
        Object.values(currentTeamAnalysisSession!.result.targetTeamFits)[0]!
          .effectiveEquipmentParameters,
      ).toEqual(previousFit.effectiveEquipmentParameters)
      expect(previousFit.effectiveEquipmentParameters?.source).toBe('source_defaults')
      expect(await database.accountRosters.toArray()).toEqual(before.rosters)
      expect(await database.accountDriveDiscs.toArray()).toEqual(before.discs)
      expect(await database.accountPlanningDrafts.toArray()).toEqual(before.drafts)
    },
    optimizerFlowIntegrationTestTimeout,
  )
  it('preserves player-confirmed equipment and deployment order during an inline rematch', async () => {
    await seedTeamWarehouse()
    const drafts = await database.accountPlanningDrafts.toArray()
    window.history.pushState({}, '', '/loadouts/team')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await findAnalyzeCurrentTeamButton())
    await user.click(await findFitTeamEquipmentButton())
    await findTeamEquipmentHeading()
    await choosePlayerSelect(screen.getByLabelText(/方案音擎精炼/), '5')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存当前队伍方案' })).toBeEnabled(),
    )
    const detailPath = window.location.pathname
    const previousFit = Object.values(currentTeamAnalysisSession!.result.targetTeamFits)[0]!
    const fit = vi.spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
    await user.click(screen.getByRole('button', { name: '重新搭配' }))
    await waitFor(() => expect(fit).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存当前队伍方案' })).toBeEnabled(),
    )
    expect(window.location.pathname).toBe(detailPath)
    expect(fit.mock.calls[0]![0].equipmentParameters).toEqual(
      previousFit.effectiveEquipmentParameters,
    )
    expect(
      Object.values(currentTeamAnalysisSession!.result.targetTeamFits)[0]!.targetExecution
        .deploymentOrder,
    ).toEqual(previousFit.targetExecution.deploymentOrder)
    expect(screen.getByLabelText(/方案音擎精炼/)).toHaveValue('5')
    expect(await database.accountPlanningDrafts.toArray()).toEqual(drafts)
  }, 30000)
  it(
    'rematches the exact current-run team when the overview contains only saved records',
    async () => {
      await seedTeamWarehouse()
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(<App />)
      await user.click(await findAnalyzeCurrentTeamButton())
      await user.click(await findFitTeamEquipmentButton())
      await findTeamEquipmentHeading()
      const teamId = decodeURIComponent(window.location.pathname.split('/').at(-1)!)
      await user.click(screen.getByRole('button', { name: '保存当前队伍方案' }))
      await screen.findByRole('heading', { name: '当前队伍建议' })
      const disc = await database.accountDriveDiscs.toCollection().first()
      if (!disc) throw new Error('Expected a test drive disc')
      await database.accountDriveDiscs.update(disc.scopedId, { tags: ['saved-rematch-refresh'] })
      await screen.findByRole('status', { name: '账户数据已更新' })
      const before = {
        rosters: await database.accountRosters.toArray(),
        discs: await database.accountDriveDiscs.toArray(),
        drafts: await database.accountPlanningDrafts.toArray(),
      }
      const route = vi.spyOn(localCalculationQueryClient, 'queryTeamRoutePresentation')
      const fit = vi.spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
      const calculate = localCalculationQueryClient.calculateAccountDecision.bind(
        localCalculationQueryClient,
      )
      const prunedPresentation = vi
        .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
        .mockImplementation(async (query) => {
          const run = await calculate(query)
          if (!run.teamPresentation) throw new Error('Expected a real team presentation')
          // Exercise presentation pruning independently of producer eligibility:
          // preserve the actual run, snapshot, saved rows and private fit solver.
          return {
            ...run,
            teamPresentation: {
              ...run.teamPresentation,
              overviewModel: {
                ...run.teamPresentation.overviewModel,
                groups: run.teamPresentation.overviewModel.groups.map((group) => ({
                  ...group,
                  items: group.kind === 'saved' ? group.items : [],
                })),
              },
            },
          }
        })
      window.history.pushState(
        {},
        '',
        `/loadouts/team?reanalyze=1&rematchTeam=${encodeURIComponent(teamId)}`,
      )
      window.dispatchEvent(new PopStateEvent('popstate'))

      expect(await findTeamEquipmentHeading()).toBeInTheDocument()
      expect(window.location.pathname).toBe(`/loadouts/team/${encodeURIComponent(teamId)}`)
      expect(route).toHaveBeenCalledWith(expect.objectContaining({ candidateId: teamId }))
      expect(fit).toHaveBeenCalledTimes(1)
      const routeResult = await route.mock.results[0]!.value
      expect(routeResult.team.agentIds.toSorted()).toEqual(
        ['agent-yixuan', 'agent-dialyn', 'agent-lucia'].toSorted(),
      )
      expect(fit.mock.calls[0]![0]).toEqual(
        expect.objectContaining({
          runId: routeResult.runId,
          candidateId: routeResult.targetCandidateId,
        }),
      )
      const prunedRun: Awaited<ReturnType<typeof calculate>> =
        await prunedPresentation.mock.results[0]!.value
      expect(
        prunedRun.teamPresentation?.overviewModel.groups.flatMap((group) =>
          group.items.flatMap((family) =>
            family.variants.filter((variant) => variant.kind !== 'saved'),
          ),
        ),
      ).toEqual([])
      expect(
        prunedRun.teamPresentation?.overviewModel.groups.flatMap((group) => group.items),
      ).not.toEqual([])
      expect(await database.accountRosters.toArray()).toEqual(before.rosters)
      expect(await database.accountDriveDiscs.toArray()).toEqual(before.discs)
      expect(await database.accountPlanningDrafts.toArray()).toEqual(before.drafts)
    },
    optimizerFlowIntegrationTestTimeout,
  )
  it('rejects an unknown rematch identity without fitting a different current team', async () => {
    await seedTeamWarehouse()
    const fit = vi.spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
    window.history.pushState({}, '', '/loadouts/team?reanalyze=1&rematchTeam=unknown-current-team')
    render(<App />)

    expect(
      await screen.findByText('这支队伍暂不能生成配装，请重新选择搭配。', {}, { timeout: 20_000 }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/loadouts/team')
    expect(fit).not.toHaveBeenCalled()
  })
  it('does not fit or navigate a rematch whose route query completes after leaving the page', async () => {
    await seedTeamWarehouse()
    const originalRoute = localCalculationQueryClient.queryTeamRoutePresentation.bind(
      localCalculationQueryClient,
    )
    let releaseRoute!: () => void
    const pending = new Promise<void>((resolve) => {
      releaseRoute = resolve
    })
    let completed = false
    const delayedRoute = vi
      .spyOn(localCalculationQueryClient, 'queryTeamRoutePresentation')
      .mockImplementation(async (query) => {
        await pending
        const route = await originalRoute(query)
        completed = true
        return route
      })
    const fit = vi.spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
    window.history.pushState(
      {},
      '',
      '/loadouts/team?reanalyze=1&rematchTeam=formation%3Aagent-dialyn%2Bagent-lucia%2Bagent-yixuan',
    )
    const user = userEvent.setup()
    render(<App />)
    try {
      await waitFor(() => expect(delayedRoute).toHaveBeenCalledTimes(1))
      await user.click(screen.getByRole('link', { name: '代理人养成' }))
      await waitFor(() => expect(window.location.pathname).toBe('/development'))
      releaseRoute()
      await waitFor(() => expect(completed).toBe(true))
      expect(window.location.pathname).toBe('/development')
      expect(fit).not.toHaveBeenCalled()
    } finally {
      releaseRoute()
      delayedRoute.mockRestore()
    }
  }, 30_000)
  it('keeps a stale team detail visible but blocks its parameter changes and save until it is recomputed', async () => {
    await seedTeamWarehouse()
    window.history.pushState({}, '', '/loadouts/team')
    const user = userEvent.setup()
    render(<App />)

    await user.click(await findAnalyzeCurrentTeamButton())
    await user.click(await findFitTeamEquipmentButton())
    await findTeamEquipmentHeading()
    const detailPath = window.location.pathname
    const savePlan = screen.getByRole('button', { name: '保存当前队伍方案' })
    const parameter = screen.getByLabelText(/方案音擎精炼/)
    expect(savePlan).toBeEnabled()
    expect(parameter).toBeEnabled()

    const disc = await database.accountDriveDiscs.toCollection().first()
    if (!disc) throw new Error('Expected a test drive disc')
    await database.accountDriveDiscs.update(disc.scopedId, { tags: ['changed-during-team-detail'] })

    await waitFor(() => expect(savePlan).toBeDisabled())
    expect(screen.getByRole('button', { name: '重新搭配' })).toBeInTheDocument()
    expect(savePlan).toBeDisabled()
    expect(parameter).toBeDisabled()
    expect(screen.queryByRole('button', { name: /录入音擎|调整音擎/ })).not.toBeInTheDocument()

    const originalFit = localCalculationQueryClient.calculateTargetTeamWarehouseFit.bind(
      localCalculationQueryClient,
    )
    let releaseFit: (() => void) | undefined
    const fitGate = new Promise<void>((resolve) => {
      releaseFit = resolve
    })
    const delayedFit = vi
      .spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
      .mockImplementation(async (query) => {
        await fitGate
        return originalFit(query)
      })
    try {
      await user.click(screen.getByRole('button', { name: '重新搭配' }))
      await waitFor(() => expect(delayedFit).toHaveBeenCalledTimes(1))
      expect(window.location.pathname).toBe(detailPath)
      expect(screen.getByText('正在重新搭配装备…')).toBeInTheDocument()
      expect(await findTeamEquipmentHeading()).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '重新搭配' }))
      expect(delayedFit).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('heading', { name: '正在生成队伍配装' })).not.toBeInTheDocument()
      expect(savePlan).toBeDisabled()
      releaseFit?.()
      expect(await findTeamEquipmentHeading()).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: '保存当前队伍方案' })).toBeEnabled(),
      )
      expect(window.location.pathname).toBe(detailPath)
    } finally {
      releaseFit?.()
      delayedFit.mockRestore()
    }
  }, 30000)
  it('keeps the exact detail and effective parameters when rematching fails', async () => {
    await seedTeamWarehouse()
    const drafts = await database.accountPlanningDrafts.toArray()
    window.history.pushState({}, '', '/loadouts/team')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await findAnalyzeCurrentTeamButton())
    await user.click(await findFitTeamEquipmentButton())
    await findTeamEquipmentHeading()
    const detailPath = window.location.pathname
    const previousFit = Object.values(currentTeamAnalysisSession!.result.targetTeamFits)[0]!
    const fit = vi
      .spyOn(localCalculationQueryClient, 'calculateTargetTeamWarehouseFit')
      .mockRejectedValueOnce(new Error('重新搭配失败；账户资产没有改变。'))
    await user.click(screen.getByRole('button', { name: '重新搭配' }))
    await screen.findByText('重新搭配失败；账户资产没有改变。')
    expect(window.location.pathname).toBe(detailPath)
    expect(await findTeamEquipmentHeading()).toBeInTheDocument()
    expect(Object.values(currentTeamAnalysisSession!.result.targetTeamFits)[0]).toEqual(previousFit)
    expect(fit).toHaveBeenCalledTimes(1)
    expect(await database.accountPlanningDrafts.toArray()).toEqual(drafts)
  }, 30000)
  it('does not navigate back to a rematched team when analysis finishes after leaving the page', async () => {
    await seedTeamWarehouse()
    window.history.pushState({}, '', '/loadouts/team')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await findAnalyzeCurrentTeamButton())
    await user.click(await findFitTeamEquipmentButton())
    await findTeamEquipmentHeading()
    const disc = await database.accountDriveDiscs.toCollection().first()
    if (!disc) throw new Error('Expected a test drive disc')
    await database.accountDriveDiscs.update(disc.scopedId, { tags: ['changed-before-rematch'] })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存当前队伍方案' })).toBeDisabled(),
    )
    const before = {
      rosters: await database.accountRosters.toArray(),
      discs: await database.accountDriveDiscs.toArray(),
      drafts: await database.accountPlanningDrafts.toArray(),
    }
    const calculate = localCalculationQueryClient.calculateAccountDecision.bind(
      localCalculationQueryClient,
    )
    let releaseCalculation!: () => void
    const pending = new Promise<void>((resolve) => {
      releaseCalculation = resolve
    })
    let completed = false
    const delayed = vi
      .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
      .mockImplementation(async (input) => {
        await pending
        const run = await calculate(input)
        completed = true
        return run
      })
    try {
      await user.click(screen.getByRole('button', { name: '重新搭配' }))
      await waitFor(() => expect(delayed).toHaveBeenCalledTimes(1))
      await user.click(screen.getByRole('link', { name: '代理人养成' }))
      await waitFor(() => expect(window.location.pathname).toBe('/development'))
      releaseCalculation()
      await waitFor(() => expect(completed).toBe(true))
      // Allow every zero-delay post-calculation stage to finish, including the
      // old continuation that used to navigate an already abandoned request.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
      })
      expect(window.location.pathname).toBe('/development')
      expect(screen.queryByRole('heading', { name: /的方案配装/ })).not.toBeInTheDocument()
      expect(await database.accountRosters.toArray()).toEqual(before.rosters)
      expect(await database.accountDriveDiscs.toArray()).toEqual(before.discs)
      expect(await database.accountPlanningDrafts.toArray()).toEqual(before.drafts)
    } finally {
      releaseCalculation()
      delayed.mockRestore()
    }
  }, 30_000)
})
