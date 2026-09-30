import Dexie from 'dexie'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAccount } from '../accounts/repository'
import { database } from '../db/database'
import { ensureBundledGameDataPacks } from '../gameDataPacks/repository'
import { sampleDiscs } from '../evaluation/fixtures'
import { localCalculationQueryClient } from './localCalculationQueryClient'
import { AccountDecisionWorldProvider } from './accountDecisionWorldLocal'
import { useAccountDecisionWorld } from './accountDecisionWorld'
import type { AccountDecisionRun, CalculationQueryClient } from './calculationQueryContract'

function Probe() {
  const world = useAccountDecisionWorld()
  return (
    <output
      data-status={world.status}
      data-run={world.run?.runId ?? ''}
      data-phase={world.calculation?.phase ?? ''}
      data-cancelled={world.calculationCancelled ?? false}
    >
      {world.status === 'error' ? world.message : world.status}
      <button onClick={world.cancelCalculation}>停止</button>
      <button onClick={() => void world.refresh()}>重试</button>
    </output>
  )
}

async function setup() {
  await database.open()
  await createAccount('等待体验合成账户')
  await ensureBundledGameDataPacks()
  let delayed = true
  const pending: Array<{ run: AccountDecisionRun; resolve: () => void }> = []
  const release = vi.fn((id: string) => localCalculationQueryClient.releaseAccountDecisionRun?.(id))
  const calculate = vi.fn(
    async (query: Parameters<CalculationQueryClient['calculateAccountDecision']>[0]) => {
      const run = await localCalculationQueryClient.calculateAccountDecision(query)
      if (delayed) await new Promise<void>((resolve) => pending.push({ run, resolve }))
      return run
    },
  )
  return {
    pending,
    calculate,
    release,
    client: {
      ...localCalculationQueryClient,
      calculateAccountDecision: calculate,
      releaseAccountDecisionRun: release,
    },
    stopDelaying: () => {
      delayed = false
    },
  }
}

afterEach(async () => {
  await Dexie.delete(database.name)
})

describe('account-owned loading lifecycle', () => {
  it('marks a lost Worker handle stale without parent input or route changes', async () => {
    const { client, stopDelaying, calculate } = await setup()
    stopDelaying()
    let retained = true
    const listeners = new Set<() => void>()
    const observable: CalculationQueryClient = {
      ...client,
      hasAccountDecisionRun: () => retained,
      subscribeAccountDecisionRuns(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }
    render(
      <AccountDecisionWorldProvider queryClient={observable}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveAttribute('data-status', 'current'),
    )
    const runId = screen.getByRole('status').getAttribute('data-run')
    expect(listeners.size).toBeGreaterThan(0)
    await act(async () => {
      retained = false
      for (const listener of listeners) listener()
    })
    await waitFor(() => expect(screen.getByRole('status')).toHaveAttribute('data-status', 'stale'))
    expect(screen.getByRole('status')).toHaveAttribute('data-run', runId)
    expect(calculate).toHaveBeenCalledTimes(1)
  })

  it('keeps one pending request across route exit and return, then reuses the completed result', async () => {
    const { client, pending, calculate, release } = await setup()
    const view = render(
      <AccountDecisionWorldProvider queryClient={client}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    await waitFor(() => expect(pending).toHaveLength(1))
    expect(screen.getByRole('status')).toHaveAttribute('data-phase', 'analyzing')
    view.rerender(
      <AccountDecisionWorldProvider queryClient={client} autoCalculate={false}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    view.rerender(
      <AccountDecisionWorldProvider queryClient={client}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    expect(calculate).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending[0].resolve()
    })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveAttribute('data-run', pending[0].run.runId),
    )
    expect(release).not.toHaveBeenCalledWith(pending[0].run.runId)
    view.rerender(
      <AccountDecisionWorldProvider queryClient={client} autoCalculate={false}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    view.rerender(
      <AccountDecisionWorldProvider queryClient={client}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    expect(calculate).toHaveBeenCalledTimes(1)
  })

  it('releases a cancelled request immediately, ignores its late result and supports retry', async () => {
    const { client, pending, calculate, release, stopDelaying } = await setup()
    render(
      <AccountDecisionWorldProvider queryClient={client}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    await waitFor(() => expect(pending).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    expect(release).toHaveBeenCalledWith(pending[0].run.runId)
    expect(screen.getByRole('status')).toHaveAttribute('data-cancelled', 'true')
    expect(screen.getByRole('status')).toHaveAttribute('data-phase', '')
    await act(async () => {
      pending[0].resolve()
    })
    expect(screen.getByRole('status')).toHaveAttribute('data-run', '')
    expect(calculate).toHaveBeenCalledTimes(1)
    stopDelaying()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveAttribute('data-status', 'current'),
    )
    expect(calculate).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveAttribute('data-cancelled', 'false')
    expect(screen.getByRole('status')).toHaveAttribute('data-phase', '')
  })

  it('supersedes an initial capture after an account edit and rejects the old late result', async () => {
    const { client, pending, calculate, release } = await setup()
    render(
      <AccountDecisionWorldProvider queryClient={client}>
        <Probe />
      </AccountDecisionWorldProvider>,
    )
    await waitFor(() => expect(pending).toHaveLength(1))
    await act(async () => {
      await database.accountDriveDiscs.add({
        ...sampleDiscs.treasureCandidate,
        id: 'new-synthetic-disc',
        scopedId: 'synthetic-initial-edit-disc',
        sourceLegacyId: null,
        migratedAt: null,
        accountId: pending[0].run.input.warehouse.accountId!,
      })
    })
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(calculate).toHaveBeenCalledTimes(2)
    expect(release).toHaveBeenCalledWith(pending[0].run.runId)
    expect(pending[1].run.input.warehouse.discs).toHaveLength(1)
    await act(async () => {
      pending[1].resolve()
    })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveAttribute('data-run', pending[1].run.runId),
    )
    await act(async () => {
      pending[0].resolve()
    })
    expect(screen.getByRole('status')).toHaveAttribute('data-run', pending[1].run.runId)
  })
})
