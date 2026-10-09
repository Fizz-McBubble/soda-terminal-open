import { useState } from 'react'
import { PlayerSelect } from '../components/PlayerSelect'
import { publicScannerDriveDiscData } from '../application/publicScannerCatalog'
import type { LoadedFormalImportCurrent } from './formalDiscImportCurrent'
import { ScannerCalibrationEditor } from './ScannerCalibrationEditor'
import { ScannerCalibrationEvidence } from './ScannerCalibrationEvidence'
import { saveScannerCalibration } from './scannerCalibrationSave'
import './scanner-manual-calibration.css'

export function ScannerManualCalibration({ current }: { current: LoadedFormalImportCurrent }) {
  const remaining = current.items
    .filter((item) => item.state === 'needs_review' || item.state === 'invalid' || item.duplicate)
    .sort((left, right) => left.sequence - right.sequence)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const item = remaining.find((entry) => entry.id === selectedId) ?? remaining[0]
  if (!item || !current.batch) return null
  if (!publicScannerDriveDiscData) return <p role="alert">驱动盘规则暂不可用，请刷新页面后重试。</p>
  const batch = current.batch
  return (
    <section className="scanner-calibration" aria-labelledby="scanner-calibration-heading">
      <header className="scanner-calibration__header">
        <div>
          <h3 id="scanner-calibration-heading">手动校准</h3>
          <p>对照盘面，补全或修正识别结果。</p>
        </div>
        <div className="scanner-calibration__queue">
          <span>还需处理 {remaining.length} 张</span>
          <PlayerSelect
            value={item.id}
            aria-label="选择待校准驱动盘"
            disabled={saving}
            onChange={setSelectedId}
          >
            {remaining.map((entry) => (
              <option key={entry.id} value={entry.id}>
                第 {entry.sequence} 张 ·{' '}
                {entry.candidate.setName && entry.candidate.setId
                  ? entry.candidate.setName
                  : '套装待确认'}
              </option>
            ))}
          </PlayerSelect>
        </div>
      </header>
      <div className="scanner-calibration__body">
        <ScannerCalibrationEvidence item={item} resultFileHandle={current.resultFileHandle} />
        <ScannerCalibrationEditor
          key={`${item.id}:${batch.reviewState.revision}`}
          item={item}
          remaining={remaining.length}
          onSave={async (candidate) => {
            setSaving(true)
            try {
              await saveScannerCalibration(
                current.account.id,
                batch.id,
                item,
                candidate,
                batch.reviewState.revision,
              )
              const next = remaining.find(
                (entry) => entry.sequence > item.sequence && entry.id !== item.id,
              )
              setSelectedId(next?.id ?? '')
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    </section>
  )
}
