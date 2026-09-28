import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Clock3,
  Download,
  FileJson,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import {
  createPublicScannerAccount,
  setPublicScannerActiveAccount,
} from '../accounts/publicScannerAccountCreation'
import { F5ScannerGoldenView } from '../components/F5GoldenViews'
import { StatusBanner } from '../components/ui/StatusBanner'
import {
  preflightAccountScanReviewBatch,
  discardInvalidAccountScanStaging,
  repairCompletedAccountScanStaging,
  stageAccountPaddleScanImport,
} from '../db/accountScanImport'
import { database } from '../db/databaseCore'
import {
  publicScannerDriveDiscData,
  publicScannerSetIdentities,
} from '../application/publicScannerCatalog'
import { assessScannerAssistantInput } from '../scanner/assistant'
import { initialDistributionSnapshot, scannerDistributionManifest } from '../scanner/distribution'
import { type ScannerAssistantSnapshot, useScannerAssistantRuntime } from '../scanner/runtime'
import {
  activeScannerResultBatchSettingKey,
  scanResultHandleSettingKey,
} from '../scanner/resultHandoff'
import {
  clearScannerTargetAccountBinding,
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
  validateScannerTargetAccountBinding,
  type ScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import { ScannerAccountGate, type ScannerAccounts } from './ScannerAccountHydrationGate'
import { type HandoffState } from './scannerAssistantPresentation'
import { PrepareChecklist } from './ScannerPrepareChecklist'
import { createPrepareChecks } from './scannerPrepareChecks'
import { ScannerTargetAccountPicker } from './ScannerTargetAccountPicker'
import { FormalDiscImportPage } from './FormalDiscImportPage'

const discardedScannerResultHandleKey = 'soda.scanner.discardedResultHandle'
const completedScannerImportKey = 'soda.scanner.completedImport'

function playerResultMessage(message: string) {
  if (message.includes('不完整的同源识别结果'))
    return '上次保存的扫描结果不完整。可以重新读取本次结果，账户仓库尚未更新。'
  if (message.includes('不完整扫描草稿包含已导入记录'))
    return '这份扫描结果已有导入记录，不能清除。请恢复结果状态后继续，账户仓库不会被重复更新。'
  return message
}

type CompletedScannerImport = {
  count: number
  accountId: string
}

function readCompletedScannerImport(): CompletedScannerImport | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(completedScannerImportKey) ?? 'null')
    if (
      value &&
      typeof value.count === 'number' &&
      Number.isFinite(value.count) &&
      value.count >= 0 &&
      typeof value.accountId === 'string'
    )
      return value
  } catch {
    // A malformed local flag should never block a fresh scanner journey.
  }
  return null
}

function ScannerProgress({ snapshot }: { snapshot: ScannerAssistantSnapshot }) {
  const processed = snapshot.progress?.processed ?? 0
  const total = snapshot.progress?.total
  const hasTotal = total != null && total > 0
  const progress = hasTotal ? Math.min(100, Math.round((processed / total) * 100)) : null

  return (
    <div
      className="scanner-web__progress"
      aria-label={progress == null ? '扫描进度，总量待确认' : `扫描进度 ${progress}%`}
    >
      <div className="scanner-web__progress-heading">
        <div>
          <span>当前进度</span>
          <strong>
            {processed}
            <small>{hasTotal ? ` / ${total}` : ' 张已处理'}</small>
          </strong>
        </div>
        <b>{progress == null ? '总量待确认' : `${progress}%`}</b>
      </div>
      <progress
        aria-label={
          hasTotal ? `已处理 ${processed}，共 ${total}` : `已处理 ${processed}，总量待确认`
        }
        max={hasTotal ? total : undefined}
        value={hasTotal ? processed : undefined}
      >
        {progress == null ? '总量待确认' : `${progress}%`}
      </progress>
      <div className="scanner-web__progress-meta">
        <span>
          <LoaderCircle aria-hidden="true" size={16} />
          {snapshot.progress?.stageLabel}
        </span>
        <span>
          <Clock3 aria-hidden="true" size={16} />
          暂时无法估算剩余时间
        </span>
      </div>
    </div>
  )
}

