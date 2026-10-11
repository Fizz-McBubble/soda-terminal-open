import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Folder,
  Plug,
  ShieldCheck,
} from 'lucide-react'
import './AssetQuickReadEntry.css'
import { focusScannerWorkspaceTarget } from './scannerWorkbenchNavigation'
import { AssetQuickReadGuide, AssetQuickReadDirectoryGuide } from './AssetQuickReadGuide'
import { AssetCaptureRiskDetails } from './AssetCaptureMethodsNotice'
import { ScannerMethodSteps } from './ScannerMethodSteps'
import { AssetQuickReadConsentStage } from './AssetQuickReadConsentDialog'
import { ScannerPreparationStatus, type PreparationStatus } from './ScannerPreparationStatus'

export type AssetQuickReadState =
  | 'idle'
  | 'starting'
  | 'capturing'
  | 'received'
  | 'timed_out'
  | 'stopped'
  | 'error'
  | 'completed'

export interface AssetQuickReadPreview {
  /** Identifies this exact candidate (the adapter may use the snapshot SHA-256). */
  snapshotId: string
  counts: { agents: number; discs: number }
  validSummary: string[]
  issues: string[]
  agents: Array<{
    agentId: string
    name: string
    level: number
    mindscape: number
    skills?: string
    wEngine?: string
  }>
}

export interface AssetQuickReadEntryProps {
  /** Only the real independent tool adapter may report ready. */
  capability?: 'unavailable' | 'ready'
  /** Controlled by the adapter; this component never simulates capture or a deadline. */
  state?: AssetQuickReadState
  onConnect?: () => void | Promise<void>
  installationDirectory?: string
  onDirectoryChange?: (value: string) => void
  targetAccountId?: string
  targetAccountName?: string
  targetRequired?: boolean
  onStart?: () => void | Promise<void>
  onStop?: () => void | Promise<void>
  onImport?: () => void | Promise<void>
  onDiscard?: () => void | Promise<void>
  onPrepareAgain?: () => void | Promise<void>
  onExport?: () => void | Promise<void>
  onInspectFile?: () => void | Promise<void>
  canImport?: boolean
  preview?: AssetQuickReadPreview
  elapsedSeconds?: number
  remainingSeconds?: number
  /** Describes the adapter's actual transaction scope and recovery behavior. */
  transactionNotice?: string
  errorMessage?: string
  completionMessage?: string
  onClose?: () => void
  onContinueScanning?: () => void
  blocked?: boolean
  preparationCondensed?: boolean
  onViewAssets?: () => void
  completionActions?: ReactNode
  riskNoticeHref?: string
  installer?: ReactNode
  downloadAvailable?: boolean
  workbenchExtras?: ReactNode
  pendingInspection?: boolean
  renderParts?: (parts: {
    preparation: ReactNode
    task: ReactNode | null
    stageActive: boolean
  }) => ReactNode
}

const stateCopy: Record<AssetQuickReadState, string> = {
  idle: '本次资产快读尚未启动。',
  starting: '资产快读正在准备。请保持游戏客户端完全退出，等待工具就绪后再启动并登录。',
  capturing:
    '资产快读已就绪，请完整启动游戏并登录。最长等待 3 分钟；收到所需数据后立即反馈，不必等满 3 分钟。',
  received: '已收到数据，尚未导入当前账户。',
  timed_out: '本次等待已结束，未收到所需的完整数据。请检查游戏准备情况后再尝试，或改用画面扫描。',
  stopped: '本次资产快读已停止。已保存的本地结果不会自动删除，网络驱动也不会自动卸载。',
  error: '本次资产快读未完成。请检查资产快读状态，或改用画面扫描。',
  completed: '本次资产快读结果已导入。',
}

