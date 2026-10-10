import { type ReactNode, type RefObject } from 'react'
import { AlertTriangle, Check, ChevronRight, LoaderCircle, ScanLine } from 'lucide-react'
import { type ScannerAssistantSnapshot } from '../scanner/runtime'
import { createPrepareChecks } from './scannerPrepareChecks'

export function PrepareChecklist({
  snapshot,
  diagnosticFeedback,
  actionPending = false,
  eyebrow,
  title,
  body,
  headingRef,
  targetReady,
  targetPanel,
  installer,
  accountDisclosure,
  fallbackJson,
  onStart,
  onRecover,
  onReconnect,
  onRevoke,
  compact = false,
  blocked = false,
}: {
  snapshot: ScannerAssistantSnapshot
  diagnosticFeedback?: ReactNode
  actionPending?: boolean
  eyebrow: string
  title: string
  body: string
  headingRef: RefObject<HTMLHeadingElement | null>
  targetReady: boolean
  targetPanel: ReactNode
  installer?: ReactNode
  accountDisclosure: ReactNode
  fallbackJson?: ReactNode
  onStart: () => void
  onRecover?: () => void
  onReconnect: () => void
  onRevoke?: () => void
  compact?: boolean
  blocked?: boolean
}) {
  const checks = createPrepareChecks(snapshot)
  const readyCount = checks.filter((check) => check.status === 'ready').length
  const checksReady = checks.every((check) => check.status === 'ready')
  const startReady =
    targetReady &&
    !['connecting', 'checking', 'awaiting_elevation'].includes(snapshot.state) &&
    snapshot.readiness.helperConnected &&
    snapshot.distribution?.state === 'ready'
  const totalReady = readyCount + (targetReady ? 1 : 0)
  const totalChecks = checks.length + 1
  const checking = ['connecting', 'checking', 'awaiting_elevation'].includes(snapshot.state)
  const unchecked = snapshot.state === 'unchecked'
  const requestInFlight =
    actionPending || snapshot.state === 'checking' || snapshot.state === 'awaiting_elevation'
  const waitingForPlayer = snapshot.state === 'ready' && !snapshot.prepare
  const needsConnection = !snapshot.readiness.helperConnected
  const headingId = compact ? 'scanner-preparation-heading' : 'scanner-stage-heading'
  const observedFailures = snapshot.prepare
    ? checks.filter((check) =>
        check.id === 'filters'
          ? snapshot.prepare?.playerChecks?.filtersClear === false
          : check.id === 'overlay'
            ? snapshot.prepare?.playerChecks?.overlayClear === false
            : check.id === 'warehouse-ready' && check.status === 'blocked',
      )
    : []
  const Heading = compact ? 'h4' : 'h2'
  const gateExplanation = startReady
    ? '点击后会切换到游戏，检查画面和仓库是否就绪；检查通过后才开始扫描。'
    : !targetReady
      ? '请先选择本次扫描要更新的账户。'
      : '本机扫描组件与助手可用后即可检查并开始。'

  return (
    <section
      className={`scanner-prepare${compact ? ' scanner-prepare--compact' : ''} scanner-prepare--${checksReady && targetReady ? 'ready' : checking ? 'checking' : waitingForPlayer ? 'prompt' : 'blocked'}${snapshot.state === 'connection_failed' ? ' scanner-prepare--connection-failed' : ''}${diagnosticFeedback ? ' scanner-prepare--with-feedback' : ''}`}
      aria-labelledby={headingId}
      data-prepare-gate={startReady ? 'ready' : 'blocked'}
    >
      {compact && (
        <section className="scanner-prepare__requirements" aria-label="扫描前必需条件">
          <h4>准备游戏</h4>
          <ul>
            <li>打开“驱动仓库”完整列表，清除筛选并关闭弹窗、筛选面板等遮挡。</li>
            <li>本机版建议 1920 × 1080 或 1600 × 900 窗口，也可全屏。</li>
            <li>扫描期间保持画面完整可见，勿切换、缩放窗口或操作游戏。</li>
          </ul>
        </section>
      )}
      <header className="scanner-prepare__intro">
        {!compact && <span>{eyebrow}</span>}
        <Heading id={headingId} ref={headingRef} tabIndex={-1}>
          {title}
        </Heading>
        <p>{body}</p>
        {snapshot.state === 'connection_failed' &&
        snapshot.error?.remedy &&
        !body.includes(snapshot.error.remedy) ? (
          <p>{snapshot.error.remedy}</p>
        ) : null}
      </header>

      <div className="scanner-prepare__primary">
        {targetPanel && <ol className="scanner-prepare__account">{targetPanel}</ol>}

        <div className="scanner-prepare__actions">
          <button
            className="button button--primary scanner-web__primary-action"
            type="button"
            disabled={blocked || requestInFlight || (!startReady && !needsConnection)}
            aria-busy={actionPending}
            aria-describedby="scanner-gate-explanation"
            title={!targetReady && !needsConnection ? '请先创建或选择目标账户' : undefined}
            onClick={
              startReady ? onStart : needsConnection ? (onRecover ?? onReconnect) : undefined
            }
          >
            <ScanLine aria-hidden="true" size={19} />
            {!startReady && needsConnection
              ? actionPending
                ? '正在连接扫描助手'
                : unchecked
                  ? '连接扫描助手'
                  : '重新连接扫描助手'
              : snapshot.state === 'awaiting_elevation'
                ? '等待 Windows 权限确认'
                : snapshot.state === 'checking'
                  ? '正在检查'
                  : snapshot.state === 'connection_failed'
                    ? '重新扫描'
                    : '开始扫描'}
            <ChevronRight aria-hidden="true" size={18} />
          </button>
          {installer}
          {compact &&
            onRevoke &&
            snapshot.readiness.helperConnected &&
            snapshot.state === 'ready' && (
              <button
                className="button button--quiet"
                type="button"
                disabled={blocked}
                onClick={onRevoke}
              >
                断开授权
              </button>
            )}
        </div>
      </div>

      {compact && (
        <p
          id="scanner-gate-explanation"
          className="scanner-prepare__gate--compact"
          aria-live="polite"
        >
          {gateExplanation}
        </p>
      )}

      {compact &&
        snapshot.prepare &&
        (observedFailures.length > 0 || snapshot.prepare.observedTotal != null) && (
          <section className="scanner-prepare__observations" aria-label="实际准备检查结果">
            {observedFailures.length > 0 && <h4>需要处理</h4>}
            {observedFailures.length > 0 && (
              <ul>
                {observedFailures.map((check) => (
                  <li key={check.id}>{check.feedback}</li>
                ))}
              </ul>
            )}
            {snapshot.prepare?.geometry?.client && (
              <p>
                检测画面：{snapshot.prepare.geometry.client.width} ×{' '}
                {snapshot.prepare.geometry.client.height}
              </p>
            )}
            {snapshot.prepare?.observedTotal != null && (
              <p>检测仓库数量：{snapshot.prepare.observedTotal} / 3000</p>
            )}
          </section>
        )}

      {diagnosticFeedback ? (
        <div className="scanner-prepare__feedback">{diagnosticFeedback}</div>
      ) : null}

      {!compact && (
        <section className="scanner-prepare__details" aria-label="本机准备条件">
          <div className="scanner-prepare__details-heading">
            <h3>本机准备条件</h3>
          </div>
          {accountDisclosure ? (
            <div className="scanner-prepare__account-disclosure">{accountDisclosure}</div>
          ) : null}
          <p id="scanner-gate-explanation" aria-live="polite">
            {gateExplanation}
          </p>
          <div className="scanner-prepare__summary">
            <strong>
              {waitingForPlayer && targetReady
                ? '点击后检查游戏是否就绪'
                : unchecked || needsConnection
                  ? '先连接本机扫描助手'
                  : checksReady && targetReady
                    ? `${totalChecks} 项准备全部通过`
                    : `${totalReady} / ${totalChecks} 项准备已通过`}
            </strong>
            <b aria-live="polite">
              {checksReady && targetReady
                ? '可以开始'
                : startReady
                  ? '点击后自动检查'
                  : checking
                    ? '正在连接助手'
                    : unchecked
                      ? '点击连接'
                      : '暂不可开始'}
            </b>
          </div>
          <div className="scanner-prepare__guide-card">
            <div className="scanner-prepare__guide-item">
              <span className="scanner-prepare__guide-label">画面环境</span>
              <p>建议 1920 × 1080 或 1600 × 900（16:9）窗口；也可全屏，位置不限。</p>
            </div>
            <div className="scanner-prepare__guide-item">
              <span className="scanner-prepare__guide-label">扫描</span>
              <p>
                <span>Windows 本地版扫描 S 级驱动盘，跳过 A/B 级。</span>
                <span className="scanner-prepare__guide-speed" aria-label="扫描耗时参考">
                  约 140 张/分钟
                </span>
              </p>
            </div>
            <div className="scanner-prepare__guide-item">
              <span className="scanner-prepare__guide-label">扫描期间</span>
              <p>保持游戏画面完整可见；勿移动、缩放、切换窗口或操作游戏。</p>
            </div>
          </div>

          <ol className="scanner-prepare__checks" aria-label="本机准备检查项">
            {checks.map((check, index) => (
              <li
                className={`scanner-prepare__check is-${check.status}${index % 2 ? ' is-right-column' : ''}${index >= 2 ? ' is-lower-row' : ''}`}
                key={check.id}
              >
                {check.status === 'unchecked' ? null : (
                  <span className="scanner-prepare__check-icon" aria-hidden="true">
                    {check.status === 'ready' ? (
                      <Check size={16} strokeWidth={3} />
                    ) : check.status === 'checking' ? (
                      <LoaderCircle size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                  </span>
                )}
                <div>
                  <strong>{check.label}</strong>
                  {check.id === 'local-scanner' &&
                  onRevoke &&
                  snapshot.readiness.helperConnected &&
                  snapshot.state === 'ready' ? (
                    <span className="scanner-prepare__instruction-row">
                      <span className="scanner-prepare__instruction">{check.instruction}</span>
                      <button
                        className="scanner-prepare__revoke"
                        type="button"
                        disabled={blocked}
                        onClick={onRevoke}
                      >
                        断开授权
                      </button>
                    </span>
                  ) : (
                    <span className="scanner-prepare__instruction">{check.instruction}</span>
                  )}
                  {check.status === 'ready' || check.status === 'blocked' ? (
                    <small className="scanner-prepare__feedback">{check.feedback}</small>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!compact && fallbackJson}
    </section>
  )
}
