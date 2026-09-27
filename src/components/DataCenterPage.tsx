import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Download, FileJson2, ShieldAlert, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  createAccountBackup,
  createVaultBackup,
  getAccountBackupFilename,
  getVaultBackupFilename,
  restoreAccountBackup,
  restoreAccountBackupIndependently,
  restoreVaultBackup,
  type AccountBackup,
} from '../accounts/backup'
import {
  importRecognizedScanDataToActiveAccount,
  recognizeDataCenterFile,
  type DataCenterFileRecognition,
} from '../accounts/dataCenter'
import {
  createAccount,
  getActiveAccount,
  saveAccountPreference,
  setActiveAccount,
} from '../accounts/repository'
import { useAppHealth } from '../appHealthContext'
import { database } from '../db/database'
import { restoreBackup } from '../domain/backup'
import { persistScanImportStaging, reassessScanImportBatch } from '../db/database'
import { driveDiscData } from '../data/gameData'
import './account-backup-ux-r1.css'

const lastFullBackupPreference = 'data-center-last-full-backup-v1'
type FilePhase =
  | 'idle'
  | 'drag-over'
  | 'reading'
  | 'recognized'
  | 'needs-confirmation'
  | 'ready'
  | 'error'
  | 'success'

type FileState = {
  phase: FilePhase
  fileName: string | null
  fileSize: number | null
  recognition: DataCenterFileRecognition | null
  success: { title: string; detail: string; batchId?: string } | null
}

const idleFileState: FileState = {
  phase: 'idle',
  fileName: null,
  fileSize: null,
  recognition: null,
  success: null,
}

type PlayerDataSummary = {
  agents: number
  wEngines: number
  discs: number
  evaluations: number
  scanBatches: number
  scanItems: number
  optimizationResults: number
  preferences: number
}

function rosterSummary(
  roster: AccountBackup['data']['roster'],
): Pick<PlayerDataSummary, 'agents' | 'wEngines'> {
  return {
    agents: roster?.agents.filter((item) => item.owned).length ?? 0,
    wEngines: roster?.wEngines?.length ?? 0,
  }
}

function backupSummary(backup: AccountBackup): PlayerDataSummary {
  return {
    ...rosterSummary(backup.data.roster),
    discs: backup.counts.driveDiscs,
    evaluations: backup.counts.discEvaluations,
    scanBatches: backup.counts.scanBatches,
    scanItems: backup.counts.scanItems,
    optimizationResults: backup.counts.optimizationResults,
    preferences: backup.counts.preferences,
  }
}

