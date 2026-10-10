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
import { ExplanationPopover } from '../components/ExplanationPopover'
import { assetQuickReadRelease } from '../assetQuickRead/distribution'
import './AssetQuickReadEntry.css'

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
  toolVersion?: string
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
  riskNoticeHref?: string
  installer?: ReactNode
  downloadAvailable?: boolean
  renderParts?: (parts: { preparation: ReactNode; task: ReactNode | null }) => ReactNode
}

const stateCopy: Record<AssetQuickReadState, string> = {
  idle: '本次资产快读尚未启动。',
  starting: '资产快读正在准备。请保持游戏客户端完全退出，等待工具就绪后再启动并登录。',
  capturing:
    '资产快读已就绪，请完整启动游戏并登录。最长等待 3 分钟；收到所需数据后立即反馈，不必等满 3 分钟。',
  received: '已收到数据，待核对。尚未导入 Soda 账户；请核对目标账户、读取数量和内容，再确认导入。',
  timed_out: '本次等待已结束，未收到所需的完整数据。请检查游戏准备情况后再尝试，或改用画面扫描。',
  stopped: '本次资产快读已停止。已保存的本地结果不会自动删除，网络驱动也不会自动卸载。',
  error: '本次资产快读未完成。请检查资产快读状态，或改用画面扫描。',
  completed: '本次资产快读结果已导入。',
}

