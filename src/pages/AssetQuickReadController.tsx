import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  AssetQuickReadEntry,
  type AssetQuickReadPreview,
  type AssetQuickReadState,
} from './AssetQuickReadEntry'
import { AssetQuickReadBridgeClient, type AssetBridgeJob } from '../assetQuickRead/bridgeClient'
import {
  assetSnapshotSchema,
  convertAssetSnapshot,
  type AssetQuickReadCandidate,
} from '../assetQuickRead/snapshotAdapter'
import {
  confirmAssetQuickReadImport,
  prepareAssetQuickReadImport,
  readLatestAssetQuickReadRecovery,
  restoreAssetQuickReadImport,
  type AssetQuickReadImportPlan,
} from '../assetQuickRead/accountImport'
import { AssetQuickReadInstallerAction } from './AssetQuickReadInstallerAction'
import { assetQuickReadDownloadAvailable } from '../assetQuickRead/distribution'
import { setPublicScannerActiveAccount } from '../accounts/publicScannerAccountCreation'

type Bridge = Pick<AssetQuickReadBridgeClient, 'connect' | 'start' | 'status' | 'cancel' | 'result'>
export type AssetQuickReadWorkbenchView = {
  preparation: ReactNode
  task: ReactNode | null
  recovery: ReactNode | null
  state: AssetQuickReadState
  busy: boolean
  hasTask: boolean
  inspectFile: (file: File) => Promise<void>
}

type Props = {
  blocked?: boolean
  preparationCondensed?: boolean
  onViewAssets?: () => void
  riskNoticeHref?: string
  workbench?: (view: AssetQuickReadWorkbenchView) => ReactNode
  targetAccountId?: string
  targetAccountName?: string
  activeAccountId?: string
  onImported?: () => void
  onTaskStart?: () => void
  client?: Bridge
}
type Reviewed = {
  raw: unknown
  candidate: AssetQuickReadCandidate
  plan: AssetQuickReadImportPlan | null
  issue?: string
}
const message = (error: unknown) =>
  error instanceof Error && !error.name.startsWith('Zod')
    ? error.message
    : '结果结构不符合当前快读合同，未写入账户。'
const active = (job: AssetBridgeJob | null) =>
  job?.state === 'starting' || job?.state === 'capturing'

function previewOf(review: Reviewed): AssetQuickReadPreview {
  const { candidate, plan } = review
  return {
    snapshotId: candidate.snapshotSha256,
    counts: { agents: candidate.counts.importableAgents, discs: candidate.counts.sDiscs },
    validSummary: [
      ...(plan
        ? [
            `将新增 ${plan.summary.newDiscs} 张盘、更新 ${plan.summary.updatedDiscs} 张盘；保留未观测的 ${plan.summary.retainedDiscs} 张旧盘。`,
            `已保护 ${plan.summary.protectedFields} 个手动修改、锁定或较新的字段。`,
            ...(plan.summary.inferredDiscLinks
              ? [
                  `${plan.summary.inferredDiscLinks} 张旧扫描盘按完全相同属性对应物理实例，请同时核对盘数。`,
                ]
              : []),
          ]
        : []),
      ...(candidate.warnings ?? []),
    ],
    issues: [
      ...candidate.issues.map((issue) => issue.message),
      ...(review.issue ? [review.issue] : []),
    ],
    agents: candidate.agents.map((agent) => {
      const skills = agent.fields.skillLevels
      return {
        agentId: agent.agentId,
        name: agent.name,
        level: agent.fields.level!,
        mindscape: agent.fields.mindscape!,
        ...(skills
          ? {
              skills: `普攻 ${skills.basic} · 闪避 ${skills.dodge} · 支援 ${skills.assist} · 特殊 ${skills.special} · 连携 ${skills.chain} · 核心 ${String.fromCharCode(64 + (skills.core ?? 1) - 1) === '@' ? '未解锁' : String.fromCharCode(64 + (skills.core ?? 1) - 1)}`,
            }
          : {}),
        ...(agent.fields.wEngineDetails?.name ? { wEngine: agent.fields.wEngineDetails.name } : {}),
      }
    }),
  }
}

// Keep the workbench DOM stable; the account binding below invalidates owned work synchronously.
export function AssetQuickReadController(props: Props) {
  return <AccountBoundQuickRead {...props} />
}

