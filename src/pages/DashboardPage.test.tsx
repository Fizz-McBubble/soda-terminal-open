import { act, configure, getConfig, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  createAccount,
  getAccountRoster,
  saveAccountRoster,
  setActiveAccount,
} from '../accounts/repository'
import { scopeLegacyEntity } from '../accounts/types'
import type { AccountRoster, RosterAgent } from '../assault/types'
import { localCalculationQueryClient } from '../application/localCalculationQueryClient'
import { database } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import { activateFormalGameDataPack, ensureBundledGameDataPacks } from '../gameDataPacks/repository'
import { gameBase33Current } from '../gameDataPacks/baseline'
import * as imageInstaller from '../assets/visualAssetInstallCoordinator'
import {
  dashboardDecisionReceipt,
  registerDashboardPageImageCases,
} from './DashboardPage.testCases'
import { deriveDashboardDevelopmentGap } from './dashboardPresentation'
import { seedTeamWarehouse } from './optimizerFlowTestFixtures'

async function resetDashboardData() {
  await database.transaction(
    'rw',
    [
      database.accounts,
      database.accountDriveDiscs,
      database.accountDiscEvaluations,
      database.accountRosters,
      database.accountPlanningDrafts,
      database.accountScanImportBatches,
      database.settings,
      database.driveDiscs,
      database.discEvaluations,
      database.gameDataPacks,
      database.gameDataPackState,
    ],
    async () => {
      await Promise.all([
        database.accounts.clear(),
        database.accountDriveDiscs.clear(),
        database.accountDiscEvaluations.clear(),
        database.accountRosters.clear(),
        database.accountPlanningDrafts.clear(),
        database.accountScanImportBatches.clear(),
        database.settings.clear(),
        database.driveDiscs.clear(),
        database.discEvaluations.clear(),
        database.gameDataPacks.clear(),
        database.gameDataPackState.clear(),
      ])
    },
  )
}

async function seedDiscs(accountId: string, count: number) {
  await database.accountDriveDiscs.bulkPut(
    Array.from({ length: count }, (_, index) =>
      scopeLegacyEntity(
        accountId,
        { ...sampleDiscs.treasureCandidate, id: `dashboard-${accountId}-${index}` },
        '2026-07-15T00:00:00.000Z',
      ),
    ),
  )
}

async function seedAssignedDiscs(accountId: string) {
  const slots = [1, 2, 3, 4, 5, 6] as const
  const discs = slots.map((slot, index) =>
    scopeLegacyEntity(
      accountId,
      { ...sampleDiscs.treasureCandidate, id: `dashboard-equipped-${slot}-${index}`, slot },
      '2026-07-15T00:00:00.000Z',
    ),
  )
  await database.accountDriveDiscs.bulkPut(discs)
  return discs.map((disc) => disc.id)
}

function completeCultivationAgent(agent: RosterAgent, discIds: string[]): RosterAgent {
  return {
    ...agent,
    owned: true,
    level: 60,
    completeness: 'complete',
    currentEquipment: 'known',
    manualSource: 'manual_override',
    progressionManuallySet: true,
    skillLevels: {
      basic: 16,
      dodge: 16,
      assist: 16,
      special: 16,
      chain: 16,
      core: 7,
    },
    wEngineDetails: {
      id: 'wengine-12001',
      name: '合成音擎',
      level: 60,
      refinement: 1,
    },
    equippedDiscIds: discIds,
  }
}

function withDashboardAgent(roster: AccountRoster, agent: RosterAgent): AccountRoster {
  return {
    ...roster,
    agents: roster.agents.map((row) => (row.agentId === agent.agentId ? agent : row)),
  }
}

