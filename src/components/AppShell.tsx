import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useInsertionEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { Archive, Menu, ShieldCheck, Users, X } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BackNavigation } from './BackNavigation'
import {
  getActiveAccount,
  getAccountRoster,
  getAccountSelectionDiagnostic,
} from '../accounts/repository'
import { database } from '../db/databaseCore'
import { useAppHealth } from '../appHealthContext'
import {
  getRouteMeta,
  isPrimaryNavigationCurrent,
  mobileNavigation,
  navigationGroups,
} from '../navigation'
import { useUiStore } from '../store/useUiStore'
import { applyRouteStyleScope, getRouteStyleScope } from '../styles/routeStyles'
import { preloadPlayerRoute } from '../routes/preloadPlayerRoute'
import { SodaMark } from './SodaMark'
import { F5VisualShell } from './F5VisualShell'
import { F5AccountSummaryProvider } from './f5AccountSummaryContext'
import { OnlineCalculationConsent } from './OnlineCalculationConsent'

export function AppShell({
  onAllowOnlineCalculation,
  children,
}: {
  onAllowOnlineCalculation?: () => void
  children?: ReactNode
}) {
  const [appSessionId] = useState(() => crypto.randomUUID())
  const location = useLocation()
  const { currentVersion, dataStatus, databaseError, databaseStatus } = useAppHealth()
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUiStore()
  const routeMeta = getRouteMeta(location.pathname)
  const accountSummary = useLiveQuery(
    async () =>
      databaseStatus === 'ready'
        ? database.transaction(
            'r',
            [
              database.settings,
              database.accounts,
              database.accountDriveDiscs,
              database.accountRosters,
            ],
            async () => {
              const [account, accountDiagnostic] = await Promise.all([
                getActiveAccount(),
                getAccountSelectionDiagnostic(),
              ])
              if (!account)
                return {
                  accountId: null,
                  name: '',
                  discCount: 0,
                  agentCount: 0,
                  hasAccount: false,
                  accountDiagnostic,
                }
              const [discCount, roster] = await Promise.all([
                database.accountDriveDiscs.where('accountId').equals(account.id).count(),
                getAccountRoster(account.id),
              ])
              return {
                accountId: account.id,
                name: account.displayName,
                discCount,
                agentCount: roster.agents.filter((agent) => agent.owned).length,
                hasAccount: true,
                accountDiagnostic,
              }
            },
          )
        : undefined,
    [databaseStatus],
  )
  const systemReady = dataStatus === 'ready' && databaseStatus === 'ready'
  const systemFailed = dataStatus === 'error' || databaseStatus === 'error'
  const accountHydrating = accountSummary === undefined
  const isF5Slice = getRouteStyleScope(location.pathname) === 'f5'
  const showOnlineCalculationCard =
    Boolean(onAllowOnlineCalculation) &&
    /^\/(?:development|loadouts|warehouse|optimizer|workbench)(?:\/|$)/.test(location.pathname)
  const statusLabel = systemFailed
    ? '运行环境初始化异常'
    : systemReady
      ? '运行环境已就绪'
      : '运行环境正在初始化'
  const localScopeProgress = accountSummary?.hasAccount
    ? Math.round(
        ([true, accountSummary.agentCount > 0, accountSummary.discCount > 0].filter(Boolean)
          .length /
          3) *
          100,
      )
    : 0
  const isPrimaryCurrent = (path: string) => isPrimaryNavigationCurrent(path, location.pathname)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('soda-f5-scrollbarless', isF5Slice)
    document.body.classList.toggle('soda-f5-scrollbarless', isF5Slice)
    return () => {
      document.documentElement.classList.remove('soda-f5-scrollbarless')
      document.body.classList.remove('soda-f5-scrollbarless')
    }
  }, [isF5Slice])

  useLayoutEffect(() => {
    // Saving updates the candidate query string without leaving the workbench.
    if (location.state?.preserveWorkbenchPosition) return
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        // Only ordinary anchor fragments participate in route restoration. Tooling
        // integrations may put parameter payloads in the fragment, which are not
        // valid CSS selectors and must not break the rendered route.
        const anchorId = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
        if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(anchorId)) {
          document.getElementById(anchorId)?.scrollIntoView()
        }
        return
      }
      if (isF5Slice) {
        const scrollOwner = document.querySelector<HTMLElement>('[data-f5-scroll-owner]')
        if (typeof scrollOwner?.scrollTo === 'function') scrollOwner.scrollTo({ top: 0 })
        else if (scrollOwner) scrollOwner.scrollTop = 0
        const pageContent = document.querySelector<HTMLElement>('.f5v-page-content')
        if (typeof pageContent?.scrollTo === 'function') pageContent.scrollTo({ top: 0 })
        else if (pageContent) pageContent.scrollTop = 0
      }
      if (!navigator.userAgent.includes('jsdom')) window.scrollTo({ top: 0, left: 0 })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [
    isF5Slice,
    location.hash,
    location.pathname,
    location.search,
    location.state?.preserveWorkbenchPosition,
  ])

  useInsertionEffect(() => {
    applyRouteStyleScope(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    let hasFocused = false
    const focusHeading = (force = false) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return false
      const heading = document.querySelector<HTMLElement>('main h1')
      if (!heading) return false
      const activeElement = document.activeElement
      const focusWasLost =
        activeElement === document.body ||
        activeElement === document.documentElement ||
        !activeElement?.isConnected
      if (!force && hasFocused && !focusWasLost) return false
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      hasFocused = true
      return true
    }
    const main = document.querySelector('main')
    const observer = main
      ? new MutationObserver(() => {
          focusHeading()
        })
      : undefined
    observer?.observe(main!, { childList: true, subtree: true })
    const frame = window.requestAnimationFrame(() => {
      focusHeading(true)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [location.pathname, location.search])

  if (isF5Slice) {
    const f5AccountSummary = {
      hydrating: accountHydrating,
      appSessionId,
      accountId: accountSummary?.accountId ?? null,
      name: accountSummary?.name ?? '',
      agentCount: accountSummary?.agentCount ?? 0,
      discCount: accountSummary?.discCount ?? 0,
      hasAccount: accountSummary?.hasAccount ?? false,
    }
    return (
      <F5AccountSummaryProvider value={f5AccountSummary}>
        <F5VisualShell
          currentPath={location.pathname}
          currentTitle={routeMeta.title}
          currentVersion={currentVersion.gameVersion}
          account={f5AccountSummary}
          systemStatus={systemFailed ? 'error' : systemReady ? 'ready' : 'loading'}
          sidebarOpen={sidebarOpen}
          closeSidebar={closeSidebar}
          toggleSidebar={toggleSidebar}
          isPrimaryCurrent={isPrimaryCurrent}
        >
          {databaseStatus === 'error' ? (
            <section className="database-error-banner" role="alert">
              <strong>本地档案库未能安全打开</strong>
              <span>{databaseError ?? '数据库初始化或迁移失败。'}</span>
              <p>现有数据不会被当作空仓库覆盖。请保留当前浏览器数据并重试，必要时联系支持恢复。</p>
            </section>
          ) : null}
          {dataStatus === 'error' ? (
            <section className="database-error-banner" role="alert">
              <strong>游戏数据未能安全加载</strong>
              <span>内置规则或数据文件未通过校验。</span>
              <p>鉴定入口会保留页面说明，但请先修复数据文件后再生成新评价。</p>
            </section>
          ) : null}
          {accountSummary?.accountDiagnostic ? (
            <section className="database-error-banner" role="alert">
              <strong>本地账户需要确认</strong>
              <p>{accountSummary.accountDiagnostic.message}</p>
              <Link to="/assets/account">查看账户与备份</Link>
            </section>
          ) : null}
          {showOnlineCalculationCard && onAllowOnlineCalculation ? (
            <OnlineCalculationConsent onAllow={onAllowOnlineCalculation} />
          ) : null}
          {children ?? <Outlet />}
        </F5VisualShell>
      </F5AccountSummaryProvider>
    )
  }

  return (
    <div className="app-shell app-shell--tactical">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <SodaMark />
          <button
            className="icon-button sidebar__close"
            onClick={closeSidebar}
            aria-label="关闭导航"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="主导航">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label || 'primary'}>
              {group.label ? <p className="nav-group__label">{group.label}</p> : null}
              {group.items.map(({ icon: Icon, label, path }) => {
                const current = isPrimaryCurrent(path)
                return (
                  <Link
                    key={path}
                    to={path}
                    aria-current={current ? 'page' : undefined}
                    className={`nav-item ${current ? 'nav-item--active' : ''}`}
                    onClick={closeSidebar}
                    onPointerEnter={() => preloadPlayerRoute(path)}
                    onFocus={() => preloadPlayerRoute(path)}
                  >
                    <Icon size={19} strokeWidth={2.1} />
                    <span className="nav-item__label">{label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer" aria-live="polite">
          <Link
            to="/system/help"
            onClick={closeSidebar}
            onPointerEnter={() => preloadPlayerRoute('/system/help')}
            onFocus={() => preloadPlayerRoute('/system/help')}
          >
            帮助与隐私
          </Link>
          <strong>本地数据</strong>
          <span className="sidebar-data-account">
            {accountHydrating
              ? '正在读取本地账户'
              : accountSummary?.hasAccount
                ? `当前账户 · ${accountSummary.name}`
                : '尚未选择账户'}
          </span>
          <div className="sidebar-data-counts" aria-label="当前账户数据范围">
            <span>{accountHydrating ? '—' : (accountSummary?.agentCount ?? 0)} 代理人</span>
            <span>{accountHydrating ? '—' : (accountSummary?.discCount ?? 0)} 驱动盘</span>
          </div>
          <div className="sidebar-data-progress">
            <span>本地范围就绪度</span>
            <strong>{localScopeProgress}%</strong>
            <progress aria-label="本地范围就绪度" max="100" value={localScopeProgress} />
          </div>
          <small>
            当前版本 {currentVersion.gameVersion} ·{' '}
            {systemFailed ? '环境异常' : systemReady ? '环境正常' : statusLabel}
          </small>
        </div>
      </aside>
      {sidebarOpen && (
        <button className="sidebar-backdrop" onClick={closeSidebar} aria-label="关闭导航" />
      )}
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button topbar__menu"
            onClick={toggleSidebar}
            aria-label="打开导航"
          >
            <Menu size={21} />
          </button>
          {!location.pathname.startsWith('/assets') &&
          !location.pathname.startsWith('/development/') &&
          location.pathname !== '/system/scanner' &&
          routeMeta.backTo ? (
            <nav className="tactical-route-title" aria-label="返回路径">
              <BackNavigation to={routeMeta.backTo} />
            </nav>
          ) : null}
          <div className="tactical-status-strip" aria-label="账号状态">
            <span>
              <Users size={15} />{' '}
              {accountHydrating ? '正在读取本地账户' : `${accountSummary?.agentCount ?? 0} 代理人`}
            </span>
            <span>
              <Archive size={15} />{' '}
              {accountHydrating ? '仓库读取中' : `${accountSummary?.discCount ?? 0} 驱动盘`}
            </span>
            <span>当前版本 {currentVersion.gameVersion}</span>
            <span className={systemFailed ? 'is-error' : ''}>
              <ShieldCheck size={15} /> {systemFailed ? '环境异常' : '环境正常'}
            </span>
          </div>
        </header>
        <div
          className={`page-content ${location.pathname.startsWith('/optimizer') || location.pathname.startsWith('/loadouts') ? 'page-content--optimizer' : ''} ${location.pathname === '/' ? 'page-content--home' : ''} ${location.pathname.startsWith('/assets') ? 'page-content--assets' : ''}`}
        >
          {databaseStatus === 'error' && (
            <section className="database-error-banner" role="alert">
              <strong>本地档案库未能安全打开</strong>
              <span>{databaseError ?? '数据库初始化或迁移失败。'}</span>
              <p>现有数据不会被当作空仓库覆盖。请保留当前浏览器数据并重试，必要时联系支持恢复。</p>
            </section>
          )}
          {dataStatus === 'error' && (
            <section className="database-error-banner" role="alert">
              <strong>游戏数据未能安全加载</strong>
              <span>内置规则或数据文件未通过校验。</span>
              <p>鉴定入口会保留页面说明，但请先修复数据文件后再生成新评价。</p>
            </section>
          )}
          <main className="page-frame" id="main-content">
            {showOnlineCalculationCard && onAllowOnlineCalculation ? (
              <OnlineCalculationConsent onAllow={onAllowOnlineCalculation} />
            ) : null}
            {children ?? <Outlet />}
          </main>
        </div>
        <nav
          className={`mobile-nav ${location.pathname === '/workbench/disc-analysis' ? 'mobile-nav--task-hidden' : ''}`}
          aria-label="移动端主导航"
        >
          {mobileNavigation.map(({ icon: Icon, label, path }) => {
            const current = isPrimaryCurrent(path)
            return (
              <Link
                key={path}
                to={path}
                aria-current={current ? 'page' : undefined}
                className={`mobile-nav__item ${current ? 'mobile-nav__item--active' : ''}`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
