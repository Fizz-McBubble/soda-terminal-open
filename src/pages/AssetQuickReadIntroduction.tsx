import { Check, Database } from 'lucide-react'
import { AssetQuickReadGuide } from './AssetQuickReadGuide'
import { TestingBadge } from '../components/TestingBadge'

export function AssetQuickReadHeading({
  headingId,
  renderParts,
}: {
  headingId: string
  renderParts: boolean
}) {
  return (
    <>
      <div className="asset-quick-read__heading">
        <Database aria-hidden="true" size={22} />
        {renderParts ? (
          <h3 id={headingId}>
            资产快读 <TestingBadge scope="quickRead" />
          </h3>
        ) : (
          <h2 id={headingId}>
            资产快读 <TestingBadge scope="quickRead" />
          </h2>
        )}
        {renderParts ? (
          <AssetQuickReadGuide />
        ) : (
          <span className="asset-quick-read__badge">资产快读 · 默认关闭</span>
        )}
      </div>
    </>
  )
}

export function AssetQuickReadProgress({ currentStep }: { currentStep: number }) {
  return (
    <>
      <ol className="scanner-journey-cards asset-quick-read__steps" aria-label="资产快读与导入进度">
        {['准备', '读取', '检查', '完成'].map((label, index) => (
          <li
            key={label}
            className={`scanner-journey-card is-${index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'}`}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span aria-hidden="true">{index < currentStep ? <Check size={14} /> : index + 1}</span>
            <div>
              <strong>{label}</strong>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

export function AssetQuickReadScope({ renderParts }: { renderParts: boolean }) {
  return (
    <>
      {renderParts ? (
        <p className="scanner-workbench__scope">
          S 级驱动盘 · 代理人养成 <span className="scanner-workbench__metric">一键读取</span>
        </p>
      ) : (
        <p>
          读取已拥有代理人的真实养成和 S
          级驱动盘。当前已装备音擎详情用于现有配装，不建立音擎或邦布库存。
        </p>
      )}
    </>
  )
}
