import { useState, type ReactNode } from 'react'
import { useAppHealth } from '../appHealthContext'
import { AppShell } from './AppShell'
import { HomeLoading } from './HomeHeroScene'
import { useLocation } from 'react-router-dom'
import './AppEntryState.css'
import { DelayedLoadingFeedback } from './DelayedLoadingFeedback'

/** Shared empty workbench: one explanation and one compact next action. */
export function WorkbenchEmptyState({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="workbench-empty-state" role="status">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{description}</p>
      {children}
      <div className="workbench-empty-state__actions app-recovery-actions">{action}</div>
    </section>
  )
}

/** Brief reads should resolve without introducing a separate page into the visual journey. */
export function AppLoadingState({
  title,
  heading,
  compact = false,
}: {
  title: string
  heading?: string
  compact?: boolean
}) {
  return (
    <DelayedLoadingFeedback>
      <section
        className={compact ? 'panel' : 'app-loading-status'}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {heading ? <h1>{heading}</h1> : null}
        <p>{title}</p>
      </section>
    </DelayedLoadingFeedback>
  )
}

function EntryError({
  title,
  description,
  hasPrimaryAction = false,
  children,
}: {
  title: string
  description: string
  hasPrimaryAction?: boolean
  children?: ReactNode
}) {
  return (
    <main className="app-entry-state" role="alert">
      <span>SODA TERMINAL</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="app-entry-state__actions app-recovery-actions">
        {children}
        <button
          className={hasPrimaryAction ? 'button' : 'button button--primary'}
          onClick={() => window.location.reload()}
        >
          重新加载
        </button>
        <a className="button" href="/">
          返回首页
        </a>
      </div>
    </main>
  )
}

/** The router may download modules concurrently, but no business page mounts before storage is ready. */
export function AppInitializationGate({
  children,
  loadingFallback,
}: {
  children: ReactNode
  loadingFallback?: ReactNode
}) {
  const {
    databaseStatus,
    retryDatabaseInitialization,
    dataStatus,
    canRepairApplicationData,
    repairApplicationData,
    currentVersion,
  } = useAppHealth()
  const [repairing, setRepairing] = useState(false)
  const [repairError, setRepairError] = useState<string | null>(null)

  const repair = async () => {
    if (!repairApplicationData) return
    setRepairing(true)
    setRepairError(null)
    try {
      await repairApplicationData()
    } catch {
      setRepairError('恢复未完成。请重试；此操作不会清除账户、驱动盘或已保存方案。')
    } finally {
      setRepairing(false)
    }
  }
  if (databaseStatus === 'error')
    return (
      <EntryError
        title="本地档案库未能安全打开"
        description="请重新加载页面。若仍无法打开，请保留当前浏览器数据，勿清除或重置账户，并重试打开或联系支持恢复。"
        hasPrimaryAction={Boolean(retryDatabaseInitialization)}
      >
        {retryDatabaseInitialization ? (
          <button
            className="button button--primary"
            type="button"
            onClick={retryDatabaseInitialization}
          >
            重试打开档案库
          </button>
        ) : null}
      </EntryError>
    )
  if (dataStatus === 'error')
    return (
      <EntryError
        title="游戏数据未能安全加载"
        description="请重新加载页面后再试。"
        hasPrimaryAction={Boolean(canRepairApplicationData && repairApplicationData)}
      >
        {canRepairApplicationData && repairApplicationData ? (
          <button className="button button--primary" onClick={repair} disabled={repairing}>
            {repairing
              ? '正在恢复应用自带资料…'
              : `恢复应用自带 ${currentVersion.gameVersion} 资料`}
          </button>
        ) : null}
        {repairError ? <p role="alert">{repairError}</p> : null}
      </EntryError>
    )
  if (databaseStatus !== 'ready')
    return loadingFallback ?? <AppLoadingState title="正在读取本地资料" />
  return children
}

export function AppRouteLoading() {
  const atHome = useLocation().pathname === '/'
  return (
    <AppShell>
      {atHome ? <HomeLoading title="正在打开首页" /> : <AppLoadingState title="正在打开页面" />}
    </AppShell>
  )
}

export function AppRouteError() {
  return <EntryError title="页面暂时无法打开" description="请重新加载页面，或返回首页后再试。" />
}
