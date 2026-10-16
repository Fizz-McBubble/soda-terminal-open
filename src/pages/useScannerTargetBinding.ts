import { createFrozenScannerTargetIssue } from './scannerAssistantTargetIssue'
import { downloadJson } from '../components/accountRecoveryHelpers'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  createPublicScannerAccount,
  setPublicScannerActiveAccount,
} from '../accounts/publicScannerAccountCreation'
import {
  publicScannerDriveDiscData,
  publicScannerSetIdentities,
} from '../application/publicScannerCatalog'
import {
  preflightAccountScanReviewBatch,
  discardInvalidAccountScanStaging,
  repairCompletedAccountScanStaging,
  stageAccountPaddleScanImport,
} from '../db/accountScanImport'
import { database } from '../db/databaseCore'
import {
  activeScannerResultBatchSettingKey,
  scanResultHandleSettingKey,
} from '../scanner/resultHandoff'
import { readScannerResultWithDeadline } from '../scanner/resultRead'
import {
  clearScannerTargetAccountBinding,
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
  validateScannerTargetAccountBinding,
  type ScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import type { HandoffState } from './scannerAssistantPresentation'
import {
  completedScannerImportKey,
  discardedScannerResultHandleKey,
} from './scannerAssistantStatePresentation'

import type { ScannerTargetBindingOptions } from './scannerAssistantBindingOptions'

export function useScannerTargetBinding({ account, runtime, update }: ScannerTargetBindingOptions) {
  const { accountState, refreshAccounts, selectedAccount, newAccountName, selectedJson } = account
  const { snapshot, commands, runScannerAction, stageFocusRequestedRef } = runtime
  const {
    setSelectedAccountId,
    setNewAccountName,
    setAccountMessage,
    setCompletedImport,
    setPreparingAnotherScan,
    setInlineImportOpen,
  } = update
  const [handoffState, setHandoffState] = useState<HandoffState>({ status: 'idle' })
  const [discardDraftConfirmationOpen, setDiscardDraftConfirmationOpen] = useState(false)
  const [discardedCompletedResultHandle, setDiscardedCompletedResultHandle] = useState(() =>
    window.localStorage.getItem(discardedScannerResultHandleKey),
  )
  const [targetBinding, setTargetBinding] = useState<ScannerTargetAccountBinding | null>(() => {
    const result = readScannerTargetAccountBinding()
    return result.valid ? result.binding : null
  })
  const readRef = useRef<AbortController | null>(null)
  const [exportSource, setExportSource] = useState<{
    json: string
    accountId: string
    generation: number
    reportId: string | undefined
    resultHandle: string | undefined
  } | null>(null)
  const startingScanRef = useRef(false)
  const startPendingRef = useRef(false)
  const [startPending, setStartPending] = useState(false)
  const bindingPendingRef = useRef(false)
  const readGenerationRef = useRef(0)
  const previousSnapshotRef = useRef(snapshot)
  const latestSnapshotRef = useRef(snapshot)
  const latestExportAccountRef = useRef(accountState?.activeAccount?.id)
  useLayoutEffect(() => {
    latestSnapshotRef.current = snapshot
    latestExportAccountRef.current = accountState?.activeAccount?.id
    if (snapshot.state === 'connection_failed') startingScanRef.current = false
  }, [snapshot, accountState?.activeAccount?.id])

  function cancelResultRead() {
    setExportSource(null)
    readGenerationRef.current += 1
    bindingPendingRef.current = false
    readRef.current?.abort()
    readRef.current = null
  }

  useEffect(() => () => cancelResultRead(), [])
  useLayoutEffect(() => {
    // An externally changed recipient invalidates the pending read and its private source before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cancelResultRead()
  }, [selectedAccount?.id])
  useEffect(() => {
    const previous = previousSnapshotRef.current
    previousSnapshotRef.current = snapshot
    const changedAttempt = Boolean(
      snapshot.diagnostics?.reportId &&
      previous.diagnostics?.reportId &&
      snapshot.diagnostics.reportId !== previous.diagnostics.reportId,
    )
    const changedResult = Boolean(
      snapshot.summary?.resultFileHandle &&
      previous.summary?.resultFileHandle &&
      snapshot.summary.resultFileHandle !== previous.summary.resultFileHandle,
    )
    const beganScanning = snapshot.state === 'scanning' && previous.state !== 'scanning'
    const acceptedStart =
      startingScanRef.current &&
      ['checking', 'awaiting_elevation', 'scanning', 'paused'].includes(snapshot.state)
    const newResult = changedResult && Boolean(previous.summary?.resultFileHandle)
    // A connection replay is not a new scan. In particular, a browser connection
    // diagnostic ID must not promote a saved terminal result into the workspace.
    if (
      !acceptedStart &&
      !beganScanning &&
      !newResult &&
      !(changedAttempt && ['scanning', 'paused'].includes(snapshot.state))
    )
      return
    cancelResultRead()
    setHandoffState({ status: 'idle' })
    setPreparingAnotherScan(false)
    setInlineImportOpen(false)
    setCompletedImport(null)
    window.localStorage.removeItem(completedScannerImportKey)
    window.localStorage.removeItem(discardedScannerResultHandleKey)
    setDiscardedCompletedResultHandle(null)
    if (!startingScanRef.current) {
      clearScannerTargetAccountBinding()
      setTargetBinding(null)
    }
    if (snapshot.state === 'scanning' || snapshot.state === 'completed')
      startingScanRef.current = false
  }, [snapshot, setCompletedImport, setInlineImportOpen, setPreparingAnotherScan])

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

  const frozenTargetIssue = useMemo(
    () => createFrozenScannerTargetIssue(targetBinding, frozenTargetValidation, accountState),
    [accountState, frozenTargetValidation, targetBinding],
  )

  const completedBindingIssue =
    targetBinding && !frozenTargetValidation.valid ? frozenTargetIssue : null

  const scanIdentityEvidence = targetBinding
    ? { source: '既有扫描绑定', value: targetBinding.displayName }
    : { source: '当前结果未提供', value: '未知' }

  async function freezeSelectedTarget(assertCurrent: () => void = () => {}) {
    if (!selectedAccount) throw new Error('请先选择本次扫描要更新的账户。')
    const current = await database.accounts.get(selectedAccount.id)
    assertCurrent()
    if (!current || current.status !== 'active') throw new Error('目标账户已不存在，请重新选择。')
    await setPublicScannerActiveAccount(current.id, database)
    assertCurrent()
    const baselineDiscCount = await database.accountDriveDiscs
      .where('accountId')
      .equals(current.id)
      .count()
    assertCurrent()
    const binding = createScannerTargetAccountBinding({ account: current, baselineDiscCount })
    saveScannerTargetAccountBinding(binding)
    setTargetBinding(binding)
    refreshAccounts()
    return binding
  }

  async function startBoundScan() {
    if (startPendingRef.current) return
    startPendingRef.current = true
    setStartPending(true)
    cancelResultRead()
    const generation = readGenerationRef.current
    const assertCurrent = () => {
      if (generation !== readGenerationRef.current)
        throw new DOMException('Cancelled', 'AbortError')
    }
    setAccountMessage('')
    try {
      await freezeSelectedTarget(assertCurrent)
      setHandoffState({ status: 'idle' })
      startingScanRef.current = true
      // Keep the old terminal snapshot hidden until the Helper acknowledges the new start.
      setPreparingAnotherScan(true)
      window.localStorage.removeItem(completedScannerImportKey)
      setCompletedImport(null)
      window.localStorage.removeItem(discardedScannerResultHandleKey)
      await runScannerAction(async () => {
        try {
          await commands.startScan()
        } catch (error) {
          startingScanRef.current = false
          throw error
        }
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setAccountMessage(error instanceof Error ? error.message : '无法锁定扫描目标账户。')
    } finally {
      startPendingRef.current = false
      setStartPending(false)
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
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '无法创建账户。')
    }
  }

  async function returnToTargetSelection() {
    cancelResultRead()
    startingScanRef.current = false
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
    setAccountMessage('')
    stageFocusRequestedRef.current = true
    try {
      if (snapshot.state === 'scanning') await commands.safeStop()
      await commands.retryConnection()
    } catch {
      setAccountMessage('暂时无法返回准备步骤，请停止本次扫描后重试。')
    }
  }

  async function handOffResult(bindingOverride?: ScannerTargetAccountBinding, file?: File) {
    if (readRef.current) return
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
    setAccountMessage('')
    const controller = new AbortController()
    readRef.current = controller
    const sourceSnapshot = latestSnapshotRef.current
    const generation = readGenerationRef.current
    let phase: 'read' | 'handoff' = 'read'
    function assertCurrent() {
      controller.signal.throwIfAborted()
      if (readRef.current !== controller) throw new DOMException('Cancelled', 'AbortError')
      if (generation !== readGenerationRef.current)
        throw new DOMException('Cancelled', 'AbortError')
      const current = latestSnapshotRef.current
      if (
        (sourceSnapshot.diagnostics?.reportId &&
          current.diagnostics?.reportId &&
          sourceSnapshot.diagnostics.reportId !== current.diagnostics.reportId) ||
        (sourceSnapshot.summary?.resultFileHandle &&
          current.summary?.resultFileHandle &&
          sourceSnapshot.summary.resultFileHandle !== current.summary.resultFileHandle) ||
        current.state === 'scanning'
      )
        throw new DOMException('Cancelled', 'AbortError')
    }
    try {
      const { result, staging } = await readScannerResultWithDeadline(async (signal) => {
        const result = file ? null : await commands.requestResultFile(signal)
        assertCurrent()
        if (
          result &&
          sourceSnapshot.summary?.resultFileHandle &&
          result.resultFileHandle !== sourceSnapshot.summary.resultFileHandle
        )
          throw new Error('扫描结果已经变化，请重新查看本次结果。')
        const staging = file
          ? JSON.parse(await file.text())
          : await commands.requestResultStaging(result!.resultFileHandle, signal)
        assertCurrent()
        return { result, staging }
      }, controller.signal)
      assertCurrent()
      const sourceJson = JSON.stringify(staging)
      phase = 'handoff'
      setHandoffState({ status: 'working', message: '正在保存本次结果，尚未更新账户。' })
      const staged = await stageAccountPaddleScanImport(binding.accountId, staging, database)
      assertCurrent()
      if (result)
        await database.settings.put({
          key: scanResultHandleSettingKey(binding.accountId, staged.batch.id),
          value: result.resultFileHandle,
        })
      assertCurrent()
      await database.settings.put({
        key: activeScannerResultBatchSettingKey(binding.accountId),
        value: staged.batch.id,
      })
      assertCurrent()
      if (!publicScannerDriveDiscData)
        throw new Error('游戏资料尚未加载完成，请稍后重新查看扫描结果。')
      setHandoffState({
        status: 'working',
        message: `正在检查 ${staged.summary.total} 张驱动盘，尚未更新账户。`,
      })
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
      assertCurrent()
      setExportSource({
        json: sourceJson,
        accountId: binding.accountId,
        generation,
        reportId: sourceSnapshot.diagnostics?.reportId,
        resultHandle: sourceSnapshot.summary?.resultFileHandle,
      })
      setPreparingAnotherScan(false)
      setInlineImportOpen(true)
      setHandoffState({
        status: preflight.complete ? 'success' : 'review_required',
        message: preflight.complete
          ? `已检查 ${staged.summary.total} 张驱动盘，请确认更新账户。`
          : `已保留 ${staged.summary.total} 条结果；请检查需确认的记录，可对照盘面手动校准，尚未更新账户。`,
      })
    } catch (error) {
      if (readRef.current !== controller || (error instanceof Error && error.name === 'AbortError'))
        return
      const timedOut = error instanceof Error && error.name === 'ScannerResultTimeoutError'
      const issueCode = timedOut
        ? 'scan_result_timeout'
        : file && phase === 'read'
          ? 'scan_file_invalid'
          : phase === 'read'
            ? 'scan_result_read_failed'
            : 'scan_import_handoff_failed'
      const knownDraftIssue =
        error instanceof Error &&
        (error.message.includes('不完整的同源识别结果') ||
          error.message.includes('不完整扫描草稿包含已导入记录'))
      const message = knownDraftIssue
        ? (error as Error).message
        : timedOut
          ? '扫描结果读取超时，请重试或选择扫描结果文件（JSON）。账户仓库尚未更新。'
          : phase === 'read'
            ? file
              ? '无法读取这份扫描结果文件，请选择有效的 JSON 文件。账户仓库尚未更新。'
              : '暂时无法读取本次扫描结果。请重试；仍失败时重新连接画面扫描，或选择扫描结果文件（JSON）。账户仓库尚未更新。'
            : error instanceof Error
              ? error.message
              : '暂时无法检查本次扫描结果，请重试。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message, issueCode })
    } finally {
      if (readRef.current === controller) readRef.current = null
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
    if (bindingPendingRef.current || readRef.current || handoffState.status === 'working') return
    if (!selectedAccount) {
      const message = '请先选择本次扫描结果归属的账户。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
      return
    }
    bindingPendingRef.current = true
    const generation = readGenerationRef.current
    const sourceHandle = snapshot.summary?.resultFileHandle
    const assertCurrent = () => {
      if (
        generation !== readGenerationRef.current ||
        sourceHandle !== latestSnapshotRef.current.summary?.resultFileHandle
      )
        throw new DOMException('Cancelled', 'AbortError')
    }
    setHandoffState({ status: 'working', message: '正在确认接收账户。' })
    try {
      const binding = await freezeSelectedTarget(assertCurrent)
      await handOffResult(binding)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : '无法确认本次扫描结果归属。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
    } finally {
      if (generation === readGenerationRef.current) bindingPendingRef.current = false
    }
  }

  async function handOffFallbackJson(file?: File) {
    const candidate = file ?? selectedJson
    if (!candidate || bindingPendingRef.current || readRef.current) return
    bindingPendingRef.current = true
    const generation = readGenerationRef.current
    const assertCurrent = () => {
      if (generation !== readGenerationRef.current)
        throw new DOMException('Cancelled', 'AbortError')
    }
    setHandoffState({ status: 'working', message: '正在确认接收账户。' })
    try {
      const binding = await freezeSelectedTarget(assertCurrent)
      await handOffResult(binding, candidate)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : '无法锁定扫描目标账户。'
      setAccountMessage(message)
      setHandoffState({ status: 'error', message })
    } finally {
      if (generation === readGenerationRef.current) bindingPendingRef.current = false
    }
  }

  const canExportResult = Boolean(
    exportSource &&
    exportSource.accountId === selectedAccount?.id &&
    exportSource.accountId === accountState?.activeAccount?.id &&
    exportSource.reportId === snapshot.diagnostics?.reportId &&
    exportSource.resultHandle === snapshot.summary?.resultFileHandle &&
    snapshot.state !== 'scanning' &&
    handoffState.status !== 'working',
  )
  function exportResult() {
    if (
      !canExportResult ||
      !exportSource ||
      exportSource.accountId !== latestExportAccountRef.current ||
      exportSource.generation !== readGenerationRef.current ||
      exportSource.reportId !== latestSnapshotRef.current.diagnostics?.reportId ||
      exportSource.resultHandle !== latestSnapshotRef.current.summary?.resultFileHandle ||
      readRef.current ||
      bindingPendingRef.current
    )
      return
    downloadJson(JSON.parse(exportSource.json), 'Soda-画面扫描结果.json')
  }

  return {
    binding: {
      targetBinding,
      setTargetBinding,
      frozenTargetValidation,
      frozenTargetIssue,
      completedBindingIssue,
      scanIdentityEvidence,
    },
    handoff: {
      handoffState,
      setHandoffState,
      discardDraftConfirmationOpen,
      setDiscardDraftConfirmationOpen,
      discardedCompletedResultHandle,
    },
    actions: {
      startPending,
      startBoundScan,
      createTargetAccount,
      returnToTargetSelection,
      handOffResult,
      discardIncompleteDraftAndRetry,
      repairCompletedBatchAndRetry,
      bindCompletedResultToSelectedAccount,
      handOffFallbackJson,
      canExportResult,
      exportResult,
      cancelResultRead,
    },
  }
}
