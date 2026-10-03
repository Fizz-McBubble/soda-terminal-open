import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppHealthContext, type AppHealth, type HealthStatus } from './appHealthContext'
import { gameData, gameDataResult } from './data/gameData'
import { databaseSchemaVersion, initializeDatabase } from './db/database'
import { currentVersionProjection } from './gameDataPacks/currentVersionProjection'
import { readCurrentGameDataRuntimeSelection } from './gameDataPacks/runtimeSelection'

type DetailedHealth = {
  authority: NonNullable<AppHealth['currentDataAuthority']>
  createCapabilities: typeof import('./appCapabilityHealth').createAppCapabilityHealth
}

export function AppHealthProvider({
  children,
  databaseInitializer = initializeDatabase,
}: {
  children: ReactNode
  databaseInitializer?: typeof initializeDatabase
}) {
  const [databaseStatus, setDatabaseStatus] = useState<HealthStatus>('loading')
  const [databaseError, setDatabaseError] = useState<string | null>(null)
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealth | null>(null)

  useEffect(() => {
    // These optional diagnostics have no browser-product consumer. Their authority/validation
    // graphs remain in the calculation Worker, not the synchronous player UI entry.
    if (import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true') return
    let active = true
    void Promise.all([
      import('./gameDataPacks/currentDataAuthorityProjection'),
      import('./appCapabilityHealth'),
    ]).then(
      ([authority, capabilities]) => {
        if (active)
          setDetailedHealth({
            authority: authority.currentDataAuthorityProjection,
            createCapabilities: capabilities.createAppCapabilityHealth,
          })
      },
      () => {
        // Optional diagnostics must not change the actual database/data failure gate below.
      },
    )
    return () => {
      active = false
    }
  }, [])

  // This query is deliberately inactive until initialization completes. It observes the same
  // game-data records used by calculation, so repair or an explicit package switch refreshes the
  // global gate without reading or changing any player-owned records.
  const runtimeSelection = useLiveQuery(async () => {
    if (databaseStatus !== 'ready') return null
    try {
      return { kind: 'selection' as const, value: await readCurrentGameDataRuntimeSelection() }
    } catch {
      return { kind: 'error' as const }
    }
  }, [databaseStatus])

  useEffect(() => {
    let active = true

    databaseInitializer({
      schemaVersion: databaseSchemaVersion,
      gameVersion: currentVersionProjection.gameVersion,
    })
      .then(() => {
        if (active) setDatabaseStatus('ready')
      })
      .catch((error: unknown) => {
        if (!active) return
        setDatabaseStatus('error')
        setDatabaseError(error instanceof Error ? error.message : '本地数据库初始化失败')
      })

    return () => {
      active = false
    }
  }, [databaseInitializer])

  const runtimeDataError =
    runtimeSelection?.kind === 'error'
      ? '游戏资料暂时不可用，请恢复与当前应用配套的资料后重试。'
      : runtimeSelection?.kind === 'selection' && runtimeSelection.value.status === 'unbound'
        ? runtimeSelection.value.message
        : null
  const dataStatus = gameDataResult.success && !runtimeDataError ? 'ready' : 'error'
  const dataError = gameDataResult.success ? runtimeDataError : gameDataResult.error.message
  const canRepairApplicationData =
    databaseStatus === 'ready' &&
    runtimeSelection?.kind === 'selection' &&
    runtimeSelection.value.status === 'unbound'
  const repairApplicationData = useCallback(async () => {
    if (!canRepairApplicationData) throw new Error('当前游戏资料状态不可由应用自带资料恢复。')
    return (await import('./gameDataPacks/repository')).repairBundledCurrentGameData()
  }, [canRepairApplicationData])

  const value = useMemo<AppHealth>(
    () => ({
      data: dataStatus === 'ready' ? gameData : null,
      currentVersion: currentVersionProjection,
      ...(detailedHealth
        ? {
            currentDataAuthority: detailedHealth.authority,
            capabilities: detailedHealth.createCapabilities({ dataStatus, databaseStatus }),
          }
        : {}),
      dataStatus,
      dataError,
      canRepairApplicationData,
      repairApplicationData,
      databaseStatus,
      databaseError,
    }),
    [
      canRepairApplicationData,
      dataError,
      dataStatus,
      databaseError,
      databaseStatus,
      detailedHealth,
      repairApplicationData,
    ],
  )

  return <AppHealthContext.Provider value={value}>{children}</AppHealthContext.Provider>
}
