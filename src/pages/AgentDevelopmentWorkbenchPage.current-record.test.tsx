import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AgentDevelopmentWorkbenchPage } from './AgentDevelopmentWorkbenchPage'
import { AccountDecisionWorldProvider } from '../application/accountDecisionWorldLocal'
import { createBrowserCalculationQueryClient } from '../application/browserCalculationQueryClient'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from '../application/browserCalculationQueryProtocol'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import {
  createAccount,
  getAccountRoster,
  saveAccountRoster,
  saveAccountDriveDisc,
} from '../accounts/repository'
import { database } from '../db/database'
import { sampleDiscs } from '../evaluation/fixtures'
import type { DriveDisc } from '../domain/schemas'

let dispatch: typeof import('../application/browserCalculationQuery.worker').calculateBrowserQueryResponse
beforeAll(async () => {
  vi.stubGlobal('self', { postMessage: vi.fn(), onmessage: null })
  dispatch = (await import('../application/browserCalculationQuery.worker'))
    .calculateBrowserQueryResponse
  vi.unstubAllGlobals()
})
beforeEach(async () => {
  database.close()
  await database.delete()
  await database.open()
})

it('updates saved current facts and panel through the production Worker before a slow account refresh finishes', async () => {
  const account = await createAccount('合成当前记录刷新账户', database, {
    id: 'account-current-record-refresh',
    makeDefault: true,
  })
  const roster = await getAccountRoster(account.id)
  const ids = Array.from({ length: 6 }, (_, index) => `current-record-disc-${index + 1}`)
  await Promise.all(
    ids.map((id, index) =>
      saveAccountDriveDisc(account.id, {
        ...sampleDiscs.treasureCandidate,
        id,
        slot: (index + 1) as DriveDisc['slot'],
        mainStat: (
          ['hp_flat', 'atk_flat', 'def_flat', 'crit_rate', 'atk_percent', 'atk_percent'] as const
        )[index],
      }),
    ),
  )
  await saveAccountRoster(account.id, {
    ...roster,
    agents: roster.agents.map((agent) =>
      agent.agentId === 'agent-billy'
        ? {
            ...agent,
            owned: true,
            level: 51,
            mindscape: 0,
            progressionManuallySet: true,
            skillLevels: { ...agent.skillLevels, basic: 9, core: 7 },
            equippedDiscIds: ids,
          }
        : agent,
    ),
  })
  const requests: BrowserCalculationQueryRequest[] = []
  let accountQueries = 0
  let resumeRefresh!: () => void
  const heldRefresh = new Promise<void>((resolve) => {
    resumeRefresh = resolve
  })
  const client = createBrowserCalculationQueryClient({
    readRuntimeSelection: readCurrentGameDataRuntimeSelection,
    createWorker: () => {
      const port = {
        onmessage: null as ((event: MessageEvent<BrowserCalculationQueryResponse>) => void) | null,
        onerror: null,
        onmessageerror: null,
        terminate: vi.fn(),
        postMessage(request: BrowserCalculationQueryRequest) {
          requests.push(structuredClone(request))
          const hold =
            request.kind === 'query' &&
            request.query.kind === 'account_decision' &&
            ++accountQueries > 1
          void (async () => {
            if (hold) await heldRefresh
            // The real Worker dispatcher and core run here; only transport timing is controlled.
            const response = await dispatch(structuredClone(request))
            if (response)
              port.onmessage?.({ data: response } as MessageEvent<BrowserCalculationQueryResponse>)
          })()
        },
      }
      queueMicrotask(() =>
        port.onmessage?.({
          data: {
            protocolVersion: browserCalculationQueryProtocolVersion,
            requestId: 0,
            status: 'ready',
          },
        } as MessageEvent<BrowserCalculationQueryResponse>),
      )
      return port
    },
  })
  const router = createMemoryRouter(
    [
      {
        path: '/development/:agentId',
        element: (
          <AccountDecisionWorldProvider queryClient={client}>
            <AgentDevelopmentWorkbenchPage />
          </AccountDecisionWorldProvider>
        ),
      },
    ],
    { initialEntries: ['/development/agent-billy'] },
  )
  const view = render(<RouterProvider router={router} />)
  try {
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '编辑当前状态' }))
    await user.clear(screen.getByRole('spinbutton', { name: '等级' }))
    await user.type(screen.getByRole('spinbutton', { name: '等级' }), '60')
    await user.clear(screen.getByRole('spinbutton', { name: '普攻' }))
    await user.type(screen.getByRole('spinbutton', { name: '普攻' }), '11')
    await user.click(screen.getByRole('button', { name: '当前音擎' }))
    await user.click(screen.getByRole('option', { name: /^星徽引擎 ·/ }))
    await user.click(screen.getByRole('button', { name: '保存代理人资料' }))
    await waitFor(() => expect(accountQueries).toBe(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.account-fact b')).toHaveTextContent('Lv.60')
    expect(document.querySelector('.skill-comparison__current b')).toHaveTextContent('11')
    expect(
      within(screen.getByRole('region', { name: '当前音擎与推荐' })).getByText('星徽引擎'),
    ).toBeInTheDocument()
    expect(document.querySelectorAll('.panel-snapshot .stat-grid > div')).toHaveLength(10)
    const updatedPanel = document.querySelector('.panel-snapshot .stat-grid')!.textContent
    const saved = (await getAccountRoster(account.id)).agents.find(
      (agent) => agent.agentId === 'agent-billy',
    )!
    expect(saved.level).toBe(60)
    expect(saved.skillLevels.basic).toBe(11)
    expect(saved.wEngineDetails.id).toBe('wengine-13004')
    const panelIndex = requests.findIndex(
      (request) =>
        request.kind === 'query' &&
        request.query.kind === 'development_workbench_route' &&
        Boolean(request.query.currentRecord),
    )
    const refreshIndex = requests.findLastIndex(
      (request) => request.kind === 'query' && request.query.kind === 'account_decision',
    )
    expect(panelIndex).toBeGreaterThan(-1)
    expect(panelIndex).toBeLessThan(refreshIndex)
    await act(async () => {
      resumeRefresh()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: '编辑当前状态' })).toBeEnabled())
    expect(document.querySelector('.panel-snapshot .stat-grid')!.textContent).toBe(updatedPanel)
  } finally {
    resumeRefresh()
    view.unmount()
  }
})
