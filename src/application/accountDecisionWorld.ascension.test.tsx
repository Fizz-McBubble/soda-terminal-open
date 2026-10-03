import Dexie from 'dexie'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAccount, saveAccountRoster, updateAccountRoster } from '../accounts/repository'
import {
  createAccountBackup,
  preflightAccountBackup,
  restoreAccountBackup,
} from '../accounts/backup'
import { saveAccountPlanningDraft } from '../accounts/planningDrafts'
import { database } from '../db/database'
import { ensureBundledGameDataPacks } from '../gameDataPacks/repository'
import { readCurrentGameDataRuntimeSelection } from '../gameDataPacks/runtimeSelection'
import {
  calculateWEngineBaseStatExact,
  calculateWEngineSecondaryStat,
} from '../gameDataPacks/panel/wEngineGrowth'
import { createBrowserCalculationQueryClient } from './browserCalculationQueryClient'
import {
  browserCalculationQueryProtocolVersion,
  type BrowserCalculationQueryRequest,
  type BrowserCalculationQueryResponse,
} from './browserCalculationQueryProtocol'
import { AccountDecisionWorldProvider, useAccountDecisionWorld } from './accountDecisionWorld'
import type { AccountDecisionWorldContextValue } from './accountDecisionWorldModel'
import {
  ascensionAgent,
  ascensionAgentId,
  ascensionInput,
  ascensionPlan,
} from './accountDecisionAscension.testFixture'

let dispatch: typeof import('./browserCalculationQuery.worker').calculateBrowserQueryResponse
beforeAll(async () => {
  vi.stubGlobal('self', { postMessage: vi.fn(), onmessage: null })
  dispatch = (await import('./browserCalculationQuery.worker')).calculateBrowserQueryResponse
  vi.unstubAllGlobals()
})
afterEach(async () => {
  await Dexie.delete(database.name)
})

function backupFacts(backup: Awaited<ReturnType<typeof createAccountBackup>>) {
  return {
    ...backup.data,
    roster: backup.data.roster ? { ...backup.data.roster, exportedAt: undefined } : null,
  }
}