type PendingAction = 'connect' | 'start' | 'import' | 'export' | 'inspect' | 'discard' | 'restart'
const actionErrors: Record<PendingAction | 'stop', string> = {
  connect: '资产快读连接未完成，请检查安装目录后重试。',
  start: '启动请求未完成，请检查资产快读状态后重试。',
  import: '导入请求未完成。请检查结果和目标账户，再次确认后重试。',
  export: '导出请求未完成，请重试。',
  inspect: '候选文件检查未完成，请重试。',
  discard: '关闭结果检查未完成，请重试；账户未修改。',
  restart: '未能返回读取准备，请重试；已导入的资产保留。',
  stop: '停止请求未完成，请重试或检查资产快读状态。',
}

function suppliedSeconds(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined
}

export function AssetQuickReadEntry({
  capability = 'unavailable',
  state = 'idle',
  onConnect,
  installationDirectory = '',
  onDirectoryChange,
  targetAccountId,
  targetAccountName = '',
  targetRequired = false,
  onStart,
  onStop,
  onImport,
  onDiscard,
  onPrepareAgain,
  onExport,
  onInspectFile,
  canImport = false,
  preview,
  elapsedSeconds,
  remainingSeconds,
  transactionNotice,
  errorMessage,
  completionMessage,
  onClose,
  onContinueScanning,
  blocked = false,
  onViewAssets,
  completionActions,
  riskNoticeHref,
  installer,
  downloadAvailable = false,
  renderParts,
  workbenchExtras,
  pendingInspection = false,
}: AssetQuickReadEntryProps) {
  const headingId = useId()
  const disclosureId = useId()
  const directoryId = useId()
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const startTriggerRef = useRef<HTMLButtonElement>(null)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [acknowledgedAccount, setAcknowledgedAccount] = useState<string | null>(null)
  const riskAccountKey = JSON.stringify([targetAccountId, targetAccountName])
  const acknowledged = acknowledgedAccount === riskAccountKey
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [stopPending, setStopPending] = useState(false)
  const [actionError, setActionError] = useState<PendingAction | 'stop' | null>(null)
  const [installerStatus, setInstallerStatus] = useState<PreparationStatus>({
    text: '',
    pending: false,
  })
  const [reportedFailure, setReportedFailure] = useState({ message: errorMessage, state })
  if (reportedFailure.message !== errorMessage || reportedFailure.state !== state) {
    setReportedFailure({ message: errorMessage, state })
    if (errorMessage || ['error', 'timed_out', 'stopped'].includes(state))
      setInstallerStatus({ text: '', pending: false })
  }
  const pendingActionRef = useRef(false)
  const stopPendingRef = useRef(false)
  const captureBusy = state === 'starting' || state === 'capturing' || pendingAction === 'start'
  const busy = captureBusy || pendingAction !== null || stopPending
  const actionBlocked = busy || blocked
  const hasTask = state !== 'idle' || pendingAction === 'start'
  const consentOpen = Boolean(
    renderParts && disclosureOpen && !captureBusy && state !== 'received' && state !== 'completed',
  )
  const stageActive = hasTask || consentOpen || pendingInspection
  const preparationBlocked = actionBlocked || state === 'received'
  const targetMissing = targetRequired && !targetAccountId
  const available = capability === 'ready' && Boolean(onStart) && !targetMissing
  const currentStep =
    state === 'completed'
      ? 3
      : state === 'received'
        ? 2
        : state === 'starting' || state === 'capturing'
          ? 1
          : 0
  const importAvailable =
    state === 'received' &&
    Boolean(preview?.snapshotId) &&
    Boolean(targetAccountId) &&
    Boolean(targetAccountName.trim()) &&
    canImport &&
    Boolean(onImport)
  const elapsed = suppliedSeconds(elapsedSeconds)
  const remaining = suppliedSeconds(remainingSeconds)
  const resultSummary = (preview?.validSummary ?? []).filter(
    (summary) => !renderParts || !summary.startsWith('本次仅检查已出现的代理人和S级盘'),
  )

  useEffect(() => {
    if (state === 'received' && preview?.snapshotId)
      focusScannerWorkspaceTarget(resultHeading.current, true)
  }, [state, preview?.snapshotId])

  function closeDisclosure() {
    setDisclosureOpen(false)
    setAcknowledgedAccount(null)
    onClose?.()
  }

  async function runAction(action: PendingAction, callback: () => void | Promise<void>) {
    if ((blocked && action !== 'export') || pendingActionRef.current || stopPendingRef.current)
      return
    pendingActionRef.current = true
    setPendingAction(action)
    setActionError(null)
    if (action === 'connect' || action === 'start') setInstallerStatus({ text: '', pending: false })
    try {
      await callback()
    } catch {
      setInstallerStatus({ text: '', pending: false })
      setActionError(action)
    } finally {
      pendingActionRef.current = false
      setPendingAction(null)
    }
  }

  function start() {
    if (
      !available ||
      targetMissing ||
      preparationBlocked ||
      !acknowledged ||
      pendingActionRef.current ||
      stopPendingRef.current
    )
      return
    setAcknowledgedAccount(null)
    if (renderParts) setDisclosureOpen(false)
    void runAction('start', onStart!)
  }

  function importResult() {
    if (!importAvailable || actionBlocked || pendingActionRef.current || stopPendingRef.current)
      return
    void runAction('import', onImport!)
  }

  async function stop() {
    if (!onStop || !captureBusy || stopPendingRef.current) return
    stopPendingRef.current = true
    setStopPending(true)
    setActionError(null)
    try {
      await onStop()
    } catch {
      setActionError('stop')
    } finally {
      stopPendingRef.current = false
      setStopPending(false)
    }
  }

  const heading = (
    <>
      <div className="asset-quick-read__heading">
        <Database aria-hidden="true" size={22} />
        {renderParts ? (
          <h3 id={headingId}>
            资产快读{' '}
            <small className="f5v-beta" aria-label="测试版">
              Beta
            </small>
          </h3>
        ) : (
          <h2 id={headingId}>
            资产快读{' '}
            <small className="f5v-beta" aria-label="测试版">
              Beta
            </small>
          </h2>
        )}
        {renderParts ? (
          <AssetQuickReadGuide />
        ) : (
          <span className="asset-quick-read__badge">资产快读 · 默认关闭</span>
        )}
      </div>
    </>
  )
  const steps = (
    <>
      <ol className="scanner-journey-cards asset-quick-read__steps" aria-label="资产快读与导入进度">
        {['准备', '读取', '检查', '完成'].map((label, index) => (
          <li
            key={label}
            className={`scanner-journey-card is-${index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'}`}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span aria-hidden="true">{index < currentStep ? <Check size={14} /> : index + 1}</span>
            <div>
              <strong>{label}</strong>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
  const scope = (
    <>
      {renderParts ? (
        <p className="scanner-workbench__scope">
          S 级驱动盘 · 代理人养成 <span className="scanner-workbench__metric">一键读取</span>
        </p>
      ) : (
        <p>
          读取已拥有代理人的真实养成和 S
          级驱动盘。当前已装备音擎详情用于现有配装，不建立音擎或邦布库存。
        </p>
      )}
    </>
  )
  const compactStatus =
    pendingAction === 'connect'
      ? '正在检查资产快读连接。'
      : pendingAction === 'start'
        ? '正在提交读取请求，请保持游戏退出。'
        : pendingAction === 'import'
          ? '正在导入，请等待结果。'
          : currentStep === 0 && installerStatus.text
            ? installerStatus.text
            : actionError
              ? actionErrors[actionError]
              : errorMessage ||
                (state === 'completed'
                  ? completionMessage?.split('。', 1)[0] || stateCopy.completed
                  : state === 'idle'
                    ? capability === 'ready'
                      ? '资产快读已连接'
                      : '资产快读未连接'
                    : stateCopy[state])
  const status = (
    <>
      <div className="asset-quick-read__status" role="status" aria-live="polite" aria-atomic="true">
        {renderParts ? (
          <strong className="asset-quick-read__tool-status">
            {compactStatus}
            {state === 'idle' &&
              capability !== 'ready' &&
              !installerStatus.text &&
              !pendingAction &&
              !errorMessage &&
              !actionError && (
                <span className="asset-quick-read__status-hint">
                  {downloadAvailable
                    ? '首次使用先安装，再连接。'
                    : '已安装可连接；安装包暂不可下载。'}
                </span>
              )}
          </strong>
        ) : capability !== 'ready' && state === 'idle' ? (
          '资产快读尚未接通，当前暂不可用。'
        ) : renderParts && state === 'received' ? (
          '已收到读取结果。'
        ) : state === 'completed' ? (
          renderParts ? (
            completionMessage?.split('。', 1)[0] || stateCopy.completed
          ) : (
            (completionMessage ?? stateCopy.completed)
          )
        ) : renderParts && state === 'idle' && capability === 'ready' ? (
          '资产快读已连接，可准备本次资产快读。'
        ) : (
          stateCopy[state]
        )}
        {!renderParts && pendingAction === 'start' && state === 'idle' && (
          <p>正在提交本次启动请求，请等待工具反馈。</p>
        )}
        {!renderParts && pendingAction === 'connect' && (
          <p>正在检查资产快读连接；本步骤不请求管理员权限。</p>
        )}
        {!renderParts && pendingAction === 'import' && <p>正在提交确认后的导入，请等待结果。</p>}
        {!renderParts && errorMessage && <p>{errorMessage}</p>}
        {!renderParts && actionError && <p>{actionErrors[actionError]}</p>}
      </div>
    </>
  )
  const connectionButton = (
    <>
      <button
        className={
          renderParts && capability !== 'ready' ? 'button button--primary' : 'button button--quiet'
        }
        type="button"
        disabled={!onConnect || preparationBlocked}
        onClick={() => {
          if (onConnect && !preparationBlocked) {
            void runAction('connect', onConnect)
          }
        }}
      >
        {pendingAction === 'connect'
          ? '正在连接资产快读'
          : capability === 'ready'
            ? '重新连接资产快读'
            : '连接资产快读'}
      </button>
    </>
  )
  const preparation = (
    <>
      {(currentStep === 0 || renderParts) && (
        <div className="asset-quick-read__prepare">
          <div className="asset-quick-read__panel">
            {!renderParts && (
              <h3>
                <Plug aria-hidden="true" size={20} />
                连接资产快读
              </h3>
            )}
            <div className="asset-quick-read__directory-row">
              <label className="asset-quick-read__directory" htmlFor={directoryId}>
                <Folder aria-hidden="true" size={17} />
                游戏安装目录
              </label>
              <AssetQuickReadDirectoryGuide />
            </div>
            <input
              id={directoryId}
              className="scanner-input asset-quick-read__input"
              value={installationDirectory}
              readOnly={!onDirectoryChange}
              disabled={preparationBlocked}
              maxLength={2048}
              placeholder="粘贴从启动器找到的游戏目录路径"
              onChange={(event) => onDirectoryChange?.(event.target.value)}
            />
            {!renderParts && (
              <p className="asset-quick-read__muted">
                先单独运行资产快读。这里只填写游戏目录，不读取账号密码。连接仅探测工具；开始读取时才请求管理员权限。
              </p>
            )}
            <div className="asset-quick-read__actions">
              {!renderParts && connectionButton}
              {onInspectFile && !renderParts && (
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={preparationBlocked}
                  onClick={() => {
                    if (!preparationBlocked) void runAction('inspect', onInspectFile)
                  }}
                >
                  检查资产快读 JSON 候选
                </button>
              )}
            </div>
            {!renderParts && (
              <p className="asset-quick-read__target">
                导入目标：<strong>{targetAccountName || '请先在扫描准备区选择账户'}</strong>
              </p>
            )}
          </div>
          {!renderParts && (
            <div className="asset-quick-read__panel">
              <h3>
                <ShieldCheck aria-hidden="true" size={20} />
                资产快读准备指南
              </h3>
              <ol className="asset-quick-read__checklist">
                <li>先完成游戏更新及首次着色器编译。</li>
                <li>完全退出游戏客户端，再准备资产快读。</li>
                <li>工具实际就绪后，才完整启动游戏并登录。</li>
              </ol>
              <p className="asset-quick-read__muted">
                最长等待 180 秒；所需数据齐全后立即反馈。游戏面板仅用于开发校对，不采集或导入。
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
  const discardButton = (
    <>
      {onDiscard && (
        <button
          className="button button--quiet"
          type="button"
          disabled={actionBlocked}
          onClick={() => {
            if (actionBlocked) return
            setAcknowledgedAccount(null)
            setDisclosureOpen(false)
            void runAction('discard', onDiscard)
          }}
        >
          放弃
        </button>
      )}
    </>
  )
  const exportButton = (
    <>
      <button
        className="button button--quiet"
        type="button"
        disabled={!onExport || busy}
        onClick={() => {
          if (onExport && !busy) void runAction('export', onExport)
        }}
      >
        {pendingAction === 'export' ? '导出中…' : '导出'}
      </button>
    </>
  )
  const taskContent = (
    <>
      {currentStep === 1 && (
        <div className="asset-quick-read__panel">
          {!renderParts && <h3>读取登录数据</h3>}
          {!renderParts && (
            <p>
              {state === 'capturing'
                ? '请现在完整启动游戏并登录，收到所需数据后即可进入检查。'
                : '请保持游戏退出，等待资产快读实际就绪。'}
            </p>
          )}
          <div className="asset-quick-read__timing">
            {elapsed !== undefined && <span>已等待 {elapsed} 秒</span>}
            {remaining !== undefined && <span>剩余 {remaining} 秒</span>}
          </div>
          {elapsed === undefined && remaining === undefined && (
            <p className="asset-quick-read__muted">等待时间由资产快读反馈，当前尚未提供。</p>
          )}
        </div>
      )}
      {state === 'received' && (
        <div className="asset-quick-read__panel">
          <h3 ref={resultHeading} tabIndex={-1}>
            本次读取结果
          </h3>
          {preview ? (
            <>
              <p className="asset-quick-read__target">
                导入目标：<strong>{targetAccountName || '尚未选择目标账户'}</strong>
              </p>
              <dl className="asset-quick-read__counts">
                <div>
                  <dt>代理人</dt>
                  <dd>{preview.counts.agents} 位</dd>
                </div>
                <div>
                  <dt>S 级驱动盘</dt>
                  <dd>{preview.counts.discs} 张</dd>
                </div>
              </dl>
              {resultSummary.length > 0 && (
                <ul className="asset-quick-read__summary">
                  {resultSummary.map((summary, index) => (
                    <li key={index}>{summary}</li>
                  ))}
                </ul>
              )}
              {!importAvailable && preview.issues.length > 0 && (
                <div className="asset-quick-read__issues">
                  <h4>暂时不能导入</h4>
                  <ul>
                    {preview.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!renderParts && transactionNotice && <p>{transactionNotice}</p>}
              {!onImport && (
                <p className="asset-quick-read__muted">当前导入尚未接通，可先核对结果。</p>
              )}
              <div className="asset-quick-read__actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!importAvailable || actionBlocked}
                  onClick={importResult}
                >
                  {pendingAction === 'import' ? '导入中…' : '导入'}
                </button>
                {exportButton}
                {discardButton}
              </div>
            </>
          ) : (
            <>
              <p>等待资产快读提供可核对的结果预览。当前不能导入。</p>
              <div className="asset-quick-read__actions">{discardButton}</div>
            </>
          )}
        </div>
      )}
      {state === 'completed' && (
        <div className="asset-quick-read__complete">
          <CheckCircle2 aria-hidden="true" size={25} />
          <div>
            <h3>导入完成</h3>
            {status}
            <strong>{targetAccountName}</strong>
            <div className="asset-quick-read__actions">
              {onViewAssets && (
                <button className="button" type="button" disabled={busy} onClick={onViewAssets}>
                  查看我的资产
                </button>
              )}
              {onExport && exportButton}
              {onPrepareAgain && (
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={actionBlocked}
                  onClick={() => {
                    if (actionBlocked) return
                    setDisclosureOpen(false)
                    setAcknowledgedAccount(null)
                    void runAction('restart', onPrepareAgain)
                  }}
                >
                  重新读取
                </button>
              )}
              {completionActions}
            </div>
          </div>
        </div>
      )}
    </>
  )
  const beginButton = (
    <>
      <button
        className={
          renderParts && capability === 'ready' ? 'button button--primary' : 'button button--quiet'
        }
        type="button"
        aria-expanded={false}
        aria-controls={disclosureId}
        disabled={preparationBlocked || targetMissing}
        onClick={() => {
          if (!preparationBlocked && !targetMissing) setDisclosureOpen(true)
        }}
      >
        {renderParts && capability === 'ready' ? '开始读取' : '准备资产快读'}
      </button>
    </>
  )
  const disclosure = (
    <div
      key="quick-read-actions"
      className={disclosureOpen || renderParts ? 'asset-quick-read__disclosure' : undefined}
      id={disclosureId}
    >
      {!renderParts && !disclosureOpen && (
        <div className="asset-quick-read__actions">
          {beginButton}
          {onContinueScanning && (
            <button className="button button--quiet" type="button" onClick={onContinueScanning}>
              改用画面扫描
            </button>
          )}
        </div>
      )}
      {disclosureOpen && !renderParts && (
        <div>
          <h3>
            <AlertTriangle aria-hidden="true" size={20} />
            读取前确认
          </h3>
          {renderParts && riskNoticeHref ? (
            <>
              <p>读取需管理员权限和网络驱动；数据先供检查，确认导入后才更新账户。</p>
              <AssetCaptureRiskDetails label="完整风险说明" />
            </>
          ) : (
            <>
              <p>
                这是非官方实验功能，未取得米哈游对该读取方式的书面授权，也不代表官方认可或推荐。
              </p>
              <p>
                <strong>
                  读取正常登录产生的网络数据可能与游戏规则冲突，存在服务受限或账号封禁风险。处罚概率未知，不能保证账号安全。
                </strong>
                缺少公开封号报告也不能证明安全。
              </p>
              <p>
                资产快读需要管理员权限和本地网络驱动；配置查询需要联网。采集只接收网络数据副本，不修改游戏文件、不注入游戏进程，不修改或重放游戏通信。
              </p>
              <p>
                资产结果保存在本地，不上传资产快照、账号凭据、原始流量或密钥，不执行装备、升级或拆解。本次采集不写入
                Soda 账户；后续须先核对目标账户、数量和内容，再由你另行确认导入。
              </p>
              <p>
                未读到的潜能保留原值，游戏面板不采集。游戏更新或解析问题可能导致读取失败、缺失或错误。
              </p>
              <p>
                采集可停止，但已发出的配置请求不能撤回；已保存的本地结果不会自动删除，退出工具不等于卸载网络驱动。
              </p>
              <p>
                本声明仅用于告知边界与风险，不构成官方许可或账号安全保证，也不排除开发者依法应承担、不能免除的责任。
              </p>
            </>
          )}
          <label className="asset-quick-read__confirmation">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={preparationBlocked || !available}
              onChange={(event) =>
                setAcknowledgedAccount(event.target.checked ? riskAccountKey : null)
              }
            />
            <span>我已阅读上述风险，自主选择开始本次资产快读</span>
          </label>
          {!renderParts && (
            <div className="asset-quick-read__actions">
              <button
                className="button button--primary"
                type="button"
                disabled={!available || !acknowledged || preparationBlocked}
                onClick={() => void start()}
              >
                开始本次资产快读
              </button>
              <button className="button button--quiet" type="button" onClick={closeDisclosure}>
                关闭风险告知
              </button>
              {onContinueScanning && (
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => {
                    closeDisclosure()
                    onContinueScanning()
                  }}
                >
                  改用画面扫描或手动录入
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {renderParts && (
        <div className="asset-quick-read__actions">
          {capability !== 'ready' ? (
            connectionButton
          ) : (
            <button
              ref={startTriggerRef}
              className="button button--primary"
              type="button"
              disabled={!available || preparationBlocked}
              onClick={() => setDisclosureOpen(true)}
            >
              一键读取
            </button>
          )}
          {!renderParts && disclosureOpen && capability !== 'ready' && (
            <button className="button button--primary" type="button" disabled>
              开始本次资产快读
            </button>
          )}
          {installer}
          {!renderParts && disclosureOpen && (
            <button className="button button--quiet" type="button" onClick={closeDisclosure}>
              关闭风险告知
            </button>
          )}
          {onContinueScanning && (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => {
                closeDisclosure()
                onContinueScanning()
              }}
            >
              改用画面扫描或手动录入
            </button>
          )}
        </div>
      )}
    </div>
  )
  const stopButton = (
    <>
      {captureBusy && onStop && (
        <button
          className="button button--quiet"
          type="button"
          disabled={stopPending}
          onClick={() => void stop()}
        >
          {stopPending ? '正在停止…' : '停止本次资产快读'}
        </button>
      )}
    </>
  )
  const preparationTools = (
    <div key="quick-read-preparation" className="asset-quick-read__tools">
      {preparation}
    </div>
  )
  const preparationActions = !captureBusy && state !== 'received' ? disclosure : null
  if (renderParts)
    return (
      <ScannerPreparationStatus.Provider value={setInstallerStatus}>
        {renderParts({
          stageActive,
          preparation: (
            <section
              className="asset-quick-read asset-quick-read--compact"
              aria-labelledby={headingId}
            >
              {heading}
              {scope}
              <ScannerMethodSteps method="读取" currentStep={currentStep} />
              {!stageActive && (
                <div className="scanner-workbench__body scanner-workbench__body--prepare">
                  <div className="asset-quick-read__game-preparation">
                    <h4>准备游戏</h4>
                    <ul>
                      <li>完成游戏更新及首次着色器编译，然后完全退出客户端。</li>
                      <li>点击读取，等页面显示“已就绪”后再启动游戏并登录。</li>
                    </ul>
                  </div>
                  <div className="asset-quick-read__connection-summary">{status}</div>
                  {preparationActions}
                  {preparationTools}
                  {workbenchExtras}
                </div>
              )}
            </section>
          ),
          task: stageActive ? (
            <div className="asset-quick-read__task">
              {pendingInspection ? (
                <p role="status">正在检查本机资产快读文件，账户尚未修改。</p>
              ) : consentOpen ? (
                <AssetQuickReadConsentStage
                  acknowledged={acknowledged}
                  disabled={preparationBlocked || !available}
                  targetAccountName={targetAccountName}
                  onAcknowledge={(checked) =>
                    setAcknowledgedAccount(checked ? riskAccountKey : null)
                  }
                  onCancel={() => {
                    setDisclosureOpen(false)
                    setAcknowledgedAccount(null)
                    requestAnimationFrame(() =>
                      startTriggerRef.current?.focus({ preventScroll: true }),
                    )
                  }}
                  onStart={start}
                />
              ) : (
                <>
                  {state !== 'completed' &&
                    (state !== 'received' || pendingAction || errorMessage || actionError) &&
                    status}
                  {taskContent}
                  {stopButton}
                  {['error', 'stopped', 'timed_out'].includes(state) && (
                    <div className="asset-quick-read__retry">
                      {disclosure}
                      {preparationTools}
                    </div>
                  )}
                </>
              )}
              {workbenchExtras}
            </div>
          ) : null,
        })}
      </ScannerPreparationStatus.Provider>
    )
  return (
    <section className="asset-quick-read" aria-labelledby={headingId}>
      {heading}
      {steps}
      {scope}
      {state !== 'completed' && status}
      {preparation}
      {taskContent}
      {disclosure}
      {stopButton}
    </section>
  )
}
