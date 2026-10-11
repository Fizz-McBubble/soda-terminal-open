import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { getAccountRoster, getAccountPreference } from '../accounts/repository'
import { currentAssetProjection } from '../gameDataPacks/currentAssetProjection'
import { resetDatabase, seed } from './assetCenterR6TestFixture'

describe('explicit asset catalogue URL selection', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    await resetDatabase()
  })

  it('honors an explicit agent URL after a different cached selection and account preference', async () => {
    const { account } = await seed()
    const roster = await getAccountRoster(account.id)
    const [target, cached] = roster.agents
    const targetName = currentAssetProjection.agents.find(
      (agent) => agent.stableId === target!.agentId,
    )!.playerName
    const cachedName = currentAssetProjection.agents.find(
      (agent) => agent.stableId === cached!.agentId,
    )!.playerName
    window.history.pushState({}, '', `/assets/agents?selected=${target!.agentId}`)
    const first = render(<App />)
    const cachedOption = await screen.findByRole('option', { name: cachedName }, { timeout: 5000 })
    await userEvent.click(cachedOption)
    expect(cachedOption).toHaveAttribute('aria-selected', 'true')
    await waitFor(async () =>
      expect(await getAccountPreference(account.id, 'assets.agents.last-selected-agent-v1')).toBe(
        cached!.agentId,
      ),
    )
    first.unmount()
    window.history.pushState({}, '', `/assets/agents?selected=${target!.agentId}`)
    render(<App />)
    await waitFor(() =>
      expect(
        screen.getByRole('option', {
          name: (name) => name === targetName || name.startsWith(`${targetName}，`),
        }),
      ).toHaveAttribute('aria-selected', 'true'),
    )
    expect(screen.getByRole('option', { name: cachedName })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })
})
