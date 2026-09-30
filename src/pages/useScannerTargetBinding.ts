import { useMemo, useState } from 'react'
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
import type { ScannerAssistantSnapshot, useScannerAssistantRuntime } from '../scanner/runtime'
import {
  clearScannerTargetAccountBinding,
  createScannerTargetAccountBinding,
  readScannerTargetAccountBinding,
  saveScannerTargetAccountBinding,
  validateScannerTargetAccountBinding,
  type ScannerTargetAccountBinding,
} from '../scanner/targetAccountBinding'
import type { ScannerAccounts } from './ScannerAccountHydrationGate'
import type { HandoffState } from './scannerAssistantPresentation'
import {
  completedScannerImportKey,
  discardedScannerResultHandleKey,
  type CompletedScannerImport,
} from './scannerAssistantStatePresentation'

type ScannerTargetBindingOptions = {
  account: {
    accountState: ScannerAccounts
    refreshAccounts: () => void
    selectedAccount: ScannerAccounts['accounts'][number] | undefined
    newAccountName: string
    selectedJson: File | null
  }
  runtime: {
    snapshot: ScannerAssistantSnapshot
    commands: ReturnType<typeof useScannerAssistantRuntime>['commands']
    runScannerAction: (action: () => void | Promise<void>) => Promise<void>
    stageFocusRequestedRef: { current: boolean }
  }
  update: {
    setSelectedAccountId: (id: string) => void
    setNewAccountName: (name: string) => void
    setAccountMessage: (msg: string) => void
    setCompletedImport: (val: CompletedScannerImport | null) => void
    setPreparingAnotherScan: (val: boolean) => void
    setInlineImportOpen: (val: boolean) => void
  }
}

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

  const scanIdentityEvidence = targetBinding
    ? { source: '既有扫描绑定', value: targetBinding.displayName }
    : { source: '当前结果未提供', value: '未知' }

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
      startBoundScan,
      createTargetAccount,
      returnToTargetSelection,
      handOffResult,
      discardIncompleteDraftAndRetry,
      repairCompletedBatchAndRetry,
      bindCompletedResultToSelectedAccount,
      handOffFallbackJson,
    },
  }
}
