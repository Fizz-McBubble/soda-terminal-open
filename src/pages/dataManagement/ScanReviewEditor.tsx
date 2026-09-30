import { useState } from 'react'
import type { DriveDiscSet, StatKey } from '../../domain/schemas'
import type { ScanImportItem } from '../../domain/scanImportStaging'
import { statOptions } from '../dataManagementPresentation'

export function ScanReviewEditor({
  item,
  sets,
  onSave,
  onKeep,
}: {
  item: ScanImportItem
  sets: DriveDiscSet[]
  onSave: (
    candidate: ScanImportItem['candidate'],
    lockState: ScanImportItem['lockState'],
    fields: string[],
  ) => void
  onKeep: () => void
}) {
  const [candidate, setCandidate] = useState(item.candidate)
  const [lockState, setLockState] = useState(item.lockState)
  const updateSubStat = (
    index: number,
    changes: Partial<ScanImportItem['candidate']['subStats'][number]>,
  ) =>
    setCandidate((current) => ({
      ...current,
      subStats: current.subStats.map((subStat, subIndex) =>
        subIndex === index ? { ...subStat, ...changes } : subStat,
      ),
    }))
  const reviewFields = Array.from(
    new Set(
      item.issues.map((issue) =>
        issue.field === 'setId' ? 'setName' : issue.field.replace(/\.(stat|value|upgrades)$/, ''),
      ),
    ),
  )
  const hasField = (field: string) => reviewFields.includes(field)
  const hasCandidate = reviewFields.every((field) => {
    if (field === 'setName') return Boolean(item.candidate.setId && item.candidate.setName)
    if (field === 'mainStat') return Boolean(item.candidate.mainStat)
    if (field === 'lockState') return item.lockState !== 'unknown'
    const subIndex = field.match(/^subStats\.(\d+)$/)?.[1]
    if (subIndex !== undefined) {
      const sub = item.candidate.subStats[Number(subIndex)]
      return Boolean(sub?.stat && sub.value !== null && sub.upgrades !== null)
    }
    return false
  })

  return (
    <article className="scan-review-item" aria-labelledby={`review-item-${item.sequence}`}>
      <h3 id={`review-item-${item.sequence}`}>第 {item.sequence} 条 / 343 · 待复核</h3>
      <div className="scan-review-evidence">
        <img alt={`第 ${item.sequence} 条详情原始截图`} src={item.evidence.detailPath} />
        <img alt={`第 ${item.sequence} 条卡面原始截图`} src={item.evidence.cardPath} />
      </div>
      <p className="muted-note">原始采集证据，只读 · source {item.sourceIdentity}</p>
      <p className="muted-note">原始套装文字：{item.fields.setName?.rawText || '未识别'}</p>
      {item.issues.map((issue) => (
        <p key={`${issue.field}-${issue.code}`} className="danger-note">
          {issue.message} · {item.fields[issue.field]?.source ?? '无来源'} ·{' '}
          {item.fields[issue.field]?.confidence ?? '低置信'} ·{' '}
          {item.fields[issue.field]?.rule ?? '未可靠识别'}
        </p>
      ))}
      <details className="scan-review-facts">
        <summary>查看字段事实、OCR 原文与规则</summary>
        {Object.entries(item.fields).map(([field, evidence]) => (
          <p key={field}>
            <strong>{field}</strong>：OCR「{evidence.rawText || '未可靠识别'}」 · 当前候选{' '}
            {evidence.normalizedValue === null
              ? '未可靠识别'
              : JSON.stringify(evidence.normalizedValue)}{' '}
            · 置信 {evidence.confidence} · 来源 {evidence.source} · 规则 {evidence.rule}
          </p>
        ))}
      </details>
      <div className="scan-review-fields">
        {hasField('setName') && (
          <label>
            套装
            <select
              value={candidate.setId ?? ''}
              onChange={(event) => {
                const set = sets.find((entry) => entry.id === event.target.value)
                setCandidate((current) => ({
                  ...current,
                  setId: set?.id ?? null,
                  setName: set?.name ?? null,
                }))
              }}
            >
              <option value="">请选择</option>
              {sets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasField('mainStat') && (
          <label>
            主词条
            <select
              value={candidate.mainStat ?? ''}
              onChange={(event) =>
                setCandidate((current) => ({
                  ...current,
                  mainStat: (event.target.value as StatKey) || null,
                }))
              }
            >
              <option value="">请选择</option>
              {statOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasField('lockState') && (
          <label>
            锁定状态
            <select
              value={String(lockState)}
              onChange={(event) =>
                setLockState(
                  event.target.value === 'unknown' ? 'unknown' : event.target.value === 'true',
                )
              }
            >
              <option value="true">已锁定</option>
              <option value="false">未锁定</option>
              <option value="unknown">待确认</option>
            </select>
          </label>
        )}
      </div>
      <div className="scan-substat-review">
        {candidate.subStats.map(
          (subStat, index) =>
            hasField(`subStats.${index}`) && (
              <div key={`${item.id}-sub-${index}`}>
                <span>副词条 {index + 1}</span>
                <select
                  aria-label={`第 ${item.sequence} 条副词条 ${index + 1}`}
                  value={subStat.stat ?? ''}
                  onChange={(event) =>
                    updateSubStat(index, { stat: (event.target.value as StatKey) || null })
                  }
                >
                  <option value="">请选择</option>
                  {statOptions.slice(0, 11).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`第 ${item.sequence} 条副词条 ${index + 1} 数值`}
                  min="0"
                  step="0.1"
                  type="number"
                  value={subStat.value ?? ''}
                  onChange={(event) =>
                    updateSubStat(index, {
                      value: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
                <input
                  aria-label={`第 ${item.sequence} 条副词条 ${index + 1} 强化次数`}
                  max="5"
                  min="0"
                  type="number"
                  value={subStat.upgrades ?? ''}
                  onChange={(event) =>
                    updateSubStat(index, {
                      upgrades: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </div>
            ),
        )}
      </div>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => onSave(candidate, lockState, reviewFields)}
      >
        手动修正并保存草稿
      </button>
      <button
        className="button button--secondary"
        type="button"
        disabled={!hasCandidate}
        onClick={() => onSave(item.candidate, item.lockState, reviewFields)}
      >
        确认当前候选
      </button>
      <button className="button button--secondary" type="button" onClick={onKeep}>
        保持待复核，下一条
      </button>
      <p className="muted-note">保存后预检会失效；请在队列完成后显式重新预检。</p>
    </article>
  )
}
