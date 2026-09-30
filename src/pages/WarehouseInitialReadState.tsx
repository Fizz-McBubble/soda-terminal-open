import { WarehouseCalculationStatus } from './WarehouseCalculationStatus'
import type { AccountDecisionWorldContextValue } from '../application/accountDecisionWorldModel'

export function WarehouseInitialReadState({
  decisionWorld,
  runAnalysis,
}: {
  decisionWorld: AccountDecisionWorldContextValue
  runAnalysis: () => Promise<unknown>
}) {
  return (
    <section className="warehouse-loading" role="status" aria-live="polite">
      <h1>驱动盘分析</h1>
      <p>
        {decisionWorld.liveInput?.warehouse.accountId
          ? `已读取 ${decisionWorld.liveInput.warehouse.discs.length} 张驱动盘，正在核对品质与用途。`
          : '正在读取当前账户的驱动盘。'}
      </p>
      <WarehouseCalculationStatus
        calculation={decisionWorld.calculation}
        cancelCalculation={decisionWorld.cancelCalculation}
      />
      {decisionWorld.calculationCancelled ? (
        <>
          <p>分析已取消，可重新分析。</p>
          <button
            className="button button--primary"
            type="button"
            onClick={() => void runAnalysis()}
          >
            重新分析
          </button>
        </>
      ) : null}
    </section>
  )
}
