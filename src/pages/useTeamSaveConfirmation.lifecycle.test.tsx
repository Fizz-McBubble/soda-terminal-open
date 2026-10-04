import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useTeamSaveConfirmation } from './useTeamSaveConfirmation'
import type { AccountPlanningDraft } from '../accounts/types'

const list = vi.hoisted(() => vi.fn())
vi.mock('../accounts/planningDrafts', () => ({
  listAccountPlanningDrafts: list,
  getAccountPlanningDraft: vi.fn(),
}))

it('settles a save confirmation cancelled by leaving during its local plan read', async () => {
  let finish!: (plans: AccountPlanningDraft[]) => void
  list.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const view = renderHook(useTeamSaveConfirmation)
  const pending = view.result.current.request('isolated-a', ['agent-billy'])
  view.unmount()
  await act(async () => {
    finish([{ kind: 'team', selection: { agentIds: ['agent-billy'] } } as AccountPlanningDraft])
  })
  await expect(pending).resolves.toBeNull()
})
