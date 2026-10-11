import { X } from 'lucide-react'
import type { RefObject } from 'react'

export function HomeAssetDialog({
  assetDialog,
  assetCacheLabel,
  assetOperationPending,
  removeVisualAssets,
  removingImages,
  downloadVisualAssets,
  assetDownloadLabel,
}: {
  assetDialog: RefObject<HTMLDialogElement | null>
  assetCacheLabel: string
  assetOperationPending: boolean
  removeVisualAssets: () => Promise<void>
  removingImages: boolean
  downloadVisualAssets: () => Promise<void>
  assetDownloadLabel: string
}) {
  return (
    <dialog
      id="home-asset-dialog"
      ref={assetDialog}
      className="home-asset-dialog"
      aria-labelledby="home-asset-dialog-title"
      aria-describedby="home-asset-dialog-note"
    >
      <header>
        <h2 id="home-asset-dialog-title">图鉴图片</h2>
        <button
          type="button"
          className="button button--quiet home-asset-dialog__close"
          aria-label="关闭图片管理"
          onClick={() => assetDialog.current?.close()}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <p role="status">{assetCacheLabel}</p>
      <p id="home-asset-dialog-note">仅删除图片，不影响账户资料。</p>
      <footer>
        <button
          className="button button--quiet"
          type="button"
          disabled={assetOperationPending}
          onClick={() => void removeVisualAssets()}
        >
          {removingImages ? '正在删除图片' : '删除本机图片缓存'}
        </button>
        <button
          className="home-primary-action"
          type="button"
          disabled={assetOperationPending}
          onClick={() => void downloadVisualAssets()}
        >
          {assetDownloadLabel}
        </button>
      </footer>
    </dialog>
  )
}
