import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { database } from '../db/database'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import type { AccountDecisionRun } from '../application/calculationQueryContract'
import { currentTeamAnalysisSession } from './teamAnalysisSession'
// Resolve the production calculation graph outside the controlled delivery of its result.
import '../decision/accountDecisionService'
import '../application/localCalculationQueryClientCore'
import {
  findAnalyzeCurrentTeamButton,
  findCurrentTeamRecommendations,
  findFitTeamEquipmentButton,
  findTeamEquipmentHeading,
  seedTeamWarehouse,
  setupOptimizerFlowTestIsolation,
} from './optimizerFlowTestFixtures'

describe('team analysis cancellation and successful retry', () => {
  setupOptimizerFlowTestIsolation()

  it.each([false, true])(
    'stops an active run, ignores its late result and completes retry (remaining BOX: %s)',
    async (remaining) => {
      await seedTeamWarehouse({ remainingBoxTeams: remaining })
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(<App />)
      if (remaining) {
        await user.click(await findAnalyzeCurrentTeamButton())
        await findCurrentTeamRecommendations()
        await user.click(await findFitTeamEquipmentButton())
        await findTeamEquipmentHeading()
        await user.click(screen.getByRole('button', { name: '保存当前队伍方案' }))
        await findCurrentTeamRecommendations()
        await user.click(await screen.findByText('再组一队'))
        await user.click(screen.getByRole('checkbox', { name: /18 张盘齐全/ }))
      }
      const before = {
        discs: await database.accountDriveDiscs.toArray(),
        rosters: await database.accountRosters.toArray(),
        plans: await database.accountPlanningDrafts.toArray(),
      }
      const retainedRunId = currentTeamAnalysisSession?.result.analysisRunId
      const calculate = localCalculationQueryClient.calculateAccountDecision.bind(
        localCalculationQueryClient,
      )
      const release = vi.spyOn(localCalculationQueryClient, 'releaseAccountDecisionRun')
      let held: { runId: string; deliver: () => void } | undefined
      const started = vi
        .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
        .mockImplementation(async (query) => {
          const run = await calculate(query)
          // If one team is reserved, hold the real detached result calculated
          // from the remaining physical discs.
          const target = !remaining || query.input.warehouse.discs.length < before.discs.length
          if (!target || held) return run
          return new Promise<AccountDecisionRun>((resolve) => {
            held = { runId: run.runId, deliver: () => resolve(run) }
          })
        })
      const start = () =>
        remaining
          ? screen.getByRole('button', { name: '推荐另一队' })
          : findAnalyzeCurrentTeamButton()
      await user.click(await start())
      await waitFor(() => expect(held).toBeDefined(), { timeout: 20_000 })
      if (remaining) {
        expect(started).toHaveBeenCalledOnce()
        expect(started.mock.calls[0]![0].input.warehouse.discs).toHaveLength(
          before.discs.length - 18,
        )
      }
      await user.click(screen.getByRole('button', { name: '取消分析' }))
      expect(release).toHaveBeenCalledWith(held!.runId)
      await act(async () => {
        held!.deliver()
      })
      expect(screen.queryByRole('heading', { name: '正在分析当前队伍' })).not.toBeInTheDocument()
      expect(currentTeamAnalysisSession?.result.analysisRunId).not.toBe(held!.runId)
      expect(await database.accountDriveDiscs.toArray()).toEqual(before.discs)
      expect(await database.accountRosters.toArray()).toEqual(before.rosters)
      expect(await database.accountPlanningDrafts.toArray()).toEqual(before.plans)
      if (remaining) {
        expect(screen.getByRole('list', { name: '当前推荐' })).toBeInTheDocument()
        expect(currentTeamAnalysisSession?.result.analysisRunId).toBe(retainedRunId)
      } else {
        expect(screen.queryByRole('list', { name: '当前推荐' })).not.toBeInTheDocument()
      }
      const beforeRetry = started.mock.calls.length
      await user.click(await start())
      await waitFor(() => expect(started.mock.calls.length).toBeGreaterThan(beforeRetry))
      expect(await findCurrentTeamRecommendations()).toBeInTheDocument()
      expect(currentTeamAnalysisSession).toMatchObject({ kind: 'complete' })
      expect(currentTeamAnalysisSession?.result.analysisRunId).not.toBe(held!.runId)
      if (remaining) expect(currentTeamAnalysisSession?.result.reservations).toHaveLength(1)
    },
    30_000,
  )
})
