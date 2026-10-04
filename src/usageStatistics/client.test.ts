import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUsageStatistics, usagePage } from './client'

afterEach(() => vi.restoreAllMocks())

function setup() {
  let now = 120
  const values = new Map<string, string>()
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  const runtime = {
    fetch,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    } as Storage,
    location: { origin: 'https://app.sodaterminal.workers.dev' },
    navigator: { onLine: true, doNotTrack: null as string | null, globalPrivacyControl: false },
    performance: { now: () => now },
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  }
  const create = (enabled = true, release = 'soda-open-test-usage') =>
    createUsageStatistics({ enabled, release, runtime: () => runtime })
  return {
    stats: create(),
    create,
    runtime,
    fetch,
    values,
    setNow: (value: number) => {
      now = value
    },
  }
}

describe('Cloudflare anonymous usage boundary', () => {
  it('classifies parameterized routes without retaining their identities or counting query changes', async () => {
    const { stats, fetch } = setup()
    stats.page('/loadouts/team/formation:private-account-name')
    stats.page('/loadouts/team/another-private-plan')
    await Promise.resolve()
    stats.page('/warehouse/discs/private-disc')
    expect(fetch).toHaveBeenCalledTimes(2)
    const payloads = fetch.mock.calls.map(([, init]) => JSON.parse(init.body))
    expect(payloads).toEqual([
      { schema: 1, event: 'page_view', category: 'loadouts', release: 'soda-open-test-usage' },
      { schema: 1, event: 'page_view', category: 'warehouse', release: 'soda-open-test-usage' },
    ])
    expect(JSON.stringify(fetch.mock.calls)).not.toMatch(/private|formation|disc\/|account|query/)
    expect(fetch.mock.calls[0][0]).toBe('/_soda/usage')
    expect(fetch.mock.calls[0][1]).toMatchObject({
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
    expect(usagePage('/unknown/private-account')).toBeNull()
  })

  it('records only one settled operation and navigation-start-to-ready timing', () => {
    const { stats, fetch, setNow } = setup()
    const finish = stats.begin('plan_save')
    setNow(245)
    finish('success')
    finish('failure')
    stats.startup()
    stats.startup()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      schema: 1,
      event: 'operation',
      category: 'plan_save',
      outcome: 'success',
      durationMs: 125,
      release: 'soda-open-test-usage',
    })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      schema: 1,
      event: 'performance',
      category: 'startup',
      durationMs: 245,
      release: 'soda-open-test-usage',
    })
  })

  it('does not send in local/preview builds, recovery, invalid release, or on a foreign origin', () => {
    const { create, runtime, fetch } = setup()
    create(false).page('/')
    create(true, '').page('/')
    runtime.location.origin = 'http://127.0.0.1:5486'
    create().page('/')
    runtime.location.origin = 'https://preview.example.com'
    create().begin('team_loadout')('success')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('respects opt-out, DNT, GPC, and unavailable preference storage', () => {
    const { stats, create, runtime, fetch } = setup()
    stats.setAllowed(false)
    stats.page('/')
    stats.setAllowed(true)
    runtime.navigator.doNotTrack = '1'
    create().page('/')
    runtime.navigator.doNotTrack = null
    runtime.navigator.globalPrivacyControl = true
    create().page('/')
    runtime.navigator.globalPrivacyControl = false
    runtime.localStorage.getItem = () => {
      throw new Error('storage denied')
    }
    create().begin('disc_import')('failure')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aborts pending reports on opt-out and does not replay work begun while disabled', () => {
    const { stats, fetch } = setup()
    fetch.mockImplementation(() => new Promise(() => undefined))
    stats.page('/')
    const signal = fetch.mock.calls[0][1].signal as AbortSignal
    stats.setAllowed(false)
    expect(signal.aborted).toBe(true)
    const finish = stats.begin('disc_import')
    stats.setAllowed(true)
    finish('success')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('drops offline events, bounds concurrent requests, and never retries failed reports', async () => {
    const { stats, fetch, runtime } = setup()
    runtime.navigator.onLine = false
    stats.begin('plan_save')('success')
    runtime.navigator.onLine = true
    fetch.mockRejectedValue(new Error('network unavailable'))
    stats.page('/')
    stats.begin('team_loadout')('failure')
    stats.begin('scanner_connection')('failure')
    expect(fetch).toHaveBeenCalledTimes(2)
    await Promise.resolve()
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
