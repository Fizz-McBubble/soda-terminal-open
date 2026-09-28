import { useEffect, useState, type ReactNode } from 'react'
import { useAppHealth } from '../appHealthContext'

/** Brief reads should resolve without introducing a separate page into the visual journey. */
export function AppLoadingState({ title, compact = false }: { title: string; compact?: boolean }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 250)
    return () => window.clearTimeout(timeout)
  }, [])
  if (!visible) return null
  if (compact)
    return (
      <section className="panel" role="status" aria-live="polite" aria-busy="true">
        <p>{title}</p>
      </section>
    )
  return (
    <main className="app-entry-state" role="status" aria-live="polite" aria-busy="true">
      <span>SODA TERMINAL</span>
      <h1>{title}</h1>
      <p>请稍候，准备完成后会自动继续。</p>
    </main>
  )
}

function EntryError({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <main className="app-entry-state" role="alert">
      <span>SODA TERMINAL</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="app-entry-state__actions">
        {children}
        <button className="back-navigation" onClick={() => window.location.reload()}>
          重新加载
        </button>
        <a className="back-navigation" href="/">
          返回首页
        </a>
      </div>
    </main>
  )
}

/** The router may download modules concurrently, but no business page mounts before storage is ready. */
export function AppInitializationGate({ children }: { children: ReactNode }) {
  const { databaseStatus, dataStatus, canRepairApplicationData, repairApplicationData } =
    useAppHealth()
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
        description="请重新加载页面。若仍无法打开，请保留当前浏览器数据，勿清除或重置账户。"
      />
    )
  if (dataStatus === 'error')
    return (
      <EntryError
        title="游戏数据未能安全加载"
        description="请重新加载页面后再试。现有账户资料不会因此被清除。"
      >
        {canRepairApplicationData && repairApplicationData ? (
          <button className="back-navigation" onClick={repair} disabled={repairing}>
            {repairing ? '正在恢复应用自带资料…' : '恢复应用自带 3.1 资料'}
          </button>
        ) : null}
        {repairError ? <p role="alert">{repairError}</p> : null}
      </EntryError>
    )
  if (databaseStatus !== 'ready') return <AppLoadingState title="正在读取本地资料" />
  return children
}

export function AppRouteLoading() {
  return <AppLoadingState title="正在打开页面" />
}

export function AppRouteError() {
  return (
    <EntryError
      title="页面暂时无法打开"
      description="请重新加载页面，或返回首页后再试。此操作不会清除账户资料。"
    />
  )
}
