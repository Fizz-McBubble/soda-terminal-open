import { preloadPlayerRoute } from '../routes/preloadPlayerRoute'

export function DiscWorkspaceModeSwitch({
  mode,
  onNavigate,
}: {
  mode: 'inventory' | 'analysis'
  onNavigate: (path: '/assets/discs' | '/warehouse/discs') => void
}) {
  return (
    <nav className="disc-workspace-switch" aria-label="驱动盘工作模式">
      <button
        type="button"
        aria-current={mode === 'inventory' ? 'page' : undefined}
        onPointerEnter={() => preloadPlayerRoute('/assets/discs')}
        onFocus={() => preloadPlayerRoute('/assets/discs')}
        onClick={() => onNavigate('/assets/discs')}
      >
        库存
      </button>
      <button
        type="button"
        aria-current={mode === 'analysis' ? 'page' : undefined}
        onPointerEnter={() => preloadPlayerRoute('/warehouse/discs')}
        onFocus={() => preloadPlayerRoute('/warehouse/discs')}
        onClick={() => onNavigate('/warehouse/discs')}
      >
        分析
      </button>
    </nav>
  )
}
