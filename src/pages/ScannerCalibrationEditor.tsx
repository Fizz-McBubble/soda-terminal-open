import { Plus, Check } from 'lucide-react'
import { useRef, useState } from 'react'
import { PlayerSelect } from '../components/PlayerSelect'
import { publicScannerSetIdentities } from '../application/publicScannerCatalog'
import type { ScanImportItem } from '../domain/scanImportStaging'
import type { StatKey } from '../domain/schemas'
import { statOptions } from './dataManagementPresentation'
import {
  calibrateSubStatValues,
  getCalibrationContext,
  calibrationFieldMessages,
  type CalibrationCandidate,
} from './scannerCalibrationForm'

export function ScannerCalibrationEditor({
  item,
  onSave,
  remaining,
}: {
  item: ScanImportItem
  remaining: number
  onSave: (candidate: CalibrationCandidate) => Promise<void>
}) {
  const [candidate, setCandidate] = useState(() => structuredClone(item.candidate))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const messages = calibrationFieldMessages(item, calibrateSubStatValues(candidate))
  const rules = getCalibrationContext().rules
  const allowedMain = candidate.slot ? rules.mainStatsBySlot[String(candidate.slot)] : null
  const allowedSub = new Set(
    rules.subStatStepsByRarity[candidate.rarity ?? 'S'].map((rule) => rule.stat),
  )
  const percent = (stat: StatKey | null) =>
    !!stat &&
    rules.mainStatBaseByRarity.S.some((rule) => rule.stat === stat && rule.unit === 'percent')
  const update = (patch: Partial<CalibrationCandidate>) => {
    setCandidate((current) => ({ ...current, ...patch }))
    setError('')
  }
  const number = (value: string) => (value.trim() === '' ? null : Number(value))
  const flagged = (field: string) =>
    messages.some((issue) => issue.field === field || issue.field.startsWith(`${field}.`))
  async function submit() {
    if (saving.current) return
    if (messages.length) {
      setError('请先处理下方提示，再保存这张盘。')
      return
    }
    saving.current = true
    setBusy(true)
    setError('')
    try {
      await onSave(calibrateSubStatValues(candidate))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className="scanner-calibration__form"
      aria-label={`校准第 ${item.sequence} 张驱动盘`}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <fieldset disabled={busy}>
        <legend className="visually-hidden">对照盘面填写驱动盘信息</legend>
        <div className="scanner-calibration__identity">
          <div
            className="scanner-calibration__field scanner-calibration__field--wide"
            data-needs-review={flagged('setId')}
          >
            <span id="calibration-set-label">套装名称</span>
            <PlayerSelect
              value={candidate.setId ?? ''}
              aria-label="套装名称"
              disabled={busy}
              onChange={(value) => {
                const set = publicScannerSetIdentities.find((entry) => entry.id === value)
                update({ setId: set?.id ?? null, setName: set?.name ?? null })
              }}
            >
              <option value="">请选择套装</option>
              {publicScannerSetIdentities.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </PlayerSelect>
          </div>
          <div className="scanner-calibration__basics">
            <div className="scanner-calibration__field" data-needs-review={flagged('slot')}>
              <span>号位</span>
              <PlayerSelect
                value={candidate.slot ?? ''}
                aria-label="号位"
                disabled={busy}
                onChange={(value) =>
                  update({ slot: Number(value) as CalibrationCandidate['slot'] })
                }
              >
                <option value="" disabled>
                  请选择
                </option>
                {[1, 2, 3, 4, 5, 6].map((slot) => (
                  <option key={slot} value={slot}>
                    {slot} 号位
                  </option>
                ))}
              </PlayerSelect>
            </div>
            <div className="scanner-calibration__field" data-needs-review={flagged('rarity')}>
              <span>稀有度</span>
              <PlayerSelect
                value={candidate.rarity ?? ''}
                aria-label="稀有度"
                disabled={busy}
                onChange={(value) => update({ rarity: value as 'A' | 'S' })}
              >
                <option value="" disabled>
                  请选择
                </option>
                <option value="S">S 级</option>
                <option value="A">A 级</option>
              </PlayerSelect>
            </div>
            <label className="scanner-calibration__field" data-needs-review={flagged('level')}>
              <span>强化等级</span>
              <input
                className="scanner-input"
                type="number"
                aria-label="强化等级"
                min="0"
                max={candidate.rarity ? rules.maxLevelByRarity[candidate.rarity] : 15}
                step="1"
                value={candidate.level ?? ''}
                onChange={(event) => update({ level: number(event.target.value) })}
              />
            </label>
          </div>
          <div className="scanner-calibration__stats">
            <div className="scanner-calibration__field" data-needs-review={flagged('mainStat')}>
              <span>主词条</span>
              <PlayerSelect
                value={candidate.mainStat ?? ''}
                aria-label="主词条"
                disabled={busy}
                onChange={(value) => update({ mainStat: value as StatKey })}
              >
                <option value="" disabled>
                  请选择主词条
                </option>
                {statOptions
                  .filter(
                    (stat) =>
                      !allowedMain ||
                      allowedMain.includes(stat.value) ||
                      candidate.mainStat === stat.value,
                  )
                  .map((stat) => (
                    <option key={stat.value} value={stat.value}>
                      {stat.label}
                    </option>
                  ))}
              </PlayerSelect>
            </div>
            <label
              className="scanner-calibration__field"
              data-needs-review={flagged('mainStatValue')}
            >
              <span>主词条数值{percent(candidate.mainStat) ? '（%）' : ''}</span>
              <input
                className="scanner-input"
                type="number"
                aria-label="主词条数值"
                min="0"
                step="any"
                value={candidate.mainStatValue ?? ''}
                onChange={(event) => update({ mainStatValue: number(event.target.value) })}
              />
            </label>
          </div>
        </div>
        <div className="scanner-calibration__substats">
          <div className="scanner-calibration__subheading">
            <strong>副词条</strong>
            <small>按盘面填写；百分比填数字，如 4.8</small>
          </div>
          <div className="scanner-calibration__substat-grid">
            {candidate.subStats.map((row, index) => (
              <div
                className="scanner-calibration__stats scanner-calibration__stats--substat"
                key={index}
              >
                <span className="scanner-calibration__row-number" aria-hidden="true">
                  {index + 1}
                </span>
                <div
                  className="scanner-calibration__field"
                  data-needs-review={flagged(`subStats.${index}`)}
                >
                  <span className="visually-hidden">副词条 {index + 1}</span>
                  <PlayerSelect
                    value={row.stat ?? ''}
                    aria-label={`副词条 ${index + 1}`}
                    disabled={busy}
                    onChange={(value) =>
                      update({
                        subStats: candidate.subStats.map((entry, n) =>
                          n === index ? { ...entry, stat: value as StatKey } : entry,
                        ),
                      })
                    }
                  >
                    <option value="" disabled>
                      请选择词条
                    </option>
                    {statOptions
                      .filter((stat) => allowedSub.has(stat.value) || row.stat === stat.value)
                      .map((stat) => (
                        <option key={stat.value} value={stat.value}>
                          {stat.label}
                        </option>
                      ))}
                  </PlayerSelect>
                </div>
                <label
                  className="scanner-calibration__field"
                  data-needs-review={flagged(`subStats.${index}`)}
                >
                  <span className="visually-hidden">数值{percent(row.stat) ? '（%）' : ''}</span>
                  <input
                    className="scanner-input"
                    type="number"
                    aria-label={`副词条 ${index + 1} 数值`}
                    min="0"
                    step="any"
                    value={row.value ?? ''}
                    onChange={(event) =>
                      update({
                        subStats: candidate.subStats.map((entry, n) =>
                          n === index ? { ...entry, value: number(event.target.value) } : entry,
                        ),
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="scanner-calibration__row-actions">
            {candidate.subStats.length < 4 ? (
              <button
                className="button button--quiet"
                type="button"
                onClick={() =>
                  update({
                    subStats: [
                      ...candidate.subStats,
                      { stat: null, value: null, upgrades: null, rawText: '', confidence: 'low' },
                    ],
                  })
                }
              >
                <Plus size={15} aria-hidden="true" />
                补充副词条
              </button>
            ) : null}
            {candidate.subStats.length > 3 && candidate.level !== null && candidate.level < 3 ? (
              <button
                className="button button--quiet"
                type="button"
                onClick={() => update({ subStats: candidate.subStats.slice(0, -1) })}
              >
                盘面只有三条副词条
              </button>
            ) : null}
          </div>
        </div>
      </fieldset>
      {messages.length ? (
        <ul className="scanner-calibration__issues" aria-label="这张盘仍需处理的问题">
          {messages.map((issue) => (
            <li key={`${issue.field}:${issue.code}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="danger-note" role="alert">
          {error}
        </p>
      ) : null}
      <div className="scanner-calibration__save">
        <button
          className="button button--primary scanner-web__primary-action"
          type="submit"
          disabled={busy || item.duplicate}
        >
          <Check size={17} aria-hidden="true" />
          {busy ? '正在保存…' : remaining > 1 ? '保存并下一张' : '保存并检查'}
        </button>
        <small>保存校准只修改本次草稿。全部检查通过后，再确认更新仓库。</small>
      </div>
    </form>
  )
}