describe('DashboardPage account-scoped warehouse summary', { timeout: 15_000 }, () => {
  const { asyncUtilTimeout } = getConfig()
  beforeAll(async () => {
    // Keep lazy compilation outside the waits for user-visible state changes.
    await Promise.all([import('./DashboardPage'), import('./AssetCenterPage')])
    configure({ asyncUtilTimeout: 8_000 })
  }, 30_000)
  afterAll(() => configure({ asyncUtilTimeout }))

  it('offers one recovery link on first visit and locates the existing backup preflight after navigation', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    })
    try {
      window.history.pushState({}, '', '/')
      render(<App />)
      const firstVisit = await screen.findByRole('region', { name: '创建账户并扫描' })
      const recovery = within(firstVisit).getByRole('link', { name: '恢复已有备份' })
      expect(recovery).toHaveAttribute('href', '/assets/account#restore-backup')
      await userEvent.click(recovery)
      const section = await screen.findByRole('region', { name: '选择或拖入本机备份' })
      expect(section).toHaveAttribute('id', 'restore-backup')
      await waitFor(() => expect(scroll.mock.contexts).toContain(section))
      expect(within(section).getByRole('button', { name: '选择或拖入 JSON' })).toBeEnabled()
      expect(await database.accounts.count()).toBe(0)
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  })

  beforeEach(async () => {
    await resetDashboardData()
    vi.spyOn(localCalculationQueryClient, 'calculateAccountDecision').mockImplementation(
      async (query) => dashboardDecisionReceipt(query, 0),
    )
    vi.spyOn(imageInstaller, 'ensureOfficialCatalogInstalled').mockResolvedValue(undefined)
    vi.spyOn(imageInstaller, 'getOfficialCatalogInstallStatus').mockReturnValue({
      kind: 'ready',
      completed: 2,
      total: 2,
      failed: 0,
    })
    vi.spyOn(imageInstaller, 'subscribeOfficialCatalogInstallStatus').mockReturnValue(() => true)
  })

  afterEach(() => vi.restoreAllMocks())

  it('shows automatic loading without requiring an initial download action', async () => {
    await createAccount('图片加载账户', database, { makeDefault: true })
    vi.mocked(imageInstaller.getOfficialCatalogInstallStatus).mockReturnValue({
      kind: 'loading',
      completed: 12,
      total: 40,
      failed: 0,
    })
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByTitle('图鉴图片 12/40')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '正在更新图片…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '下载并加载图片' })).not.toBeInTheDocument()
    expect(imageInstaller.ensureOfficialCatalogInstalled).toHaveBeenCalledWith()
  })

  it('keeps partial images available with a concise retry action', async () => {
    await createAccount('部分图片账户', database, { makeDefault: true })
    vi.mocked(imageInstaller.getOfficialCatalogInstallStatus).mockReturnValue({
      kind: 'partial',
      completed: 38,
      total: 40,
      failed: 2,
    })
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByTitle('图鉴图片还差 2 张')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '补齐图片' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '管理图片' })).toBeEnabled()
  })

  it('repairs only bundled application data after an explicit action and preserves account assets', async () => {
    const account = await createAccount('资料恢复测试', database, {
      id: 'account-home-repair',
      makeDefault: true,
    })
    await seedDiscs(account.id, 6)
    await ensureBundledGameDataPacks(database)
    await activateFormalGameDataPack('game-base-3.0.1', database)
    const before = await Promise.all([
      database.accounts.toArray(),
      database.accountRosters.toArray(),
      database.accountDriveDiscs.toArray(),
      database.accountPlanningDrafts.toArray(),
    ])
    window.history.pushState({}, '', '/')
    render(<App />)
    const repair = await screen.findByRole('button', {
      name: `恢复应用自带 ${gameBase33Current.gameVersion} 资料`,
    })
    expect(screen.getByRole('heading', { name: '游戏数据未能安全加载' })).toBeInTheDocument()
    expect(screen.getByText('请重新加载页面后再试。')).toBeInTheDocument()
    expect(
      (await database.gameDataPackState.get('active-game-data-packs'))?.activeFormalByKind[
        'game-base'
      ],
    ).toBe('game-base-3.0.1')
    await userEvent.click(repair)
    await screen.findByRole('region', { name: '本地资料' })
    expect(
      (await database.gameDataPackState.get('active-game-data-packs'))?.activeFormalByKind[
        'game-base'
      ],
    ).toBe(gameBase33Current.id)
    expect(
      await Promise.all([
        database.accounts.toArray(),
        database.accountRosters.toArray(),
        database.accountDriveDiscs.toArray(),
        database.accountPlanningDrafts.toArray(),
      ]),
    ).toEqual(before)
  })

  it('uses only the active account warehouse when another same-name account and legacy tables differ', async () => {
    const current = await createAccount('同名玩家', database, {
      id: 'account-dashboard-current',
      makeDefault: true,
      now: new Date('2026-07-15T00:00:00.000Z'),
    })
    const other = await createAccount('同名玩家', database, {
      id: 'account-dashboard-other',
      now: new Date('2026-07-15T00:00:01.000Z'),
    })
    await seedDiscs(current.id, 343)
    await seedDiscs(other.id, 298)
    await database.driveDiscs.bulkPut(
      Array.from({ length: 298 }, (_, index) => ({
        ...sampleDiscs.treasureCandidate,
        id: `legacy-dashboard-${index}`,
      })),
    )
    await setActiveAccount(current.id, database)

    // Hold analysis pending: account counts must remain usable independently.
    const calculation = vi
      .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
      .mockImplementation(() => new Promise(() => {}))
    window.history.pushState({}, '', '/')
    const view = render(<App />)
    try {
      const readiness = await screen.findByRole('region', { name: '本地资料' })
      expect(within(readiness).getByText('343 张')).toBeInTheDocument()
      expect(within(readiness).queryByText('298 张')).not.toBeInTheDocument()
    } finally {
      view.unmount()
      calculation.mockRestore()
    }
  })

  it('shows a zero account state instead of legacy warehouse data when no account is active', async () => {
    await database.driveDiscs.put({ ...sampleDiscs.treasureCandidate, id: 'legacy-only-dashboard' })
    window.history.pushState({}, '', '/')
    render(<App />)

    const readiness = await screen.findByRole('region', { name: '本地资料' })
    await waitFor(() => expect(within(readiness).getByText('0 张')).toBeInTheDocument())
    expect(within(readiness).queryByText('1 张')).not.toBeInTheDocument()
    const nextAction = screen.getByRole('heading', { name: '创建账户并扫描' }).closest('section')
    expect(within(nextAction!).getByRole('link', { name: '前往扫描与导入' })).toHaveAttribute(
      'href',
      '/system/scanner',
    )
    expect(nextAction!.querySelector('.home-next-action__context')).toHaveTextContent(
      /当前阶段\s*·?\s*首次使用/,
    )
    expect(nextAction!.querySelector('.home-next-signal')).not.toBeInTheDocument()
    expect(within(nextAction!).queryByText('其他入口')).not.toBeInTheDocument()
    expect(within(nextAction!).queryByText('下一步')).not.toBeInTheDocument()
    expect(within(nextAction!).queryByText('从首次扫描开始')).not.toBeInTheDocument()
    const journey = screen.getByRole('heading', { name: '使用旅程' }).closest('section')
    expect(
      nextAction!.compareDocumentPosition(journey!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(journey!).getAllByRole('link')).toHaveLength(5)
    expect(within(journey!).getByRole('link', { name: /代理人养成/ })).toHaveTextContent(
      '等待记录代理人',
    )
    expect(within(journey!).queryByText('当前承接点')).not.toBeInTheDocument()
    expect(within(journey!).queryByText('复查与持续提升')).not.toBeInTheDocument()
    expect(await database.accounts.count()).toBe(0)
    expect(await database.accountDriveDiscs.count()).toBe(0)
    expect(await database.accountPlanningDrafts.count()).toBe(0)
    expect(await database.accountScanImportBatches.count()).toBe(0)
  })

  it('keeps a failed account analysis recoverable instead of presenting it as an empty account', async () => {
    const account = await createAccount('读取失败恢复账户', database, {
      id: 'account-dashboard-recovery',
      makeDefault: true,
    })
    await setActiveAccount(account.id, database)
    const calculation = vi
      .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
      .mockRejectedValueOnce(new Error('本次计算服务未能响应，请重新分析。'))
    window.history.pushState({}, '', '/')
    const user = userEvent.setup()
    render(<App />)

    const analysisError = await screen.findByRole('alert', { name: '接下来' })
    expect(analysisError).toHaveTextContent('本次计算服务未能响应，请重新分析。')
    expect(screen.getByRole('region', { name: '本地资料' })).toHaveTextContent('读取失败恢复账户')
    expect(screen.queryByRole('heading', { name: '创建账户并扫描' })).not.toBeInTheDocument()
    expect(await database.accounts.count()).toBe(1)

    await user.click(within(analysisError).getByRole('button', { name: '重试分析' }))
    await waitFor(() =>
      expect(screen.queryByRole('alert', { name: '接下来' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByRole('heading', { name: '扫描或导入本地数据' })).toBeInTheDocument()
    calculation.mockRestore()
  })

  it('keeps usable facts during analysis, stops it, and calculates successfully on retry without accepting the late run', async () => {
    await seedTeamWarehouse({
      account: { id: 'account-dashboard-stop', displayName: '首页正常分析账户' },
    })
    let finishFirst!: () => void
    const held = new Promise<void>((resolve) => {
      finishFirst = resolve
    })
    const calculation = vi
      .spyOn(localCalculationQueryClient, 'calculateAccountDecision')
      .mockImplementation(async (query) => dashboardDecisionReceipt(query, 1))
      .mockImplementationOnce(async (query) => {
        await held
        return dashboardDecisionReceipt(query, 0)
      })
    const releases = vi.spyOn(localCalculationQueryClient, 'releaseAccountDecisionRun')
    const before = await database.accountDriveDiscs.toArray()
    window.history.pushState({}, '', '/')
    const view = render(<App />)
    try {
      const user = userEvent.setup()
      await screen.findByRole('button', { name: '停止分析' })
      await waitFor(() => expect(calculation).toHaveBeenCalledOnce())
      expect(screen.getByRole('region', { name: '本地资料' })).toHaveTextContent('18 张')
      expect(screen.getByRole('status', { name: '接下来' })).toHaveAttribute('aria-busy', 'true')
      await user.click(screen.getByRole('button', { name: '停止分析' }))
      expect(screen.getByRole('status', { name: '接下来' })).toHaveTextContent('分析已取消')
      expect(releases).toHaveBeenCalledWith(calculation.mock.calls[0]![0].runId)
      await user.click(screen.getByRole('button', { name: '重新分析' }))
      await waitFor(() => expect(calculation).toHaveBeenCalledTimes(2))
      expect(await screen.findByRole('link', { name: '继续：查看队伍建议' })).toHaveAttribute(
        'href',
        '/loadouts/team',
      )
      expect(screen.queryByRole('button', { name: '停止分析' })).not.toBeInTheDocument()
      expect(screen.queryByText('分析已取消')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert', { name: '接下来' })).not.toBeInTheDocument()
      expect(
        screen.queryByText('当前已记录的代理人暂未形成支持的队伍，请补充或更新资产资料。'),
      ).not.toBeInTheDocument()
      await act(async () => {
        finishFirst()
        await calculation.mock.results[0]!.value
      })
      expect(screen.getByRole('link', { name: '继续：查看队伍建议' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: '继续：查看队伍配装' })).not.toBeInTheDocument()
      expect(await database.accountDriveDiscs.toArray()).toEqual(before)
    } finally {
      finishFirst()
      view.unmount()
      calculation.mockRestore()
      releases.mockRestore()
    }
  })

  it('describes non-linear readiness without claiming later steps are complete', async () => {
    const account = await createAccount('旅程状态账户', database, {
      id: 'account-dashboard-readiness',
      makeDefault: true,
    })
    const roster = await getAccountRoster(account.id, database)
    roster.agents = roster.agents.map((agent) =>
      agent.agentId === 'agent-nicole' ? { ...agent, owned: true, level: 1 } : agent,
    )
    await saveAccountRoster(account.id, roster, database)
    await seedDiscs(account.id, 6)
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByRole('link', { name: '前往代理人资产' })).toHaveAttribute(
      'href',
      '/assets/agents',
    )
    const journey = screen.getByRole('region', { name: '使用旅程' })
    expect(within(journey).queryByText('已完成')).not.toBeInTheDocument()
    expect(
      within(journey)
        .getByRole('link', { name: /扫描与导入/ })
        .closest('li'),
    ).toHaveClass('is-complete')
    expect(within(journey).getByRole('link', { name: /我的资产/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(
      within(journey)
        .getByRole('link', { name: /队伍配装/ })
        .closest('li'),
    ).toHaveClass('is-upcoming')
    expect(
      within(journey)
        .getByRole('link', { name: /驱动盘分析/ })
        .closest('li'),
    ).toHaveClass('is-upcoming')
  })

  it('derives cultivation readiness from real roster facts and applicable potential only', async () => {
    const account = await createAccount('合成养成账户', database, {
      id: 'account-dashboard-cultivation-facts',
      makeDefault: true,
    })
    const roster = await getAccountRoster(account.id, database)
    const discIds = await seedAssignedDiscs(account.id)
    const discs = await database.accountDriveDiscs.where('accountId').equals(account.id).toArray()
    const nicole = completeCultivationAgent(
      roster.agents.find((agent) => agent.agentId === 'agent-nicole')!,
      discIds,
    )
    const cultivationGap = (agent: RosterAgent) =>
      deriveDashboardDevelopmentGap({ roster: withDashboardAgent(roster, agent), discs }, [agent])

    expect(cultivationGap(nicole)).toBe(false)
    expect(
      cultivationGap({
        ...nicole,
        wEngineDetails: { id: null, name: null, level: null, refinement: null },
      }),
    ).toBe(true)
    expect(cultivationGap({ ...nicole, skillLevels: { ...nicole.skillLevels, core: null } })).toBe(
      true,
    )
    expect(cultivationGap({ ...nicole, equippedDiscIds: [] })).toBe(true)

    const ellen = completeCultivationAgent(
      roster.agents.find((agent) => agent.agentId === 'agent-ellen')!,
      discIds,
    )
    expect(cultivationGap({ ...ellen, potentialImage: null })).toBe(true)
  })

  it('shows cultivation ready only when the synthetic account has all required facts', async () => {
    const account = await createAccount('完整合成养成账户', database, {
      id: 'account-dashboard-complete-cultivation',
      makeDefault: true,
    })
    const roster = await getAccountRoster(account.id, database)
    const discIds = await seedAssignedDiscs(account.id)
    roster.agents = roster.agents.map((agent) =>
      agent.agentId === 'agent-nicole' ? completeCultivationAgent(agent, discIds) : agent,
    )
    await saveAccountRoster(account.id, roster, database)
    window.history.pushState({}, '', '/')
    render(<App />)

    const journey = await screen.findByRole('region', { name: '使用旅程' })
    expect(within(journey).getByRole('link', { name: /代理人养成/ })).toHaveTextContent(
      '当前养成已就绪',
    )
    expect(within(journey).queryByText('继续完善养成')).not.toBeInTheDocument()
  })

  it('keeps the replaceable version hero independent from owned-account catalog images', async () => {
    const account = await createAccount('图像隔离账户', database, {
      id: 'account-dashboard-images',
    })
    await setActiveAccount(account.id, database)
    const roster = await getAccountRoster(account.id, database)
    roster.agents = roster.agents.map((agent) =>
      agent.agentId === 'agent-nicole' ? { ...agent, owned: true } : agent,
    )
    await saveAccountRoster(account.id, roster, database)
    window.history.pushState({}, '', '/')
    render(<App />)
    const hero = await screen.findByRole('img', { name: '首页角色插画' })
    expect(hero).toHaveAttribute('draggable', 'false')
    expect(hero).toHaveAttribute('src', expect.stringContaining('ramiel-user-cutout-1152.webp'))
    expect(hero).toHaveAttribute('fetchpriority', 'high')
    const focus = document.querySelector('.home-focus')
    const scene = document.querySelector('.home-scene')
    expect(scene?.parentElement).toBe(focus)
    expect(document.querySelectorAll('.home-scene > img')).toHaveLength(1)
    expect(document.querySelector('.focus-copy h1 br')).not.toBeNull()
    expect(document.querySelectorAll('.home-disc-object')).toHaveLength(0)
    expect(document.querySelectorAll('.journey-list--five > li')).toHaveLength(5)
    expect(document.querySelector('.home-version-hero__fallback')).toBeNull()
    expect(screen.queryByText('图片暂未提供')).not.toBeInTheDocument()
  })

  it('keeps cache deletion in management while download is available directly on the card', async () => {
    await createAccount('图片管理测试', database, {
      id: 'account-image-controls',
      makeDefault: true,
    })
    window.history.pushState({}, '', '/')
    // jsdom does not implement the native dialog API.
    const previousShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'showModal',
    )
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      },
    })
    render(<App />)
    const manage = await screen.findByRole('button', { name: '管理图片' })
    expect(document.querySelector('.home-readiness details')).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(manage)
    const dialog = screen.getByRole('dialog', { name: '图鉴图片' })
    expect(dialog.closest('.home-focus')).toBeNull()
    expect(within(dialog).getByRole('button', { name: '检查图片更新' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '删除本机图片' })).toBeInTheDocument()
    expect(within(dialog).getByText('仅删除图片，不影响账户资料。')).toBeInTheDocument()
    expect(screen.queryByText('导出图包')).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    if (previousShowModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', previousShowModal)
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    }
  })

  registerDashboardPageImageCases({ App, database, seedDiscs })
})
