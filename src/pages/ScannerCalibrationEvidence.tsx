import { ImageOff, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ScanImportItem } from '../domain/scanImportStaging'
import { requestScannerDetailEvidence } from '../scanner/detailEvidenceClient'

export function ScannerCalibrationEvidence({
  item,
  resultFileHandle,
}: {
  item: ScanImportItem
  resultFileHandle: string | null
}) {
  const [attempt, setAttempt] = useState(0)
  const [image, setImage] = useState<{ key: string; src: string } | null>(null)
  const [failure, setFailure] = useState('')
  const key = `${resultFileHandle}:${item.id}:${item.evidence.visualDetailHash}`
  useEffect(() => {
    let cancelled = false
    let revoke: (() => void) | undefined
    if (!resultFileHandle) return
    void requestScannerDetailEvidence(resultFileHandle, item.id)
      .then((result) => {
        if (cancelled) return result.revoke()
        if (
          result.availability !== 'available' ||
          result.visualDetailHash !== item.evidence.visualDetailHash
        ) {
          result.revoke()
          setFailure(key)
          return
        }
        revoke = result.revoke
        setImage({ key, src: result.detailSrc })
      })
      .catch(() => {
        if (!cancelled) setFailure(key)
      })
    return () => {
      cancelled = true
      revoke?.()
    }
  }, [key, item.id, item.evidence.visualDetailHash, resultFileHandle, attempt])
  const unavailable = !resultFileHandle || failure === key
  return (
    <figure className="scanner-calibration__evidence">
      <figcaption>第 {item.sequence} 张 · 扫描时的盘面</figcaption>
      {image?.key === key && !unavailable ? (
        <img
          src={image.src}
          alt={`第 ${item.sequence} 张驱动盘的扫描详情`}
          onError={() => setFailure(key)}
        />
      ) : unavailable ? (
        <div className="scanner-calibration__image-empty" role="status">
          <ImageOff size={26} aria-hidden="true" />
          <strong>暂时无法读取盘面</strong>
          <p>可以回到游戏，对照这张盘填写。无法确认的内容请保留，重新扫描。</p>
          {resultFileHandle ? (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => {
                setFailure('')
                setImage(null)
                setAttempt((value) => value + 1)
              }}
            >
              <RotateCw size={15} aria-hidden="true" />
              重新读取盘面
            </button>
          ) : null}
        </div>
      ) : (
        <div className="scanner-calibration__image-empty" role="status">
          正在读取本机盘面…
        </div>
      )}
    </figure>
  )
}
