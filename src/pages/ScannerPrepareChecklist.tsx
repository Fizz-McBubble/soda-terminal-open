import { useState, type ReactNode, type RefObject } from 'react'
import { AlertTriangle, Check, ChevronRight, LoaderCircle, ScanLine } from 'lucide-react'
import { ExplanationPopover } from '../components/ExplanationPopover'
import { type ScannerAssistantSnapshot } from '../scanner/runtime'
import { createPrepareChecks } from './scannerPrepareChecks'
import { ScannerPreparationStatus, type PreparationStatus } from './ScannerPreparationStatus'

function ScannerWindowModeGuidance() {
  return (
    <>
      云绝建议使用<strong>窗口模式或大窗口模式（非全屏）</strong>，
      <strong>全屏模式可能不稳定</strong>；本地建议使用 <strong>1080p 窗口模式</strong>。
    </>
  )
}

export function PrepareChecklist({
  snapshot,
  diagnosticFeedback,
  resumeAction,
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
  resumeAction?: ReactNode
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
  const [installerStatus, setInstallerStatus] = useState<PreparationStatus>({
    text: '',
    pending: false,
  })
  const currentConnection = {
    state: snapshot.state,
    actionPending,
    message: snapshot.error?.userMessage,
    remedy: snapshot.error?.remedy,
  }
  const [reportedConnection, setReportedConnection] = useState(currentConnection)
  if (
    reportedConnection.state !== currentConnection.state ||
    reportedConnection.actionPending !== actionPending ||
    reportedConnection.message !== currentConnection.message ||
    reportedConnection.remedy !== currentConnection.remedy
  ) {
    setReportedConnection(currentConnection)
    if (
      actionPending ||
      ['connecting', 'checking', 'awaiting_elevation', 'connection_failed'].includes(snapshot.state)
    )
      setInstallerStatus({ text: '', pending: false })
  }
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
      : '画面扫描连接后即可检查并开始。'
  const showInstallerStatus =
    compact &&
    !requestInFlight &&
    !checking &&
    Boolean(installerStatus.text) &&
    (needsConnection ||
      installerStatus.pending ||
      snapshot.distribution?.state === 'update_available')
  const currentBody = compact
    ? snapshot.state === 'connection_failed'
      ? snapshot.error?.remedy || body
      : gateExplanation
    : body

  return (
    <ScannerPreparationStatus.Provider value={compact ? setInstallerStatus : null}>
      <section
        className={`scanner-prepare${compact ? ' scanner-prepare--compact' : ''} scanner-prepare--${checksReady && targetReady ? 'ready' : checking ? 'checking' : waitingForPlayer ? 'prompt' : 'blocked'}${snapshot.state === 'connection_failed' ? ' scanner-prepare--connection-failed' : ''}${diagnosticFeedback ? ' scanner-prepare--with-feedback' : ''}`}
        aria-labelledby={headingId}
        data-prepare-gate={startReady ? 'ready' : 'blocked'}
      >
        {compact && !checking && observedFailures.length === 0 && (
          <section className="scanner-prepare__requirements" aria-label="扫描前必需条件">
            <h4>准备游戏</h4>
            <ul>
              <li>打开“驱动仓库”，清除筛选并关闭弹窗和侧栏。</li>
              <li>
                <ScannerWindowModeGuidance />
              </li>
              <li>保持游戏画面完整可见，扫描时暂不操作键鼠或切换窗口。</li>
            </ul>
          </section>
        )}
        <header className="scanner-prepare__intro">
          {!compact && <span>{eyebrow}</span>}
          <div className={compact ? 'scanner-prepare__status-row' : undefined}>
            <Heading id={headingId} ref={headingRef} tabIndex={-1}>
              {showInstallerStatus ? '画面扫描安装包' : title}
            </Heading>
            {compact &&
              snapshot.prepare &&
              (observedFailures.length > 0 || snapshot.prepare.observedTotal != null) && (
                <ExplanationPopover
                  className="scanner-prepare__observations"
                  closeLabel="关闭实际准备检查结果"
                  label="检查结果"
                  title="实际准备检查结果"
                  variant="text"
                  showIndicator={false}
                >
                  {snapshot.prepare?.geometry?.client && (
                    <p>
                      检测画面：{snapshot.prepare.geometry.client.width} ×{' '}
                      {snapshot.prepare.geometry.client.height}
                    </p>
                  )}
                  {snapshot.prepare?.observedTotal != null && (
                    <p>检测仓库数量：{snapshot.prepare.observedTotal} / 3000</p>
                  )}
                </ExplanationPopover>
              )}
          </div>
          <p
            id={compact ? 'scanner-gate-explanation' : undefined}
            aria-live={compact ? 'polite' : undefined}
          >
            {showInstallerStatus ? installerStatus.text : currentBody}
          </p>
          {!compact &&
          snapshot.state === 'connection_failed' &&
          snapshot.error?.remedy &&
          !body.includes(snapshot.error.remedy) ? (
            <p>{snapshot.error.remedy}</p>
          ) : null}
        </header>
        {compact && observedFailures.length > 0 && (
          <ul className="scanner-prepare__blocking-reasons" aria-label="扫描前需处理的问题">
            {observedFailures.map((check) => (
              <li key={check.id}>{check.feedback}</li>
            ))}
          </ul>
        )}

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
              onClick={() => {
                const action = startReady
                  ? onStart
                  : needsConnection
                    ? (onRecover ?? onReconnect)
                    : undefined
                if (action) {
                  setInstallerStatus({ text: '', pending: false })
                  action()
                }
              }}
            >
              <ScanLine aria-hidden="true" size={19} />
              {!startReady && needsConnection
                ? actionPending
                  ? '正在连接画面扫描'
                  : unchecked
                    ? '连接画面扫描'
                    : '重新连接画面扫描'
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
            {resumeAction}
            {compact && diagnosticFeedback}
          </div>
        </div>

        {!compact && diagnosticFeedback ? (
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
                    ? '先连接画面扫描'
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
                      ? '正在连接画面扫描'
                      : unchecked
                        ? '点击连接'
                        : '暂不可开始'}
              </b>
            </div>
            <div className="scanner-prepare__guide-card">
              <div className="scanner-prepare__guide-item">
                <span className="scanner-prepare__guide-label">画面环境</span>
                <p>
                  <ScannerWindowModeGuidance />
                </p>
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
    </ScannerPreparationStatus.Provider>
  )
}
