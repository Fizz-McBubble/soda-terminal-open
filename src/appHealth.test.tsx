import Dexie from 'dexie'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AppHealthProvider } from './appHealth'
import { useAppHealth } from './appHealthContext'
import { AppInitializationGate } from './components/AppEntryState'
import { database } from './db/databaseCore'

const diagnostics = vi.hoisted(() => ({
  authorityLoad: vi.fn(),
  capabilitiesLoad: vi.fn(),
  create: vi.fn((input: { databaseStatus: string }) => ({
    fingerprint: 'optional-diagnostics',
    runtime: { state: input.databaseStatus },
  })),
}))

vi.mock('./gameDataPacks/currentDataAuthorityProjection', () => {
  diagnostics.authorityLoad()
  return { currentDataAuthorityProjection: { authorityId: 'optional-authority' } }
})
vi.mock('./appCapabilityHealth', () => {
  diagnostics.capabilitiesLoad()
  return { createAppCapabilityHealth: diagnostics.create }
})

function Probe() {
  const health = useAppHealth()
  return (
    <output data-testid="health">
      {JSON.stringify({
        databaseStatus: health.databaseStatus,
        dataStatus: health.dataStatus,
        databaseError: health.databaseError,
        dataError: health.dataError,
        gameVersion: health.currentVersion.gameVersion,
        canRepair: health.canRepairApplicationData,
        authority: health.currentDataAuthority?.authorityId ?? null,
        capabilities: health.capabilities?.fingerprint ?? null,
      })}
    </output>
  )
}

const readHealth = () => JSON.parse(screen.getByTestId('health').textContent ?? '{}')
beforeEach(() => vi.clearAllMocks())
afterEach(async () => {
  vi.unstubAllEnvs()
  database.close()
  await Dexie.delete('soda-terminal')
})

it('browser composition keeps current data/runtime health without loading optional diagnostics', async () => {
  vi.stubEnv('VITE_SODA_COMMUNITY_BUILD', 'true')
  const initializer = vi.fn().mockResolvedValue(undefined)
  render(
    <AppHealthProvider databaseInitializer={initializer}>
      <Probe />
    </AppHealthProvider>,
  )
  await waitFor(() =>
    expect(readHealth()).toMatchObject({
      databaseStatus: 'ready',
      dataStatus: 'ready',
      gameVersion: '3.2',
      authority: null,
      capabilities: null,
    }),
  )
  expect(initializer).toHaveBeenCalledWith(expect.objectContaining({ gameVersion: '3.2' }))
  expect(diagnostics.authorityLoad).not.toHaveBeenCalled()
  expect(diagnostics.capabilitiesLoad).not.toHaveBeenCalled()
  expect(diagnostics.create).not.toHaveBeenCalled()
})

it('internal composition retains optional diagnostics after their module loads', async () => {
  vi.stubEnv('VITE_SODA_COMMUNITY_BUILD', 'false')
  render(
    <AppHealthProvider databaseInitializer={async () => {}}>
      <Probe />
    </AppHealthProvider>,
  )
  await waitFor(() =>
    expect(readHealth()).toMatchObject({
      databaseStatus: 'ready',
      authority: 'optional-authority',
      capabilities: 'optional-diagnostics',
    }),
  )
  expect(diagnostics.create).toHaveBeenLastCalledWith({
    dataStatus: 'ready',
    databaseStatus: 'ready',
  })
})

it('browser composition still fails closed on database initialization errors', async () => {
  vi.stubEnv('VITE_SODA_COMMUNITY_BUILD', 'true')
  const initializer = vi.fn().mockRejectedValue(new Error('initialization failed'))
  render(
    <AppHealthProvider databaseInitializer={initializer}>
      <Probe />
      <AppInitializationGate>
        <span data-testid="business">business</span>
      </AppInitializationGate>
    </AppHealthProvider>,
  )
  await waitFor(() =>
    expect(readHealth()).toMatchObject({
      databaseStatus: 'error',
      databaseError: 'initialization failed',
      authority: null,
      capabilities: null,
    }),
  )
  expect(screen.queryByTestId('business')).not.toBeInTheDocument()
  expect(diagnostics.create).not.toHaveBeenCalled()
})

it('browser composition keeps the unbound package failure and existing repair action', async () => {
  vi.stubEnv('VITE_SODA_COMMUNITY_BUILD', 'true')
  await database.open()
  await database.gameDataPackState.put({
    id: 'active-game-data-packs',
    activeFormalByKind: {},
    expiredCalculationPackageIds: [],
    updatedAt: '2026-10-03T00:00:00Z',
  })
  render(
    <AppHealthProvider databaseInitializer={async () => {}}>
      <Probe />
      <AppInitializationGate>
        <span data-testid="business">business</span>
      </AppInitializationGate>
    </AppHealthProvider>,
  )
  await waitFor(() =>
    expect(readHealth()).toMatchObject({
      databaseStatus: 'ready',
      dataStatus: 'error',
      canRepair: true,
      authority: null,
      capabilities: null,
    }),
  )
  expect(screen.queryByTestId('business')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /恢复应用自带/ })).toBeInTheDocument()
  expect(diagnostics.create).not.toHaveBeenCalled()
})
