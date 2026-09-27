import { displayDiscMainValue, formatDiscStatValue } from './publicDiscFacts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useOptionalAccountDecisionWorld } from '../application/accountDecisionWorld'
import { publicAssetCatalog, publicAssetDiscSetById } from '../application/publicAssetCatalog'
import { publicAssetStatLabel } from '../application/publicAssetStatLabels'
import { isN2AcceptanceRecoveryAvailable } from '../accounts/acceptanceAccountRecoveryEntry'
import {
  createAccountBackup,
  getAccountBackupFilename,
  preflightAccountBackupAgainstDatabase,
  restoreAccountBackup,
  type AccountBackup,
} from '../accounts/backup'
import {
  deleteAccount,
  getAccountRoster,
  getAccountPreference,
  getActiveAccount,
  setActiveAccount,
  deleteAccountDriveDiscs,
  saveAccountDriveDisc,
  saveAccountBangboo,
  accountDriveDiscRevision as discRevision,
  saveAccountPreference,
} from '../accounts/repository'
import { createPublicScannerEmptyRoster as createEmptyRoster } from '../accounts/publicScannerAccountCreation'
import { saveAgentWEngineAssignment } from '../accounts/wEngineAssignment'
import { listAccountPlanningDrafts } from '../accounts/planningDrafts'
import { AssetMaintenanceGolden } from '../components/assets/r6/AssetMaintenanceGolden'
import type {
  AssetTab,
  BackupPreview,
  DiscItem,
  TypedAssetSave,
} from '../components/assets/r6/types'
import { database } from '../db/databaseCore'
import type { DriveDisc } from '../domain/schemas'
import { normalizeDiscTags } from '../domain/discTags'
import type { AccountPlanningDraft } from '../accounts/types'

const lastFullBackupPreference = 'data-center-last-full-backup-v1'
const lastSelectedAgentPreference = 'assets.agents.last-selected-agent-v1'
const loadAcceptanceRecovery =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : () => import('../accounts/acceptanceAccountRecovery')

function activeTab(value?: string): AssetTab {
  return value === 'agents' ||
    value === 'wengines' ||
    value === 'bangboos' ||
    value === 'discs' ||
    value === 'account'
    ? value
    : 'account'
}

const catalog = publicAssetCatalog

function asDiscItem(disc: DriveDisc, relations: { equipped: boolean; planned: boolean }): DiscItem {
  return {
    stableId: disc.id,
    set: publicAssetDiscSetById.get(disc.setId) ?? {
      stableId: disc.setId,
      entityType: 'drive_disc_set',
      playerName: '未识别套装',
      rarity: null,
      specialty: null,
    },
    slot: disc.slot,
    level: disc.level,
    mainStat: publicAssetStatLabel(disc.mainStat),
    mainValue: displayDiscMainValue(disc),
    subStats: disc.subStats.map((item) => ({
      stat: publicAssetStatLabel(item.stat),
      value: formatDiscStatValue(item.stat, item.value),
      upgrades: item.upgrades,
    })),
    locked: disc.locked,
    favorite: disc.favorite,
    tags: disc.tags,
    protections: [
      ...(disc.locked ? (['locked'] as const) : []),
      ...(relations.equipped ? (['equipped'] as const) : []),
      ...(relations.planned ? (['planned'] as const) : []),
    ],
    revision: discRevision(disc),
  }
}

function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function loadAssetData() {
  const account = await getActiveAccount()
  if (!account)
    return {
      account: null,
      roster: createEmptyRoster(),
      discs: [] as DriveDisc[],
      planningDrafts: [] as AccountPlanningDraft[],
      lastSelectedAgentId: null,
    }
  const [roster, discs, planningDrafts, preferredAgent] = await Promise.all([
    getAccountRoster(account.id),
    database.accountDriveDiscs.where('accountId').equals(account.id).toArray(),
    listAccountPlanningDrafts(account.id),
    getAccountPreference(account.id, lastSelectedAgentPreference),
  ])
  return {
    account,
    roster,
    discs: discs as DriveDisc[],
    planningDrafts,
    lastSelectedAgentId: typeof preferredAgent === 'string' ? preferredAgent : null,
  }
}