function ScopeSummary({ title, summary }: { title: string; summary: PlayerDataSummary }) {
  return (
    <section className="data-center-scope-summary" aria-label={title}>
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>角色档案</dt>
          <dd>{summary.agents} 位代理人</dd>
        </div>
        <div>
          <dt>驱动盘</dt>
          <dd>{summary.discs} 张</dd>
        </div>
        <div>
          <dt>驱动盘评价与标签</dt>
          <dd>{summary.evaluations} 条评价</dd>
        </div>
        <div>
          <dt>扫描批次/暂存</dt>
          <dd>
            {summary.scanBatches} 个批次 / {summary.scanItems} 条暂存
          </dd>
        </div>
        <div>
          <dt>已保存配装方案/结果</dt>
          <dd>{summary.optimizationResults} 个</dd>
        </div>
        <div>
          <dt>账户偏好</dt>
          <dd>{summary.preferences} 项</dd>
        </div>
      </dl>
    </section>
  )
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function formatFileSize(size: number | null) {
  if (size === null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function recognitionPhase(recognition: DataCenterFileRecognition): FilePhase {
  if (recognition.kind === 'unknown' || recognition.errors.length > 0) return 'error'
  if (
    recognition.kind === 'account_backup' ||
    recognition.kind === 'vault_backup' ||
    recognition.kind === 'legacy_backup' ||
    recognition.counts.confirm > 0
  )
    return 'needs-confirmation'
  return 'ready'
}

function primaryActionLabel(recognition: DataCenterFileRecognition) {
  if (recognition.kind === 'scan_staging' && recognition.counts.confirm > 0)
    return `确认 ${recognition.counts.confirm} 条问题`
  if (recognition.kind === 'scan_data') return `导入 ${recognition.counts.add} 张驱动盘`
  if (recognition.kind === 'scan_staging') return `导入 ${recognition.counts.add} 张驱动盘`
  if (
    recognition.kind === 'account_backup' ||
    recognition.kind === 'vault_backup' ||
    recognition.kind === 'legacy_backup'
  )
    return '确认以备份完整替换本地数据'
  return '重新选择文件'
}

function FileIntake({
  state,
  disabled,
  onFile,
  onStateChange,
  onPrimaryAction,
  onReset,
  triggerRef,
}: {
  state: FileState
  disabled: boolean
  onFile: (file: File) => Promise<void>
  onStateChange: (phase: FilePhase) => void
  onPrimaryAction: () => Promise<void>
  onReset: () => void
  triggerRef?: RefObject<HTMLDivElement | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const openPicker = () => inputRef.current?.click()

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || isReading) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openPicker()
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (disabled || isReading) return
    dragDepth.current += 1
    onStateChange('drag-over')
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      onStateChange(state.recognition ? recognitionPhase(state.recognition) : 'idle')
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    if (disabled || isReading) return
    const file = event.dataTransfer.files[0]
    if (file) void onFile(file)
  }

  const isReading = state.phase === 'reading' || state.phase === 'recognized'
  return (
    <section className="data-center-file-flow" aria-live="polite" data-state={state.phase}>
      <div
        ref={triggerRef}
        aria-disabled={disabled || isReading}
        className="data-center-dropzone"
        onClick={() => {
          if (!disabled && !isReading) openPicker()
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <input
          ref={inputRef}
          accept="application/json,.json"
          aria-label="选择 soda-terminal-backup JSON 或扫描数据"
          disabled={disabled || isReading}
          hidden
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onFile(file)
            event.target.value = ''
          }}
        />
        {state.phase === 'drag-over' ? <Upload size={28} /> : <FileJson2 size={28} />}
        <strong>
          {state.phase === 'drag-over'
            ? '松开后识别文件'
            : state.phase === 'reading'
              ? '正在识别文件'
              : state.phase === 'recognized'
                ? '文件已识别，正在预检'
                : '选择文件或拖到这里'}
        </strong>
        <span>
          {state.fileName
            ? `${state.fileName} · ${formatFileSize(state.fileSize)}`
            : '支持扫描数据和 Soda Terminal 备份；系统会先识别，不会立即写入'}
        </span>
      </div>

      {state.recognition && state.phase !== 'success' && (
        <div className={`data-center-preflight ${state.phase === 'error' ? 'is-error' : ''}`}>
          <div className="data-center-preflight__title">
            {state.phase === 'error' ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
            <div>
              <span>{state.phase === 'error' ? '无法继续' : '文件已识别'}</span>
              <h3>{state.phase === 'error' ? state.recognition.label : '预检通过，尚未写入'}</h3>
              {state.phase !== 'error' && <p>{state.recognition.label}</p>}
            </div>
          </div>
          {state.recognition.kind !== 'unknown' && (
            <dl className="data-center-counts">
              <div>
                <dt>目标账号</dt>
                <dd>{state.recognition.targetAccountName ?? '全部账号'}</dd>
              </div>
              <div>
                <dt>总数</dt>
                <dd>{state.recognition.counts.total}</dd>
              </div>
              <div>
                <dt>新增</dt>
                <dd>{state.recognition.counts.add}</dd>
              </div>
              <div>
                <dt>跳过</dt>
                <dd>{state.recognition.counts.skip}</dd>
              </div>
              <div>
                <dt>需确认</dt>
                <dd>{state.recognition.counts.confirm}</dd>
              </div>
              <div>
                <dt>失败</dt>
                <dd>{state.recognition.counts.failed}</dd>
              </div>
            </dl>
          )}
          <p className={state.recognition.preservesOriginal ? 'safe-note' : 'danger-note'}>
            {state.recognition.preservesOriginal
              ? '原数据会保留；只有确认后的有效内容才会写入。'
              : `${state.recognition.replacementScope ?? '本地数据将被完整替换'}，不会合并。`}
          </p>
          {state.recognition.errors.slice(0, 3).map((error) => (
            <p key={error} className="danger-note">
              {error}
            </p>
          ))}
          {state.recognition.risks.slice(0, 2).map((risk) => (
            <p key={risk} className="muted-note">
              {risk}
            </p>
          ))}
          <div className="data-center-actions">
            {state.phase === 'error' ? (
              <button className="button button--primary" type="button" onClick={onReset}>
                重新选择文件
              </button>
            ) : (
              <button
                className="button button--primary"
                disabled={disabled || isReading}
                type="button"
                onClick={() => void onPrimaryAction()}
              >
                {primaryActionLabel(state.recognition)}
              </button>
            )}
          </div>
        </div>
      )}

      {state.phase === 'success' && state.success && (
        <div className="data-center-success">
          <CheckCircle2 size={24} />
          <div>
            <h3>{state.success.title}</h3>
            <p>{state.success.detail}</p>
            {state.success.batchId ? (
              <Link
                className="button button--primary"
                to={`/assets/discs?importBatch=${encodeURIComponent(state.success.batchId)}`}
              >
                查看本次导入
              </Link>
            ) : (
              <button className="button button--primary" type="button" onClick={onReset}>
                返回账号概览
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export function DataCenterPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data } = useAppHealth()
  const [revision, setRevision] = useState(0)
  const [fileState, setFileState] = useState<FileState>(idleFileState)
  const [busy, setBusy] = useState(false)
  const [createValue, setCreateValue] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [restoringAccount, setRestoringAccount] = useState(false)
  const [message, setMessage] = useState('')
  const [switchingAccountName, setSwitchingAccountName] = useState<string | null>(null)
  const [activatingAccountId, setActivatingAccountId] = useState<string | null>(null)
  const [activationError, setActivationError] = useState<string | null>(null)
  const [repreflightFeedback, setRepreflightFeedback] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [restoreConfirmation, setRestoreConfirmation] = useState<'replace' | 'independent' | null>(
    null,
  )
  const [restoreDisplayName, setRestoreDisplayName] = useState('')
  const restoreDialogRef = useRef<HTMLDivElement>(null)
  const restoreCancelRef = useRef<HTMLButtonElement>(null)
  const restoreTriggerRef = useRef<HTMLDivElement>(null)
  const createActionTriggerRef = useRef<HTMLButtonElement>(null)
  const restoreActionTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!restoreConfirmation) return
    window.requestAnimationFrame(() => restoreCancelRef.current?.focus())
  }, [restoreConfirmation])

  useEffect(() => {
    if (!restoringAccount) return
    window.requestAnimationFrame(() => restoreTriggerRef.current?.focus())
  }, [restoringAccount])

  const accountState = useLiveQuery(async () => {
    const active = await getActiveAccount()
    const accounts = await database.accounts.where('status').equals('active').toArray()
    const rawAccountSummaries = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        ...(await (async () => {
          const [
            discs,
            rosterRecord,
            evaluations,
            scanBatches,
            latestScanBatches,
            scanItems,
            optimizationResults,
            preferences,
          ] = await Promise.all([
            database.accountDriveDiscs.where('accountId').equals(account.id).count(),
            database.accountRosters.get(account.id),
            database.accountDiscEvaluations.where('accountId').equals(account.id).count(),
            database.accountScanImportBatches.where('accountId').equals(account.id).count(),
            database.accountScanImportBatches
              .where('accountId')
              .equals(account.id)
              .sortBy('updatedAt'),
            database.accountScanImportItems.where('accountId').equals(account.id).count(),
            database.accountOptimizationResults.where('accountId').equals(account.id).count(),
            database.accountPreferences.where('accountId').equals(account.id).count(),
          ])
          return {
            discs,
            agents: rosterRecord?.roster.agents.filter((agent) => agent.owned).length ?? 0,
            wEngines: rosterRecord?.roster.wEngines?.length ?? 0,
            evaluations,
            scanBatches,
            latestScanAt: latestScanBatches.at(-1)?.updatedAt ?? null,
            scanItems,
            optimizationResults,
            preferences,
          }
        })()),
      })),
    )
    const duplicateTotals = rawAccountSummaries.reduce<Record<string, number>>(
      (totals, account) => {
        totals[account.displayName] = (totals[account.displayName] ?? 0) + 1
        return totals
      },
      {},
    )
    const duplicateSeen: Record<string, number> = {}
    const accountSummaries = rawAccountSummaries.map((account) => {
      const duplicateOrdinal = (duplicateSeen[account.displayName] ?? 0) + 1
      duplicateSeen[account.displayName] = duplicateOrdinal
      return { ...account, duplicateOrdinal, duplicateTotal: duplicateTotals[account.displayName] }
    })
    if (!active)
      return {
        active: null,
        accounts: accountSummaries,
        agents: 0,
        wEngines: 0,
        discs: 0,
        lastBackup: null,
      }
    const [rosterRecord, discs, backupPreference] = await Promise.all([
      database.accountRosters.get(active.id),
      database.accountDriveDiscs.where('accountId').equals(active.id).count(),
      database.accountPreferences.get(`${active.id}:${lastFullBackupPreference}`),
    ])
    return {
      active,
      accounts: accountSummaries,
      agents: rosterRecord?.roster.agents.filter((agent) => agent.owned).length ?? 0,
      wEngines: rosterRecord?.roster.wEngines?.length ?? 0,
      discs,
      lastBackup: typeof backupPreference?.value === 'string' ? backupPreference.value : null,
    }
  }, [revision])

  async function inspectFile(file: File) {
    setFileState({
      phase: 'reading',
      fileName: file.name,
      fileSize: file.size,
      recognition: null,
      success: null,
    })
    setMessage('')
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      if (!data || !driveDiscData) throw new Error('游戏数据尚未加载，暂时无法安全预检。')
      setFileState({
        phase: 'recognized',
        fileName: file.name,
        fileSize: file.size,
        recognition: null,
        success: null,
      })
      const recognition = await recognizeDataCenterFile(parsed, {
        accountId: accountState?.active?.id ?? null,
        accountName: accountState?.active?.displayName ?? null,
        driveDiscSets: data.driveDiscSets,
        rules: driveDiscData.rules,
        gameDataVersion: driveDiscData.dataVersion,
      })
      setFileState({
        phase: recognitionPhase(recognition),
        fileName: file.name,
        fileSize: file.size,
        recognition,
        success: null,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '文件无法读取。'
      setFileState({
        phase: 'error',
        fileName: file.name,
        fileSize: file.size,
        recognition: {
          kind: 'unknown',
          label: '无法识别',
          targetAccountId: accountState?.active?.id ?? null,
          targetAccountName: accountState?.active?.displayName ?? null,
          counts: { total: 0, add: 0, skip: 0, confirm: 0, failed: 1 },
          preservesOriginal: true,
          replacementScope: null,
          errors: [`${detail} 原数据未变化。`],
          risks: [],
          input: null,
        },
        success: null,
      })
    }
  }

  async function executeRecognition() {
    const recognition = fileState.recognition
    if (!recognition || !data || !driveDiscData) return
    const accountId = accountState?.active?.id
    setBusy(true)
    try {
      if (recognition.kind === 'scan_data') {
        const result = await importRecognizedScanDataToActiveAccount(recognition, accountId, {
          driveDiscSets: data.driveDiscSets,
          rules: driveDiscData.rules,
          gameDataVersion: driveDiscData.dataVersion,
        })
        setFileState((current) => ({
          ...current,
          phase: 'success',
          success: {
            title: '扫描数据已导入',
            detail: `新增 ${result.summary.ready} 张，重复跳过 ${result.summary.skipped} 张，失败 ${result.summary.failed} 张。`,
            batchId: result.batchId,
          },
        }))
      } else if (recognition.kind === 'scan_staging') {
        if (recognition.counts.confirm > 0) {
          await persistScanImportStaging(recognition.staging, {
            driveDiscSets: data.driveDiscSets,
            rules: driveDiscData.rules,
            dataVersion: driveDiscData.dataVersion,
          })
          await reassessScanImportBatch(recognition.staging.batch.id, {
            driveDiscSets: data.driveDiscSets,
            rules: driveDiscData.rules,
            dataVersion: driveDiscData.dataVersion,
          })
          setMessage(`已载入 ${recognition.counts.confirm} 条需要确认的记录；请在下方完成确认。`)
        } else {
          throw new Error('该扫描暂存无需确认，请导出标准扫描数据后再导入。')
        }
      } else if (recognition.kind === 'account_backup') {
        const identity = recognition.backupPreflight.identity
        setRestoreDisplayName(`${recognition.targetAccountName ?? '玩家账户'}（恢复副本）`)
        setRestoreConfirmation(identity === 'same_name_different_id' ? 'independent' : 'replace')
      } else if (recognition.kind === 'vault_backup') {
        const count = await restoreVaultBackup(recognition.input)
        setFileState((current) => ({
          ...current,
          phase: 'success',
          success: { title: '保险库恢复完成', detail: `已完整恢复 ${count} 个账号。` },
        }))
      } else if (recognition.kind === 'legacy_backup') {
        if (!recognition.legacyPreflight.backup) return
        const counts = await restoreBackup(recognition.legacyPreflight.backup)
        setFileState((current) => ({
          ...current,
          phase: 'success',
          success: {
            title: '旧版备份恢复完成',
            detail: `已恢复 ${counts.driveDiscs} 张档案；原子事务已完成。`,
          },
        }))
      }
      setRevision((current) => current + 1)
    } catch (error) {
      const detail = error instanceof Error ? error.message : '操作失败。'
      setFileState((current) => ({
        ...current,
        phase: 'error',
        recognition: current.recognition
          ? { ...current.recognition, errors: [`${detail} 原数据未变化。`] }
          : current.recognition,
      }))
    } finally {
      setBusy(false)
    }
  }

  async function confirmAccountRestore() {
    const recognition = fileState.recognition
    if (recognition?.kind !== 'account_backup' || !restoreConfirmation) return
    setBusy(true)
    try {
      const result =
        restoreConfirmation === 'independent'
          ? await restoreAccountBackupIndependently(recognition.input, {
              displayName: restoreDisplayName,
            })
          : { counts: await restoreAccountBackup(recognition.input) }
      setRestoreConfirmation(null)
      setFileState((current) => ({
        ...current,
        phase: 'success',
        success: {
          title: '账号恢复完成',
          detail:
            restoreConfirmation === 'independent'
              ? `已作为独立玩家账户恢复 ${result.counts.driveDiscs} 张正式驱动盘，并设为当前账户。`
              : `已完整替换目标玩家账户：${result.counts.driveDiscs} 张正式驱动盘，并设为当前账户。`,
        },
      }))
      setRevision((current) => current + 1)
    } catch (error) {
      setRestoreConfirmation(null)
      const detail = error instanceof Error ? error.message : '恢复失败。'
      setFileState((current) => ({
        ...current,
        phase: 'error',
        recognition: current.recognition
          ? { ...current.recognition, errors: [`${detail} 本地账户数据未改动。`] }
          : current.recognition,
      }))
    } finally {
      setBusy(false)
    }
  }

  async function exportAccount(accountId = accountState?.active?.id) {
    const account = accountState?.accounts.find((candidate) => candidate.id === accountId)
    if (!account) return
    setBusy(true)
    try {
      const backup = await createAccountBackup(account.id)
      downloadJson(backup, getAccountBackupFilename(account.id))
      await saveAccountPreference(account.id, lastFullBackupPreference, backup.exportedAt)
      setMessage(`“${account.displayName}”的备份已下载。`)
      setRevision((current) => current + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '备份导出失败。')
    } finally {
      setBusy(false)
    }
  }

  async function exportVault() {
    setBusy(true)
    try {
      const backup = await createVaultBackup()
      downloadJson(backup, getVaultBackupFilename())
      setMessage('全部账号保险库备份已生成并下载。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保险库备份导出失败。')
    } finally {
      setBusy(false)
    }
  }

  async function selectAccount(accountId: string) {
    const nextAccount = accountState?.accounts.find((account) => account.id === accountId)
    setSwitchingAccountName(nextAccount?.displayName ?? '所选账户')
    try {
      await setActiveAccount(accountId)
      setFileState(idleFileState)
      setRevision((current) => current + 1)
    } finally {
      setSwitchingAccountName(null)
    }
  }

  async function activateLocalAccount(accountId: string) {
    const account = accountState?.accounts.find((candidate) => candidate.id === accountId)
    if (!account) return
    setActivatingAccountId(accountId)
    setActivationError(null)
    try {
      await setActiveAccount(accountId)
      setMessage(`已设为当前账户：${account.displayName}。`)
      setRevision((current) => current + 1)
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? `${error.message} 未切换，账户数据未改动。`
          : '未切换，账户数据未改动。请重试。',
      )
    } finally {
      setActivatingAccountId(null)
    }
  }

  async function saveNewAccount() {
    const displayName = createValue.trim()
    if (!displayName) {
      setMessage('请先填写新账户名称。')
      return
    }
    setBusy(true)
    try {
      const account = await createAccount(displayName)
      await setActiveAccount(account.id)
      setCreateValue('')
      setCreatingAccount(false)
      setFileState(idleFileState)
      setMessage(`已创建并切换到 ${account.displayName}。`)
      setRevision((current) => current + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '账户创建失败，原数据未变化。')
    } finally {
      setBusy(false)
    }
  }

  function closeInlineAction(action: 'create' | 'restore') {
    if (action === 'create') {
      setCreatingAccount(false)
      window.requestAnimationFrame(() => createActionTriggerRef.current?.focus())
      return
    }
    setRestoringAccount(false)
    window.requestAnimationFrame(() => restoreActionTriggerRef.current?.focus())
  }

  function handleInlineActionKeys(event: KeyboardEvent<HTMLElement>, action: 'create' | 'restore') {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    closeInlineAction(action)
  }

  function handleRestoreDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setRestoreConfirmation(null)
      window.requestAnimationFrame(() => restoreTriggerRef.current?.focus())
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), summary, a[href]',
      ),
    )
    if (!controls.length) return
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function previewRepreflight() {
    if (!accountState?.active) {
      setRepreflightFeedback('error')
      return
    }
    setRepreflightFeedback('loading')
    window.setTimeout(() => setRepreflightFeedback('success'), 0)
  }

  const pendingBackup =
    fileState.recognition?.kind === 'account_backup'
      ? fileState.recognition.backupPreflight.backup
      : undefined
  const backupScope = pendingBackup ? backupSummary(pendingBackup) : null
  const matchingLocalAccount = pendingBackup
    ? accountState?.accounts.find((account) => account.id === pendingBackup.account.id)
    : undefined
  const sameNameLocalAccounts = pendingBackup
    ? (accountState?.accounts.filter(
        (account) =>
          account.id !== pendingBackup.account.id &&
          account.displayName.toLocaleLowerCase() ===
            pendingBackup.account.displayName.toLocaleLowerCase(),
      ) ?? [])
    : []

  return (
    <div className="page-stack data-center-page account-backup-r1">
      {!embedded ? (
        <header className="workflow-header">
          <div>
            <h1>账户与备份</h1>
            <p>查看当前账户的数据状态，并在需要时安全处理备份。</p>
          </div>
        </header>
      ) : null}

      {message && (
        <p className="form-message" aria-live="polite">
          {message}
        </p>
      )}
      {!embedded ? (
        <section className="panel" aria-labelledby="data-center-scanner-heading">
          <div className="panel__header">
            <div>
              <span className="eyebrow">LOCAL TOOL</span>
              <h2 id="data-center-scanner-heading">扫描与导入</h2>
            </div>
          </div>
          <p>先在独立本地助手检查截图或扫描暂存 JSON；助手不会读取账户或直接导入。</p>
          <Link className="button button--quiet" to="/system/scanner">
            打开扫描助手
          </Link>
        </section>
      ) : null}
      <section aria-label="账户与备份" className="data-center-account account-backup-r1__workspace">
        {!embedded && (
          <article
            className="panel data-center-account-card"
            data-testid="data-center-account-summary"
          >
            <div className="panel__header">
              <div>
                <span className="eyebrow">当前玩家账户</span>
                <h2 id="data-center-account-heading">
                  {switchingAccountName
                    ? `正在切换到 ${switchingAccountName}…`
                    : (accountState?.active?.displayName ?? '尚未选择账号')}
                </h2>
              </div>
              <span className="status-pill">本地数据</span>
            </div>
            {switchingAccountName ? (
              <p role="status" aria-live="polite" className="form-message">
                正在切换到 {switchingAccountName}…
              </p>
            ) : accountState?.active ? (
              <>
                {embedded ? (
                  <section
                    className="data-center-account-stats"
                    aria-labelledby="account-status-heading"
                  >
                    <h3 id="account-status-heading">本地资产范围</h3>
                    <dl>
                      <div>
                        <dt>代理人</dt>
                        <dd>{accountState.agents}</dd>
                      </div>
                      <div>
                        <dt>驱动盘</dt>
                        <dd>{accountState.discs}</dd>
                      </div>
                      <div>
                        <dt>最近备份</dt>
                        <dd>
                          {accountState.lastBackup
                            ? new Date(accountState.lastBackup).toLocaleDateString()
                            : '尚未备份'}
                        </dd>
                      </div>
                    </dl>
                    <p className="safe-note">切换账户不会合并数据。</p>
                  </section>
                ) : (
                  <section
                    className="data-center-account-stats"
                    aria-labelledby="account-status-heading"
                  >
                    <h3 id="account-status-heading">账户数据状态</h3>
                    <dl>
                      <div>
                        <dt>驱动盘</dt>
                        <dd>{accountState.discs}</dd>
                      </div>
                      <div>
                        <dt>待复核</dt>
                        <dd>0</dd>
                      </div>
                      <div>
                        <dt>预检</dt>
                        <dd>待执行</dd>
                      </div>
                    </dl>
                    <div className="data-center-repreflight-action">
                      <p className="safe-note">所有待复核项已处理。下一步请重新预检。</p>
                      <button
                        className="button button--primary"
                        type="button"
                        disabled={repreflightFeedback === 'loading'}
                        aria-describedby="repreflight-note"
                        onClick={previewRepreflight}
                      >
                        {repreflightFeedback === 'loading' ? '正在重新预检…' : '重新预检（不导入）'}
                      </button>
                      <p id="repreflight-note" className="muted-note">
                        这一步只检查当前账户的复核结果，不会导入。导入仍需在预检通过后单独确认。
                      </p>
                    </div>
                    <Link className="button button--quiet" to="/system/data/import-discs">
                      导入驱动盘
                    </Link>
                    <Link className="button button--quiet" to="/system/scanner">
                      扫描与导入
                    </Link>
                    {repreflightFeedback === 'loading' && (
                      <p role="status" aria-live="polite" className="form-message">
                        正在准备重新预检；尚未导入数据。
                      </p>
                    )}
                    {repreflightFeedback === 'success' && (
                      <p role="status" aria-live="polite" className="form-message">
                        预检入口已准备好。本节点未执行预检，也未导入数据。
                      </p>
                    )}
                    {repreflightFeedback === 'error' && (
                      <p role="alert" className="danger-note">
                        尚未选择玩家账户，无法准备预检。
                      </p>
                    )}
                  </section>
                )}
              </>
            ) : accountState?.accounts.length ? (
              <section
                aria-labelledby="local-account-activation-heading"
                className="data-center-local-activation"
                data-testid="local-account-activation"
              >
                <h3 id="local-account-activation-heading">选择本机玩家账户继续</h3>
                <p className="muted-note">
                  请选择要继续使用的本机玩家账户。设为当前账户只会更新当前选择，不会修改账户数据。
                </p>
                <ul className="data-center-local-account-list">
                  {accountState.accounts.map((account) => (
                    <li key={account.id}>
                      <article className="data-center-local-account-card">
                        <div>
                          <h4>{account.displayName}</h4>
                          {account.duplicateTotal > 1 && (
                            <p className="muted-note">
                              同名本机账户 {account.duplicateOrdinal} / {account.duplicateTotal}
                            </p>
                          )}
                        </div>
                        <dl aria-label={`${account.displayName} 的本机数据摘要`}>
                          <div>
                            <dt>正式驱动盘</dt>
                            <dd>{account.discs}</dd>
                          </div>
                          <div>
                            <dt>代理人</dt>
                            <dd>{account.agents}</dd>
                          </div>
                        </dl>
                        <button
                          aria-label={`设为当前账户：${account.displayName}，${account.discs} 张正式驱动盘，${account.agents} 位代理人`}
                          className="button button--primary"
                          disabled={activatingAccountId !== null}
                          type="button"
                          onClick={() => void activateLocalAccount(account.id)}
                        >
                          {activatingAccountId === account.id
                            ? '正在设为当前账户…'
                            : '设为当前账户'}
                        </button>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="danger-note">尚未选择玩家账户。可新建账户，或检查备份文件。</p>
            )}
            {activationError && (
              <p role="alert" className="danger-note">
                未切换，账户数据未改动。{activationError} 请重试。
              </p>
            )}
          </article>
        )}

        <article className="panel data-center-account-tools">
          <div className="account-backup-r1__account-main">
            <header className="account-backup-r1__section-heading">
              <div>
                <h2 id="account-directory-heading">账户</h2>
                <p>{accountState?.accounts.length ?? 0} 个本机账户</p>
              </div>
            </header>
            {accountState?.accounts.length ? (
              <ul
                aria-labelledby="account-directory-heading"
                className="account-backup-r1__account-list"
              >
                {accountState.accounts.map((account) => {
                  const isCurrent = account.id === accountState.active?.id
                  return (
                    <li key={account.id}>
                      <article
                        aria-current={isCurrent ? 'true' : undefined}
                        className={`account-backup-r1__account-option ${isCurrent ? 'is-current' : ''}`}
                      >
                        <div className="account-backup-r1__account-option-heading">
                          <strong>{account.displayName}</strong>
                          <small>{isCurrent ? '当前账户' : '本机账户'}</small>
                        </div>
                        <dl className="account-backup-r1__account-option-counts">
                          <div>
                            <dt>代理人</dt>
                            <dd>{account.agents}</dd>
                          </div>
                          <div>
                            <dt>驱动盘</dt>
                            <dd>{account.discs}</dd>
                          </div>
                        </dl>
                        <dl className="account-backup-r1__account-option-dates">
                          <div>
                            <dt>创建</dt>
                            <dd>{new Date(account.createdAt).toLocaleDateString()}</dd>
                          </div>
                          <div>
                            <dt>最近扫描</dt>
                            <dd>
                              {account.latestScanAt
                                ? new Date(account.latestScanAt).toLocaleDateString()
                                : '暂无'}
                            </dd>
                          </div>
                        </dl>
                        <div className="account-backup-r1__account-option-actions">
                          {!isCurrent && (
                            <button
                              aria-label={`切换到账户：${account.displayName}，${account.agents} 位代理人，${account.discs} 张驱动盘`}
                              className="button button--quiet"
                              disabled={switchingAccountName !== null}
                              type="button"
                              onClick={() => void selectAccount(account.id)}
                            >
                              切换
                            </button>
                          )}
                          <button
                            className="button button--quiet"
                            disabled={busy}
                            type="button"
                            onClick={() => void exportAccount(account.id)}
                          >
                            备份
                          </button>
                          <button
                            aria-label={`删除账户：${account.displayName}`}
                            className="button button--danger"
                            disabled
                            type="button"
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="account-backup-r1__empty-account">
                尚无本机账户。新建账户只建立独立数据空间。
              </p>
            )}
          </div>

          <aside aria-label="账户操作" className="account-backup-r1__action-column">
            <div className="account-backup-r1__primary-actions">
              <button
                ref={createActionTriggerRef}
                aria-controls="account-create-panel"
                aria-expanded={creatingAccount}
                className="button button--primary account-backup-r1__create-trigger"
                disabled={busy}
                type="button"
                onClick={() => {
                  setCreatingAccount((current) => !current)
                  setRestoringAccount(false)
                }}
              >
                {creatingAccount ? '取消新建' : '＋ 新建账户'}
              </button>
              <button
                ref={restoreActionTriggerRef}
                aria-controls="account-restore-panel"
                aria-expanded={restoringAccount}
                className="button button--quiet"
                disabled={busy}
                type="button"
                onClick={() => {
                  setRestoringAccount((current) => !current)
                  setCreatingAccount(false)
                }}
              >
                {restoringAccount ? '取消恢复' : '恢复账户'}
              </button>
            </div>
            {creatingAccount && (
              <section
                id="account-create-panel"
                aria-label="新建账户"
                className="account-backup-r1__action-panel account-backup-r1__create"
                onKeyDown={(event) => handleInlineActionKeys(event, 'create')}
              >
                <label>
                  新账户名称
                  <input
                    autoFocus
                    maxLength={40}
                    placeholder="例如：第二套存档"
                    value={createValue}
                    onChange={(event) => setCreateValue(event.target.value)}
                  />
                </label>
                <div className="account-backup-r1__create-actions">
                  <button
                    className="button button--primary"
                    disabled={busy || !createValue.trim()}
                    type="button"
                    onClick={() => void saveNewAccount()}
                  >
                    创建并切换
                  </button>
                  <button
                    className="button button--quiet"
                    disabled={busy}
                    type="button"
                    onClick={() => closeInlineAction('create')}
                  >
                    取消
                  </button>
                </div>
              </section>
            )}
            {restoringAccount && (
              <section
                id="account-restore-panel"
                aria-label="恢复账户"
                className="account-backup-r1__action-panel"
                onKeyDown={(event) => handleInlineActionKeys(event, 'restore')}
              >
                <FileIntake
                  state={fileState}
                  disabled={busy}
                  onFile={inspectFile}
                  onStateChange={(phase) => setFileState((current) => ({ ...current, phase }))}
                  onPrimaryAction={executeRecognition}
                  onReset={() => setFileState(idleFileState)}
                  triggerRef={restoreTriggerRef}
                />
              </section>
            )}
          </aside>
        </article>

        {!embedded && (
          <section className="panel data-center-restore" aria-labelledby="account-backup-heading">
            <header className="account-backup-r1__section-heading">
              <div>
                <h2 id="account-backup-heading">当前账户备份与恢复</h2>
                <p>
                  {accountState?.active
                    ? `操作范围：${accountState.active.displayName}`
                    : '请先选择或创建账户；恢复文件仍可先检查。'}
                </p>
              </div>
            </header>
            <div className="data-center-actions">
              <button
                className="button button--primary"
                disabled={busy || !accountState?.active}
                type="button"
                onClick={() => void exportAccount()}
              >
                <Download size={17} /> 导出当前账户
              </button>
            </div>
            <p className="account-backup-r1__trust">
              <ShieldAlert size={17} />
              检查文件不会写入。恢复前会再次确认覆盖或独立副本；取消或失败时原数据保持不变。
            </p>
            <FileIntake
              state={fileState}
              disabled={busy}
              onFile={inspectFile}
              onStateChange={(phase) => setFileState((current) => ({ ...current, phase }))}
              onPrimaryAction={executeRecognition}
              onReset={() => setFileState(idleFileState)}
              triggerRef={restoreTriggerRef}
            />
          </section>
        )}

        {!embedded && (
          <section
            className="panel account-backup-r1__safety"
            aria-labelledby="account-safety-heading"
          >
            <div>
              <h2 id="account-safety-heading">全部账户与安全</h2>
              <p>导出本机全部账户；不会切换账户或改写资产。</p>
            </div>
            <div className="data-center-actions">
              <button
                className="button button--quiet"
                disabled={busy}
                type="button"
                onClick={() => void exportVault()}
              >
                备份全部账户
              </button>
              <button className="button button--quiet" disabled type="button">
                删除账户（尚未开放）
              </button>
            </div>
          </section>
        )}
      </section>
      {restoreConfirmation && pendingBackup && backupScope && (
        <div
          ref={restoreDialogRef}
          aria-describedby="account-restore-confirmation-detail"
          aria-labelledby="account-restore-confirmation-title"
          aria-modal="true"
          className="data-center-confirmation"
          onKeyDown={handleRestoreDialogKeys}
          role="dialog"
        >
          <section className="panel">
            <h2 id="account-restore-confirmation-title">
              {restoreConfirmation === 'independent'
                ? '作为独立玩家账户恢复'
                : `完整替换“${pendingBackup.account.displayName}”的数据？`}
            </h2>
            <p id="account-restore-confirmation-detail">
              {restoreConfirmation === 'independent'
                ? '发现同名账号，但不是同一账号。不会自动合并或覆盖。'
                : '将完整替换当前目标账号的以下范围。'}
            </p>
            {restoreConfirmation === 'independent' ? (
              <section aria-label="同名账户识别" className="data-center-identity-cards">
                <article>
                  <span className="eyebrow">备份账户</span>
                  <h3>{pendingBackup.account.displayName}</h3>
                  <p>备份日期：{new Date(pendingBackup.exportedAt).toLocaleDateString()}</p>
                  <p>
                    {backupScope.discs} 张驱动盘 / {backupScope.agents} 位代理人
                  </p>
                  <details>
                    <summary>高级信息</summary>
                    <p>识别码：…{pendingBackup.account.id.slice(-6)}</p>
                  </details>
                </article>
                {sameNameLocalAccounts.map((account) => (
                  <article key={account.id}>
                    <span className="eyebrow">本机同名账户</span>
                    <h3>{account.displayName}</h3>
                    <p>创建日期：{new Date(account.createdAt).toLocaleDateString()}</p>
                    <p>
                      {account.discs} 张驱动盘 / {account.agents} 位代理人
                    </p>
                    <details>
                      <summary>高级信息</summary>
                      <p>识别码：…{account.id.slice(-6)}</p>
                    </details>
                  </article>
                ))}
                <label>
                  恢复后的本地显示名称
                  <input
                    value={restoreDisplayName}
                    onChange={(event) => setRestoreDisplayName(event.target.value)}
                  />
                </label>
                <p className="safe-note">不会合并到现有同名账户，也不会替换它的数据。</p>
              </section>
            ) : (
              <section aria-label="恢复范围对照" className="data-center-restore-comparison">
                <ScopeSummary title="备份" summary={backupScope} />
                <ScopeSummary
                  title="当前本机"
                  summary={
                    matchingLocalAccount ?? {
                      agents: 0,
                      wEngines: 0,
                      discs: 0,
                      evaluations: 0,
                      scanBatches: 0,
                      scanItems: 0,
                      optimizationResults: 0,
                      preferences: 0,
                    }
                  }
                />
              </section>
            )}
            {restoreConfirmation === 'replace' && (
              <section className="data-center-confirmation-boundaries">
                <h3>不会覆盖</h3>
                <p>其他玩家账户、旧单账号数据和游戏数据包。</p>
                <h3>恢复后</h3>
                <p>目标账户会成为当前账户。恢复失败时，此账号仍保持恢复前的数据。</p>
              </section>
            )}
            <div className="data-center-actions">
              <button
                ref={restoreCancelRef}
                className="button button--quiet"
                type="button"
                onClick={() => {
                  setRestoreConfirmation(null)
                  window.requestAnimationFrame(() => restoreTriggerRef.current?.focus())
                }}
              >
                取消
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={() => void confirmAccountRestore()}
              >
                {restoreConfirmation === 'independent' ? '作为独立账号恢复' : '完整替换此账号'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
