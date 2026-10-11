import type { useAssetCenterData } from './useAssetCenterData'

export function AssetCenterReadFeedback({
  reads,
}: {
  reads: ReturnType<typeof useAssetCenterData>
}) {
  const failures = [
    ...(reads.assets.failed ? ['账户资产'] : []),
    ...(reads.accounts.failed ? ['账户列表'] : []),
    ...(reads.identity.failed ? ['当前账户身份'] : []),
  ]
  if (failures.length)
    return (
      <section className="asset-center-loading" role="alert">
        <p>
          {failures.join('和')}读取失败。
          {reads.assets.data ? '页面保留上次读取的资料，' : ''}
          请重试读取后继续操作。
        </p>
        <button
          type="button"
          onClick={() => {
            if (reads.assets.failed) reads.assets.retry()
            if (reads.accounts.failed) reads.accounts.retry()
            if (reads.identity.failed) reads.identity.retry()
          }}
        >
          重试读取
        </button>
      </section>
    )
  if (reads.assets.pending || reads.accounts.pending)
    return (
      <section className="asset-center-loading" role="status" aria-live="polite">
        正在读取当前账户资料…
      </section>
    )
  return null
}
