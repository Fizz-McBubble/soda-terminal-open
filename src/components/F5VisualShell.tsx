import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { mobileNavigation, navigationGroups } from '../navigation'
import { useDetailsDisclosureMotion } from '../motion/useDetailsDisclosureMotion'
import { useStateTransitionMotion } from '../motion/useStateTransitionMotion'
import { SponsorProvider, SponsorRail } from './SponsorSupport'

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

type F5VisualShellProps = {
  children: ReactNode
  currentPath: string
  currentTitle: string
  currentVersion: string
  account: {
    hydrating: boolean
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
  const pageFrameRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreMenuFocusRef = useRef(false)
  const narrowNavigation = useSyncExternalStore(subscribeNavigationWidth, isNarrowNavigation)
  const navigationDialogOpen = narrowNavigation && sidebarOpen
  const dismissNavigation = () => {
    restoreMenuFocusRef.current = narrowNavigation
    closeSidebar()
    // Route links close without restoring focus; AppShell owns the new page heading.
  }
  const isScanner = currentPath === '/system/scanner'
  const isWorkspaceRoute =
    isScanner ||
    currentPath.startsWith('/assets') ||
    currentPath.startsWith('/development') ||
    currentPath === '/warehouse/discs'
  useStateTransitionMotion({
    scope: pageFrameRef,
    stateKey: currentPath,
    includeScope: true,
  })
  useDetailsDisclosureMotion({ scope: pageFrameRef })

  useEffect(() => {
    pageFrameRef.current?.scrollTo?.({ top: 0, left: 0 })
  }, [currentPath])

  useEffect(() => {
    if (navigationDialogOpen) closeRef.current?.focus()
    else if (restoreMenuFocusRef.current) {
      restoreMenuFocusRef.current = false
      if (narrowNavigation) menuRef.current?.focus()
    }
  }, [navigationDialogOpen, narrowNavigation])

  return (
    <div className="f5v-shell" data-slice-theme="bright-muted">
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
            className="f5v-rail-close"
            onClick={dismissNavigation}
            aria-label="关闭导航"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <nav className="f5v-navigation" aria-label="主导航">
          {navigationGroups.flatMap((group) =>
            group.items.map(({ label, path }) => {
              const current = isPrimaryCurrent(path)
              const destination = path === '/assets' && account.hasAccount ? '/assets/agents' : path
              return (
                <Link
                  key={path}
                  to={destination}
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'is-current' : undefined}
                  onClick={closeSidebar}
                >
                  <span>{label}</span>
                  {path === '/loadouts/team' || path === '/warehouse/discs' ? (
                    <small className="f5v-beta" aria-label="测试版">
                      Beta
                    </small>
                  ) : null}
                </Link>
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
              {systemStatus === 'loading'
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
          className="f5v-backdrop"
          onClick={dismissNavigation}
          tabIndex={-1}
          aria-hidden="true"
          aria-label="关闭导航"
        />
      ) : null}

      <div className="f5v-content" inert={navigationDialogOpen}>
        <header className="f5v-topbar">
          <button
            ref={menuRef}
            className="f5v-menu"
            onClick={toggleSidebar}
            aria-label="打开导航"
            aria-expanded={navigationDialogOpen}
            aria-controls="primary-navigation-panel"
          >
            <Menu aria-hidden="true" size={21} />
          </button>
          <div className="f5v-location" aria-label="当前位置">
            <strong>{currentTitle}</strong>
          </div>
          <div className="f5v-account-strip" aria-label="账号状态">
            <strong>本地账户</strong>
            <span>
              {account.hydrating ? '读取中' : account.hasAccount ? account.name : '尚未创建账户'}
            </span>
            <span>
              {account.hydrating
                ? '读取中'
                : `${account.agentCount} 代理人 · ${account.discCount} 驱动盘`}
            </span>
            <b>版本 {currentVersion}</b>
          </div>
        </header>
        <div className={`f5v-page-content ${isWorkspaceRoute ? 'is-workspace' : 'is-page'}`}>
          <main
            ref={pageFrameRef}
            className="f5v-page-frame"
            id="main-content"
            data-f5-scroll-owner
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