function AccountBoundQuickRead({
  targetAccountId,
  targetAccountName,
  activeAccountId,
  onImported,
  onTaskStart,
  client: suppliedClient,
  blocked = false,
  preparationCondensed = false,
  onViewAssets,
  riskNoticeHref,
  workbench,
}: Props) {
  const [client] = useState<Bridge>(() => suppliedClient ?? new AssetQuickReadBridgeClient())
  const [connected, setConnected] = useState(false)
  const [directory, setDirectory] = useState('')
  const [state, setState] = useState<AssetQuickReadState>('idle')
  const [job, setJob] = useState<AssetBridgeJob | null>(null)
  const [review, setReview] = useState<Reviewed | null>(null)
  const [error, setError] = useState('')
  const [completion, setCompletion] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const [recoveryAvailable, setRecoveryAvailable] = useState(false)
  const [restoreArmed, setRestoreArmed] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const connectionAbort = useRef<AbortController | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const operationRef = useRef<string | null>(null)
  const operationId = useRef(0)
  const accountReady = Boolean(targetAccountId && targetAccountId === activeAccountId)
  const recoveryBusy = state === 'starting' || state === 'capturing' || active(job)
  const generation = useRef(0)
  const ownedJob = useRef<AssetBridgeJob | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    generation.current++
    connectionAbort.current?.abort()
    connectionAbort.current = null
    operationId.current++
    const owned = ownedJob.current
    ownedJob.current = null
    if (active(owned)) void client.cancel(owned!.jobId).catch(() => undefined)
    operationRef.current = null
    // This externally changed transaction identity must reset before paint, without remounting the shared workbench.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOperation(null)
    setConnected(false)
    setDirectory('')
    setJob(null)
    setReview(null)
    setState('idle')
    setError('')
    setCompletion('')
    setRecoveryKey('')
    setRecoveryAvailable(false)
    setRecoveryNotice('')
    setRestoreArmed(false)
    setRestoring(false)
    setSelecting(false)
  }, [targetAccountId, client])

  useEffect(() => {
    const guard = generation
    guard.current++
    return () => {
      guard.current++
      connectionAbort.current?.abort()
      const owned = ownedJob.current
      if (active(owned)) void client.cancel(owned!.jobId).catch(() => undefined)
    }
  }, [client])

  useEffect(() => {
    if (!targetAccountId || !accountReady || recoveryBusy || (state === 'completed' && recoveryKey))
      return
    let cancelled = false
    void readLatestAssetQuickReadRecovery(targetAccountId)
      .then((saved) => {
        if (cancelled) return
        setRecoveryKey(saved?.recoveryKey ?? '')
        setRecoveryAvailable(saved?.canRestore ?? false)
        setRecoveryNotice(
          saved
            ? (saved.unavailableReason ??
                `已保存 ${new Date(saved.createdAt).toLocaleString('zh-CN')} 的快读导入恢复副本。`)
            : '',
        )
      })
      .catch(() => {
        if (!cancelled)
          setRecoveryNotice('暂时无法读取快读恢复副本，请重新进入本页再试；账户未修改。')
      })
    return () => {
      cancelled = true
    }
  }, [targetAccountId, accountReady, recoveryBusy, state, recoveryKey])

  async function inspect(raw: unknown, sha256: string, scope: number) {
    if (generation.current !== scope) return
    const candidate = convertAssetSnapshot(raw, { snapshotSha256: sha256 })
    let plan: AssetQuickReadImportPlan | null = null
    let issue: string | undefined
    if (candidate.importable && targetAccountId) {
      try {
        plan = await prepareAssetQuickReadImport(targetAccountId, candidate)
      } catch (failure) {
        issue = message(failure)
      }
    } else if (!targetAccountId) issue = '请先在页面顶部选择目标账户，再检查这份文件。'
    if (generation.current !== scope) return
    setReview({ raw, candidate, plan, issue })
    setState('received')
  }

  useEffect(() => {
    if (!job || !active(job)) return
    let cancelled = false
    const scope = generation.current
    const currentJob = job
    const valid = () => !cancelled && generation.current === scope
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const latest = await client.status(currentJob.jobId)
          if (!valid()) return
          if (latest.jobId !== currentJob.jobId || latest.targetAccountId !== targetAccountId)
            throw new Error('独立工具任务与当前接收账户不一致，未采用结果。')
          ownedJob.current = latest
          if (latest.state === 'received') {
            const result = await client.result(latest.jobId)
            if (!valid()) return
            if (result.jobId !== latest.jobId || result.targetAccountId !== targetAccountId)
              throw new Error('读取结果的账户或任务不一致，未采用结果。')
            await inspect(result.snapshot, result.sha256, scope)
            if (valid()) setJob(latest)
          } else {
            setJob(latest)
            setState(latest.state)
            if (latest.state === 'error')
              setError('独立工具未完成本次读取，请核对游戏目录、管理员授权与准备状态后再试。')
          }
        } catch (failure) {
          if (valid()) {
            setError(message(failure))
            setState('error')
            if (active(ownedJob.current))
              void client.cancel(currentJob.jobId).catch(() => undefined)
          }
        }
      })()
    }, 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // The binding generation invalidates results when the selected account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, job, targetAccountId])

  async function performConnect(launchIfMissing = true) {
    const scope = generation.current
    const controller = new AbortController()
    connectionAbort.current = controller
    setError('')
    try {
      await client.connect({ launchIfMissing, signal: controller.signal })
      if (scope === generation.current) {
        setConnected(true)
        setState('idle')
      }
    } catch (failure) {
      if (scope === generation.current) {
        setConnected(false)
        setError(message(failure))
      }
      throw failure
    } finally {
      if (connectionAbort.current === controller) connectionAbort.current = null
    }
  }

  async function performStart() {
    if (!targetAccountId || !directory.trim()) throw new Error('请先选择账户并填写游戏安装目录。')
    const scope = ++generation.current
    onTaskStart?.()
    setError('')
    setReview(null)
    setRecoveryKey('')
    setRecoveryAvailable(false)
    setRecoveryNotice('')
    setRestoreArmed(false)
    setCompletion('')
    setState('starting')
    try {
      const started = await client.start(directory, targetAccountId)
      if (scope !== generation.current) {
        if (active(started)) await client.cancel(started.jobId)
        return
      }
      if (started.targetAccountId !== targetAccountId)
        throw new Error('工具未绑定到所选账户，未开始本次读取。')
      ownedJob.current = started
      setJob(started)
      setState(started.state)
    } catch (failure) {
      if (scope === generation.current) {
        setError(message(failure))
        setState('error')
      }
      throw failure
    }
  }

  async function performStop() {
    const scope = ++generation.current
    const owned = ownedJob.current
    try {
      if (active(owned)) {
        const stopped = await client.cancel(owned!.jobId)
        if (scope !== generation.current) return
        ownedJob.current = stopped
        setJob(stopped)
      }
      if (scope === generation.current) setState('stopped')
    } catch (failure) {
      if (scope === generation.current) {
        setError(message(failure))
        setState('error')
      }
      throw failure
    }
  }

  async function performInspectFile(file: File) {
    const scope = ++generation.current
    onTaskStart?.()
    setError('')
    setReview(null)
    setRecoveryKey('')
    setRecoveryAvailable(false)
    setRecoveryNotice('')
    setRestoreArmed(false)
    setCompletion('')
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error('候选文件超过 16 MiB，未读取。')
      const bytes = await file.arrayBuffer()
      if (generation.current !== scope) return
      const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
      await inspect(JSON.parse(new TextDecoder().decode(bytes)), sha, scope)
    } catch (failure) {
      if (scope === generation.current) {
        setError(
          failure instanceof SyntaxError ? '文件不是有效的 JSON，未读取。' : message(failure),
        )
        setState('error')
      }
    }
  }

  async function performImportResult() {
    if (!review?.plan || !targetAccountId) return
    const scope = generation.current
    try {
      const receipt = await confirmAssetQuickReadImport(review.candidate, review.plan, {
        accountId: targetAccountId,
        snapshotSha256: review.candidate.snapshotSha256,
        sameGameAccountAndCounts: true,
      })
      if (scope !== generation.current) return
      setRecoveryKey(receipt.recoveryKey)
      setRecoveryAvailable(true)
      setRecoveryNotice('本次导入前的恢复副本已保存在本机，重新进入本页仍可查看。')
      setCompletion(
        `已处理 ${receipt.observedAgents} 位代理人和 ${receipt.observedDiscs} 张 S 盘。账户盘库共 ${receipt.totalDiscs} 张；本次导入前的恢复副本已保存在本机。`,
      )
      setState('completed')
      onImported?.()
    } catch (failure) {
      if (scope === generation.current) {
        setError(message(failure))
        await inspect(review.raw, review.candidate.snapshotSha256, scope)
      }
      throw failure
    }
  }

  function exportResult() {
    if (!review) return
    // Whitelist the native asset structure; pairing/session/security fields are stripped.
    const safe = assetSnapshotSchema.parse(review.raw)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'soda-asset-quick-read.json'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function performRestore() {
    const scope = generation.current
    if (
      !restoreArmed ||
      !accountReady ||
      recoveryBusy ||
      !targetAccountId ||
      !recoveryKey ||
      !recoveryAvailable ||
      restoring
    )
      return
    setRestoring(true)
    setError('')
    try {
      await restoreAssetQuickReadImport(targetAccountId, recoveryKey, 'restore_asset_quick_read')
      if (scope !== generation.current) return
      setCompletion('已恢复到本次导入前，恢复副本继续保留。')
      setRecoveryKey('')
      setRecoveryAvailable(false)
      setRecoveryNotice('已恢复到这次快读导入前，恢复副本继续保留。')
      setRestoreArmed(false)
      onImported?.()
    } catch (failure) {
      if (scope === generation.current) setError(message(failure))
    } finally {
      if (scope === generation.current) setRestoring(false)
    }
  }

  async function performSelectTarget() {
    if (!targetAccountId || selecting || active(ownedJob.current)) return
    const scope = generation.current
    setSelecting(true)
    setError('')
    try {
      await setPublicScannerActiveAccount(targetAccountId)
      if (scope !== generation.current) return
      onImported?.()
      if (review) await inspect(review.raw, review.candidate.snapshotSha256, scope)
    } catch (failure) {
      if (scope === generation.current) setError(message(failure))
    } finally {
      if (scope === generation.current) setSelecting(false)
    }
  }

  const busy = recoveryBusy || operation !== null || restoring || selecting || downloading
  const hasTask = state !== 'idle' || Boolean(review) || operation === 'file'
  async function runOperation(name: string, action: () => Promise<void>) {
    if (blocked || operationRef.current || recoveryBusy || downloading) return
    const scope = generation.current
    const token = ++operationId.current
    operationRef.current = name
    setOperation(name)
    try {
      await action()
    } finally {
      if (operationId.current === token && operationRef.current === name) {
        operationRef.current = null
        if (
          generation.current === scope ||
          name === 'start' ||
          name === 'file' ||
          name === 'discard'
        )
          setOperation(null)
      }
    }
  }
  const connect = () => runOperation('connect', () => performConnect(true))
  const connectAfterInstallation = () => runOperation('connect', () => performConnect(false))
  const start = () => runOperation('start', performStart)
  const inspectFile = (file: File) => runOperation('file', () => performInspectFile(file))
  const importResult = () => runOperation('import', performImportResult)
  const restore = () => runOperation('restore', performRestore)
  const selectTarget = () => runOperation('select', performSelectTarget)
  const discardResult = () =>
    runOperation('discard', async () => {
      if (state !== 'received') return
      generation.current++
      ownedJob.current = null
      setJob(null)
      setReview(null)
      setError('')
      setCompletion('')
      setState('idle')
    })
  async function stop() {
    if (operationRef.current === 'stop') return
    const token = ++operationId.current
    operationRef.current = 'stop'
    setOperation('stop')
    try {
      await performStop()
    } finally {
      if (operationId.current === token && operationRef.current === 'stop') {
        operationRef.current = null
        setOperation(null)
      }
    }
  }

  const filePicker = (
    <input
      ref={fileInput}
      hidden
      type="file"
      accept=".json,application/json"
      aria-label="选择资产快读候选文件"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void inspectFile(file)
      }}
    />
  )
  const taskExtras = (
    <>
      {state === 'error' && active(job) && (
        <div className="asset-quick-read__recovery">
          <p>连接失败时工具可能仍在等待；先尝试停止本次独立任务，再重新连接。</p>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => void stop().catch(() => undefined)}
          >
            尝试停止本次独立任务
          </button>
        </div>
      )}
      {targetAccountId && !accountReady && !active(job) && (
        <div className="asset-quick-read__recovery">
          <p>先将“{targetAccountName}”设为当前接收账户，再开始快读或确认结果。</p>
          <button
            type="button"
            className="button button--quiet"
            disabled={blocked || busy}
            onClick={() => void selectTarget()}
          >
            {selecting ? '切换中…' : '使用所选接收账户'}
          </button>
        </div>
      )}
    </>
  )
  const recovery = (
    <>
      {recoveryNotice && !recoveryBusy && (
        <div className="asset-quick-read__recovery">
          <p>{recoveryNotice}</p>
          {recoveryKey && (
            <>
              <button
                type="button"
                className="button button--quiet"
                disabled={blocked || busy || !accountReady || !recoveryAvailable}
                onClick={() => setRestoreArmed(true)}
              >
                {state === 'completed' ? '恢复本次导入' : '恢复上次快读导入'}
              </button>
              {restoreArmed && (
                <div>
                  <p>
                    将恢复到本次导入前的代理人和盘库。导入后若有其他修改，会停止恢复，避免覆盖。
                  </p>
                  <button
                    type="button"
                    className="button"
                    disabled={blocked || busy || !accountReady || !recoveryAvailable}
                    onClick={() => void restore()}
                  >
                    {restoring ? '恢复中…' : '确认恢复到导入前'}
                  </button>
                  <button
                    type="button"
                    className="button button--quiet"
                    disabled={restoring}
                    onClick={() => setRestoreArmed(false)}
                  >
                    取消恢复
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
  const entry = (
    <AssetQuickReadEntry
      targetRequired
      preparationCondensed={preparationCondensed}
      onViewAssets={onViewAssets}
      downloadAvailable={assetQuickReadDownloadAvailable()}
      installer={
        workbench ? (
          <AssetQuickReadInstallerAction
            connected={connected}
            blocked={
              blocked ||
              recoveryBusy ||
              state === 'received' ||
              operation !== null ||
              restoring ||
              selecting
            }
            onConnect={connect}
            onReturnConnect={connectAfterInstallation}
            onBusyChange={setDownloading}
          />
        ) : undefined
      }
      riskNoticeHref={riskNoticeHref}
      blocked={blocked || operation !== null || restoring || selecting || downloading}
      capability={connected ? 'ready' : 'unavailable'}
      state={state}
      installationDirectory={directory}
      onDirectoryChange={setDirectory}
      onConnect={active(job) ? undefined : connect}
      targetAccountId={targetAccountId}
      targetAccountName={targetAccountName}
      onStart={accountReady && directory.trim() && !active(job) ? start : undefined}
      onStop={stop}
      onInspectFile={() => fileInput.current?.click()}
      preview={review ? previewOf(review) : undefined}
      canImport={accountReady && Boolean(review?.plan?.importable)}
      onImport={importResult}
      onDiscard={discardResult}
      onExport={review ? exportResult : undefined}
      elapsedSeconds={
        job?.readyAt && job.remainingSeconds !== null
          ? Math.max(0, 180 - job.remainingSeconds)
          : undefined
      }
      remainingSeconds={job?.readyAt ? (job.remainingSeconds ?? undefined) : undefined}
      transactionNotice="确认后会先保存本机恢复副本，再在同一事务中导入；保留手动修改、锁定字段与盘标签，不删除本次未观测资产。"
      errorMessage={
        error ||
        (connected && !targetAccountId
          ? '请先在页面顶部选择目标账户。'
          : connected && !directory.trim() && state === 'idle'
            ? '请填写游戏安装目录后准备快读。'
            : '')
      }
      completionMessage={completion}
      renderParts={
        workbench
          ? (parts) =>
              workbench({
                ...parts,
                preparation: (
                  <>
                    {parts.preparation}
                    {!hasTask && taskExtras}
                  </>
                ),
                task: hasTask ? (
                  <>
                    {parts.task ??
                      (operation === 'file' ? (
                        <p role="status">正在检查本机快读文件，账户尚未修改。</p>
                      ) : null)}
                    {taskExtras}
                  </>
                ) : null,
                recovery: recoveryNotice && !recoveryBusy ? recovery : null,
                state,
                busy,
                hasTask,
                inspectFile,
              })
          : undefined
      }
    />
  )
  return (
    <>
      {!workbench && filePicker}
      {entry}
      {!workbench && (
        <>
          {taskExtras}
          {recovery}
        </>
      )}
    </>
  )
}
