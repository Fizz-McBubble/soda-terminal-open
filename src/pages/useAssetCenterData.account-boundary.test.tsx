import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as repository from '../accounts/repository'
import { database } from '../db/database'
import { resetDatabase, seed } from './assetCenterR6TestFixture'
import { useAssetCenterData } from './useAssetCenterData'
import { AssetCenterReadFeedback } from './AssetCenterReadFeedback'

function ReadView() {
  const reads = useAssetCenterData(0)
  return (
    <>
      <AssetCenterReadFeedback reads={reads} />
      {reads.assets.data && <h1>{reads.assets.data.account?.displayName}</h1>}
    </>
  )
}

describe('asset read account identity boundary', () => {
  beforeEach(resetDatabase)
  afterEach(() => vi.restoreAllMocks())

  it('hides account A when the real active identity becomes B and its roster query fails', async () => {
    const { account: first } = await seed()
    const second = await repository.createAccount('第二合成账户', database, {
      id: 'account-synthetic-asset-read-second',
    })
    await repository.setActiveAccount(first.id)
    const original = repository.getAccountRoster
    const rosterRead = vi
      .spyOn(repository, 'getAccountRoster')
      .mockImplementation((...args) =>
        args[0] === second.id
          ? Promise.reject(new Error('synthetic B roster read failure'))
          : original(...args),
      )
    const before = await database.accountRosters.toArray()
    render(<ReadView />)
    await screen.findByRole('heading', { name: first.displayName })
    await act(() => repository.setActiveAccount(second.id))
    await screen.findByRole('alert')
    expect(screen.queryByRole('heading', { name: first.displayName })).toBeNull()
    expect(screen.queryByRole('heading', { name: second.displayName })).toBeNull()
    expect((await repository.getActiveAccount())?.id).toBe(second.id)
    expect(await database.accountRosters.toArray()).toEqual(before)
    rosterRead.mockImplementation(original)
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }))
    await screen.findByRole('heading', { name: second.displayName })
    expect(screen.queryByRole('heading', { name: first.displayName })).toBeNull()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
