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
        onClick={() => onNavigate('/assets/discs')}
      >
        库存
      </button>
      <button
        type="button"
        aria-current={mode === 'analysis' ? 'page' : undefined}
        onClick={() => onNavigate('/warehouse/discs')}
      >
        分析
      </button>
    </nav>
  )
}
