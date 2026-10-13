import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import { database } from '../db/database'
import { DashboardPage } from './DashboardPage'

vi.mock('../application/accountDecisionWorld', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../application/accountDecisionWorld')>()
  return { ...actual, useAccountDecisionWorld: vi.fn() }
})
// This focused page mount has no shell account-summary context; sponsorship
// does not participate in the staging query or homepage next action.
vi.mock('../components/SponsorSupport', () => ({ SponsorSupport: () => null }))

describe('Dashboard staging identity with the actual reactive query', () => {
  afterEach(() => vi.restoreAllMocks())

  it('does not expose retained account A staging while account B query is delayed', async () => {
    const worldFor = (accountId: string) =>
      ({
        status: 'unavailable',
        run: null,
        nextAction: null,
        liveInput: {
          warehouse: {
            accountId,
            account: { id: accountId, displayName: accountId },
            roster: createEmptyRoster(),
            discs: [],
          },
          drafts: [],
        },
      }) as unknown as ReturnType<typeof useAccountDecisionWorld>
    // Control transport timing only: Dashboard still uses real useLiveQuery,
    // including its retention of the last value when dependencies change.
    const collection = database.accountScanImportBatches
      .where('accountId')
      .equals('account-staging-a')
    const prototype = Object.getPrototypeOf(collection) as typeof collection
    let finishB!: (value: []) => void
    const heldB = new Promise<[]>((resolve) => {
      finishB = resolve
    })
    const read = vi
      .spyOn(prototype, 'toArray')
      .mockResolvedValueOnce([{ importHistory: [] }, { importHistory: [] }] as never)
      .mockReturnValueOnce(heldB as ReturnType<typeof prototype.toArray>)
    vi.mocked(useAccountDecisionWorld).mockReturnValue(worldFor('account-staging-a'))
    const view = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    try {
      await screen.findByText('2 份扫描结果等待导入，点击导入后才会更新账户。')
      vi.mocked(useAccountDecisionWorld).mockReturnValue(worldFor('account-staging-b'))
      view.rerender(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>,
      )
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
      expect(screen.getByRole('region', { name: '本地资料' })).toHaveTextContent(
        'account-staging-b',
      )
      expect(screen.queryByText(/2 份扫描结果等待导入/)).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: '继续正式导入' })).not.toBeInTheDocument()
      await act(async () => finishB([]))
      expect(screen.getByRole('heading', { name: '扫描或导入本地数据' })).toBeInTheDocument()
    } finally {
      finishB([])
      view.unmount()
    }
  })
})
