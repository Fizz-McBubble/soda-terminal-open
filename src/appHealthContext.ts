import { createContext, useContext } from 'react'
import type { GameDataManifest } from './domain/schemas'
import type { currentVersionProjection } from './gameDataPacks/currentVersionProjection'
import type { currentDataAuthorityProjection } from './gameDataPacks/currentDataAuthorityProjection'
import type { createAppCapabilityHealth } from './appCapabilityHealth'

export type HealthStatus = 'loading' | 'ready' | 'error'

export type AppHealth = {
  data: GameDataManifest | null
  currentVersion: Pick<
    typeof currentVersionProjection,
    | 'id'
    | 'gameVersion'
    | 'packageId'
    | 'packageVersion'
    | 'rollbackPackageId'
    | 'lifecycle'
    | 'fieldBoundary'
  >
  currentDataAuthority?: typeof currentDataAuthorityProjection
  capabilities?: ReturnType<typeof createAppCapabilityHealth>
  dataStatus: Exclude<HealthStatus, 'loading'>
  dataError: string | null
  canRepairApplicationData?: boolean
  repairApplicationData?: () => Promise<unknown>
  databaseStatus: HealthStatus
  databaseError: string | null
}

export const AppHealthContext = createContext<AppHealth | null>(null)

export function useAppHealth() {
  const context = useContext(AppHealthContext)
  if (!context) throw new Error('useAppHealth must be used within AppHealthProvider')
  return context
}
