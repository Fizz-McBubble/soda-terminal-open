import Dexie from 'dexie'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import AppCore, { type DecisionEnvironment } from './AppCore'
import { AppHealthProvider } from './appHealth'
import { createBrowserCalculationQueryClient } from './application/browserCalculationQueryClient'
import { database, initializeDatabase } from './db/database'
import { currentVersionProjection } from './gameDataPacks/currentVersionProjection'
import { readCurrentGameDataRuntimeSelection } from './gameDataPacks/runtimeSelection'

function startupEnvironment() {
  vi.stubEnv('VITE_SODA_COMMUNITY_BUILD', 'true')
  window.history.replaceState({}, '', '/')
  const readRuntimeSelection = vi.fn(readCurrentGameDataRuntimeSelection)
  const createWorker = vi.fn(() => {
    throw new Error('Startup without an account must not start calculation')
  })
  const decisionEnvironment: DecisionEnvironment = {
    mode: 'local',
    queryClient: createBrowserCalculationQueryClient({ readRuntimeSelection, createWorker }),
    runtimeSelectionReader: readRuntimeSelection,
    repairRuntimeSelection: null,
  }
  return { decisionEnvironment, readRuntimeSelection, createWorker }
}

afterEach(async () => {
  cleanup()
  vi.unstubAllEnvs()
  database.close()
  await Dexie.delete(database.name)
})

it('shows the existing shell and current version while storage waits, then opens the home page', async () => {
  const environment = startupEnvironment()
  let continueStartup!: () => void
  const pending = new Promise<void>((resolve) => {
    continueStartup = resolve
  })
  const initializer = vi.fn(async (options: Parameters<typeof initializeDatabase>[0]) => {
    await pending
    await initializeDatabase(options)
  })
  render(
    <AppCore
      HealthProvider={AppHealthProvider}
      databaseInitializer={initializer}
      decisionEnvironment={environment.decisionEnvironment}
    />,
  )
  expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
  expect(screen.getByText(`版本 ${currentVersionProjection.gameVersion}`)).toHaveTextContent('3.2')
  expect(screen.queryByText('版本 3.1')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /^前往扫描与导入/ })).not.toBeInTheDocument()
  expect(database.isOpen()).toBe(false)
  expect(environment.readRuntimeSelection).not.toHaveBeenCalled()
  expect(environment.createWorker).not.toHaveBeenCalled()

  await act(async () => continueStartup())
  expect(await screen.findByRole('link', { name: /^前往扫描与导入/ })).toBeInTheDocument()
  expect(screen.getByText('版本 3.2')).toBeInTheDocument()
  expect(initializer).toHaveBeenCalledWith(expect.objectContaining({ gameVersion: '3.2' }))
  expect(environment.createWorker).not.toHaveBeenCalled()
})

it('keeps a failed database behind the existing recovery screen', async () => {
  const environment = startupEnvironment()
  render(
    <AppCore
      HealthProvider={AppHealthProvider}
      databaseInitializer={async () => {
        throw new Error('synthetic startup failure')
      }}
      decisionEnvironment={environment.decisionEnvironment}
    />,
  )
  expect(await screen.findByRole('heading', { name: '本地档案库未能安全打开' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /^前往扫描与导入/ })).not.toBeInTheDocument()
  expect(environment.readRuntimeSelection).not.toHaveBeenCalled()
  expect(environment.createWorker).not.toHaveBeenCalled()
})
