import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { createAccount, setActiveAccount } from '../accounts/repository'
import type {
  AccountDecisionQuery,
  AccountDecisionRun,
} from '../application/calculationQueryContract'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import type { database as AppDatabase } from '../db/database'
import * as imageInstaller from '../assets/visualAssetInstallCoordinator'

export function dashboardDecisionReceipt(
  query: AccountDecisionQuery,
  recommendationCount: number,
): AccountDecisionRun {
  return {
    runId: query.runId,
    capturedAt: query.capturedAt,
    input: query.input,
    inputFingerprint: localCalculationQueryClient.fingerprintAccountDecisionInput(query.input),
    claimStatus: recommendationCount ? 'candidate' : 'unsupported',
    decisionAuthority: { status: 'ready', recommendationCount, blockers: [] },
    get snapshot(): AccountDecisionRun['snapshot'] {
      throw new Error('首页应只消费公开分析回执。')
    },
  }
}

export function registerDashboardPageImageCases(context: {
  App: ComponentType
  database: typeof AppDatabase
  seedDiscs: (accountId: string, count: number) => Promise<void>
}) {
  it('keeps the account usable when automatic image loading fails', async () => {
    const account = await createAccount('图片失败账户', context.database, { makeDefault: true })
    await context.seedDiscs(account.id, 6)
    const before = await context.database.accountDriveDiscs.toArray()
    vi.mocked(imageInstaller.getOfficialCatalogInstallStatus).mockReturnValue({
      kind: 'error',
      completed: 0,
      total: 40,
      failed: 40,
    })
    vi.mocked(imageInstaller.ensureOfficialCatalogInstalled).mockRejectedValue(new Error('offline'))
    window.history.pushState({}, '', '/')
    render(<context.App />)
    const card = await screen.findByRole('region', { name: '本地资料' })
    expect(within(card).getByTitle('图鉴图片加载失败')).toBeInTheDocument()
    expect(card).toHaveTextContent('图片失败账户')
    expect(card).toHaveTextContent('6 张')
    expect(within(card).getByRole('button', { name: '补齐图片' })).toBeEnabled()
    expect(screen.getByRole('img', { name: '首页角色插画' })).toBeInTheDocument()
    expect(await context.database.accountDriveDiscs.toArray()).toEqual(before)
  })

  it('retries only after a failed automatic load and preserves account data', async () => {
    const account = await createAccount('补齐图片测试', context.database, { makeDefault: true })
    await context.seedDiscs(account.id, 6)
    const before = await context.database.accountDriveDiscs.toArray()
    type Status = ReturnType<typeof imageInstaller.getOfficialCatalogInstallStatus>
    let onStatus!: (status: Status) => void
    vi.mocked(imageInstaller.getOfficialCatalogInstallStatus).mockReturnValue({
      kind: 'loading',
      completed: 0,
      total: 40,
      failed: 0,
    })
    vi.mocked(imageInstaller.subscribeOfficialCatalogInstallStatus).mockImplementation(
      (listener) => {
        onStatus = listener
        return () => true
      },
    )
    const install = vi.mocked(imageInstaller.ensureOfficialCatalogInstalled)
    install.mockImplementation(async (options) => {
      if (!options?.verifyCache) throw new Error('offline')
      onStatus({ kind: 'ready', completed: 40, total: 40, failed: 0 })
    })
    const explicitRepairs = () => install.mock.calls.filter(([options]) => options?.verifyCache)
    window.history.pushState({}, '', '/')
    render(<context.App />)
    await screen.findByTitle('图鉴图片 0/40')
    expect(install).toHaveBeenCalledWith()
    expect(explicitRepairs()).toHaveLength(0)
    await act(async () => onStatus({ kind: 'partial', completed: 38, total: 40, failed: 2 }))
    const card = within(screen.getByRole('region', { name: '本地资料' }))
    await userEvent.click(card.getByRole('button', { name: '补齐图片' }))
    await waitFor(() => expect(card.getByRole('status')).toHaveTextContent('图鉴图片已就绪'))
    expect(explicitRepairs()).toEqual([[{ verifyCache: true }]])
    expect(await context.database.accountDriveDiscs.toArray()).toEqual(before)
  })

  it('keeps complete long local-status values available without making them layout copy', async () => {
    const displayName = '黄金复验超长本地账户名称用于验证资料卡边界不发生任何漂移'
    const account = await createAccount(displayName, context.database, {
      id: 'account-dashboard-long-name',
      makeDefault: true,
    })
    await setActiveAccount(account.id, context.database)
    window.history.pushState({}, '', '/')
    render(<context.App />)

    await waitFor(() => expect(screen.getAllByTitle(displayName)).toHaveLength(1))
    const readiness = document.querySelector('.home-readiness')!
    expect(readiness).not.toBeNull()
    expect(readiness.querySelector('dd')).toHaveTextContent(displayName)
    expect(readiness.querySelector('dd')).toHaveAttribute('title', displayName)
    expect(readiness.querySelector('.home-readiness__heading b')).toHaveAttribute('title')
    expect(readiness.querySelector('.home-catalog-cache')).toHaveAttribute('title')
  })
}
