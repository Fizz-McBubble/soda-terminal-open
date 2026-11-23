import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppHealthContext, type AppHealth, type HealthStatus } from './appHealthContext'
import { gameData, gameDataResult } from './data/gameData'
import { databaseSchemaVersion, initializeDatabase } from './db/database'
import { publicVersionIdentity } from './application/publicVersionIdentity'
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
  const detailedLoad = useRef<Promise<void> | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const loadDetailedHealth = useCallback(() => {
    if (import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true') return Promise.resolve()
    if (!detailedLoad.current) {
      detailedLoad.current = Promise.all([
        import('./gameDataPacks/currentDataAuthorityProjection'),
        import('./appCapabilityHealth'),
      ])
        .then(([authority, capabilities]) => {
          if (mounted.current)
            setDetailedHealth({
              authority: authority.currentDataAuthorityProjection,
              createCapabilities: capabilities.createAppCapabilityHealth,
            })
        })
        .catch((error: unknown) => {
          detailedLoad.current = null
          throw error
        })
    }
    return detailedLoad.current
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
      gameVersion: publicVersionIdentity.gameVersion,
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
      currentVersion: publicVersionIdentity,
      ...(detailedHealth
        ? {
            currentDataAuthority: detailedHealth.authority,
            capabilities: detailedHealth.createCapabilities({ dataStatus, databaseStatus }),
          }
        : {}),
      ...(import.meta.env.VITE_SODA_COMMUNITY_BUILD === 'true' ? {} : { loadDetailedHealth }),
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
      loadDetailedHealth,
      repairApplicationData,
    ],
  )

  return <AppHealthContext.Provider value={value}>{children}</AppHealthContext.Provider>
}
