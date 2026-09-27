import { useEffect, useState } from 'react'
import { Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { driveDiscData } from '../data/gameData'
import { database } from '../db/database'
import {
  copyLegacyDataToAccount,
  legacyDefaultAccountId,
  preflightLegacyAccountMigration,
  type LegacyAccountMigrationPreflight,
} from '../accounts/migration'
import {
  createLegacyMigrationBackup,
  getLegacyMigrationBackupFilename,
  type LegacyMigrationBackup,
} from '../accounts/migrationBackup'
import { createVaultBackup, getVaultBackupFilename, type VaultBackup } from '../accounts/backup'
import { preflightFrozenAccountRecovery } from '../accounts/frozenRecovery'
import {
  confirmAccountRecoveryGroup,
  getAccountMigrationCompletionState,
  importReviewedRecoveryToAccount,
  persistReviewedRecoveryToAccount,
  preflightReviewedRecovery,
  reviewedRecoveryExpectedTotal,
  type RecoveryReviewGroup,
} from '../accounts/reviewRecovery'
import { getActiveAccount, renameAccount, setActiveAccount } from '../accounts/repository'
import { getAccountDisplayLabel, type AccountProfile } from '../accounts/types'
import type { DriveDiscSet } from '../domain/schemas'
import {
  loadLegacyRecoveryFixture,
  type LegacyRecoveryFixture,
} from '@soda/legacy-recovery-fixture'

const emptyRecoveryGroups = { batchId: 'no-test-fixture', groups: [] }

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function AccountRecoveryGroupReview({
  group,
  sets,
  onConfirm,
}: {
  group: RecoveryReviewGroup
  sets: DriveDiscSet[]
  onConfirm: (setId: string) => Promise<void>
}) {
  const [setId, setSetId] = useState(group.candidateSetId)
  const [saving, setSaving] = useState(false)
  return (
    <article className="preflight-card">
      <img
        alt={`${group.candidateSetName} 代表盘面`}
        height="126"
        src={group.representativeDataUrl}
        width="124"
      />
      <p>
        <strong>{group.candidateSetName}</strong> · {group.sequences.length} 张 · 序号{' '}
        {group.sequences.join('、')}
      </p>
      <p className="muted-note">{group.reason}</p>
      <label>
        确认套装
        <select value={setId} onChange={(event) => setSetId(event.target.value)}>
          {sets
            .filter((set) => !set.evidenceOnly)
            .map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
        </select>
      </label>
      <button
        className="button button--secondary"
        disabled={saving}
        type="button"
        onClick={() => {
          setSaving(true)
          void onConfirm(setId).finally(() => setSaving(false))
        }}
      >
        {saving ? '正在确认…' : '确认这一组'}
      </button>
    </article>
  )
}

export function AccountMigrationPreflightPanel() {
  const [recoveryFixture, setRecoveryFixture] = useState<LegacyRecoveryFixture | null>(null)
  const [preflight, setPreflight] = useState<LegacyAccountMigrationPreflight | null>(null)
  const [legacyBackup, setLegacyBackup] = useState<LegacyMigrationBackup | null>(null)
  const [vaultBackup, setVaultBackup] = useState<VaultBackup | null>(null)
  const [copyResult, setCopyResult] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<Awaited<
    ReturnType<typeof importReviewedRecoveryToAccount>
  > | null>(null)
  const [completion, setCompletion] = useState<Awaited<
    ReturnType<typeof getAccountMigrationCompletionState>
  > | null>(null)
  const [accounts, setAccounts] = useState<AccountProfile[]>([])
  const [activeAccountId, setActiveAccountId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const frozenPreflight = recoveryFixture
    ? preflightFrozenAccountRecovery(recoveryFixture.frozenInput)
    : null
  const recoveryPreflight =
    recoveryFixture && driveDiscData
      ? preflightReviewedRecovery(recoveryFixture.stagingInput, recoveryFixture.groupsInput, {
          driveDiscSets: driveDiscData.driveDiscSets,
          rules: driveDiscData.rules,
          dataVersion: driveDiscData.dataVersion,
        })
      : null

  async function refreshState() {
    const [nextPreflight, nextAccounts, active, nextCompletion] = await Promise.all([
      preflightLegacyAccountMigration(),
      database.accounts.toArray(),
      getActiveAccount(),
      getAccountMigrationCompletionState(
        legacyDefaultAccountId,
        recoveryFixture?.groupsInput ?? emptyRecoveryGroups,
      ),
    ])
    setPreflight(nextPreflight)
    setAccounts(nextAccounts)
    setActiveAccountId(active?.id ?? '')
    setRenameValue(active?.displayName ?? '')
    setCompletion(nextCompletion)
  }

  async function inspectLegacyData() {
    setLoading(true)
    setError(null)
    try {
      await refreshState()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取旧数据摘要。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadLegacyRecoveryFixture().then((fixture) => {
      if (active) setRecoveryFixture(fixture)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([
      preflightLegacyAccountMigration(),
      database.accounts.toArray(),
      getActiveAccount(),
      getAccountMigrationCompletionState(
        legacyDefaultAccountId,
        recoveryFixture?.groupsInput ?? emptyRecoveryGroups,
      ),
    ])
      .then(([nextPreflight, nextAccounts, current, nextCompletion]) => {
        if (!active) return
        setPreflight(nextPreflight)
        setAccounts(nextAccounts)
        setActiveAccountId(current?.id ?? '')
        setRenameValue(current?.displayName ?? '')
        setCompletion(nextCompletion)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '无法读取旧数据摘要。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [recoveryFixture])

  async function exportLegacyBackup() {
    setError(null)
    const backup = await createLegacyMigrationBackup()
    setLegacyBackup(backup)
    downloadJson(backup, getLegacyMigrationBackupFilename(new Date(backup.exportedAt)))
    setMessage('迁移前完整备份已生成并下载。')
  }

  async function copyLegacyData() {
    if (!preflight || !legacyBackup) return
    setLoading(true)
    setError(null)
    try {
      const result = await copyLegacyDataToAccount(legacyDefaultAccountId, preflight.preflightHash)
      const vault = await createVaultBackup()
      setVaultBackup(vault)
      setCopyResult(
        `${result.status === 'already_copied' ? '副本已存在并重新校验' : '复制完成'}：${result.counts.agents} 名代理人、${result.counts.driveDiscs} 张正式盘。`,
      )
      setMessage('账号副本数量与完整性校验通过，旧数据仍完整保留。')
      await refreshState()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号复制失败。')
    } finally {
      setLoading(false)
    }
  }

  async function loadReviewedRecovery() {
    if (!driveDiscData || !recoveryFixture || !recoveryPreflight?.success) return
    setLoading(true)
    setError(null)
    try {
      const result = await persistReviewedRecoveryToAccount(
        legacyDefaultAccountId,
        recoveryFixture.stagingInput,
        recoveryFixture.groupsInput,
        {
          driveDiscSets: driveDiscData.driveDiscSets,
          rules: driveDiscData.rules,
          dataVersion: driveDiscData.dataVersion,
        },
      )
      await refreshState()
      setMessage(
        `恢复暂存已载入：自动恢复 ${result.autoRecovered} 条，规则重算通过 ${result.domainReassessed} 条，剩余 ${result.summary.needsReview} 条分为 14 组。`,
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号恢复暂存载入失败。')
    } finally {
      setLoading(false)
    }
  }

  async function confirmRecoveryGroup(group: RecoveryReviewGroup, setId: string) {
    if (!driveDiscData) return
    setError(null)
    try {
      await confirmAccountRecoveryGroup(legacyDefaultAccountId, group, setId, {
        driveDiscSets: driveDiscData.driveDiscSets,
        rules: driveDiscData.rules,
        dataVersion: driveDiscData.dataVersion,
      })
      const next = await getAccountMigrationCompletionState(
        legacyDefaultAccountId,
        recoveryFixture?.groupsInput ?? emptyRecoveryGroups,
      )
      setCompletion(next)
      setMessage(
        `已确认 ${group.groupId}；当前 ${next.recovery.summary.ready} 可导入 / ${next.recovery.summary.needsReview} 待复核。`,
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '代表组确认失败。')
    }
  }

  async function importReviewedRecovery() {
    if (!driveDiscData || completion?.recovery.summary.ready !== reviewedRecoveryExpectedTotal)
      return
    setLoading(true)
    setError(null)
    try {
      const result = await importReviewedRecoveryToAccount(legacyDefaultAccountId, {
        driveDiscSets: driveDiscData.driveDiscSets,
        rules: driveDiscData.rules,
        dataVersion: driveDiscData.dataVersion,
        gameDataVersion: driveDiscData.dataVersion,
      })
      setImportResult(result)
      await refreshState()
      setMessage(`账号仓库核对完成：${result.total} 张正式盘。`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号恢复导入失败。')
    } finally {
      setLoading(false)
    }
  }

  async function selectAccount(accountId: string) {
    const account = await setActiveAccount(accountId)
    setActiveAccountId(account.id)
    setRenameValue(account.displayName)
    setMessage(`已切换到 ${getAccountDisplayLabel(account)}。`)
  }

  async function saveRename() {
    if (!activeAccountId) return
    try {
      const result = await renameAccount(activeAccountId, renameValue)
      setMessage(result.warning ?? '账号显示名已更新；accountId 与资产归属未变化。')
      await refreshState()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号重命名失败。')
    }
  }

  const recoveryStatus = completion?.recovery ?? null
  const recoveryLoaded = Boolean(recoveryStatus?.summary.total)
  const migrationComplete = completion?.complete ?? false
  const importComplete = completion?.importComplete ?? false
  const displayedTargetAccount = completion?.account ?? preflight?.targetAccount ?? null

  return (
    <article className="panel data-management-grid__wide" data-testid="account-migration-preflight">
      <div className="panel__header">
        <div>
          <span className="eyebrow">旧账户恢复</span>
          <h2>恢复旧账户资料</h2>
        </div>
        <button
          className="button button--quiet"
          disabled={loading}
          type="button"
          onClick={() => void inspectLegacyData()}
        >
          <RefreshCw size={16} /> {loading ? '处理中…' : '刷新状态'}
        </button>
      </div>
      <p>旧表永久保留；本流程只创建账号副本并向该账号仓库写入，不提供旧表清理。</p>
      {error && <p className="danger-note">{error}</p>}
      {message && <p className="form-message">{message}</p>}

      {accounts.length > 0 && (
        <div className="preflight-card">
          <h3>账号选择与显示名</h3>
          <label>
            当前账号
            <select
              aria-label="当前账号"
              value={activeAccountId}
              onChange={(event) => void selectAccount(event.target.value)}
            >
              <option value="">请选择账号</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {getAccountDisplayLabel(account)}
                </option>
              ))}
            </select>
          </label>
          {activeAccountId && (
            <div className="inline-form">
              <label>
                显示名
                <input
                  aria-label="账号显示名"
                  maxLength={40}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                />
              </label>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void saveRename()}
              >
                保存显示名
              </button>
            </div>
          )}
        </div>
      )}

      {preflight && (
        <ol className="migration-steps">
          <li>
            <h3>1. 下载迁移前完整备份</h3>
            {migrationComplete && completion ? (
              <p className="form-message">已完成迁移；旧表仍完整保留，可作为原始回滚依据。</p>
            ) : (
              <>
                <p>包含旧仓库、鉴定历史、角色池、配装结果、扫描证据、模板与全部旧设置。</p>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void exportLegacyBackup()}
                >
                  <Download size={16} /> 生成并下载迁移前备份
                </button>
              </>
            )}
            {legacyBackup && (
              <p className="muted-note">
                {getLegacyMigrationBackupFilename(new Date(legacyBackup.exportedAt))} ·
                完整性校验已记录 · 正式盘 {legacyBackup.counts.driveDiscs} · 角色池设置{' '}
                {legacyBackup.data.settings.some((setting) => setting.key === 'assault-roster-v1')
                  ? '已包含'
                  : '未发现'}
              </p>
            )}
          </li>
          <li>
            <h3>2. 复制旧数据到原本地账号</h3>
            {displayedTargetAccount && (
              <p>
                <ShieldCheck size={17} /> {displayedTargetAccount.displayName}（
                {displayedTargetAccount.id}）· 创建 {displayedTargetAccount.createdAt.slice(0, 10)}{' '}
                · 更新 {displayedTargetAccount.updatedAt.slice(0, 10)}
              </p>
            )}
            <p>
              代理人 {preflight.counts.agents} · 邦布 {preflight.counts.bangboos} · 正式盘{' '}
              {preflight.counts.driveDiscs} · 鉴定 {preflight.counts.discEvaluations} · 扫描条目{' '}
              {preflight.counts.scanItems}
            </p>
            {preflight.conflicts.length > 0 && (
              <ul className="preflight-errors">
                {preflight.conflicts.map((conflict) => (
                  <li key={conflict}>{conflict}</li>
                ))}
              </ul>
            )}
            {migrationComplete && completion ? (
              <p className="form-message">
                账号副本已完成：{completion.agentCount} 名代理人，稳定 ID{' '}
                {completion.account?.id.slice(-8)}。
              </p>
            ) : (
              <button
                className="button button--primary"
                disabled={!legacyBackup || !preflight.canCopy || loading}
                type="button"
                onClick={() => void copyLegacyData()}
              >
                {preflight.alreadyCopied ? '重新校验并设为当前账号' : '复制并校验账号副本'}
              </button>
            )}
            {copyResult && <p>{copyResult}</p>}
            {vaultBackup && (
              <div>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() =>
                    downloadJson(
                      vaultBackup,
                      getVaultBackupFilename(new Date(vaultBackup.exportedAt)),
                    )
                  }
                >
                  <Download size={16} /> 下载账号保险库备份
                </button>
                <p className="muted-note">
                  {getVaultBackupFilename(new Date(vaultBackup.exportedAt))} · 完整性校验已记录 ·
                  账号 {vaultBackup.accounts.length}
                </p>
              </div>
            )}
          </li>
          <li>
            <h3>3. 载入恢复暂存并确认 14 个代表组</h3>
            <p>
              原冻结批次 {frozenRecoveryBatchIdLabel(recoveryFixture?.frozenInput)}：
              {frozenPreflight?.summary?.ready ?? 0} 可导入 /{' '}
              {frozenPreflight?.summary?.needsReview ?? 0} 待复核。恢复包保留原截图与 OCR
              证据，自动恢复 3 条；现行领域规则另使 6 条低等级三副词条合法通过。
            </p>
            <p>
              恢复批次 {reviewedRecoveryBatchIdLabel(recoveryFixture?.stagingInput)} · 载入后预计{' '}
              {recoveryPreflight?.summary?.ready ?? 0} 可导入 /{' '}
              {recoveryPreflight?.summary?.needsReview ?? 0} 待复核 · 完整性校验已记录
            </p>
            {recoveryPreflight && recoveryPreflight.errors.length > 0 && (
              <ul className="preflight-errors">
                {recoveryPreflight.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {importComplete && completion ? (
              <p className="form-message">
                恢复复核已完成：14/14 组，298 条均保留 user_confirmed.v1 与原始证据。
              </p>
            ) : (
              <button
                className="button button--primary"
                disabled={
                  !recoveryPreflight?.success ||
                  (!preflight.alreadyCopied && !copyResult) ||
                  Boolean(recoveryStatus?.summary.imported) ||
                  loading
                }
                type="button"
                onClick={() => void loadReviewedRecovery()}
              >
                {recoveryLoaded ? '重新校验恢复暂存' : '载入账号恢复暂存'}
              </button>
            )}
            {recoveryLoaded && recoveryStatus && (
              <div className="preflight-card">
                <h3>当前账号恢复进度</h3>
                <p>
                  总数 {recoveryStatus.summary.total} · 可导入 {recoveryStatus.summary.ready} ·
                  待复核 {recoveryStatus.summary.needsReview} · 已导入{' '}
                  {recoveryStatus.summary.imported} · 已确认组{' '}
                  {recoveryStatus.confirmedGroupIds.length}/14
                </p>
                {recoveryStatus.pendingGroups.length > 0 && (
                  <div className="scan-review-list">
                    {recoveryStatus.pendingGroups.map((group) => (
                      <AccountRecoveryGroupReview
                        key={group.groupId}
                        group={group}
                        sets={driveDiscData?.driveDiscSets ?? []}
                        onConfirm={(setId) => confirmRecoveryGroup(group, setId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
          <li>
            <h3>4. 导入默认账号正式仓库</h3>
            {importComplete && completion ? (
              <div className="preflight-card preflight-card--ready">
                <h3>已导入完成</h3>
                <p>
                  账号正式仓库 {completion.warehouseCount} 张 · 恢复批次已导入{' '}
                  {completion.recovery.summary.imported} 张 · 审计记录{' '}
                  {completion.auditedImportCount} 张
                  {completion.importedAt
                    ? ` · ${new Date(completion.importedAt).toLocaleString()}`
                    : ''}
                </p>
              </div>
            ) : (
              <button
                className="button button--primary"
                disabled={
                  recoveryStatus?.summary.total !== reviewedRecoveryExpectedTotal ||
                  recoveryStatus.summary.ready !== reviewedRecoveryExpectedTotal ||
                  recoveryStatus.summary.needsReview !== 0 ||
                  recoveryStatus.summary.invalid !== 0 ||
                  loading
                }
                type="button"
                onClick={() => void importReviewedRecovery()}
              >
                导入 298 张到原本地账号
              </button>
            )}
            {!importComplete &&
              !importResult &&
              recoveryStatus?.summary.ready !== reviewedRecoveryExpectedTotal && (
                <p className="danger-note">
                  必须完成 14 组明确确认并达到 298 张可导入、0 张待复核，当前不能部分导入。
                </p>
              )}
          </li>
          <li>
            <h3>5. 最终核对</h3>
            {migrationComplete && completion ? (
              <div className="preflight-card preflight-card--ready">
                <h3>迁移与恢复已完成</h3>
                <p>
                  {completion.account?.displayName} · 创建{' '}
                  {completion.account?.createdAt.slice(0, 10)} · 更新{' '}
                  {completion.account?.updatedAt.slice(0, 10)} · ID{' '}
                  {completion.account?.id.slice(-8)}
                </p>
                <p>
                  {completion.agentCount} 名代理人 · {completion.warehouseCount} 张正式盘。
                </p>
              </div>
            ) : (
              <div className="preflight-card preflight-card--error">
                <h3>尚未达到 20 名代理人 / 298 张正式盘</h3>
                <p>
                  当前 {completion?.agentCount ?? 0} 名代理人 · {completion?.warehouseCount ?? 0}{' '}
                  张正式盘。
                </p>
                {completion?.differences.map((difference) => (
                  <p key={difference} className="muted-note">
                    {difference}
                  </p>
                ))}
              </div>
            )}
            {importResult && <p className="muted-note">仓库与原始文件的完整性校验已记录</p>}
          </li>
        </ol>
      )}
    </article>
  )
}

function frozenRecoveryBatchIdLabel(input: unknown) {
  const value = input as { batch?: { id?: unknown } } | null | undefined
  return typeof value?.batch?.id === 'string' ? value.batch.id : '未知批次'
}

function reviewedRecoveryBatchIdLabel(input: unknown) {
  const value = input as { batch?: { id?: unknown } } | null | undefined
  return typeof value?.batch?.id === 'string' ? value.batch.id : '未知批次'
}
