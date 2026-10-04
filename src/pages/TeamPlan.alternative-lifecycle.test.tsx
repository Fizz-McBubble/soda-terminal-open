import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import {
  findAnalyzeCurrentTeamButton,
  findFitTeamEquipmentButton,
  findTeamEquipmentHeading,
  optimizerFlowIntegrationTestTimeout,
  seedTeamWarehouse,
  setupOptimizerFlowTestIsolation,
} from './optimizerFlowTestFixtures'

describe('alternative team navigation lifecycle', () => {
  setupOptimizerFlowTestIsolation()
  it(
    'stays on the team list when a departed alternative route query finally returns',
    async () => {
      await seedTeamWarehouse({ sameCoreAlternatives: true })
      window.history.pushState({}, '', '/loadouts/team')
      const user = userEvent.setup()
      render(<App />)
      await user.click(await findAnalyzeCurrentTeamButton())
      await user.click(await findFitTeamEquipmentButton())
      await findTeamEquipmentHeading()
      const original = localCalculationQueryClient.queryTeamRoutePresentation.bind(
        localCalculationQueryClient,
      )
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      const query = vi
        .spyOn(localCalculationQueryClient, 'queryTeamRoutePresentation')
        .mockImplementation(async (input) => {
          await gate
          return original(input)
        })
      try {
        await user.click(
          await screen.findByRole('button', {
            name: /^(用.+替换|查看含.+的另一搭配)/,
          }),
        )
        await waitFor(() => expect(query).toHaveBeenCalledOnce())
        expect(screen.getByText('正在搭配替换队伍…')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /返回选择队伍/ }))
        await waitFor(() => expect(window.location.pathname).toBe('/loadouts/team'))
        await act(async () => {
          release()
          await query.mock.results[0]!.value
        })
        expect(window.location.pathname).toBe('/loadouts/team')
        expect(screen.queryByText('正在搭配替换队伍…')).not.toBeInTheDocument()
      } finally {
        release()
        query.mockRestore()
      }
    },
    optimizerFlowIntegrationTestTimeout,
  )
})