function defaultAgentSelection(
  roster: ReturnType<typeof createEmptyRoster>,
  preferredAgentId: string | null,
) {
  const catalogIds = new Set(catalog.agents.map((agent) => agent.stableId))
  if (preferredAgentId && catalogIds.has(preferredAgentId)) return preferredAgentId
  return (
    roster.agents.find((agent) => agent.owned && catalogIds.has(agent.agentId))?.agentId ??
    catalog.agents[0]?.stableId
  )
}

export function AssetCenterPage() {
  const decisionWorld = useOptionalAccountDecisionWorld()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const navigate = useNavigate()
  const [revision, setRevision] = useState(0)
  const [message, setMessageState] = useState({ text: '', transient: false, revision: 0 })
  const [acceptanceRecoveryAvailable, setAcceptanceRecoveryAvailable] = useState(false)
  const data = useLiveQuery(loadAssetData, [revision])
  const accountOptions = useLiveQuery(
    () =>
      database.accounts
        .filter((account) => account.status === 'active')
        .toArray()
        .then((accounts) =>
          accounts
            .sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-CN'))
            .map((account) => ({ id: account.id, displayName: account.displayName })),
        ),
    [],
  )
  const propsData =
    data ??
    ({
      account: null,
      roster: createEmptyRoster(),
      discs: [] as DriveDisc[],
      planningDrafts: [] as AccountPlanningDraft[],
      lastSelectedAgentId: null,
    } as const)
  const discs = useMemo(() => {
    const equippedIds = new Set(
      propsData.roster.agents.flatMap((agent) => agent.equippedDiscIds ?? []),
    )
    const plannedIds = new Set(
      propsData.planningDrafts.flatMap(
        (draft) => resolvePlanningDiscReferences(draft).referenceIds,
      ),
    )
    return propsData.discs.map((disc) =>
      asDiscItem(disc, { equipped: equippedIds.has(disc.id), planned: plannedIds.has(disc.id) }),
    )
  }, [propsData.discs, propsData.planningDrafts, propsData.roster])

  const setMessage = useCallback((text: string, transient = false) => {
    setMessageState((current) => ({ text, transient, revision: current.revision + 1 }))
  }, [])

  useEffect(() => {
    if (!message.transient || !message.text) return
    const revision = message.revision
    const timer = window.setTimeout(() => {
      setMessageState((current) =>
        current.revision === revision ? { text: '', transient: false, revision } : current,
      )
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!loadAcceptanceRecovery) return
    let active = true
    void isN2AcceptanceRecoveryAvailable(window.location.search).then((available) => {
      if (active) setAcceptanceRecoveryAvailable(available)
    })
    return () => {
      active = false
    }
  }, [])

  async function requireCurrentAccount(expectedId: string) {
    const account = await getActiveAccount()
    if (!account || account.id !== expectedId)
      throw new Error('当前账户已经切换，请刷新后重新确认。')
    return account
  }

  async function save(payload: TypedAssetSave) {
    try {
      const account = propsData.account
      if (!account) throw new Error('正在读取当前账户，请稍候再保存。')
      await requireCurrentAccount(account.id)
      if (payload.kind === 'discs') {
        const current = await database.accountDriveDiscs.get(`${account.id}:${payload.stableId}`)
        if (!current || discRevision(current) !== payload.baseRevision)
          throw new Error('这张驱动盘已被扫描、导入或恢复更新，请刷新后重新确认。')
        const saved = {
          ...current,
          locked: current.locked,
          favorite: payload.draft.favorite,
          tags: normalizeDiscTags(payload.draft.tags),
          updatedAt: new Date().toISOString(),
        }
        await saveAccountDriveDisc(account.id, saved, database, payload.baseRevision)
        setMessage('已保存到当前账户。', true)
        setRevision((value) => value + 1)
        return discRevision(saved)
      } else {
        const roster = await getAccountRoster(account.id)
        if (payload.kind === 'agents') {
          const index = roster.agents.findIndex((item) => item.agentId === payload.stableId)
          if (
            index < 0 ||
            JSON.stringify({ source: roster.agents[index] }) !== payload.baseRevision
          )
            throw new Error('代理人资料已更新，请刷新后重新确认。')
          const {
            wEngineCatalogId,
            wEngineLevel,
            wEngineRefinement,
            wEngineRefinementManuallySet,
            ...agentDraft
          } = payload.draft
          const savedRoster = await saveAgentWEngineAssignment({
            accountId: account.id,
            agentId: payload.stableId,
            baseRevision: payload.baseRevision,
            draft: {
              wEngineCopyId: payload.draft.wEngineCopyId,
              wEngineCatalogId,
              wEngineLevel,
              wEngineRefinement,
              wEngineRefinementManuallySet,
            },
            agentPatch: agentDraft,
            agents: catalog.agents,
            wengines: catalog.wengines,
          })
          const savedAgent = savedRoster.agents.find((agent) => agent.agentId === payload.stableId)
          if (!savedAgent) throw new Error('代理人资料保存后未能重新读取。')
          const savedRevision = JSON.stringify({ source: savedAgent })
          setMessage('已保存到当前账户。', true)
          setRevision((value) => value + 1)
          return savedRevision
        } else {
          await saveAccountBangboo(
            account.id,
            payload.stableId,
            payload.draft,
            payload.baseRevision,
          )
        }
      }
      setMessage('已保存到当前账户。', true)
      setRevision((value) => value + 1)
      return undefined
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。')
      return null
    }
  }

  async function deleteDiscs(ids: string[], baseRevisions: Record<string, string>) {
    const account = propsData.account
    if (!account) {
      setMessage('请先创建并选择本机账户。')
      return false
    }
    try {
      await requireCurrentAccount(account.id)
      const current = await database.accountDriveDiscs
        .where('accountId')
        .equals(account.id)
        .toArray()
      const byId = new Map(current.map((disc) => [disc.id, disc]))
      if (ids.some((id) => !byId.has(id) || discRevision(byId.get(id)!) !== baseRevisions[id]))
        throw new Error('批量选择中有驱动盘已更新或消失，请刷新后重新确认。')
      const result = await deleteAccountDriveDiscs(account.id, ids, database, baseRevisions)
      setMessage(`已从当前账户删除 ${result.deletedCount} 张驱动盘，关联鉴定与配装引用已同步清理。`)
      setRevision((value) => value + 1)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除驱动盘失败。')
      return false
    }
  }

  async function createBackup() {
    const account = propsData.account
    if (!account) return setMessage('请先创建并选择本机账户。')
    await requireCurrentAccount(account.id)
    let backup: AccountBackup
    try {
      backup = await createAccountBackup(account.id)
    } catch {
      setMessage(
        '备份未生成：账户资料未通过完整性检查。原资料未修改，请保留当前账户并检查录入内容。',
      )
      return
    }
    downloadJson(backup, getAccountBackupFilename(account.id))
    await saveAccountPreference(account.id, lastFullBackupPreference, backup.exportedAt)
    setMessage('备份文件已下载到本机。')
  }

  async function inspectBackup(file: File): Promise<BackupPreview> {
    const input = JSON.parse(await file.text()) as unknown
    const preflight = await preflightAccountBackupAgainstDatabase(input)
    if (!preflight.success || !preflight.backup)
      throw new Error(preflight.errors[0] ?? '备份预检失败。')
    const backup: AccountBackup = preflight.backup
    return {
      fileName: file.name,
      accountName: backup.account.displayName,
      exportedAt: backup.exportedAt,
      scope: `${backup.counts.roster ? '代理人/音擎/邦布' : '无养成资料'} · ${backup.counts.driveDiscs} 张驱动盘`,
      payload: input,
    }
  }

  async function restore(preview: BackupPreview) {
    await restoreAccountBackup(preview.payload)
    const refreshed = decisionWorld ? await decisionWorld.refresh() : true
    setMessage(
      refreshed
        ? '备份已恢复，当前账户资料已重新读取。'
        : '备份已恢复。配装建议暂未更新，请返回首页重新分析。',
    )
    setRevision((value) => value + 1)
  }

  async function selectAccount(accountId: string) {
    if (accountId === propsData.account?.id) return
    const account = await setActiveAccount(accountId)
    setMessage(`已切换到“${account.displayName}”。资产和队伍配装会按该账户重新读取。`)
    setRevision((value) => value + 1)
  }

  async function deleteLocalAccount(accountId: string) {
    try {
      const account = accountOptions?.find((candidate) => candidate.id === accountId)
      if (!account) throw new Error('账户已不存在，请刷新后重新确认。')
      const result = await deleteAccount(accountId)
      setMessage(
        result.nextActiveAccountId
          ? `已永久删除“${account.displayName}”，并切换到剩余账户。`
          : `已永久删除“${account.displayName}”。本机当前没有账户。`,
      )
      setRevision((value) => value + 1)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '账户删除失败，原数据未变化。')
      return false
    }
  }

  function selectAgent(agentId: string) {
    const account = propsData.account
    if (!account) return
    void saveAccountPreference(account.id, lastSelectedAgentPreference, agentId).catch(() => {
      setMessage('未能记住默认代理人；本次选择仍然有效。')
    })
  }

  async function restoreAcceptanceAccount() {
    if (!loadAcceptanceRecovery) return
    try {
      setMessage('正在恢复隔离验收账户…')
      const { restoreN2AcceptanceAccount } = await loadAcceptanceRecovery()
      const result = await restoreN2AcceptanceAccount()
      setMessage(
        `已恢复隔离验收账户：${result.counts.agents} 名代理人、${result.counts.wEngines} 件音擎、${result.counts.bangboos} 名邦布、${result.counts.driveDiscs} 张驱动盘。`,
      )
      setRevision((value) => value + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验收账户恢复失败。')
    }
  }

  if (!data) {
    return (
      <section className="asset-center-loading" role="status" aria-live="polite">
        正在读取当前账户资料…
      </section>
    )
  }

  return (
    <AssetMaintenanceGolden
      key={propsData.account?.id ?? 'no-account'}
      accountId={propsData.account?.id ?? 'no-account'}
      accountName={propsData.account?.displayName ?? '尚未选择账户'}
      accountUpdatedAt={propsData.account?.updatedAt ?? new Date(0).toISOString()}
      accountOptions={accountOptions ?? []}
      catalog={catalog}
      discs={discs}
      roster={propsData.roster}
      initialTab={propsData.account ? activeTab(params.assetType) : 'account'}
      initialSelection={{
        agents:
          searchParams.get('selected') ??
          defaultAgentSelection(propsData.roster, propsData.lastSelectedAgentId) ??
          undefined,
        wengines: searchParams.get('selected') ?? undefined,
      }}
      message={message.text}
      onNavigate={(tab) => navigate(tab === 'account' ? '/assets/account' : `/assets/${tab}`)}
      onPrimaryNavigate={(path) => navigate(path)}
      onSelectAgent={selectAgent}
      onSave={save}
      onDeleteDiscs={deleteDiscs}
      onCreateBackup={createBackup}
      onInspectBackup={inspectBackup}
      onRestore={restore}
      onSelectAccount={selectAccount}
      onDeleteAccount={deleteLocalAccount}
      onRestoreAcceptanceAccount={
        acceptanceRecoveryAvailable ? restoreAcceptanceAccount : undefined
      }
    />
  )
}
import { resolvePlanningDiscReferences } from '../accounts/planningDiscReferences'
