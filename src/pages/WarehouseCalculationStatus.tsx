import { useEffect, useState } from 'react'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'

export function WarehouseCalculationStatus({
  calculation,
  cancelCalculation,
}: {
  calculation?: AccountDecisionWorldContextValue['calculation']
  cancelCalculation?: () => void
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!calculation) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [calculation])
  if (!calculation) return null
  const elapsed =
    calculation.startedAt === null
      ? null
      : Math.max(0, Math.floor((now - calculation.startedAt) / 1000))
  const phase = {
    reading_account: '正在读取账户',
    preparing_rules: '正在准备分析资料',
    analyzing: '正在核对品质与用途',
  }[calculation.phase]
  return (
    <div className="warehouse-calculation-status">
      <span role="status" aria-live="polite">
        {phase}
        {elapsed !== null ? ` · 已等待 ${elapsed} 秒` : ''}
      </span>
      {cancelCalculation ? (
        <button className="button button--quiet" type="button" onClick={cancelCalculation}>
          取消分析
        </button>
      ) : null}
    </div>
  )
}
