export function SodaMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="soda-mark" aria-label="Soda Terminal">
      <div className="soda-mark__symbol" aria-hidden="true">
        <img src="/assets/soda-brand-icon.png" alt="" />
      </div>
      {!compact && (
        <div>
          <strong>Soda Terminal</strong>
          <span>智能工具终端</span>
        </div>
      )}
    </div>
  )
}
