/* eslint-disable react-refresh/only-export-components -- this frozen page slice exports its pure view mapping and drawer together. */
import './warehouse-manual-decision-layer.css'
import { ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { DriveDisc } from '../domain/schemas'
import {
  warehouseCategoryLabels,
  type WarehouseDiscDecision,
} from '../warehouse/discWarehouseAnalysis'
import {
  readableAgentName,
  readablePhysicalDiscLabel,
  readableSetName,
  readableWarehouseReason,
} from './warehouseFactLabels'

/**
 * The player-facing label helpers live in `warehouseFactLabels` (one implementation, build-time
 * sources). This frozen desktop slice keeps re-exporting them so its own drawer and older importers
 * stay unchanged.
 */
export {
  readableAgentName,
  readablePhysicalDiscLabel,
  readableSetName,
  readableWarehouseReason,
  setNames,
  statLabel,
} from './warehouseFactLabels'

export type ManualDecisionLayer = 'high_confidence' | 'priority_review' | 'aggressive_review'

export const manualLayerCopy: Record<
  ManualDecisionLayer,
  { label: string; summary: string; drawer: string }
> = {
  high_confidence: {
    label: '可清理 · 请核对',
    summary: '已核对当前用途，处理前请在游戏内确认。',
    drawer: '当前未发现必须保留的用途。未来可能仍有用途，请在游戏内核对后再决定是否清理。',
  },
  priority_review: {
    label: '停止强化 · 请核对',
    summary: '已有完整的停止投入依据，仍需在游戏内逐张确认。',
    drawer:
      '已有更合适的盘，或这张盘已有无效强化且没有独有用途。建议停止强化，清理前请在游戏内核对。',
  },
  aggressive_review: {
    label: '其他整理选择',
    summary: '仅在你主动查看时显示，可能包含高价值或正在使用的盘。',
    drawer: '这些盘不属于清理建议，可能仍在使用或值得保留。',
  },
}

export function strictCleanupPass(decision: WarehouseDiscDecision) {
  const safety = decision.cleanupSafety
  const coveredSurplusPass =
    safety.hasCoverageAlternative &&
    !safety.rareUnique &&
    !safety.significantFit &&
    safety.alternativeSafe
  return (
    decision.category === 'cleanup_candidate' &&
    !safety.equipped &&
    !safety.activePlanReferenced &&
    !safety.savedPlanReferenced &&
    !safety.portfolioReferenced &&
    safety.deleteAfterFeasible &&
    safety.complete &&
    safety.potentialEvaluated &&
    safety.cleanupEvidenceComplete &&
    (coveredSurplusPass || safety.badEmbryoCleanupSafe)
  )
}

export function getManualDecisionLayer(decision: WarehouseDiscDecision): ManualDecisionLayer {
  if (strictCleanupPass(decision)) return 'high_confidence'
  if (decision.category === 'replaceable') return 'priority_review'
  return 'aggressive_review'
}

function strengthLabel(decision: WarehouseDiscDecision) {
  if (decision.strength === 'candidate') return '有适合使用的角色'
  return decision.cleanupSafety.complete ? '暂未找到适合的角色' : '资料不足，不能判断适配价值'
}

export function WarehouseDiscDrawer({
  disc,
  decision,
  discs,
  drafts,
  manualLayer,
  onClose,
}: {
  disc: DriveDisc
  decision: WarehouseDiscDecision
  discs: readonly DriveDisc[]
  drafts: ReadonlyArray<{ id: string; name: string }>
  manualLayer: ManualDecisionLayer
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  const alternatives = decision.alternatives
    .map((id) => discs.find((item) => item.id === id))
    .filter((item): item is DriveDisc => Boolean(item))
  const missingAlternativeCount = decision.alternatives.length - alternatives.length
  const safety = decision.cleanupSafety
  const risks = [
    safety.equipped && '正在被代理人装备，不要按清理候选处理。',
    safety.activePlanReferenced && '被当前培养方案使用，处理会影响当前配装。',
    safety.savedPlanReferenced && '被已保存或草稿方案使用，先确认方案影响。',
    safety.portfolioReferenced && '被选定的多支队伍使用，不能进入清理候选。',
    !safety.deleteAfterFeasible &&
      `清理后只剩 ${safety.availableCopiesAfterDelete} 张同类盘，不够现有配装同时使用的 ${safety.protectedDemandCount} 张。`,
    safety.rareUnique &&
      !safety.badEmbryoCleanupSafe &&
      '当前仓库中的稀缺同类盘，还没有能替换的盘。',
    safety.significantFit && !safety.nonViableEmbryo && '仍有当前代理人的候选适配依据。',
    safety.noCurrentAccountFit && '当前账号没有发现套装、号位与主词条均兼容的用途。',
    safety.nonViableEmbryo &&
      !safety.badEmbryoCleanupSafe &&
      '即使后续强化都命中有效词条，也未达到该号位建议保留的词条数；但 4–6 号位较稀缺，仍需核对。',
    !safety.hasBetterAlternative &&
      !(decision.enhancementPotential.knownNonTargetRolls ?? 0) &&
      '尚未找到同套装、同号位、同主词条的明确更优替代，也没有记录到无效强化。',
    !safety.hasBetterAlternative &&
      Boolean(decision.enhancementPotential.knownNonTargetRolls) &&
      '当前没有严格更优同类盘；已有无效强化，且没有其他盘无法替代的角色用途。',
    safety.hasBetterAlternative && !safety.alternativeSafe && '替代关系仍未满足安全条件。',
    !safety.complete && '角色适用资料或强化记录不完整，暂不能确认是否适合清理。',
    !safety.potentialEvaluated && '强化记录或角色资料不足，暂时无法估计强化上限。',
    safety.potentialEvaluated &&
      !safety.optimisticCeilingDominated &&
      decision.enhancementPotential.remainingRollOpportunities !== 0 &&
      '即使只按最乐观情况计算，仍可能通过剩余强化追平现有替代。',
  ].filter((item): item is string => Boolean(item))
  const passed = [
    !safety.equipped && '未被当前装备使用',
    !safety.activePlanReferenced && '未被当前培养方案使用',
    !safety.savedPlanReferenced && '未被已保存或草稿方案使用',
    !safety.portfolioReferenced && '未被选定的多支队伍使用',
    safety.deleteAfterFeasible &&
      `清理后仍有 ${safety.availableCopiesAfterDelete} 张同类盘，足够现有配装同时使用的 ${safety.protectedDemandCount} 张`,
    safety.hasBetterAlternative && '已找到同类更优对比候选',
    safety.hasCoverageAlternative && '已有同类盘覆盖单盘适配维度',
    !safety.significantFit && '未发现当前代理人的候选适配依据',
    !safety.rareUnique && '不是稀缺唯一盘',
    safety.alternativeSafe && '替代实体数量与当前声明用途已核对',
    safety.complete && '适配覆盖与强化记录完整',
    safety.potentialEvaluated && '已完成最乐观剩余强化上限计算',
    safety.optimisticCeilingDominated && '即使剩余强化全部命中最有利词条，仍低于同一张替代盘',
    safety.nonViableEmbryo && '即使后续强化都有效，也未达到该号位建议保留的词条数',
    safety.badEmbryoCleanupSafe && '强化潜力较低，且已核对当前用途与同类盘数量',
    safety.cleanupEvidenceComplete && '已有判断清理候选所需的资料',
    decision.category === 'replaceable' && '已核对停止强化的理由；清理前仍需在游戏内确认',
  ].filter((item): item is string => Boolean(item))
  const plans = decision.planIds.map((id) => ({
    id,
    name: drafts.find((draft) => draft.id === id)?.name || '未命名方案',
    active: decision.activePlanIds.includes(id),
  }))
  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') return onClose()
    if (event.key !== 'Tab') return
    const nodes = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], select, input, summary',
      ),
    ]
    if (!nodes.length) return
    const [first] = nodes
    const last = nodes.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first!.focus()
    }
  }
  return createPortal(
    <aside
      className="warehouse-disc-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warehouse-drawer-title"
      aria-describedby="warehouse-drawer-layer-description"
      onKeyDown={trapFocus}
    >
      <header>
        <div>
          <span className="eyebrow">单盘解释</span>
          <h2 id="warehouse-drawer-title">
            {readableSetName(disc.setId)} · {disc.slot} 号位
          </h2>
        </div>
        <button
          ref={closeRef}
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="关闭驱动盘详情"
        >
          <X size={19} />
        </button>
      </header>
      <section>
        <h3>驱动盘信息</h3>
        <p>{readablePhysicalDiscLabel(disc, discs)}</p>
        <p>分析建议：{warehouseCategoryLabels[decision.category]}</p>
      </section>
      <section>
        <h3>{manualLayerCopy[manualLayer].label}</h3>
        <p id="warehouse-drawer-layer-description">{manualLayerCopy[manualLayer].drawer}</p>
      </section>
      <section>
        <h3>建议原因</h3>
        <p>{strengthLabel(decision)}</p>
        <ul>
          {decision.reasons.map((reason) => (
            <li key={reason}>{readableWarehouseReason(reason)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>清理前需要注意</h3>
        {risks.length ? (
          <>
            <p>需要优先确认的风险</p>
            <ul>
              {risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>当前未发现使用冲突，请在游戏内核对后再处理。</p>
        )}
        {passed.length > 0 && <p>已核对的情况</p>}
        <ul>
          {passed.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>替代与适配</h3>
        <p>
          {alternatives.length
            ? safety.alternativeSafe
              ? `有 ${alternatives.length} 张已核对的同类替代盘覆盖当前声明用途。`
              : `有 ${alternatives.length} 张同类盘可供比对；尚不能据此认定完整替代。`
            : missingAlternativeCount
              ? '替代盘资料不完整，暂时无法比对。'
              : '暂未发现同类明确更优替代。'}
        </p>
        {missingAlternativeCount > 0 && (
          <p>{missingAlternativeCount} 张替代盘的仓库记录缺失，请更新仓库后重新分析。</p>
        )}
        {alternatives.length ? (
          <ul aria-label="同类对比盘">
            {alternatives.map((item) => (
              <li key={item.id}>{readablePhysicalDiscLabel(item, discs)}</li>
            ))}
          </ul>
        ) : null}
        <p>
          {decision.fitAgentIds.length
            ? `适用角色：${decision.fitAgentIds.map(readableAgentName).join('、')}`
            : '暂未找到适合的角色。'}
        </p>
      </section>
      <section>
        <h3>受影响方案</h3>
        {plans.length ? (
          <ul>
            {plans.map((plan) => (
              <li key={plan.id}>
                {plan.name} · {plan.active ? '当前培养方案' : '保存/草稿方案'}
              </li>
            ))}
          </ul>
        ) : (
          <p>未被已保存或草稿方案使用。</p>
        )}
      </section>
      <section>
        <h3>强化潜力</h3>
        <p>
          {decision.enhancementPotential.potentialEvaluated
            ? decision.enhancementPotential.remainingEnhancementNodes === 0
              ? '已满级。'
              : (decision.enhancementPotential.unlocksRemaining ?? 0) > 0
                ? `还可强化 ${decision.enhancementPotential.remainingEnhancementNodes} 次，其中 1 次解锁第 4 条副词条。`
                : `还可强化副词条 ${decision.enhancementPotential.remainingRollOpportunities} 次。`
            : '强化记录或角色资料不足，暂时无法估计强化上限。'}
        </p>
        {decision.enhancementPotential.potentialEvaluated ? (
          <p>
            {decision.enhancementPotential.optimisticCeilingDominated
              ? '即使剩余强化全部命中最有利词条，仍低于同一张现有替代盘。'
              : decision.enhancementPotential.investmentStopReason
                ? '已有满级同类替代，建议停止投入。'
                : decision.enhancementPotential.remainingRollOpportunities === 0
                  ? '暂未找到能完整替代这张盘的现有驱动盘。'
                  : '剩余强化仍有提升空间，结合当前用途决定是否投入。'}
          </p>
        ) : null}
      </section>
      <details>
        <summary>关于这份建议</summary>
        <p>建议根据当前角色和仓库生成，不会更改你的驱动盘或方案。</p>
        <p>清理前仍需在游戏内核对；这里不会删除驱动盘，也不能判断未来是否有用。</p>
      </details>
      <button className="button button--quiet" type="button" onClick={onClose}>
        关闭详情 <ChevronRight size={16} />
      </button>
    </aside>,
    document.body,
  )
}
