import { useEffect, useId, useRef } from 'react'
import { AssetCaptureRiskDetails } from './AssetCaptureMethodsNotice'

export function AssetQuickReadConsentStage({
  acknowledged,
  disabled,
  targetAccountName,
  onAcknowledge,
  onCancel,
  onStart,
}: {
  acknowledged: boolean
  disabled: boolean
  targetAccountName: string
  onAcknowledge: (checked: boolean) => void
  onCancel: () => void
  onStart: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [])
  return (
    <section className="asset-quick-read__consent-stage" aria-labelledby={titleId}>
      <h3 ref={titleRef} id={titleId} tabIndex={-1}>
        读取前确认
      </h3>
      <p>
        导入目标：<strong>{targetAccountName || '尚未选择账户'}</strong>
      </p>
      <p>非官方读取存在账号处罚风险，无法保证账号安全。</p>
      <p>读取需管理员权限和网络驱动；结果先在本机查看，点击导入后才更新账户。</p>
      <AssetCaptureRiskDetails label="完整风险说明" />
      <label className="asset-quick-read__confirmation">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={disabled}
          onChange={(event) => onAcknowledge(event.target.checked)}
        />
        <span>我已阅读上述风险，自主选择开始本次资产快读</span>
      </label>
      <div className="asset-quick-read__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={disabled || !acknowledged}
          onClick={onStart}
        >
          开始读取
        </button>
        <button className="button button--quiet" type="button" onClick={onCancel}>
          返回
        </button>
      </div>
    </section>
  )
}