type PendingAction = 'connect' | 'start' | 'import' | 'export' | 'inspect' | 'discard'
const actionErrors: Record<PendingAction | 'stop', string> = {
  connect: '资产快读连接未完成，请检查安装目录后重试。',
  start: '启动请求未完成，请检查资产快读状态后重试。',
  import: '导入请求未完成。请检查结果和目标账户，再次确认后重试。',
  export: '导出请求未完成，请重试。',
  inspect: '候选文件检查未完成，请重试。',
  discard: '关闭结果检查未完成，请重试；账户未修改。',
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
  preparationCondensed = false,
  onViewAssets,
  riskNoticeHref,
  installer,
  downloadAvailable = false,
  toolVersion,
  renderParts,
}: AssetQuickReadEntryProps) {
  const headingId = useId()
  const disclosureId = useId()
  const directoryId = useId()
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const [preparationExpanded, setPreparationExpanded] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(!installationDirectory)
  const [disclosureOpen, setDisclosureOpen] = useState(false)
  const [acknowledgedAccount, setAcknowledgedAccount] = useState<string | null>(null)
  const riskAccountKey = JSON.stringify([targetAccountId, targetAccountName])
  const acknowledged = acknowledgedAccount === riskAccountKey
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [stopPending, setStopPending] = useState(false)
  const [actionError, setActionError] = useState<PendingAction | 'stop' | null>(null)
  const [importConfirmation, setImportConfirmation] = useState<string | null>(null)
  const pendingActionRef = useRef(false)
  const stopPendingRef = useRef(false)
  const captureBusy = state === 'starting' || state === 'capturing' || pendingAction === 'start'
  const busy = captureBusy || pendingAction !== null || stopPending
  const actionBlocked = busy || blocked
  const hasTask = state !== 'idle' || pendingAction === 'start'
  const preparationBlocked = actionBlocked || state === 'received'
  const condensed = hasTask || preparationCondensed
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
  const confirmationKey = JSON.stringify([
    targetAccountId ?? targetAccountName,
    targetAccountName,
    preview?.snapshotId,
    preview?.counts.agents,
    preview?.counts.discs,
  ])
  const confirmedImport = importConfirmation === confirmationKey
  const importAvailable =
    state === 'received' &&
    Boolean(preview?.snapshotId) &&
    Boolean(targetAccountName.trim()) &&
    canImport &&
    Boolean(onImport)
  const elapsed = suppliedSeconds(elapsedSeconds)
  const remaining = suppliedSeconds(remainingSeconds)

  useEffect(() => {
    if (state === 'received' && preview?.snapshotId) resultHeading.current?.focus()
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
    try {
      await callback()
    } catch {
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
    setImportConfirmation(null)
    void runAction('start', onStart!)
  }

  function importResult() {
    if (
      !importAvailable ||
      !confirmedImport ||
      actionBlocked ||
      pendingActionRef.current ||
      stopPendingRef.current
    )
      return
    setImportConfirmation(null)
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
          <h3 id={headingId}>资产快读（实验）</h3>
        ) : (
          <h2 id={headingId}>资产快读（实验）</h2>
        )}
        {renderParts ? (
          <ExplanationPopover
            label="资产快读指南"
            closeLabel="关闭资产快读指南"
            className="asset-quick-read__guide-entry"
            align="start"
          >
            <p>资产快读 v{assetQuickReadRelease.version}；目前已验证国服 Windows 3.2。</p>
            <p>先完成游戏更新及首次着色器编译（Shader），再完全退出游戏客户端。</p>
            <p>
              工具实际就绪后，才完整启动游戏并登录。最长等待 180
              秒；收到所需完整数据后立即完成，不必等满 180 秒。
            </p>
            <p>
              游戏安装目录是包含 ZenlessZoneZero_Data
              的客户端目录，用于资产快读定位游戏；不是账户或结果文件目录。
            </p>
            <p>
              首次使用先下载资产快读安装包并打开，完成安装后回到本页连接。已安装时，点击连接会尝试打开资产快读，不会开始采集。
            </p>
            <p>
              <a
                href="https://github.com/Fizz-McBubble/soda-terminal-asset-quick-read"
                target="_blank"
                rel="noreferrer"
              >
                查看资产快读源码与版本
              </a>
            </p>
          </ExplanationPopover>
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
          代理人养成与 S 级驱动盘 · 需重启登录 · 最长 3 分钟，读到即完成
        </p>
      ) : (
        <p>
          读取已拥有代理人的真实养成和 S
          级驱动盘。当前已装备音擎详情用于现有配装，不建立音擎或邦布库存。
        </p>
      )}
    </>
  )
  const status = (
    <>
      <div className="asset-quick-read__status" role="status" aria-live="polite" aria-atomic="true">
        {renderParts && state === 'idle' ? (
          <strong className="asset-quick-read__tool-status">
            {capability === 'ready' ? '资产快读已连接' : '资产快读未连接'}
          </strong>
        ) : capability !== 'ready' && state === 'idle' ? (
          '资产快读尚未接通，当前暂不可用。'
        ) : state === 'completed' ? (
          (completionMessage ?? stateCopy.completed)
        ) : renderParts && state === 'idle' && capability === 'ready' ? (
          '资产快读已连接，可准备本次资产快读。'
        ) : (
          stateCopy[state]
        )}
        {capability === 'ready' && state === 'idle' && toolVersion && (
          <span className="asset-quick-read__tool-version">v{toolVersion}</span>
        )}
        {pendingAction === 'start' && state === 'idle' && (
          <p>正在提交本次启动请求，请等待工具反馈。</p>
        )}
        {pendingAction === 'connect' && <p>正在检查资产快读连接；本步骤不请求管理员权限。</p>}
        {pendingAction === 'import' && <p>正在提交确认后的导入，请等待结果。</p>}
        {errorMessage && <p>{errorMessage}</p>}
        {actionError && <p>{actionErrors[actionError]}</p>}
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
          if (onConnect && !preparationBlocked) void runAction('connect', onConnect)
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
            {renderParts && installationDirectory && !directoryOpen && (
              <div className="asset-quick-read__directory-summary">
                <span>游戏目录：{installationDirectory}</span>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={preparationBlocked}
                  onClick={() => setDirectoryOpen(true)}
                >
                  修改游戏目录
                </button>
              </div>
            )}
            {(!renderParts || directoryOpen || !installationDirectory) && (
              <>
                <label className="asset-quick-read__directory" htmlFor={directoryId}>
                  <Folder aria-hidden="true" size={17} />
                  游戏安装目录
                </label>
                <input
                  id={directoryId}
                  className="scanner-input asset-quick-read__input"
                  value={installationDirectory}
                  readOnly={!onDirectoryChange}
                  disabled={preparationBlocked}
                  maxLength={2048}
                  placeholder="选择包含 ZenlessZoneZero_Data 的游戏目录"
                  onChange={(event) => onDirectoryChange?.(event.target.value)}
                />
                {renderParts && installationDirectory.trim() && (
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={preparationBlocked}
                    onClick={() => setDirectoryOpen(false)}
                  >
                    收起目录编辑
                  </button>
                )}
              </>
            )}
            <p className="asset-quick-read__muted">
              {renderParts
                ? '连接仅检查工具；开始读取时才请求管理员权限。'
                : '先单独运行资产快读。这里只填写游戏目录，不读取账号密码。连接仅探测工具；开始读取时才请求管理员权限。'}
            </p>
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
                最长等待 180 秒；所需数据齐全后立即反馈。本机国服 3.2
                的关键字段已核对，潜能和最终面板未采集。
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
            setImportConfirmation(null)
            setAcknowledgedAccount(null)
            setDisclosureOpen(false)
            void runAction('discard', onDiscard)
          }}
        >
          放弃本次结果
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
        {pendingAction === 'export' ? '导出中…' : '导出本次读取结果'}
      </button>
    </>
  )
  const taskContent = (
    <>
      {currentStep === 1 && (
        <div className="asset-quick-read__panel">
          <h3>读取登录数据</h3>
          <p>
            {state === 'capturing'
              ? '请现在完整启动游戏并登录，收到所需数据后即可进入检查。'
              : '请保持游戏退出，等待资产快读实际就绪。'}
          </p>
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
            检查本次读取结果
          </h3>
          {preview ? (
            <>
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
              {preview.validSummary.length > 0 && (
                <ul className="asset-quick-read__summary">
                  {preview.validSummary.map((summary, index) => (
                    <li key={index}>{summary}</li>
                  ))}
                </ul>
              )}
              {preview.issues.length > 0 && (
                <div className="asset-quick-read__issues">
                  <h4>需要核对的问题</h4>
                  <ul>
                    {preview.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.agents.length > 0 && (
                <details open={!renderParts}>
                  <summary>代理人读取详情（{preview.agents.length} 位）</summary>
                  <ul className="asset-quick-read__agent-rows" aria-label="代理人读取预览">
                    {preview.agents.map((agent) => (
                      <li key={agent.agentId}>
                        <strong>{agent.name}</strong>
                        <span>
                          等级 {agent.level} · 影画 M{agent.mindscape}
                        </span>
                        {agent.skills && <span>{agent.skills}</span>}
                        {agent.wEngine && <span>当前音擎：{agent.wEngine}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="asset-quick-read__target">
                导入目标：<strong>{targetAccountName || '尚未选择目标账户'}</strong>
              </p>
              {transactionNotice && <p>{transactionNotice}</p>}
              {!onImport && (
                <p className="asset-quick-read__muted">当前导入尚未接通，可先核对结果。</p>
              )}
              <label className="asset-quick-read__confirmation">
                <input
                  type="checkbox"
                  checked={confirmedImport}
                  disabled={!importAvailable || actionBlocked}
                  onChange={(event) =>
                    setImportConfirmation(event.target.checked ? confirmationKey : null)
                  }
                />
                <span>
                  我确认这是同一个游戏账户，已核对代理人和驱动盘读取数量，导入到“
                  {targetAccountName || '未选择账户'}”
                </span>
              </label>
              <div className="asset-quick-read__actions">
                <button
                  className="button"
                  type="button"
                  disabled={!importAvailable || !confirmedImport || actionBlocked}
                  onClick={importResult}
                >
                  {pendingAction === 'import' ? '导入中…' : '确认导入本次资产快读结果'}
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
            <p>{completionMessage ?? '本次资产快读结果已进入所选账户。'}</p>
            <strong>{targetAccountName}</strong>
            <div className="asset-quick-read__actions">
              {onViewAssets && (
                <button className="button" type="button" disabled={busy} onClick={onViewAssets}>
                  查看我的资产
                </button>
              )}
              {onExport && exportButton}
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
      className={disclosureOpen ? 'asset-quick-read__disclosure' : undefined}
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
      {disclosureOpen && (
        <div>
          <h3>
            <AlertTriangle aria-hidden="true" size={20} />
            启用前，请阅读风险告知
          </h3>
          {renderParts && riskNoticeHref ? (
            <>
              <p>本次采集代理人养成与 S 级驱动盘，结果先在本机检查，确认导入前不写入 Soda 账户。</p>
              <p>
                非官方实验方式；存在服务受限或账号封禁风险，处罚概率未知，不能保证账号安全。开始读取需要管理员权限与本地网络驱动。
              </p>
              <p>
                <a href={riskNoticeHref}>阅读完整采集方式与风险说明</a>
              </p>
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
                本机国服 3.2
                的两次读取及关键显示字段已核对。其他账号、后续版本、完整响应状态与遗漏规则仍未验证；潜能和最终面板未采集。游戏更新、驱动兼容性和解析问题可能导致失败、缺失或错误。
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
          ) : disclosureOpen ? (
            <button
              className="button button--primary"
              type="button"
              disabled={!available || !acknowledged || preparationBlocked}
              onClick={() => void start()}
            >
              开始本次资产快读
            </button>
          ) : (
            beginButton
          )}
          {disclosureOpen && capability !== 'ready' && (
            <button className="button button--primary" type="button" disabled>
              开始本次资产快读
            </button>
          )}
          {installer}
          {disclosureOpen && (
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
    <details
      key="quick-read-preparation"
      className="asset-quick-read__tools"
      open={!condensed || preparationExpanded}
      onToggle={(event) => {
        if (condensed) setPreparationExpanded(event.currentTarget.open)
      }}
    >
      <summary hidden={!condensed}>资产快读准备</summary>
      {preparation}
    </details>
  )
  const preparationActions = !captureBusy && state !== 'received' ? disclosure : null
  if (renderParts)
    return renderParts({
      preparation: (
        <section className="asset-quick-read asset-quick-read--compact" aria-labelledby={headingId}>
          {heading}
          {scope}
          {['idle', 'error', 'stopped', 'timed_out'].includes(state) && (
            <div className="asset-quick-read__game-preparation">
              <h4>准备游戏</h4>
              <ul>
                <li>提前完成游戏更新与首次着色器编译。</li>
                <li>完全退出游戏客户端。</li>
                <li>等待页面显示工具就绪，再完整启动游戏并登录。</li>
              </ul>
            </div>
          )}
          {!hasTask ? (
            status
          ) : (
            <p className="asset-quick-read__tool-status">
              <strong>{capability === 'ready' ? '资产快读已连接' : '资产快读未连接'}</strong>
              {capability === 'ready' && toolVersion && (
                <span className="asset-quick-read__tool-version">v{toolVersion}</span>
              )}
            </p>
          )}
          {capability !== 'ready' && (
            <p className="asset-quick-read__muted">
              {downloadAvailable
                ? '首次使用先下载安装包，再回到本页连接；已安装时点击连接即可打开工具。'
                : '资产快读安装包尚未发布，当前不能下载；已安装用户可点击连接打开工具。'}
            </p>
          )}
          {capability === 'ready'
            ? [preparationTools, preparationActions]
            : [preparationActions, preparationTools]}
        </section>
      ),
      task: hasTask ? (
        <div className="asset-quick-read__task">
          {status}
          {taskContent}
          {stopButton}
        </div>
      ) : null,
    })
  return (
    <section className="asset-quick-read" aria-labelledby={headingId}>
      {heading}
      {steps}
      {scope}
      {status}
      {preparation}
      {taskContent}
      {disclosure}
      {stopButton}
    </section>
  )
}
