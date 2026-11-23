import { Check, Database } from 'lucide-react'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'
import { AssetQuickReadGuide } from './AssetQuickReadGuide'

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
        {renderParts ? <h3 id={headingId}>资产快读</h3> : <h2 id={headingId}>资产快读</h2>}
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

export function AssetQuickReadScope({
  renderParts,
  connectedBridgeVersion,
}: {
  renderParts: boolean
  connectedBridgeVersion?: string
}) {
  const connectedFor33 = connectedBridgeVersion === '1.1.1'
  const olderPublicDownload =
    assetQuickReadRelease.version === '1.2.0' && assetQuickReadRelease.bridgeVersion === '1.1.0'
  const compatibility = connectedFor33
    ? '已连接本机快读，支持国服 3.3。'
    : olderPublicDownload
      ? '官网下载版 1.2.0 支持国服 3.2。'
      : null
  return (
    <>
      {renderParts ? (
        <p className="scanner-workbench__scope">
          驱动盘 · 代理人养成{' '}
          <span className="scanner-workbench__metric">
            {connectedFor33
              ? '本机支持国服 3.3'
              : olderPublicDownload
                ? '官网下载版支持国服 3.2'
                : '一键读取'}
          </span>
        </p>
      ) : (
        <p>
          读取已拥有代理人的真实养成和驱动盘。配装与分析只使用 S 级，A/B
          级记录会保留。当前已装备音擎详情用于现有配装，不建立音擎或邦布库存。
          {compatibility && ` ${compatibility}`}
        </p>
      )}
    </>
  )
}
