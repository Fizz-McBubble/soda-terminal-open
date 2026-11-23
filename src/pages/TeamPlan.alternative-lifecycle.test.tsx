import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
const usage = vi.hoisted(() => ({ begin: vi.fn(), outcome: vi.fn() }))
vi.mock('../usageStatistics/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../usageStatistics/client')>()),
  beginUsageOperation: (action: string) => {
    usage.begin(action)
    let finished = false
    return (outcome: string) => {
      if (finished) return
      finished = true
      usage.outcome(outcome)
    }
  },
}))
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import {
  findAnalyzeCurrentTeamButton,
  findFitTeamEquipmentButton,
  selectSameCoreFixtureTeam,
  findTeamEquipmentHeading,
  optimizerFlowIntegrationTestTimeout,
  seedTeamWarehouse,
  setupOptimizerFlowTestIsolation,
  setupRealTeamRematchModules,
} from './optimizerFlowTestFixtures'

describe('alternative team navigation lifecycle', () => {
  setupOptimizerFlowTestIsolation()
  setupRealTeamRematchModules()
  it(
    'stays on the team list when a departed alternative route query finally returns',
    async () => {
      await seedTeamWarehouse({ sameCoreAlternatives: true })
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(<App />)
      await user.click(await findAnalyzeCurrentTeamButton())
      await selectSameCoreFixtureTeam(user)
      await user.click(await findFitTeamEquipmentButton())
      await findTeamEquipmentHeading()
      expect(usage.begin.mock.calls).toEqual([['team_loadout']])
      expect(usage.outcome.mock.calls).toEqual([['success']])
      const original = localCalculationQueryClient.queryTeamRoutePresentation.bind(
        localCalculationQueryClient,
      )
      let release!: () => void
      let capturedSignal: AbortSignal | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const query = vi
        .spyOn(localCalculationQueryClient, 'queryTeamRoutePresentation')
        .mockImplementation(async (input, options) => {
          capturedSignal = options?.signal
          await gate
          return original(input, options)
        })
      try {
        const headingBefore = screen.getByRole('heading', { level: 1 }).textContent
        await user.click(
          await screen.findByRole('button', {
            name: /^(用.+替换|查看含.+的另一搭配)/,
          }),
        )
        await waitFor(() => expect(query).toHaveBeenCalledOnce())
        expect(screen.getByText('正在搭配替换队伍…')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(headingBefore!)
        expect(screen.getByRole('button', { name: '取消切换' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /返回选择队伍/ }))
        await waitFor(() => expect(window.location.pathname).toBe('/loadouts/team'))
        expect(capturedSignal?.aborted).toBe(true)
        await act(async () => {
          release()
          await query.mock.results[0]!.value.catch(() => undefined)
        })
        expect(window.location.pathname).toBe('/loadouts/team')
        expect(screen.queryByText('正在搭配替换队伍…')).not.toBeInTheDocument()
        expect(usage.begin.mock.calls).toEqual([['team_loadout']])
        expect(usage.outcome.mock.calls).toEqual([['success']])
      } finally {
        release()
        query.mockRestore()
      }
    },
    optimizerFlowIntegrationTestTimeout,
  )

  it(
    'keeps team identity and lets the player cancel a same-core switch in place with real abort',
    async () => {
      await seedTeamWarehouse({ sameCoreAlternatives: true })
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(<App />)
      await user.click(await findAnalyzeCurrentTeamButton())
      await selectSameCoreFixtureTeam(user)
      await user.click(await findFitTeamEquipmentButton())
      await findTeamEquipmentHeading()
      const originalPath = window.location.pathname
      const originalHeading = screen.getByRole('heading', { level: 1 }).textContent ?? ''
      expect(originalHeading).not.toBe('')
      const original = localCalculationQueryClient.queryTeamRoutePresentation.bind(
        localCalculationQueryClient,
      )
      let release!: () => void
      let capturedSignal: AbortSignal | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const query = vi
        .spyOn(localCalculationQueryClient, 'queryTeamRoutePresentation')
        .mockImplementation(async (input, options) => {
          capturedSignal = options?.signal
          await gate
          return original(input, options)
        })
      try {
        await user.click(
          await screen.findByRole('button', {
            name: /^(用.+替换|查看含.+的另一搭配)/,
          }),
        )
        await waitFor(() => expect(query).toHaveBeenCalledOnce())
        expect(screen.getByText('正在搭配替换队伍…')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(originalHeading)
        expect(screen.getByRole('button', { name: /返回选择队伍/ })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: '取消切换' }))
        expect(capturedSignal?.aborted).toBe(true)
        expect(screen.queryByText('正在搭配替换队伍…')).not.toBeInTheDocument()
        expect(window.location.pathname).toBe(originalPath)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(originalHeading)
        await act(async () => {
          release()
          await query.mock.results[0]!.value.catch(() => undefined)
        })
        expect(window.location.pathname).toBe(originalPath)
      } finally {
        release()
        query.mockRestore()
      }
    },
    optimizerFlowIntegrationTestTimeout,
  )
})
