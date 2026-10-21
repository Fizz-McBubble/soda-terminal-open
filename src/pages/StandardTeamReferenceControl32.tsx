import { useRef, useState } from 'react'
import type { TargetTeamWarehouseFitQueryResult } from '../application/calculationQueryContract'
import type {
  TargetTeamStandardReferenceRequest32,
  TargetTeamStandardReferenceResult32,
} from '../application/targetTeamStandardReference32'
import { planningEventDisplayLabel32 } from '../application/planningEventDisplay32'
import { getAgentName, formatDevelopmentEntityText } from '../application/publicRosterNames'
import { publicAssetStatLabel } from '../application/publicAssetStatLabels'
import { PlayerSelect } from '../components/PlayerSelect'
import { PlanningDialog } from './TeamSolverWorkspaceParts'
import { displayDriveDiscSet, formatDiscStatValue } from './discFactPresentation'
import {
  compileStandardReferenceEventDraft32,
  conditionDraftKey32,
  emptyStandardReferenceEventDraft32,
  eventDraftKey32,
  restoreStandardReferenceEventDraft32,
  isRetainedObservationCondition32,
  type StandardReferenceEventDraft32,
} from './standardReferenceEventDraft32'
import './standard-team-reference.css'

export function StandardTeamReferenceControl32({
  fit,
  disabled,
  onChange,
  savedReference,
  savedRequest,
}: {
  fit?: TargetTeamWarehouseFitQueryResult
  disabled: boolean
  onChange?: (request: TargetTeamStandardReferenceRequest32) => Promise<void>
  savedReference?: TargetTeamStandardReferenceResult32
  savedRequest?: TargetTeamStandardReferenceRequest32
}) {
  const [open, setOpen] = useState(false)
  const reference = savedReference ?? fit?.standardReference32
  return (
    <>
      <button
        className="button button--secondary"
        type="button"
        disabled={!reference || (disabled && !savedReference)}
        onClick={() => setOpen(true)}
      >
        {savedReference ? '保存时的标准参考' : '高级比较'}
      </button>
      {open && reference ? (
        <PlanningDialog
          title="高级配装比较"
          description="自定义动作与条件，比较标准培养下的参考配装。日常配装可直接查看并保存当前方案。"
          onCancel={() => setOpen(false)}
        >
          {savedReference ? (
            <div className="standard-reference-form">
              <StandardReferenceCultivation32 result={savedReference} />
              <StandardReferenceRecipe32 result={savedReference} />
              {savedReference.status !== 'selected' ? (
                <p>保存时尚未生成完整标准参考；账户配装记录保持独立。</p>
              ) : null}
              <details>
                <summary>保存时的比较动作与条件</summary>
                {savedRequest?.stage === 'select' && savedRequest.declarations ? (
                  savedRequest.declarations.occurrences.map((row) => (
                    <div key={row.occurrenceId}>
                      <p>
                        {getAgentName(row.ownerAgentId)} ·{' '}
                        {planningEventDisplayLabel32(row.ownerAgentId, row.eventId) ??
                          '保存的来源动作'}{' '}
                        · {row.atSeconds}秒
                        {row.durationSeconds === undefined ? '' : `，持续${row.durationSeconds}秒`}
                      </p>
                      <ul>
                        {row.conditions.map((condition) => {
                          const def = savedReference.metadata?.events
                            .find(
                              (event) =>
                                event.ownerAgentId === row.ownerAgentId &&
                                event.eventId === row.eventId,
                            )
                            ?.conditions.find(
                              (def) =>
                                def.providerAgentId === condition.providerAgentId &&
                                def.referenceKey === condition.referenceKey,
                            )
                          return (
                            <li key={conditionDraftKey32(condition)}>
                              {getAgentName(condition.providerAgentId)} ·{' '}
                              {def?.label ?? '保存的来源条件'}：
                              {typeof condition.value === 'boolean'
                                ? condition.value
                                  ? '已生效'
                                  : '未生效'
                                : (def?.options?.find((option) => option.value === condition.value)
                                    ?.label ?? String(condition.value))}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p>沿用保存时的固定参考目标。</p>
                )}
              </details>
              <div className="button-row">
                <button type="button" onClick={() => setOpen(false)}>
                  返回配装
                </button>
              </div>
            </div>
          ) : (
            <StandardReferenceForm
              key={reference.preparedIdentity ?? 'unavailable'}
              result={reference}
              request={savedRequest ?? fit?.standardReferenceRequest32}
              disabled={disabled || Boolean(savedReference)}
              onChange={onChange}
              onClose={() => setOpen(false)}
            />
          )}
        </PlanningDialog>
      ) : null}
    </>
  )
}

function StandardReferenceForm({
  result,
  request,
  disabled,
  onChange,
  onClose,
}: {
  result: TargetTeamStandardReferenceResult32
  request?: TargetTeamStandardReferenceRequest32
  disabled: boolean
  onChange?: (request: TargetTeamStandardReferenceRequest32) => Promise<void>
  onClose: () => void
}) {
  const metadata = result.metadata
  const existing = request?.stage === 'select' ? request.declarations : undefined
  const [rows, setRows] = useState<StandardReferenceEventDraft32[]>(() =>
    metadata ? restoreStandardReferenceEventDraft32(metadata, existing) : [],
  )
  const [confirmed, setConfirmed] = useState(Boolean(existing?.confirmedDeclaredConditions))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [edited, setEdited] = useState(false)
  const sequence = useRef(0)
  const busy = disabled || pending
  const update = (id: string, patch: Partial<StandardReferenceEventDraft32>) => {
    setRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
    setConfirmed(false)
    setEdited(true)
    setError(null)
  }
  const submit = async (request: TargetTeamStandardReferenceRequest32) => {
    setPending(true)
    setError(null)
    try {
      if (!onChange) throw new Error('保存时的参考只读；请返回当前队伍生成新参考。')
      await onChange(request)
      setEdited(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : '参考方案未生成，请重试。')
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="standard-reference-form">
      <StandardReferenceCultivation32 result={result} />
      {Object.entries(result.potentialByAgentId ?? {}).map(([id, value]) => (
        <label key={id}>
          <span>{getAgentName(id)} · 标准潜能</span>
          <PlayerSelect
            aria-label={`${getAgentName(id)}标准潜能`}
            value={String(value)}
            disabled={busy}
            onChange={(level) =>
              void submit({
                stage: 'prepare',
                potentialByAgentId: { ...result.potentialByAgentId, [id]: Number(level) },
              })
            }
          >
            <option value="0">P0 · 未激活分支</option>
            <option value="6">P6 · 标准培养</option>
            {value !== 0 && value !== 6 ? (
              <option value={value}>{`P${value} · 已声明分支`}</option>
            ) : null}
          </PlayerSelect>
        </label>
      ))}
      {result.status === 'unsupported' ? (
        <p role="status">
          当前参考暂不能生成：{result.gaps.map(formatDevelopmentEntityText).join('；')}
        </p>
      ) : null}
      {metadata ? (
        <>
          <p>
            选择用于比较的动作，填写0至{metadata.declaredDurationSeconds}
            秒内的发生时间与当时条件。动作名称沿用锁定英文资料；“来源倍率项”保留数值表行号，不推断命中次数。
          </p>
          {rows.map((row, index) => {
            const event = metadata.events.find((event) => eventDraftKey32(event) === row.eventKey)
            return (
              <fieldset key={row.id} disabled={busy} className="standard-reference-event">
                <legend>动作 {index + 1}</legend>
                <label>
                  <span>比较动作</span>
                  <PlayerSelect
                    aria-label={`动作${index + 1}名称`}
                    value={row.eventKey}
                    onChange={(eventKey) =>
                      update(row.id, {
                        eventKey,
                        conditions: {},
                        duration: '',
                        snapshot: '',
                        constant: false,
                        windswept: '',
                      })
                    }
                  >
                    <option value="">选择动作</option>
                    {metadata.memberIds.map((id) => (
                      <optgroup key={id} label={getAgentName(id)}>
                        {metadata.events
                          .filter((event) => event.ownerAgentId === id)
                          .map((event) => {
                            const label = planningEventDisplayLabel32(id, event.eventId)
                            return (
                              <option
                                key={event.eventId}
                                value={eventDraftKey32(event)}
                                disabled={!label}
                              >
                                {label ?? '动作名称尚未匹配当前资料'}
                              </option>
                            )
                          })}
                      </optgroup>
                    ))}
                  </PlayerSelect>
                </label>
                <label>
                  <span>发生时间（秒）</span>
                  <input
                    aria-label={`动作${index + 1}发生时间`}
                    type="number"
                    min="0"
                    max={metadata.declaredDurationSeconds}
                    step="any"
                    value={row.at}
                    onChange={(event) => update(row.id, { at: event.target.value })}
                  />
                </label>
                {event?.quantityUnit === 'seconds' ? (
                  <>
                    <label>
                      <span>持续时间（秒）</span>
                      <input
                        aria-label={`动作${index + 1}持续时间`}
                        type="number"
                        min="0"
                        step="any"
                        value={row.duration}
                        onChange={(event) => update(row.id, { duration: event.target.value })}
                      />
                    </label>
                    <label className="standard-reference-check">
                      <input
                        type="checkbox"
                        checked={row.constant}
                        onChange={(event) => update(row.id, { constant: event.target.checked })}
                      />
                      区间内条件保持不变
                    </label>
                  </>
                ) : null}
                {event?.requiresWindsweptObservation ? (
                  <label>
                    <span>风蚀状态</span>
                    <PlayerSelect
                      aria-label={`动作${index + 1}风蚀状态`}
                      value={row.windswept}
                      onChange={(windswept) => update(row.id, { windswept })}
                    >
                      <option value="">选择状态</option>
                      <option value="inactive">未触发风蚀</option>
                      <option value="active">风蚀已生效</option>
                    </PlayerSelect>
                  </label>
                ) : null}
                {event ? (
                  <details>
                    <summary>动作条件（{event.conditions.length}项）</summary>
                    <p>
                      分别填写动作及候选音擎、盘套的状态；每套配装只应用实际装备的条件，空白不视为未触发或零层。
                    </p>
                    {event.conditions.map((def) => {
                      const key = conditionDraftKey32(def)
                      const label = `${getAgentName(def.providerAgentId)} · ${def.label}`
                      if (
                        isRetainedObservationCondition32(row, def, existing) &&
                        !row.conditions[key]
                      )
                        return (
                          <p key={key}>{label}：沿用已保存的观察；修改事件或时间后须重新核对。</p>
                        )
                      return (
                        <label key={key}>
                          <span>{label}</span>
                          {def.valueKind === 'number' ? (
                            <input
                              aria-label={`动作${index + 1}：${label}`}
                              type="number"
                              min={def.minimum}
                              max={def.maximum}
                              step="any"
                              value={row.conditions[key] ?? ''}
                              onChange={(event) =>
                                update(row.id, {
                                  conditions: { ...row.conditions, [key]: event.target.value },
                                })
                              }
                            />
                          ) : (
                            <PlayerSelect
                              aria-label={`动作${index + 1}：${label}`}
                              value={row.conditions[key] ?? ''}
                              onChange={(value) =>
                                update(row.id, { conditions: { ...row.conditions, [key]: value } })
                              }
                            >
                              <option value="">选择状态</option>
                              {def.valueKind === 'boolean' ? (
                                <>
                                  <option value="false">未生效</option>
                                  <option value="true">已生效</option>
                                </>
                              ) : (
                                def.options?.map((option, index) => (
                                  <option key={index} value={String(index)}>
                                    {option.label}
                                  </option>
                                ))
                              )}
                            </PlayerSelect>
                          )}
                        </label>
                      )
                    })}
                    <label>
                      <span>历史快照时间（秒，可选）</span>
                      <input
                        aria-label={`动作${index + 1}快照时间`}
                        type="number"
                        min="0"
                        step="any"
                        value={row.snapshot}
                        onChange={(event) => update(row.id, { snapshot: event.target.value })}
                      />
                    </label>
                  </details>
                ) : null}
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => {
                    setRows((rows) => rows.filter((item) => item.id !== row.id))
                    setConfirmed(false)
                    setEdited(true)
                  }}
                >
                  移除此动作
                </button>
              </fieldset>
            )
          })}
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              setRows((rows) => [
                ...rows,
                emptyStandardReferenceEventDraft32(
                  `standard-ui-${Date.now()}-${++sequence.current}`,
                ),
              ])
              setConfirmed(false)
              setEdited(true)
            }}
          >
            添加比较动作
          </button>
          <label className="standard-reference-check">
            <input
              type="checkbox"
              disabled={busy}
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            我确认所列动作和条件用于本次有限比较
          </label>
          <div className="button-row">
            <button
              type="button"
              disabled={busy || !rows.length || !confirmed}
              className="primary"
              onClick={() => {
                try {
                  const declarations = compileStandardReferenceEventDraft32(
                    metadata,
                    rows,
                    confirmed,
                    existing,
                  )
                  if (!result.preparedIdentity || !result.sourceBindingFingerprint)
                    throw new Error('资料已变化，请重新读取标准参考。')
                  void submit({
                    stage: 'select',
                    preparedIdentity: result.preparedIdentity,
                    sourceBindingFingerprint: result.sourceBindingFingerprint,
                    potentialByAgentId: request?.potentialByAgentId,
                    declarations,
                  })
                } catch (error) {
                  setError(error instanceof Error ? error.message : '请检查动作和条件。')
                }
              }}
            >
              {busy ? '正在生成参考…' : '生成参考方案'}
            </button>
            <button type="button" onClick={onClose}>
              返回配装
            </button>
          </div>
        </>
      ) : (
        <div className="button-row">
          <button type="button" onClick={onClose}>
            返回配装
          </button>
        </div>
      )}
      {error ? <p role="alert">{error}</p> : null}
      <StandardReferenceRecipe32 result={result} edited={edited} />
    </div>
  )
}

function StandardReferenceCultivation32({
  result,
}: {
  result: TargetTeamStandardReferenceResult32
}) {
  if (!result.referenceCultivation?.length)
    return result.status === 'unsupported' ? null : (
      <p>此历史参考未保存培养基线；重新生成可查看完整配置。</p>
    )
  return (
    <section aria-label="标准参考培养基线">
      <h3>培养基线</h3>
      <ul>
        {result.referenceCultivation.map((member) => (
          <li key={member.agentId}>
            {getAgentName(member.agentId)} · {member.level}级 · {member.mindscape}影
            {member.potential === null ? ' · 潜能不适用' : ` · 潜能${member.potential}`}
            {' · '}技能{member.effectiveSkillLevel}（基础{member.baseSkillLevel}） · 核心
            {member.coreLevel}
            {' · '}副词条{member.substatRollBudget}次
          </li>
        ))}
      </ul>
    </section>
  )
}

function StandardReferenceRecipe32({
  result,
  edited = false,
}: {
  result: TargetTeamStandardReferenceResult32
  edited?: boolean
}) {
  if (result.status !== 'selected') return null
  return (
    <section aria-label="已生成的标准参考">
      <h3>{edited ? '上次生成的参考（条件尚未更新）' : '三人标准参考'}</h3>
      <p>在当前候选范围内按已列动作比较。以下为参考盘，不占用账户库存。</p>
      {result.searchDiagnostics ? (
        <p>
          已求值{result.searchDiagnostics.evaluations}套完整配装，其中
          {result.searchDiagnostics.unknownEvaluations}套未满足比较条件，
          {result.searchDiagnostics.differentCoverageEvaluations}套覆盖范围不一致。
          {result.searchDiagnostics.allDiscreteCombinationsVisited
            ? '已遍历所列套装与音擎组合，词条分配仍为有限搜索。'
            : '所列套装与音擎组合尚未全部遍历。'}
        </p>
      ) : null}
      {result.equipment.map((member) => (
        <details key={member.agentId}>
          <summary>
            {getAgentName(member.agentId)} · {formatDevelopmentEntityText(member.engineId)}{' '}
            {member.refinement}叠 · {member.discCount}张参考盘
          </summary>
          {member.discs ? (
            <ol>
              {member.discs.map((disc) => (
                <li key={disc.slot}>
                  {disc.slot}号位 · {displayDriveDiscSet(disc.setId)} +{disc.level} ·{' '}
                  {publicAssetStatLabel(disc.mainStat)}
                  <br />
                  {disc.subStats
                    .map(
                      (stat) =>
                        `${publicAssetStatLabel(stat.stat)} ${formatDiscStatValue(stat.stat, stat.value)}`,
                    )
                    .join('、')}
                </li>
              ))}
            </ol>
          ) : (
            <p>此历史记录未保存参考盘明细；原参考身份仍保留。</p>
          )}
        </details>
      ))}
    </section>
  )
}
