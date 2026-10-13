import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Database, RefreshCw, ScanLine, ShieldCheck, Sparkles, Users } from 'lucide-react'
import ramielHero from '../assets/golden-sample/ramiel-user-cutout-1152.webp'
import ramielHeroSmall from '../assets/golden-sample/ramiel-user-cutout-576.webp'
import ramielHeroLarge from '../assets/golden-sample/ramiel-user-cutout-1536.webp'
import { officialCatalogAssets, resolveCachedVisualAsset } from '../assets/visualAssets'
import {
  ensureOfficialCatalogInstalled,
  removeOfficialCatalogImages,
  getOfficialCatalogInstallStatus,
  subscribeOfficialCatalogInstallStatus,
} from '../assets/visualAssetInstallCoordinator'
import { HomeAssetDialog } from './HomeAssetDialog'
import { F5HomeGoldenView } from '../components/F5GoldenViews'
import { database } from '../db/databaseCore'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'

export function DashboardPage() {
  const decisionWorld = useAccountDecisionWorld()
  const accountInput = decisionWorld.liveInput
  const home = accountInput
    ? {
        account: accountInput.warehouse.account,
        roster: accountInput.warehouse.roster,
        discs: accountInput.warehouse.discs,
        drafts: accountInput.drafts,
      }
    : accountInput === undefined && decisionWorld.status !== 'error'
      ? undefined
      : { account: null, roster: null, discs: [], drafts: [] }
  const pendingStagingRead = useLiveQuery(async () => {
    const accountId = accountInput?.warehouse.accountId
    if (!accountId) return { accountId: null, count: 0 }
    const staging = await database.accountScanImportBatches
      .where('accountId')
      .equals(accountId)
      .toArray()
    return {
      accountId,
      count: staging.filter((batch) => batch.importHistory.at(-1)?.action !== 'imported').length,
    }
  }, [accountInput?.warehouse.accountId])
  const pendingStaging =
    pendingStagingRead?.accountId === accountInput?.warehouse.accountId
      ? pendingStagingRead?.count
      : undefined
  const [assetCacheStatus, setAssetCacheStatus] = useState(getOfficialCatalogInstallStatus)
  const [discArtUrls, setDiscArtUrls] = useState<string[]>([])
  const [retryingAccountRead, setRetryingAccountRead] = useState(false)
  const [removingImages, setRemovingImages] = useState(false)
  const [assetManagementError, setAssetManagementError] = useState<string | null>(null)
  const assetDialog = useRef<HTMLDialogElement>(null)
  const assetOperationPending = assetCacheStatus.kind === 'loading' || removingImages

  useEffect(() => {
    let active = true
    const unsubscribe = subscribeOfficialCatalogInstallStatus(setAssetCacheStatus)
    // The shell may have begun loading before this route subscribed.
    queueMicrotask(() => active && setAssetCacheStatus(getOfficialCatalogInstallStatus()))
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function downloadVisualAssets() {
    if (assetOperationPending) return
    setAssetManagementError(null)
    try {
      await ensureOfficialCatalogInstalled({ verifyCache: true })
    } catch {
      /* Shared status retains successfully cached images and retry state. */
    }
  }

  async function removeVisualAssets() {
    if (assetOperationPending) return
    setRemovingImages(true)
    setAssetManagementError(null)
    try {
      await removeOfficialCatalogImages()
      setDiscArtUrls([])
      setAssetCacheStatus(getOfficialCatalogInstallStatus())
    } catch {
      setAssetManagementError('图片缓存未能完全删除，请重试。')
    } finally {
      setRemovingImages(false)
    }
  }

  useEffect(() => {
    if (assetCacheStatus.kind !== 'ready' && assetCacheStatus.kind !== 'partial') return
    let active = true
    let resolvedUrls: string[] = []
    const discAssets = officialCatalogAssets
      .filter((asset) => asset.entityType === 'drive_disc_set')
      .slice(0, 2)
    void Promise.all(
      discAssets.map((asset) => resolveCachedVisualAsset(asset).catch(() => null)),
    ).then((urls) => {
      resolvedUrls = urls.filter((url): url is string => Boolean(url))
      if (active) setDiscArtUrls(resolvedUrls)
      else resolvedUrls.forEach((url) => URL.revokeObjectURL(url))
    })
    return () => {
      active = false
      resolvedUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [assetCacheStatus.kind])

  if (home === undefined)
    return (
      <section className="panel" role="status" aria-live="polite">
        <h1>正在读取本地账户</h1>
        <p>正在读取角色、装备和已保存方案，请稍候。</p>
      </section>
    )

  if (decisionWorld.status === 'error' && !home.account)
    return (
      <section className="panel status-card is-warning" role="alert">
        <h1>暂时无法继续当前分析</h1>
        <p>{decisionWorld.message}</p>
        <p>账户、驱动盘和已保存方案未被修改。</p>
        {decisionWorld.canRepairApplicationData ? (
          <>
            <p>仅修复应用资料，不修改账户资产。</p>
            <button
              className="button button--primary"
              type="button"
              disabled={retryingAccountRead}
              onClick={() => {
                setRetryingAccountRead(true)
                void decisionWorld
                  .repairApplicationData()
                  .finally(() => setRetryingAccountRead(false))
              }}
            >
              {retryingAccountRead ? '正在恢复…' : '恢复应用自带资料'}
            </button>
          </>
        ) : (
          <button
            className="button button--primary"
            type="button"
            disabled={retryingAccountRead}
            onClick={() => {
              setRetryingAccountRead(true)
              void decisionWorld.refresh().finally(() => setRetryingAccountRead(false))
            }}
          >
            {retryingAccountRead ? '正在重新读取…' : '重新读取本地资料'}
          </button>
        )}
      </section>
    )

  const ownedAgents = home.roster?.agents.filter((agent) => agent.owned) ?? []
  const developmentGap = ownedAgents.some(
    (agent) => agent.level < 60 || agent.completeness !== 'complete',
  )
  const savedTeamPlans = home.drafts.filter(
    (draft) => draft.kind === 'team' && draft.state === 'saved',
  )
  const nextAction = (() => {
    if (!home?.account)
      return {
        eyebrow: '从首次扫描开始',
        title: '创建账户并扫描',
        description: '在扫描页创建或选择本机账户，完成扫描，软件校验后点击导入。',
        label: '前往扫描与导入',
        path: '/system/scanner',
        icon: Database,
      }
    if (!home.discs.length && pendingStaging)
      return {
        eyebrow: '已有待确认数据',
        title: '继续正式导入',
        description: `${pendingStaging} 份扫描结果等待导入，点击导入后才会更新账户。`,
        label: '导入',
        path: '/system/data/import-discs',
        icon: ScanLine,
      }
    if (!home.discs.length)
      return {
        eyebrow: '仓库尚未建立',
        title: '扫描或导入本地数据',
        description: '前往扫描页，读取游戏中的驱动盘。软件校验后点击导入，即可开始配装。',
        label: '继续：扫描与导入',
        path: '/system/scanner',
        icon: ScanLine,
      }
    if (!ownedAgents.length)
      return {
        eyebrow: '仓库已就绪',
        title: '记录代理人资料',
        description: '标记当前账户拥有的代理人，才能把驱动盘仓库与养成目标关联起来。',
        label: '查看我的资产',
        path: '/assets/agents',
        icon: Users,
      }
    if (
      decisionWorld.status === 'current' &&
      decisionWorld.run?.teamPresentation &&
      !decisionWorld.run.teamPresentation.overviewModel.groups.some(
        (group) => group.kind === 'recommended' && group.items.length,
      ) &&
      !savedTeamPlans.length
    )
      return {
        eyebrow: '队伍建议仍待补齐',
        title: '记录代理人资料',
        description:
          ownedAgents.length < 3
            ? '已记录的代理人不足三名，请先补充已拥有代理人。'
            : '当前已记录的代理人暂未形成支持的队伍，请补充或更新资产资料。',
        label: '前往代理人资产',
        path: '/assets/agents',
        icon: Users,
      }
    const shared = decisionWorld.nextAction
    if (!shared)
      return {
        eyebrow: '账户资料已就绪',
        title: '选择队伍并配装',
        description: '选择想使用的代理人，按当前仓库搭配装备。',
        label: '前往队伍配装',
        path: '/loadouts/team?reanalyze=1',
        icon: Users,
      }
    return {
      eyebrow:
        decisionWorld.status === 'stale'
          ? '账户资料已有变化'
          : decisionWorld.run?.decisionAuthority.status === 'ready'
            ? '可按当前仓库搭配队伍'
            : '队伍建议仍待补齐',
      ...shared,
      // The homepage is already the readiness decision. Entering the team route
      // must consume that intent rather than asking the player to press analysis again.
      path: shared.path === '/loadouts/team' ? '/loadouts/team?reanalyze=1' : shared.path,
      description: shared.path === '/loadouts/team' ? `${shared.description} ` : shared.description,
      label: `继续：${shared.label}`,
      icon:
        decisionWorld.status === 'stale'
          ? RefreshCw
          : shared.path === '/warehouse/discs'
            ? ShieldCheck
            : Users,
    }
  })()

  const journeyCore = [
    {
      label: '扫描与导入',
      description: home.discs.length ? `已导入 ${home.discs.length} 件驱动盘` : '尚未建立仓库',
      path: '/system/scanner',
      icon: ScanLine,
      ready: Boolean(home?.discs.length),
    },
    {
      label: '我的资产',
      description: home.account
        ? ownedAgents.length
          ? '账户与代理人已确认'
          : '等待录入代理人'
        : '尚未建立账户',
      path: '/assets',
      icon: Database,
      ready: Boolean(home?.account && ownedAgents.length),
    },
    {
      label: '代理人养成',
      description: ownedAgents.length
        ? developmentGap
          ? '继续完善养成'
          : '当前养成已就绪'
        : '等待录入代理人',
      path: '/development',
      icon: Sparkles,
      ready: Boolean(ownedAgents.length && !developmentGap),
    },
    {
      label: '队伍配装',
      description: savedTeamPlans.length
        ? `${savedTeamPlans.length} 份方案已保存`
        : '等待形成可用方案',
      path: '/loadouts/team',
      icon: Users,
      ready: Boolean(savedTeamPlans?.length),
    },
    {
      label: '驱动盘分析',
      description: savedTeamPlans.length
        ? '查看驱动盘用途与保留建议'
        : '查看驱动盘的适配与强化建议',
      path: '/warehouse/discs',
      icon: ShieldCheck,
      ready: false,
    },
  ]
  const currentJourneyIndex = journeyCore.findIndex(
    (step) =>
      nextAction.path === step.path ||
      nextAction.path.startsWith(`${step.path}/`) ||
      nextAction.path.startsWith(`${step.path}?`),
  )
  const recoveryJourneyIndex = decisionWorld.status === 'stale' ? 3 : -1
  const journey = journeyCore.map((step, index) => ({
    ...step,
    state:
      index === recoveryJourneyIndex
        ? ('recovery' as const)
        : index === currentJourneyIndex
          ? ('current' as const)
          : step.ready
            ? ('ready' as const)
            : ('upcoming' as const),
  }))
  const localStatus = !home.account
    ? '尚未选择本地账户'
    : !home.discs.length
      ? pendingStaging
        ? '已有数据等待正式确认'
        : '仓库等待第一次本机扫描'
      : decisionWorld.status === 'stale'
        ? '账户资料已有变化'
        : '本地资料可以继续使用'
  const headline = (() => {
    switch (nextAction.title) {
      case '创建账户并扫描':
        return ['创建账户', '开始扫描']
      case '继续完成当前方案':
        return ['继续完成', '当前方案']
      case '当前决策尚未闭合':
        return ['查看当前', '待补资料']
      case '当前候选决策已形成':
        return ['核对仓库', '执行影响']
      case '账户资料已有变化':
        return ['重新分析', '当前账户']
      case '建立或恢复账户':
        return ['建立或恢复', '本地账户']
      case '扫描或导入本地数据':
        return ['扫描或导入', '本地资料']
      case '继续正式导入':
        return ['继续检查', '正式导入']
      case '记录代理人资料':
        return ['记录代理人', '已有装备']
      case '重新生成队伍方案':
        return ['恢复队伍', '配装方案']
      default:
        return ['查看当前', '队伍方案']
    }
  })()
  const ordinaryNextSignal =
    decisionWorld.status === 'stale'
      ? {
          label: '账户资料已有变化',
          summary: '旧结果仍保留；重新分析后再保存新方案。',
        }
      : savedTeamPlans?.length
        ? {
            label: `${savedTeamPlans.length} 份队伍方案已保存`,
            summary: '选择一份继续配装；保存方案可共用驱动盘。',
          }
        : {
            label: nextAction.eyebrow,
            summary: '也可从下方“使用旅程”进入其他步骤。',
          }
  const retryAnalysis = () => {
    if (retryingAccountRead) return
    setRetryingAccountRead(true)
    const retry =
      decisionWorld.status === 'error' && decisionWorld.canRepairApplicationData
        ? decisionWorld.repairApplicationData()
        : decisionWorld.refresh()
    void retry.catch(() => undefined).finally(() => setRetryingAccountRead(false))
  }
  const nextSignal =
    home.account && (decisionWorld.calculation || retryingAccountRead)
      ? {
          label:
            decisionWorld.calculation?.phase === 'reading_account'
              ? '正在读取账户资料'
              : decisionWorld.calculation?.phase === 'preparing_rules'
                ? '正在准备分析资料'
                : '正在分析当前账户',
          summary: '账户资产可继续查看。',
          busy: true,
          action: decisionWorld.cancelCalculation
            ? { label: '停止分析', onClick: decisionWorld.cancelCalculation }
            : undefined,
        }
      : home.account && decisionWorld.status === 'error'
        ? {
            label: '当前分析未完成',
            summary: decisionWorld.message,
            alert: true,
            action: {
              label: decisionWorld.canRepairApplicationData ? '恢复应用资料' : '重新分析',
              onClick: retryAnalysis,
            },
          }
        : home.account && decisionWorld.calculationCancelled
          ? {
              label: '分析已停止',
              summary: '账户资产保留，可重新分析。',
              action: { label: '重新分析', onClick: retryAnalysis },
            }
          : ordinaryNextSignal
  const assetCacheLabel =
    assetManagementError ??
    (assetCacheStatus.kind === 'loading'
      ? `图片加载中 ${assetCacheStatus.completed}/${assetCacheStatus.total}`
      : assetCacheStatus.kind === 'ready'
        ? '本机素材已就绪'
        : assetCacheStatus.kind === 'idle'
          ? '图片尚未缓存'
          : assetCacheStatus.kind === 'partial'
            ? `图片待补齐 ${assetCacheStatus.failed} 张`
            : '图片加载失败，可重试')
  const assetCacheDetail =
    assetCacheStatus.kind === 'error' || assetCacheStatus.kind === 'partial'
      ? '已有图片保留，其他功能可继续使用。'
      : assetCacheStatus.kind === 'loading'
        ? '自动加载并缓存，可继续使用其他功能。'
        : '图片缓存在此浏览器。'
  const assetDownloadLabel =
    assetCacheStatus.kind === 'loading'
      ? '正在加载图片…'
      : assetCacheStatus.kind === 'ready'
        ? '检查图片更新'
        : assetCacheStatus.kind === 'idle'
          ? '重新加载图片'
          : '补齐图片'
  return (
    <>
      <F5HomeGoldenView
        statusLabel={nextAction.eyebrow}
        headline={headline as [string, string]}
        headlineLabel={nextAction.title}
        supportingCopy={nextAction.description}
        primaryAction={{ label: nextAction.label, route: nextAction.path }}
        nextSignal={nextSignal}
        heroSrc={ramielHero}
        heroSrcSet={`${ramielHeroSmall} 576w, ${ramielHero} 1152w, ${ramielHeroLarge} 1536w`}
        recoveryAction={
          home.account
            ? undefined
            : { label: '恢复已有备份', route: '/assets/account#restore-backup' }
        }
        discArtUrls={discArtUrls}
        readiness={{
          stateLabel: home.account ? '本机账户' : '开始使用',
          stateTitle: localStatus,
          accountName: home.account?.displayName ?? '尚未选择',
          agentCount: ownedAgents.length,
          discCount: home.discs.length,
          assetLabel:
            assetCacheStatus.kind === 'ready' && discArtUrls.length === 2
              ? '图鉴素材可用'
              : assetCacheLabel,
          assetDetail: assetCacheDetail,
        }}
        assetAction={{
          label: assetCacheStatus.kind === 'ready' ? '图片已缓存' : assetDownloadLabel,
          disabled: assetOperationPending || assetCacheStatus.kind === 'ready',
          onClick: () => void downloadVisualAssets(),
        }}
        onManageImages={() => assetDialog.current?.showModal()}
        journey={journey}
      />
      <HomeAssetDialog
        assetDialog={assetDialog}
        assetCacheLabel={assetCacheLabel}
        assetOperationPending={assetOperationPending}
        removeVisualAssets={removeVisualAssets}
        removingImages={removingImages}
        downloadVisualAssets={downloadVisualAssets}
        assetDownloadLabel={assetDownloadLabel}
      />
    </>
  )
}
