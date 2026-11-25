import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { allNavigationItems, mobileNavigation, navigationGroups } from '../navigation'
import { preloadPlayerRouteIntent } from '../routes/preloadPlayerRoute'
import { useDetailsDisclosureMotion } from '../motion/useDetailsDisclosureMotion'
import { useStateTransitionMotion } from '../motion/useStateTransitionMotion'
import { SponsorProvider, SponsorRail } from './SponsorSupport'
import { ReleaseNotes } from './ReleaseNotes'
import { TestingBadge } from './TestingBadge'

const signalPeaks = [
  18, 32, 54, 82, 45, 24, 37, 67, 96, 62, 35, 18, 24, 43, 77, 100, 59, 32, 22, 42, 67, 35, 21, 13,
]

const narrowNavigationQuery = '(max-width: 960px)'
const publicBuild = import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
function subscribeNavigationWidth(onChange: () => void) {
  const media = window.matchMedia?.(narrowNavigationQuery)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}
function isNarrowNavigation() {
  return window.matchMedia?.(narrowNavigationQuery).matches ?? window.innerWidth <= 960
}

function subscribeDesktopScale(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

const desktopBaselineWidth = 1920
const desktopMinScaleWidth = 1280
const desktopBaselineChromeTolerance = 24
const desktopMaxScale = 1.5

function desktopScale() {
  // Use outerWidth (stable across native browser zoom) as the desktop composition baseline.
  // Never scale from innerWidth, which shrinks under browser zoom and cancels magnification.
  // Snap within +/-24px of 1920 so OS window borders stay exact 1x without a large discontinuity.
  const windowWidth = window.outerWidth
  if (!Number.isFinite(windowWidth) || windowWidth < desktopMinScaleWidth) return 1
  if (Math.abs(windowWidth - desktopBaselineWidth) <= desktopBaselineChromeTolerance) return 1
  return Math.min(desktopMaxScale, windowWidth / desktopBaselineWidth)
}

function desktopTypeViewportUnit() {
  // Provide a stable 1% desktop width unit from outerWidth so fluid clamp() font sizes
  // preserve desktop composition at 100% zoom without shrinking under native browser zoom.
  const windowWidth = window.outerWidth
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return undefined
  return `${Math.round(windowWidth) / 100}px`
}

function routeSectionFor(path: string) {
  if (path.startsWith('/assets')) return 'assets'
  if (path.startsWith('/development')) return 'development'
  if (path.startsWith('/loadouts')) return 'teams'
  if (path.startsWith('/warehouse')) return 'warehouse'
  if (path.startsWith('/system')) return 'system'
  return 'home'
}

type F5VisualShellProps = {
  navigationPending?: boolean
  children: ReactNode
  currentPath: string
  currentTitle: string
  currentVersion: string
  account: {
    hydrating: boolean
    status: 'loading' | 'ready' | 'error'
    name: string
    agentCount: number
    discCount: number
    hasAccount: boolean
  }
  systemStatus: 'ready' | 'loading' | 'error'
  sidebarOpen: boolean
  closeSidebar: () => void
  toggleSidebar: () => void
  isPrimaryCurrent: (path: string) => boolean
}

export function F5VisualShell(props: F5VisualShellProps) {
  return (
    <SponsorProvider>
      <F5VisualShellContent {...props} />
    </SponsorProvider>
  )
}

function F5VisualShellContent({
  navigationPending = false,
  children,
  currentPath,
  currentTitle,
  currentVersion,
  account,
  systemStatus,
  sidebarOpen,
  closeSidebar,
  toggleSidebar,
  isPrimaryCurrent,
}: F5VisualShellProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const pageFrameRef = useRef<HTMLElement>(null)
  const signalRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const syncVisibility = () => {
      const state = document.hidden ? 'paused' : 'running'
      shellRef.current?.style.setProperty('--signal-play-state', state)
      signalRef.current?.style.setProperty('--signal-play-state', state)
    }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])
  const railRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreMenuFocusRef = useRef(false)
  const narrowNavigation = useSyncExternalStore(subscribeNavigationWidth, isNarrowNavigation)
  const scale = useSyncExternalStore(subscribeDesktopScale, desktopScale)
  const typeViewportUnit = useSyncExternalStore(subscribeDesktopScale, desktopTypeViewportUnit)
  const navigationDialogOpen = narrowNavigation && sidebarOpen
  const dismissNavigation = () => {
    restoreMenuFocusRef.current = narrowNavigation
    closeSidebar()
    // Route links close without restoring focus; AppShell owns the new page heading.
  }
  const isScanner = currentPath === '/system/scanner'
  const currentNavigation = allNavigationItems.find(({ path }) => isPrimaryCurrent(path))
  const LocationIcon = currentNavigation?.icon
  const isWorkspaceRoute =
    isScanner ||
    currentPath.startsWith('/assets') ||
    currentPath.startsWith('/development') ||
    currentPath === '/warehouse/discs'
  useDetailsDisclosureMotion({ scope: pageFrameRef })
  useStateTransitionMotion({
    scope: pageFrameRef,
    stateKey: currentPath,
    includeScope: true,
    enabled: !navigationPending,
    transition: 'route',
  })
  const scrollScannerFromInitialHeading = (event: KeyboardEvent<HTMLElement>) => {
    if (!isScanner || !(event.target instanceof HTMLElement)) return
    if (!event.target.matches('h1[tabindex="-1"]')) return
    const owner = pageFrameRef.current
    if (!owner || event.currentTarget !== owner) return
    const maxScrollTop = Math.max(0, owner.scrollHeight - owner.clientHeight)
    const pageStep = Math.max(40, Math.round(owner.clientHeight * 0.9))
    let nextTop: number | null = null
    switch (event.key) {
      case 'PageDown':
        nextTop = owner.scrollTop + pageStep
        break
      case 'PageUp':
        nextTop = owner.scrollTop - pageStep
        break
      case 'ArrowDown':
        nextTop = owner.scrollTop + 40
        break
      case 'ArrowUp':
        nextTop = owner.scrollTop - 40
        break
      case 'Home':
        nextTop = 0
        break
      case 'End':
        nextTop = maxScrollTop
        break
      case ' ':
        nextTop = owner.scrollTop + (event.shiftKey ? -pageStep : pageStep)
        break
    }
    if (nextTop === null) return
    event.preventDefault()
    owner.scrollTop = Math.max(0, Math.min(maxScrollTop, nextTop))
  }

  useEffect(() => {
    if (navigationDialogOpen) closeRef.current?.focus()
    else if (restoreMenuFocusRef.current) {
      restoreMenuFocusRef.current = false
      if (narrowNavigation) menuRef.current?.focus()
    }
  }, [navigationDialogOpen, narrowNavigation])

  return (
    <div
      ref={shellRef}
      className="f5v-shell"
      data-slice-theme="bright-muted"
      data-route-section={routeSectionFor(currentPath)}
      style={
        {
          '--soda-ui-scale': narrowNavigation ? 1 : scale,
          ...(narrowNavigation || !typeViewportUnit ? {} : { '--soda-type-vw': typeViewportUnit }),
        } as CSSProperties
      }
    >
      <aside
        ref={railRef}
        id="primary-navigation-panel"
        className={`f5v-rail ${sidebarOpen ? 'is-open' : ''}`}
        inert={narrowNavigation && !sidebarOpen}
        aria-hidden={narrowNavigation && !sidebarOpen ? true : undefined}
        role={navigationDialogOpen ? 'dialog' : undefined}
        aria-modal={navigationDialogOpen ? true : undefined}
        aria-label={navigationDialogOpen ? '主导航' : undefined}
        onKeyDown={(event) => {
          if (!navigationDialogOpen) return
          if (event.key === 'Escape') {
            // The native top layer closes its own disclosure before the rail.
            if (
              (event.target as HTMLElement).closest('[popover]') ||
              railRef.current?.querySelector('.explanation__trigger[aria-expanded="true"]')
            )
              return
            event.preventDefault()
            dismissNavigation()
          } else if (event.key === 'Tab') {
            const items = railRef.current?.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled])',
            )
            const first = items?.[0]
            const last = items?.[items.length - 1]
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <div className="f5v-brand-row">
          <Link className="f5v-brand" to="/" aria-label="Soda Terminal 首页" onClick={closeSidebar}>
            <img
              className="f5v-brand-icon"
              src="/assets/soda-brand-icon.png"
              alt=""
              aria-hidden="true"
            />
            <span>
              <strong>Soda</strong>
              <small>Terminal</small>
            </span>
          </Link>
          <button
            ref={closeRef}
            type="button"
            className="f5v-rail-close"
            onClick={dismissNavigation}
            aria-label="关闭导航"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <nav className="f5v-navigation" aria-label="主导航">
          {navigationGroups.flatMap((group) =>
            group.items.map(({ label, path, icon: Icon }) => {
              const current = isPrimaryCurrent(path)
              const destination = path === '/assets' && account.hasAccount ? '/assets/agents' : path
              const link = (
                <Link
                  key={path}
                  to={destination}
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'is-current' : undefined}
                  onClick={closeSidebar}
                >
                  <Icon className="f5v-navigation__icon" aria-hidden="true" size={16} />
                  <span>{label}</span>
                </Link>
              )
              return path === '/loadouts/team' || path === '/warehouse/discs' ? (
                <div className="f5v-navigation__testing-row" key={path}>
                  {link}
                  <TestingBadge scope={path === '/loadouts/team' ? 'box' : 'discs'} />
                </div>
              ) : (
                link
              )
            }),
          )}
        </nav>
        <SponsorRail />
        <Link className="f5v-help-link" to="/system/help" onClick={closeSidebar}>
          帮助与隐私
        </Link>
        <div className="f5v-local-status" aria-live="polite">
          <i aria-hidden="true" />
          <span>
            <strong>
              {systemStatus === 'error'
                ? '暂时无法读取资料'
                : publicBuild
                  ? '账户与方案本地保存'
                  : '本地模式'}
            </strong>
            <small>
              {systemStatus === 'error'
                ? '请检查本地档案与运行资料'
                : systemStatus === 'loading'
                  ? '正在读取本机资料'
                  : publicBuild
                    ? '计算按需在线进行'
                    : '资料只在本机处理'}
            </small>
          </span>
        </div>
      </aside>

      {navigationDialogOpen ? (
        <button
          type="button"
          className="f5v-backdrop"
          onClick={dismissNavigation}
          tabIndex={-1}
          aria-hidden="true"
          aria-label="关闭导航"
        />
      ) : null}

      <div className="f5v-content" inert={navigationDialogOpen}>
        <div className="f5v-workspace-color-field" aria-hidden="true" />
        <header className="f5v-topbar">
          <button
            ref={menuRef}
            type="button"
            className="f5v-menu"
            onClick={toggleSidebar}
            aria-label="打开导航"
            aria-expanded={navigationDialogOpen}
            aria-controls="primary-navigation-panel"
          >
            <Menu aria-hidden="true" size={21} />
          </button>
          <div className="f5v-location" aria-label="当前位置">
            {LocationIcon ? (
              <span className="f5v-location__mark" key={currentNavigation?.path} aria-hidden="true">
                <LocationIcon size={16} />
              </span>
            ) : null}
            <strong>{currentTitle}</strong>
            {navigationPending ? <small role="status">正在打开页面…</small> : null}
          </div>
          <span className="f5v-terminal-signal" ref={signalRef} aria-hidden="true">
            <span className="f5v-terminal-wave">
              {signalPeaks.map((peak, index) => (
                <i
                  key={index}
                  style={
                    {
                      '--peak': peak + '%',
                      '--beat-offset': -((index * 7) % 24) * 0.09 + 's',
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          </span>
          <div className="f5v-topbar-tools">
            <ReleaseNotes key={currentPath} />
            <div className="f5v-account-strip" aria-label="账号状态">
              <strong>本地账户</strong>
              <span>
                {account.status === 'error'
                  ? '暂无法读取'
                  : account.status === 'loading'
                    ? '读取中'
                    : account.hasAccount
                      ? account.name
                      : '尚未创建账户'}
              </span>
              <span>
                {account.status === 'error'
                  ? '账户状态未知'
                  : account.status === 'loading'
                    ? '读取中'
                    : `${account.agentCount} 名代理人 · ${account.discCount} 张驱动盘`}
              </span>
              <b>资料版本 {currentVersion}</b>
            </div>
          </div>
        </header>
        <div className={`f5v-page-content ${isWorkspaceRoute ? 'is-workspace' : 'is-page'}`}>
          <main
            ref={pageFrameRef}
            className="f5v-page-frame"
            id="main-content"
            data-f5-scroll-owner
            aria-busy={navigationPending || undefined}
            onKeyDown={scrollScannerFromInitialHeading}
            onPointerOverCapture={(event) => preloadPlayerRouteIntent(event.target)}
            onFocusCapture={(event) => preloadPlayerRouteIntent(event.target)}
          >
            {children}
          </main>
        </div>
        <nav className="f5v-mobile-navigation" aria-label="移动端主导航">
          {mobileNavigation.map(({ icon: Icon, label, path }) => {
            const current = isPrimaryCurrent(path)
            const destination = path === '/assets' && account.hasAccount ? '/assets/agents' : path
            return (
              <Link
                key={path}
                to={destination}
                aria-current={current ? 'page' : undefined}
                className={current ? 'is-current' : undefined}
              >
                <Icon aria-hidden="true" size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
