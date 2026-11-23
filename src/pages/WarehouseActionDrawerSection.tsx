import { WarehouseActionDrawer } from './WarehouseActionDrawer'
import { statusText, warehouseActionStrengthLabel } from './warehouseDiscPresentation'
import type { displayWarehouseActionProjection } from '../application/warehouseActionContract'
import type { useAccountDecisionWorld } from '../application/accountDecisionWorld'

type ProjectionActionItem = NonNullable<
  ReturnType<typeof displayWarehouseActionProjection>
>['actions'][number]
type WarehouseData = NonNullable<
  ReturnType<typeof useAccountDecisionWorld>['liveInput']
>['warehouse']
type WarehouseDisc = WarehouseData['discs'][number]

export function WarehouseActionDrawerSection({
  detailItem,
  detailDisc,
  accountId,
  selectedDiscId,
  comparisonId,
  comparisonFact,
  selectedIndex,
  totalRows,
  onMoveSelection,
  onReturnToSelectedDisc,
  onSelectAlternative,
  onShowSameKind,
  onReturnToOriginal,
  selectedItem,
  selectedDisc,
  ownedAgentIds,
  discs,
  alternativeRecommendations,
  onReanalyze,
}: {
  detailItem: ProjectionActionItem | null
  detailDisc: WarehouseDisc | null
  accountId: string
  selectedDiscId: string | null | undefined
  comparisonId: string | null
  comparisonFact: WarehouseDisc | null
  selectedIndex: number
  totalRows: number
  onMoveSelection: (offset: number) => void
  onReturnToSelectedDisc: () => void
  onSelectAlternative: (id: string) => void
  onShowSameKind: () => void
  onReturnToOriginal: () => void
  selectedItem: ProjectionActionItem | null
  selectedDisc: WarehouseDisc | null
  ownedAgentIds: Set<string>
  discs: WarehouseDisc[]
  alternativeRecommendations: Map<string, { label: string; prioritize: boolean }>
  onReanalyze: () => void
}) {
  if (detailItem && detailDisc) {
    return (
      <WarehouseActionDrawer
        key={`${accountId}:${selectedDiscId}`}
        navigation={
          !comparisonId
            ? {
                index: selectedIndex,
                total: totalRows,
                onPrevious: () => onMoveSelection(-1),
                onNext: () => onMoveSelection(1),
              }
            : undefined
        }
        onReturnToList={comparisonId ? undefined : onReturnToSelectedDisc}
        onSelectAlternative={onSelectAlternative}
        onShowSameKind={onShowSameKind}
        onReturnToOriginal={comparisonId ? onReturnToOriginal : undefined}
        comparisonOrigin={
          comparisonId && !comparisonFact && selectedItem && selectedDisc
            ? { item: selectedItem, disc: selectedDisc }
            : undefined
        }
        comparisonFact={comparisonFact ?? undefined}
        item={detailItem}
        ownedAgentIds={ownedAgentIds}
        disc={detailDisc}
        discs={discs}
        decisionLabel={warehouseActionStrengthLabel(detailItem)}
        alternativeRecommendations={alternativeRecommendations}
        relations={statusText(detailItem)}
        onReanalyze={onReanalyze}
      />
    )
  }

  return (
    <aside className="warehouse-action-drawer warehouse-action-drawer--empty">
      {comparisonId ? (
        <>
          <p role="status">替代盘记录或分析结果已不可用，请更新仓库后重新分析。</p>
          <button className="button button--quiet" type="button" onClick={onReturnToOriginal}>
            返回原盘
          </button>
          <button className="button button--primary" type="button" onClick={onReanalyze}>
            重新分析
          </button>
        </>
      ) : (
        '当前筛选下没有可查看的驱动盘。'
      )}
    </aside>
  )
}