async function setup(holdResponses = false) {
  await database.open()
  const account = await createAccount('突破失效合成账户')
  await ensureBundledGameDataPacks()
  await saveAccountRoster(account.id, ascensionInput().warehouse.roster)
  const responses: Array<() => void> = []
  const requests: BrowserCalculationQueryRequest[] = []
  const client = createBrowserCalculationQueryClient({
    readRuntimeSelection: readCurrentGameDataRuntimeSelection,
    createWorker: () => {
      const port = {
        onmessage: null as ((event: MessageEvent<BrowserCalculationQueryResponse>) => void) | null,
        onerror: null,
        onmessageerror: null,
        terminate: vi.fn(),
        postMessage(request: BrowserCalculationQueryRequest) {
          requests.push(request)
          // Real production dispatch/core; only the transport timing is controlled.
          void dispatch(structuredClone(request)).then((response) => {
            if (!response) return
            const handler = port.onmessage
            const deliver = () =>
              handler?.({ data: response } as MessageEvent<BrowserCalculationQueryResponse>)
            if (holdResponses) responses.push(deliver)
            else deliver()
          })
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
  let world!: AccountDecisionWorldContextValue
  function Probe() {
    world = useAccountDecisionWorld()
    return (
      <output>
        {world.status}
        <button onClick={() => void world.refresh()}>重新分析</button>
      </output>
    )
  }
  const mount = () =>
    render(
      <AccountDecisionWorldProvider
        queryClient={client}
        runtimeSelectionReader={readCurrentGameDataRuntimeSelection}
        repairRuntimeSelection={null}
      >
        <Probe />
      </AccountDecisionWorldProvider>,
    )
  return {
    account,
    responses,
    requests,
    client,
    mount,
    world: () => world,
    stopHolding: () => {
      holdResponses = false
    },
  }
}

async function changePhase(accountId: string, target: 'agent' | 'equipped-engine') {
  await act(async () =>
    updateAccountRoster(accountId, (roster) => {
      const agent = roster.agents.find((row) => row.agentId === ascensionAgentId)!
      if (target === 'agent') agent.ascension = 5
      else agent.wEngineDetails.ascension = 5
      return roster
    }),
  )
}

describe('ascension facts through browser client, provider and persistence', () => {
  it.each(['agent', 'equipped-engine'] as const)(
    'makes an existing result stale on a same-level %s promotion, then reanalyzes and preserves it',
    async (target) => {
      const h = await setup()
      h.mount()
      await waitFor(() => expect(h.world().status).toBe('current'))
      const before = h.world().run!
      await act(async () =>
        updateAccountRoster(h.account.id, (roster) => {
          const agent = roster.agents.find((row) => row.agentId === ascensionAgentId)!
          agent.syncedAt = '2026-10-03T02:00:00.000Z'
          agent.wEngineDetails.name = '私人名称'
          return roster
        }),
      )
      await waitFor(() =>
        expect(h.world().liveInput?.warehouse.roster.updatedAt).not.toBe(
          before.input.warehouse.roster.updatedAt,
        ),
      )
      expect(h.world().status).toBe('current')
      await changePhase(h.account.id, target)
      await waitFor(() => expect(h.world().status).toBe('stale'))
      expect(h.world().run!.runId).toBe(before.runId)
      fireEvent.click(screen.getByRole('button', { name: '重新分析' }))
      await waitFor(() => expect(h.world().status).toBe('current'))
      const after = h.world().run!
      expect(after.runId).not.toBe(before.runId)
      expect(after.inputFingerprint).not.toBe(before.inputFingerprint)
      const agent = ascensionAgent(after.input)
      expect(agent.level).toBe(50)
      expect(target === 'agent' ? agent.ascension : agent.wEngineDetails.ascension).toBe(5)
      expect(agent.wEngineCopyId).toBe('ascension-copy')
      const phase = agent.wEngineDetails.ascension!
      expect(calculateWEngineBaseStatExact(29, 50, phase)).toBeCloseTo(
        target === 'agent' ? 359.8784 : 385.7522,
        6,
      )
      expect(calculateWEngineSecondaryStat(0.192, 50, phase)).toBeCloseTo(
        target === 'agent' ? 0.4224 : 0.48,
        6,
      )
      await saveAccountPlanningDraft(h.account.id, ascensionPlan(h.account.id))
      const backup = await createAccountBackup(h.account.id)
      expect(preflightAccountBackup(backup).success).toBe(true)
      await restoreAccountBackup(JSON.parse(JSON.stringify(backup)))
      const reread = await createAccountBackup(h.account.id)
      expect(backupFacts(reread)).toEqual(backupFacts(backup))
    },
    20_000,
  )

  it('discards an in-flight response captured before a promotion', async () => {
    const h = await setup(true)
    h.mount()
    await waitFor(() => expect(h.responses).toHaveLength(1))
    const old = h.requests.find((request) => request.kind === 'query')!
    h.stopHolding()
    await changePhase(h.account.id, 'equipped-engine')
    await waitFor(() => expect(h.world().status).toBe('current'))
    const current = h.world().run!
    expect(current.runId).not.toBe(old.kind === 'query' ? old.query.runId : '')
    expect(ascensionAgent(current.input).wEngineDetails.ascension).toBe(5)
    await act(async () => {
      h.responses.shift()!()
      await Promise.resolve()
    })
    expect(h.world().run!.runId).toBe(current.runId)
  }, 20_000)

  it('invalidates a same-account restore with different saved parameters at the same revision', async () => {
    const h = await setup()
    const saved = await saveAccountPlanningDraft(h.account.id, ascensionPlan(h.account.id))
    const original = await createAccountBackup(h.account.id)
    const updated = structuredClone(original)
    updated.data.planningDrafts[0]!.teamEquipmentParameters!.wEngines[0]!.ascension = 5
    expect(preflightAccountBackup(updated).success).toBe(true)
    expect(updated.data.planningDrafts[0]!.revision).toBe(saved.revision)
    h.mount()
    await waitFor(() => expect(h.world().status).toBe('current'))
    await act(async () => {
      await restoreAccountBackup(updated)
    })
    await waitFor(() => expect(h.world().status).toBe('stale'))
    fireEvent.click(screen.getByRole('button', { name: '重新分析' }))
    await waitFor(() => expect(h.world().status).toBe('current'))
    expect(h.world().run!.input.drafts[0]!.teamEquipmentParameters!.wEngines[0]!.ascension).toBe(5)
    const resaved = await saveAccountPlanningDraft(h.account.id, updated.data.planningDrafts[0]!)
    expect(resaved.revision).toBe(saved.revision + 1)
    expect(backupFacts(await createAccountBackup(h.account.id)).roster).toEqual(
      backupFacts(original).roster,
    )
  }, 20_000)
})
