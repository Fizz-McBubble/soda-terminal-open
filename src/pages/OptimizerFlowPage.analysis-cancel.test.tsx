import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { database } from '../db/database'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import type { AccountDecisionRun } from '../application/calculationQueryContract'
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
        await screen.findByRole('heading', { name: '当前队伍建议' })
        await user.click(await screen.findByText('再组一队'))
        await user.click(screen.getByRole('checkbox', { name: /18 张盘齐全/ }))
      }
      const before = {
        discs: await database.accountDriveDiscs.toArray(),
        rosters: await database.accountRosters.toArray(),
        plans: await database.accountPlanningDrafts.toArray(),
      }
      const calculate = localCalculationQueryClient.calculateAccountDecision.bind(
        localCalculationQueryClient,
      )
      let deliver: (() => Promise<void>) | undefined
      const deferred = vi
        .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
        .mockImplementationOnce(
          (query) =>
            new Promise<AccountDecisionRun>((resolve) => {
              deliver = async () => resolve(await calculate(query))
            }),
        )
      const release = vi.spyOn(localCalculationQueryClient, 'releaseAccountDecisionRun')
      if (remaining) {
        // The source account refresh succeeds; delay the detached remaining-BOX run.
        deferred.mockRestore()
        vi.spyOn(localCalculationQueryClient, 'calculateAccountDecision')
          .mockImplementationOnce(calculate)
          .mockImplementationOnce(
            (query) =>
              new Promise<AccountDecisionRun>((resolve) => {
                deliver = async () => resolve(await calculate(query))
              }),
          )
        await user.click(screen.getByRole('button', { name: '推荐另一队' }))
      } else await user.click(await findAnalyzeCurrentTeamButton())
      await waitFor(() => expect(deliver).toBeDefined(), { timeout: 20_000 })
      await user.click(screen.getByRole('button', { name: '取消分析' }))
      expect(release).toHaveBeenCalled()
      await act(async () => {
        await deliver!()
      })
      expect(screen.queryByRole('heading', { name: '正在分析当前队伍' })).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before.discs)
      expect(await database.accountRosters.toArray()).toEqual(before.rosters)
      expect(await database.accountPlanningDrafts.toArray()).toEqual(before.plans)
      if (remaining) {
        expect(screen.getByRole('list', { name: '当前推荐' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '推荐另一队' }))
      } else {
        expect(screen.queryByRole('list', { name: '当前推荐' })).not.toBeInTheDocument()
        await user.click(await findAnalyzeCurrentTeamButton())
      }
      expect(await findCurrentTeamRecommendations()).toBeInTheDocument()
    },
    30_000,
  )
})