function ScannerJourneyCards({ currentStep }: { currentStep: number }) {
  const steps = [{ label: '准备' }, { label: '扫描' }, { label: '检查' }, { label: '完成' }]

  return (
    <ol className="scanner-journey-cards" aria-label="扫描与导入进度">
      {steps.map((step, index) => {
        const state =
          index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'
        return (
          <li
            className={`scanner-journey-card is-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
            key={step.label}
          >
            <span aria-hidden="true">{state === 'complete' ? <Check size={14} /> : index + 1}</span>
            <div>
              <strong>{step.label}</strong>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ScannerAssistantPage() {
  return (
    <ScannerAccountGate>
      {(accountState, refreshAccounts) => (
        <HydratedScannerAssistantPage
          accountState={accountState}
          refreshAccounts={refreshAccounts}
        />
      )}
    </ScannerAccountGate>
  )
}

function HydratedScannerAssistantPage({
  accountState,
  refreshAccounts,
}: {
  accountState: ScannerAccounts
  refreshAccounts: () => void
}) {
  const { snapshot, commands } = useScannerAssistantRuntime()
  const [assessment, setAssessment] = useState(() => assessScannerAssistantInput({ kind: 'empty' }))
  const [selectedJson, setSelectedJson] = useState<File | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [handoffState, setHandoffState] = useState<HandoffState>({ status: 'idle' })
  const [inlineImportOpen, setInlineImportOpen] = useState(false)
  const [importedThisVisit, setImportedThisVisit] = useState(false)
  const [preparingAnotherScan, setPreparingAnotherScan] = useState(false)
  const [completedImport, setCompletedImport] = useState<CompletedScannerImport | null>(
    readCompletedScannerImport,
  )
  const [discardDraftConfirmationOpen, setDiscardDraftConfirmationOpen] = useState(false)
  const [discardedCompletedResultHandle, setDiscardedCompletedResultHandle] = useState(() =>
    window.localStorage.getItem(discardedScannerResultHandleKey),
  )
  const [targetBinding, setTargetBinding] = useState<ScannerTargetAccountBinding | null>(() => {
    const result = readScannerTargetAccountBinding()
    return result.valid ? result.binding : null
  })
  const discardDialogRef = useRef<HTMLDialogElement>(null)
  const discardTriggerRef = useRef<HTMLButtonElement>(null)
  const discardCancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!discardDraftConfirmationOpen) return
    const dialog = discardDialogRef.current
    const trigger = discardTriggerRef.current
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal()
    else dialog?.setAttribute('open', '')
    discardCancelRef.current?.focus()
    return () => {
      trigger?.focus()
    }
  }, [discardDraftConfirmationOpen])
  const inputRef = useRef<HTMLInputElement>(null)
  const stageHeadingRef = useRef<HTMLHeadingElement>(null)
  const stageFocusRequestedRef = useRef(false)
  const distribution = snapshot.distribution ?? initialDistributionSnapshot
  const canOpenInstalledHelper =
    !snapshot.readiness.helperConnected &&
    snapshot.error?.diagnosticCode !== 'helper_incompatible' &&
    scannerDistributionManifest.runtime.releaseState !== 'not_published'
  const prepareGateReady = useMemo(
    () => createPrepareChecks(snapshot).every((check) => check.status === 'ready'),
    [snapshot],
  )
  const effectiveSelectedAccountId =
    selectedAccountId || accountState?.activeAccount?.id || accountState?.accounts[0]?.id || ''
  const selectedAccount = accountState?.accounts.find(
    (account) => account.id === effectiveSelectedAccountId,
  )
  const targetReady = Boolean(selectedAccount)
  const completedImportCount =
    completedImport && completedImport.accountId === selectedAccount?.id
      ? completedImport.count
      : null
  const frozenTargetValidation = useMemo(() => {
    if (!targetBinding || !accountState)
      return {
        valid: false as const,
        message: '本次扫描尚未锁定目标账户。',
      }
    return validateScannerTargetAccountBinding({
      binding: targetBinding,
      targetAccount:
        accountState.accounts.find((account) => account.id === targetBinding.accountId) ?? null,
      activeAccount: accountState.activeAccount ?? null,
      currentDiscCount: accountState.discCounts.get(targetBinding.accountId) ?? 0,
    })
  }, [accountState, targetBinding])
  const frozenTargetIssue = useMemo(() => {
    if (!targetBinding || frozenTargetValidation.valid) return null
    const activeName = accountState?.activeAccount?.displayName ?? '尚未选择账户'
    const currentTarget = accountState?.accounts.find(
      (account) => account.id === targetBinding.accountId,
    )
    const currentDiscCount = accountState?.discCounts.get(targetBinding.accountId)
    const issueCode =
      'code' in frozenTargetValidation ? frozenTargetValidation.code : 'binding_missing'
    switch (issueCode) {
      case 'active_account_changed':
        return {
          title: '扫描目标与当前账户不一致',
          message: `本次扫描锁定“${targetBinding.displayName}”，当前账户为“${activeName}”。`,
        }
      case 'baseline_changed':
        return {
          title: '目标账户的仓库已经变化',
          message: `本次扫描锁定“${targetBinding.displayName}”时有 ${targetBinding.baselineDiscCount} 张驱动盘，当前为 ${currentDiscCount ?? 0} 张。`,
        }
      case 'target_account_changed':
        return {
          title: '目标账户资料已经变化',
          message: `本次扫描锁定“${targetBinding.displayName}”，当前账户名称为“${currentTarget?.displayName ?? activeName}”。`,
        }
      case 'target_account_missing':
        return {
          title: '扫描目标账户已不可用',
          message: `本次扫描锁定“${targetBinding.displayName}”，但该账户已不存在或不可用。`,
        }
      default:
        return {
          title: '需要重新确认扫描目标',
          message: `本次扫描原先锁定“${targetBinding.displayName}”。`,
        }
    }
  }, [accountState, frozenTargetValidation, targetBinding])
  const completedBindingIssue =
    targetBinding && !frozenTargetValidation.valid ? frozenTargetIssue : null

  const stateCopy = useMemo(() => {
    switch (snapshot.state) {
      case 'unchecked':
        return {
          eyebrow: '等待本机助手',
          title: '确认数据归属，然后检查并开始',
          body:
            window.location.protocol === 'https:'
              ? '首次使用先下载并安装扫描助手；已安装点击连接。连接后选择账户，再检查游戏。'
              : '点击后会切换到游戏，并自动检查扫描准备情况。',
        }
      case 'connection_failed':
        return snapshot.readiness.helperConnected
          ? {
              eyebrow: '扫描恢复',
              title: '本次扫描未完成',
              body: `${snapshot.error?.userMessage ?? '本机扫描没有完成。'}${snapshot.progress?.processed ? ` 本次已处理 ${snapshot.progress.processed} 张，部分结果不会作为完整仓库导入。` : ''} 请确认游戏已启动并显示完整驱动仓库，再重新切换到游戏。现有账户与上次结果不会被覆盖。`,
            }
          : {
              eyebrow: '连接恢复',
              title: '本机扫描助手尚未连接',
              body: `${snapshot.error?.userMessage ?? '扫描助手未就绪，可重新连接。'}${window.location.protocol === 'https:' ? ' 首次连接时，请允许浏览器访问本机设备；如果曾拒绝，请到此网站的浏览器权限设置中改为允许，再点击重新连接。' : ''}`,
            }
      case 'ready':
        return {
          eyebrow: !targetReady ? '等待选择账户' : prepareGateReady ? '准备检查已通过' : '等待本机核验',
          title: targetReady ? '切换到游戏，开始本地扫描' : '选择账户，再检查游戏',
          body: targetReady
            ? '已选择接收结果的本地账户。扫描只在本机读取，正式导入前仍会让你检查。'
            : '扫描助手已连接。选择接收结果的账户后，再检查游戏并开始扫描。',
        }
      case 'checking':
        return {
          eyebrow: '正在核验',
          title: '本机助手正在检查游戏与权限',
          body: '请求处理中不会重复创建扫描会话；检查通过后会自动进入扫描。',
        }
      case 'awaiting_elevation':
        return {
          eyebrow: '等待 Windows 权限',
          title: '请确认管理员权限提示',
          body: '常驻助手仍使用普通权限；只会为本次扫描启动一次受控的管理员子进程。',
        }
      case 'scanning':
        return {
          eyebrow: '正在本机处理',
          title: '正在读取游戏中的资产',
          body: '保持游戏窗口可见。扫描结果会先保存在本机，确认导入前不会改动账户。',
        }
      case 'completed':
        return {
          eyebrow: '扫描已完成',
          title: '结果已生成，先检查再导入',
          body: '扫描结果已保存在本机。请核对数量与接收账户，再确认导入。',
        }
      default:
        return {
          eyebrow: '正在接管并核验',
          title: '本机助手正在检查游戏画面',
          body: '助手会在全部准备门通过后立即开始；未通过时保持零输入并给出原因。',
        }
    }
  }, [
    prepareGateReady,
    snapshot.error?.userMessage,
    snapshot.progress,
    snapshot.readiness.helperConnected,
    snapshot.state,
    targetReady,
  ])

  useEffect(() => {
    if (
      !stageFocusRequestedRef.current ||
      snapshot.state === 'connecting' ||
      snapshot.state === 'checking' ||
      snapshot.state === 'awaiting_elevation'
    )
      return
    stageHeadingRef.current?.focus()
    stageFocusRequestedRef.current = false
  }, [snapshot.state])

  function runScannerAction(action: () => void | Promise<void>) {
    stageFocusRequestedRef.current = true
    setActionFeedback(null)
    void Promise.resolve(action()).catch((error) =>
      setActionFeedback(
        error instanceof Error && error.message.includes('扫描')
          ? error.message
          : '扫描助手未就绪，可重新连接。',
      ),
    )
  }

  async function freezeSelectedTarget() {
    if (!selectedAccount) throw new Error('请先选择本次扫描要更新的账户。')
    const current = await database.accounts.get(selectedAccount.id)
    if (!current || current.status !== 'active') throw new Error('目标账户已不存在，请重新选择。')
    await setPublicScannerActiveAccount(current.id, database)
    const baselineDiscCount = await database.accountDriveDiscs
      .where('accountId')
      .equals(current.id)
      .count()
    const binding = createScannerTargetAccountBinding({ account: current, baselineDiscCount })
    saveScannerTargetAccountBinding(binding)
    setTargetBinding(binding)
    refreshAccounts()
    setAccountMessage(`已锁定“${current.displayName}”，导入时将再次确认完整替换。`)
    return binding
  }

  async function startBoundScan() {
    setAccountMessage('')
    try {
      await freezeSelectedTarget()
      window.localStorage.removeItem(completedScannerImportKey)
      setCompletedImport(null)
      window.localStorage.removeItem(discardedScannerResultHandleKey)
      runScannerAction(() => commands.startScan())
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '无法锁定扫描目标账户。')
    }
  }

  async function createTargetAccount() {
    setAccountMessage('')
    try {
      const account = await createPublicScannerAccount(newAccountName, database)
      await setPublicScannerActiveAccount(account.id, database)
      setSelectedAccountId(account.id)
      setNewAccountName('')
      refreshAccounts()
      setAccountMessage(`已创建独立账户“${account.displayName}”，请确认后开始扫描。`)
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '无法创建账户。')
    }
  }

  async function returnToTargetSelection() {
    setPreparingAnotherScan(true)
    setInlineImportOpen(false)
    setHandoffState({ status: 'idle' })
    const completedResultHandle = snapshot.summary?.resultFileHandle
    if (completedResultHandle) {
      window.localStorage.setItem(discardedScannerResultHandleKey, completedResultHandle)
      setDiscardedCompletedResultHandle(completedResultHandle)
    }
    clearScannerTargetAccountBinding()
    setTargetBinding(null)
    setSelectedAccountId(accountState?.activeAccount?.id ?? '')
    setAccountMessage('请重新确认本次扫描保存到哪个账户。')
    stageFocusRequestedRef.current = true
    try {
      if (snapshot.state === 'scanning') await commands.safeStop()
      await commands.retryConnection()
    } catch {
      setAccountMessage('暂时无法返回准备步骤，请停止本次扫描后重试。')
    }
  }

  async function handOffResult(bindingOverride?: ScannerTargetAccountBinding, file?: File) {
    if (handoffState.status === 'working') return
    const binding =
      bindingOverride ?? (frozenTargetValidation.valid ? frozenTargetValidation.binding : null)
    if (!binding) {
      const message =
        'message' in frozenTargetValidation
          ? frozenTargetValidation.message
          : '本次扫描尚未锁定目标账户。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
      return
    }
    setHandoffState({ status: 'working', message: '正在读取扫描结果。' })
    setAccountMessage('正在检查扫描结果。')
    try {
      const result = file ? null : await commands.requestResultFile()
      const staging = file
        ? JSON.parse(await file.text())
        : await commands.requestResultStaging(result!.resultFileHandle)
      const staged = await stageAccountPaddleScanImport(binding.accountId, staging, database)
      if (result)
        await database.settings.put({
          key: scanResultHandleSettingKey(binding.accountId, staged.batch.id),
          value: result.resultFileHandle,
        })
      await database.settings.put({
        key: activeScannerResultBatchSettingKey(binding.accountId),
        value: staged.batch.id,
      })
      if (!publicScannerDriveDiscData)
        throw new Error('游戏资料尚未加载完成，请稍后重新查看扫描结果。')
      const preflight = await preflightAccountScanReviewBatch(
        binding.accountId,
        staged.batch.id,
        {
          driveDiscSets: publicScannerDriveDiscData.driveDiscSets,
          driveDiscSetIdentities: publicScannerSetIdentities,
          rules: publicScannerDriveDiscData.rules,
          dataVersion: publicScannerDriveDiscData.dataVersion,
        },
        database,
        staged.batch.reviewState.revision,
      )
      setPreparingAnotherScan(false)
      setInlineImportOpen(true)
      setHandoffState({
        status: 'success',
        message: preflight.complete
          ? `已检查 ${staged.summary.total} 张驱动盘，请确认更新账户。`
          : `已保留 ${staged.summary.total} 条结果，其中 ${preflight.needsReview} 条需要重新扫描；尚未更新账户。`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '暂时无法读取本次扫描结果，请重试。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
    }
  }

  async function discardIncompleteDraftAndRetry() {
    const binding = frozenTargetValidation.valid ? frozenTargetValidation.binding : null
    if (!binding) return
    setDiscardDraftConfirmationOpen(false)
    setHandoffState({ status: 'working', message: '正在重新读取扫描结果。' })
    try {
      await discardInvalidAccountScanStaging(binding.accountId, database)
      await handOffResult(binding)
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法安全清除不完整扫描草稿。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
    }
  }

  async function repairCompletedBatchAndRetry() {
    const binding = frozenTargetValidation.valid ? frozenTargetValidation.binding : null
    if (!binding) return
    setHandoffState({ status: 'working', message: '正在恢复扫描结果状态。' })
    try {
      await repairCompletedAccountScanStaging(binding.accountId, database)
      await handOffResult(binding)
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法恢复这次扫描结果，请重新扫描。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
    }
  }

  async function bindCompletedResultToSelectedAccount() {
    if (handoffState.status === 'working') return
    if (!selectedAccount) {
      const message = '请先选择本次扫描结果归属的账户。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
      return
    }
    try {
      const current = await database.accounts.get(selectedAccount.id)
      if (!current || current.status !== 'active') throw new Error('所选账户已不可用，请重新选择。')
      await setPublicScannerActiveAccount(current.id, database)
      const baselineDiscCount = await database.accountDriveDiscs
        .where('accountId')
        .equals(current.id)
        .count()
      const binding = createScannerTargetAccountBinding({ account: current, baselineDiscCount })
      saveScannerTargetAccountBinding(binding)
      setTargetBinding(binding)
      refreshAccounts()
      setAccountMessage(`已确认“${binding.displayName}”作为本次已有结果的归属账户。`)
      await handOffResult(binding)
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法确认本次扫描结果归属。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
    }
  }

  async function handOffFallbackJson() {
    try {
      if (!selectedJson) return
      const binding = await freezeSelectedTarget()
      await handOffResult(binding, selectedJson)
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '无法锁定扫描目标账户。')
    }
  }

  async function inspectJson(file: File | undefined) {
    if (!file) return
    setSelectedJson(null)
    const text = await file.text()
    const next = assessScannerAssistantInput({ kind: 'json', name: file.name, text })
    setAssessment(next)
    if (next.canHandOff) setSelectedJson(file)
  }

  const resultEligibleForFormalReview =
    snapshot.summary?.resultStatus === 'ready_for_review' ||
    snapshot.summary?.resultStatus === 'needs_review'
  const restartingAfterCompletedResult =
    snapshot.state === 'completed' &&
    Boolean(snapshot.summary?.resultFileHandle) &&
    discardedCompletedResultHandle === snapshot.summary?.resultFileHandle
  const nextScanHasAdvanced =
    ['checking', 'awaiting_elevation', 'scanning', 'paused'].includes(snapshot.state) ||
    (snapshot.state === 'completed' &&
      Boolean(snapshot.summary?.resultFileHandle) &&
      snapshot.summary?.resultFileHandle !== discardedCompletedResultHandle)
  const preparingNewScan = preparingAnotherScan && !nextScanHasAdvanced
  const showImportComplete =
    completedImportCount !== null &&
    !inlineImportOpen &&
    !restartingAfterCompletedResult &&
    !preparingNewScan
  const visualState =
    restartingAfterCompletedResult || preparingNewScan
      ? 'ready'
      : snapshot.state === 'completed'
        ? completedBindingIssue
          ? 'review_required'
          : frozenTargetValidation.valid && resultEligibleForFormalReview
            ? 'import_ready'
            : 'completed'
        : snapshot.state
  const scanIdentityEvidence = targetBinding
    ? {
        source: '既有扫描绑定',
        value: targetBinding.displayName,
      }
    : {
        source: '当前结果未提供',
        value: '未知',
      }
  const currentReceivingAccountName = selectedAccount?.displayName ?? '尚未选择接收账户'
  const accountDisclosure = selectedAccount ? (
    <p className="scanner-target-account__summary">
      <strong>
        {(accountState?.discCounts.get(selectedAccount.id) ?? 0) === 0
          ? '建立驱动盘仓库'
          : '更新此账户仓库'}
      </strong>
      <span>
        “{selectedAccount.displayName}”当前
        {(accountState?.discCounts.get(selectedAccount.id) ?? 0) === 0
          ? '为空仓库'
          : `有 ${accountState?.discCounts.get(selectedAccount.id) ?? 0} 张驱动盘`}
        ；确认后完整替换此账户的驱动盘，不合并。扫描期间不会改动账户。
      </span>
    </p>
  ) : null
  const installer =
    distribution.state !== 'ready' &&
    scannerDistributionManifest.runtime.releaseState !== 'not_published' ? (
      <a
        className="button button--quiet scanner-prepare__download"
        href={scannerDistributionManifest.helper.downloadUrl}
        download
        title="首次安装或修复扫描助手"
      >
        <Download aria-hidden="true" size={17} />
        下载扫描助手
      </a>
    ) : null
  const presentedStateCopy =
    restartingAfterCompletedResult || preparingNewScan
      ? {
          eyebrow: '开始新的扫描',
          title: selectedAccount ? '确认账户，然后开始本地扫描' : '创建账户，然后开始本地扫描',
          body: selectedAccount
            ? '已导入的驱动盘会保留；新扫描结果需检查并确认后才会更新账户。'
            : '已有账户中的驱动盘会保留。先创建接收账户；新扫描结果需检查并确认后才会更新账户。',
        }
      : completedImportCount !== null
        ? {
            eyebrow: '驱动盘已更新',
            title: '驱动盘已进入当前账户',
            body: `已更新 ${completedImportCount} 张驱动盘。现在可以继续配队或检查仓库建议。`,
          }
        : snapshot.state === 'completed' && !selectedAccount
          ? {
              eyebrow: '先确定接收账户',
              title: '创建账户后检查本次结果',
              body: '扫描结果已保存在本机。先创建接收账户，再检查结果；创建账户不会自动导入。',
            }
          : visualState === 'review_required'
            ? {
                eyebrow: '账户需要复核',
                title: '先确认这是你的本地账户',
                body: `扫描识别为${scanIdentityEvidence.value}，当前接收账户是${currentReceivingAccountName}。确认归属前，不开放正式导入。`,
              }
            : visualState === 'import_ready'
              ? {
                  eyebrow: '归属检查已通过',
                  title: '结果已就绪，请检查导入条件',
                  body: '接收账户已确认，下一步检查识别结果是否完整。',
                }
              : stateCopy
  const journeyStep =
    preparingNewScan || restartingAfterCompletedResult
      ? 0
      : inlineImportOpen
        ? 2
        : completedImportCount !== null
          ? 3
          : snapshot.state === 'completed'
            ? 2
            : ['scanning', 'paused'].includes(snapshot.state)
              ? 1
              : 0
  const resultSummary =
    snapshot.state === 'completed' ? (
      <div className="scanner-web__summary" aria-label="驱动盘导入摘要">
        <article>
          <AlertTriangle aria-hidden="true" size={20} />
          <span>本次结果</span>
          <strong>{snapshot.summary?.uniqueRecords ?? 0}</strong>
          <small>
            可直接导入 {snapshot.summary?.reliable ?? 0} · 待检查{' '}
            {snapshot.summary?.needsReview ?? 0}
          </small>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>更新账户</span>
          <strong>{completedImportCount ?? 0}</strong>
          <small>
            {completedImportCount === null ? '确认导入前不会改动账户' : '当前账户已更新'}
          </small>
        </article>
      </div>
    ) : null
  const newAccountControls = (
    <div className="scanner-target-account__create">
      <label>
        <span id="scanner-target-account-heading">新账户名称</span>
        <input
          className="scanner-input"
          aria-label="新账户名称"
          maxLength={40}
          value={newAccountName}
          onChange={(event) => setNewAccountName(event.target.value)}
          placeholder="例如：我的主账号"
        />
      </label>
      <button
        className="button button--quiet"
        type="button"
        disabled={!newAccountName.trim()}
        onClick={() => void createTargetAccount()}
      >
        {snapshot.state === 'completed' && !restartingAfterCompletedResult
          ? '创建账户并继续检查'
          : '创建并用于本次扫描'}
      </button>
    </div>
  )

  return (
    <F5ScannerGoldenView
      runtimeState={snapshot.state}
      visualState={visualState}
      task={
        <section className="scanner-task" aria-labelledby="scanner-page-heading">
          <header className="scanner-task__top">
            <div>
              <h1 id="scanner-page-heading">扫描与导入</h1>
              <p>扫描游戏中的驱动盘，核对结果后，由你确认导入当前账户。</p>
            </div>
          </header>
          <ScannerJourneyCards currentStep={journeyStep} />
          {showImportComplete ? (
            <section className="scanner-import-complete" aria-label="已导入扫描结果">
              <div className="scanner-task__completion" role="status" aria-live="polite">
                <CheckCircle2 aria-hidden="true" size={28} />
                <div>
                  <h2 id="scanner-stage-heading" ref={stageHeadingRef} tabIndex={-1}>
                    {importedThisVisit ? '驱动盘已进入当前账户' : '上次导入已完成'}
                  </h2>
                  <span>
                    {completedImportCount} 张驱动盘已更新至
                    {selectedAccount?.displayName ? `“${selectedAccount.displayName}”` : '当前账户'}
                  </span>
                </div>
              </div>
              <div className="scanner-import-complete__next">
                <button
                  className="button button--primary scanner-web__primary-action"
                  type="button"
                  onClick={() => void returnToTargetSelection()}
                >
                  重新扫描
                </button>
                <Link className="button button--quiet" to="/assets/discs">
                  查看驱动盘
                </Link>
                <p>重新扫描不会改动已导入的驱动盘，新结果仍需检查并确认。</p>
              </div>
            </section>
          ) : null}
          {actionFeedback ? (
            <p className="scanner-task__feedback is-error" role="alert" aria-live="polite">
              {actionFeedback}
            </p>
          ) : null}
          {!showImportComplete &&
          !inlineImportOpen &&
          ['scanning', 'completed'].includes(snapshot.state) &&
          !restartingAfterCompletedResult &&
          !preparingNewScan ? (
            <div className="scanner-task__state-copy">
              <h2 id="scanner-stage-heading" ref={stageHeadingRef} tabIndex={-1}>
                {presentedStateCopy.title}
              </h2>
              <p>{presentedStateCopy.body}</p>
            </div>
          ) : null}

          {!showImportComplete &&
          !inlineImportOpen &&
          ([
            'unchecked',
            'connecting',
            'checking',
            'awaiting_elevation',
            'connection_failed',
            'ready',
          ].includes(snapshot.state) ||
            restartingAfterCompletedResult ||
            preparingNewScan) ? (
            <PrepareChecklist
              snapshot={snapshot}
              eyebrow={presentedStateCopy.eyebrow}
              title={presentedStateCopy.title}
              body={presentedStateCopy.body}
              headingRef={stageHeadingRef}
              targetReady={targetReady}
              installer={installer}
              accountDisclosure={accountDisclosure || accountMessage ? (
                <>
                  {accountDisclosure}
                  {accountMessage ? (
                    <p role={targetReady ? 'status' : 'alert'} aria-live="polite">
                      {playerResultMessage(accountMessage)}
                    </p>
                  ) : null}
                </>
              ) : null}
              targetPanel={
                <li
                  className={`scanner-target-account is-${targetReady ? 'ready' : 'blocked'}`}
                  aria-labelledby="scanner-target-account-heading"
                >
                  <span className="scanner-prepare__check-icon" aria-hidden="true">
                    {targetReady ? (
                      <Check size={16} strokeWidth={3} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                  </span>
                  <div className="scanner-target-account__content">
                    {accountState?.accounts.length ? (
                      <>
                        <ScannerTargetAccountPicker
                          accounts={accountState.accounts.map((account) => ({
                            id: account.id,
                            displayName: account.displayName,
                            discCount: accountState.discCounts.get(account.id) ?? 0,
                          }))}
                          selectedAccountId={effectiveSelectedAccountId}
                          onSelect={(accountId) => {
                            setSelectedAccountId(accountId)
                            setAccountMessage('')
                          }}
                        />
                        <div className="scanner-target-account__create" aria-label="新建独立账户">
                          <label>
                            新账户名称
                            <input
                              className="scanner-input"
                              aria-label="新账户名称"
                              maxLength={40}
                              value={newAccountName}
                              onChange={(event) => setNewAccountName(event.target.value)}
                              placeholder="例如：我的主账号"
                            />
                          </label>
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={!newAccountName.trim()}
                            onClick={() => void createTargetAccount()}
                          >
                            创建并用于本次扫描
                          </button>
                        </div>
                      </>
                    ) : (
                      newAccountControls
                    )}
                  </div>
                </li>
              }
              onRecover={
                canOpenInstalledHelper
                  ? () => void runScannerAction(() => commands.openHelper(true))
                  : undefined
              }
              onReconnect={() => void runScannerAction(() => commands.retryConnection())}
              onRevoke={() => void runScannerAction(() => commands.revokePairing())}
              onStart={() => void startBoundScan()}
            />
          ) : null}

          {snapshot.state === 'scanning' ? (
            <>
              {targetBinding ? (
                <p className="scanner-target-account__frozen" role="status">
                  本次扫描目标：{targetBinding.displayName} · 替换前{' '}
                  {targetBinding.baselineDiscCount} 张
                </p>
              ) : (
                <p className="danger-note" role="alert">
                  本次扫描缺少目标账户绑定；结果不会进入正式导入。
                </p>
              )}
              {frozenTargetIssue ? (
                <StatusBanner
                  className="scanner-target-mismatch"
                  tone="error"
                  title={frozenTargetIssue.title}
                  action={
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => void returnToTargetSelection()}
                    >
                      返回准备步骤重新选择
                    </button>
                  }
                >
                  <p>{frozenTargetIssue.message}</p>
                </StatusBanner>
              ) : null}
              <div className="scanner-web__interaction-lock" role="alert">
                <AlertTriangle aria-hidden="true" size={20} />
                <p>
                  <strong>扫描期间请不要操作游戏</strong>
                  <span>不要使用鼠标键盘、切换游戏页面或最小化窗口。</span>
                </p>
              </div>
              <ScannerProgress snapshot={snapshot} />
              <div className="scanner-web__scan-actions">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => runScannerAction(() => commands.safeStop())}
                >
                  <CircleStop aria-hidden="true" size={17} />
                  停止本次扫描
                </button>
                <small>停止后不会生成或导入结果；你可以回到准备步骤重新开始。</small>
              </div>
            </>
          ) : null}

          {!showImportComplete &&
          (snapshot.state === 'completed' || inlineImportOpen) &&
          !restartingAfterCompletedResult &&
          !preparingNewScan ? (
            <>
              <div className="scanner-web__handoff">
                {inlineImportOpen ? (
                  <>
                    <FormalDiscImportPage
                      embedded
                      compact
                      secondaryAction={
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={() => void returnToTargetSelection()}
                        >
                          返回准备，重新扫描
                        </button>
                      }
                      onImportSuccess={(imported) => {
                        const next = { count: imported, accountId: selectedAccount?.id ?? '' }
                        window.localStorage.setItem(completedScannerImportKey, JSON.stringify(next))
                        setImportedThisVisit(true)
                        setCompletedImport(next)
                        setInlineImportOpen(false)
                        setPreparingAnotherScan(false)
                        setTargetBinding(null)
                        refreshAccounts()
                      }}
                    />
                  </>
                ) : frozenTargetValidation.valid && resultEligibleForFormalReview ? (
                  <section className="scanner-result-ready" aria-label="扫描结果与下一步">
                    <div className="scanner-result-ready__facts">
                      <div className="scanner-completed-account">
                        <span>本次扫描保存到</span>
                        <strong title={frozenTargetValidation.binding.displayName}>
                          {frozenTargetValidation.binding.displayName}
                        </strong>
                      </div>
                      {resultSummary}
                    </div>
                    <div className="scanner-result-ready__next">
                      <div className="scanner-result-ready__actions">
                        <button
                          className="button button--primary scanner-web__primary-action"
                          type="button"
                          disabled={handoffState.status === 'working'}
                          onClick={() => void handOffResult()}
                        >
                          {handoffState.status === 'working'
                            ? '正在检查结果'
                            : snapshot.summary?.needsReview
                              ? '检查需确认的记录'
                              : '查看扫描结果'}
                          <ChevronRight aria-hidden="true" size={18} />
                        </button>
                        <button
                          className="button button--quiet"
                          type="button"
                          disabled={handoffState.status === 'working'}
                          onClick={() => void returnToTargetSelection()}
                        >
                          放弃此结果并重新扫描
                        </button>
                      </div>
                      <p>确认导入前不会更新账户仓库。</p>
                    </div>
                  </section>
                ) : completedBindingIssue ? (
                  <section
                    className="scanner-target-review"
                    role="alert"
                    aria-labelledby="scanner-target-review-heading"
                  >
                    <h3 className="visually-hidden" id="scanner-target-review-heading">
                      {completedBindingIssue.title}
                    </h3>
                    <p className="visually-hidden">{completedBindingIssue.message}</p>
                    <dl className="scanner-account-evidence" aria-label="账户归属比较" role="group">
                      <div>
                        <dt>扫描识别账户</dt>
                        <dd title={`${scanIdentityEvidence.source}：${scanIdentityEvidence.value}`}>
                          <strong>{scanIdentityEvidence.value}</strong>
                        </dd>
                      </div>
                      <div>
                        <dt>当前接收账户</dt>
                        <dd title={`账户选择器当前指向：${currentReceivingAccountName}`}>
                          <strong>{currentReceivingAccountName}</strong>
                        </dd>
                      </div>
                    </dl>
                    {accountState?.accounts.length ? (
                      <ScannerTargetAccountPicker
                        accounts={accountState.accounts.map((account) => ({
                          id: account.id,
                          displayName: account.displayName,
                          discCount: accountState.discCounts.get(account.id) ?? 0,
                        }))}
                        selectedAccountId={effectiveSelectedAccountId}
                        onSelect={(accountId) => {
                          setSelectedAccountId(accountId)
                          setAccountMessage('')
                          setHandoffState({ status: 'idle' })
                        }}
                      />
                    ) : null}
                    {resultSummary}
                    <div className="scanner-target-review__actions">
                      <button
                        className="button button--primary scanner-web__primary-action"
                        type="button"
                        disabled={!selectedAccount || handoffState.status === 'working'}
                        onClick={() => void bindCompletedResultToSelectedAccount()}
                      >
                        {handoffState.status === 'working' ? '正在准备结果' : '确认账户并继续'}
                        <ChevronRight aria-hidden="true" size={18} />
                      </button>
                      <button
                        className="button button--quiet"
                        type="button"
                        disabled={handoffState.status === 'working'}
                        onClick={() => void returnToTargetSelection()}
                      >
                        放弃此结果并重新扫描
                      </button>
                    </div>
                    <p className="scanner-target-review__footnote">
                      仅为已有扫描结果选择接收账户，不会重新扫描、启动游戏或改动账户仓库。
                    </p>
                  </section>
                ) : (
                  <section className="scanner-completed-review" aria-label="已完成扫描结果">
                    {accountState?.accounts.length ? (
                      <ScannerTargetAccountPicker
                        accounts={accountState.accounts.map((account) => ({
                          id: account.id,
                          displayName: account.displayName,
                          discCount: accountState.discCounts.get(account.id) ?? 0,
                        }))}
                        selectedAccountId={effectiveSelectedAccountId}
                        onSelect={(accountId) => {
                          setSelectedAccountId(accountId)
                          setAccountMessage('')
                        }}
                      />
                    ) : (
                      <div className="scanner-completed-account-setup">
                        <p>本次扫描结果尚未绑定账户。先创建独立本机账户，再继续检查。</p>
                        {newAccountControls}
                      </div>
                    )}
                    {resultSummary}
                    {snapshot.summary?.resultStatus === 'blocked_import' ? (
                      <p role="alert">本次结果无法安全导入，请重新扫描。</p>
                    ) : null}
                    <div className="scanner-result-ready__actions">
                      {snapshot.summary?.resultStatus === 'blocked_import' ? (
                        <button
                          className="button button--primary scanner-web__primary-action"
                          type="button"
                          onClick={() => void returnToTargetSelection()}
                        >
                          返回准备步骤
                        </button>
                      ) : (
                        <>
                          <button
                            className="button button--primary scanner-web__primary-action"
                            type="button"
                            disabled={!selectedAccount || handoffState.status === 'working'}
                            onClick={() => void bindCompletedResultToSelectedAccount()}
                          >
                            确认账户并继续
                            <ChevronRight aria-hidden="true" size={18} />
                          </button>
                          <button
                            className="button button--quiet"
                            type="button"
                            disabled={handoffState.status === 'working'}
                            onClick={() => void returnToTargetSelection()}
                          >
                            放弃此结果并重新扫描
                          </button>
                        </>
                      )}
                    </div>
                  </section>
                )}
                {handoffState.status !== 'idle' && handoffState.status !== 'success' ? (
                  <p role={handoffState.status === 'error' ? 'alert' : 'status'} aria-live="polite">
                    {playerResultMessage(handoffState.message)}
                  </p>
                ) : null}
                {handoffState.status === 'error' &&
                handoffState.message.includes('不完整的同源识别结果') ? (
                  <>
                    <button
                      className="button button--quiet"
                      type="button"
                      ref={discardTriggerRef}
                      onClick={() => setDiscardDraftConfirmationOpen(true)}
                    >
                      重新读取扫描结果
                    </button>
                    {discardDraftConfirmationOpen ? (
                      <dialog
                        ref={discardDialogRef}
                        className="scanner-task__confirmation"
                        aria-labelledby="scanner-discard-draft-title"
                        onCancel={() => setDiscardDraftConfirmationOpen(false)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            setDiscardDraftConfirmationOpen(false)
                          }
                          if (event.key !== 'Tab') return
                          const buttons = discardDialogRef.current?.querySelectorAll('button')
                          if (!buttons?.length) return
                          const first = buttons[0]!,
                            last = buttons[buttons.length - 1]!
                          if (event.shiftKey && document.activeElement === first) {
                            event.preventDefault()
                            last.focus()
                          } else if (!event.shiftKey && document.activeElement === last) {
                            event.preventDefault()
                            first.focus()
                          }
                        }}
                      >
                        <h3 id="scanner-discard-draft-title">重新读取扫描结果？</h3>
                        <p>
                          将仅清除“
                          {frozenTargetValidation.valid
                            ? frozenTargetValidation.binding.displayName
                            : '当前账户'}
                          ”中未导入的不完整扫描结果，再读取本次结果。不会重新扫描游戏或修改账户仓库。
                        </p>
                        <div className="scanner-task__confirmation-actions">
                          <button
                            className="button button--quiet"
                            type="button"
                            ref={discardCancelRef}
                            onClick={() => setDiscardDraftConfirmationOpen(false)}
                          >
                            取消
                          </button>
                          <button
                            className="button button--primary"
                            type="button"
                            onClick={() => void discardIncompleteDraftAndRetry()}
                          >
                            确认重新读取
                          </button>
                        </div>
                      </dialog>
                    ) : null}
                  </>
                ) : null}
                {handoffState.status === 'error' &&
                handoffState.message.includes('不完整扫描草稿包含已导入记录') ? (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => void repairCompletedBatchAndRetry()}
                  >
                    恢复结果状态并继续
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
          {!showImportComplete &&
          !inlineImportOpen &&
          (snapshot.state === 'connection_failed' ||
            (selectedJson !== null && !['scanning', 'completed'].includes(snapshot.state))) ? (
            <section
              className="scanner-web__fallback-trigger"
              aria-labelledby="scanner-json-recovery-heading"
            >
              <FileJson aria-hidden="true" size={18} />
              <span>
                <strong id="scanner-json-recovery-heading">已有扫描结果文件？</strong>
                <small>仅在本机助手不可用时使用</small>
              </span>
              <button
                className="button button--quiet scanner-web__file-picker"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <Upload aria-hidden="true" size={18} />
                <span>选择扫描结果文件（JSON）</span>
              </button>
              <input
                className="visually-hidden"
                tabIndex={-1}
                aria-label="选择扫描结果文件（JSON）"
                ref={inputRef}
                accept="application/json,.json"
                type="file"
                onChange={(event) => void inspectJson(event.target.files?.[0])}
              />
              {assessment.state !== 'idle' ? (
                <StatusBanner
                  tone={
                    assessment.state === 'blocked'
                      ? 'error'
                      : assessment.canHandOff
                        ? 'success'
                        : 'info'
                  }
                  title={assessment.title}
                >
                  <p>{assessment.message}</p>
                </StatusBanner>
              ) : null}
              {assessment.canHandOff && selectedJson ? (
                <div className="scanner-web__json-handoff">
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={!targetReady}
                    onClick={() => void handOffFallbackJson()}
                  >
                    继续检查并导入
                  </button>
                  <small>继续检查“{selectedJson.name}”，无需重新选择文件。</small>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      }
    />
  )
}
