import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Database, RefreshCw, ScanLine, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import ramielHero from '../assets/golden-sample/ramiel-user-cutout-1152.webp'
import ramielHeroSmall from '../assets/golden-sample/ramiel-user-cutout-576.webp'
import ramielHeroLarge from '../assets/golden-sample/ramiel-user-cutout-1536.webp'
import {
  getVisualAssetInstallErrorMessage,
  getVisualAssetPackState,
  isVisualAssetPackCached,
  officialCatalogAssets,
  resolveCachedVisualAsset,
} from '../assets/visualAssets'
import {
  ensureOfficialCatalogInstalled,
  removeOfficialCatalogImages,
  getOfficialCatalogInstallProgress,
  subscribeOfficialCatalogInstallProgress,
} from '../assets/visualAssetInstallCoordinator'
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
  const pendingStaging = useLiveQuery(async () => {
    const accountId = accountInput?.warehouse.accountId
    if (!accountId) return 0
    const staging = await database.accountScanImportBatches
      .where('accountId')
      .equals(accountId)
      .toArray()
    return staging.filter((batch) => batch.importHistory.at(-1)?.action !== 'imported').length
  }, [accountInput?.warehouse.accountId])
  const [assetCacheStatus, setAssetCacheStatus] = useState<
    | { kind: 'checking' }
    | { kind: 'idle' }
    | { kind: 'incomplete' }
    | { kind: 'preparing'; completed: number }
    | { kind: 'ready' }
    | { kind: 'error'; message: string }
  >(() => ({ kind: 'checking' }))
  const [discArtUrls, setDiscArtUrls] = useState<string[]>([])
  const [retryingAccountRead, setRetryingAccountRead] = useState(false)
  const [removingImages, setRemovingImages] = useState(false)
  const assetDialog = useRef<HTMLDialogElement>(null)
  const assetOperationPending =
    assetCacheStatus.kind === 'checking' || assetCacheStatus.kind === 'preparing' || removingImages

  useEffect(() => {
    let active = true
    if (!('caches' in window)) {
      queueMicrotask(
        () =>
          active &&
          setAssetCacheStatus({ kind: 'error', message: '当前浏览器不支持本机图鉴图片缓存。' }),
      )
      return () => {
        active = false
      }
    }
    const onProgress = (completed: number) => {
      if (active) setAssetCacheStatus({ kind: 'preparing', completed })
    }
    const unsubscribe = subscribeOfficialCatalogInstallProgress(onProgress)
    void isVisualAssetPackCached()
      .then((cached) => {
        const state = getVisualAssetPackState()
        const hasImages = Boolean(
          state.activeCache ||
          state.wEngineCache ||
          Object.values(state.activeCaches ?? {}).some(Boolean),
        )
        if (active)
          setAssetCacheStatus({ kind: cached ? 'ready' : hasImages ? 'incomplete' : 'idle' })
      })
      .catch(() => {
        if (active)
          setAssetCacheStatus({
            kind: 'error',
            message: '本机图片暂时无法读取，请重试下载并加载图片。',
          })
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function downloadVisualAssets() {
    if (assetOperationPending) return
    if (!('caches' in window)) {
      setAssetCacheStatus({ kind: 'error', message: '当前浏览器不支持本机图鉴图片缓存。' })
      return
    }
    setAssetCacheStatus({ kind: 'preparing', completed: getOfficialCatalogInstallProgress() })
    try {
      await ensureOfficialCatalogInstalled({ verifyCache: true })
      setAssetCacheStatus({ kind: 'ready' })
    } catch (error) {
      setAssetCacheStatus({ kind: 'error', message: getVisualAssetInstallErrorMessage(error) })
    }
  }

  async function removeVisualAssets() {
    if (removingImages || assetCacheStatus.kind === 'preparing') return
    setRemovingImages(true)
    try {
      await removeOfficialCatalogImages()
      setDiscArtUrls([])
      setAssetCacheStatus({ kind: 'idle' })
    } catch {
      setAssetCacheStatus({ kind: 'error', message: '图片缓存未能完全删除，请重试。' })
    } finally {
      setRemovingImages(false)
    }
  }

  useEffect(() => {
    if (assetCacheStatus.kind !== 'ready') return
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

  if (decisionWorld.status === 'error')
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
        description: '在扫描页创建或选择本机账户，完成扫描、检查并确认导入。',
        label: '前往扫描与导入',
        path: '/system/scanner',
        icon: Database,
      }
    if (!home.discs.length && pendingStaging)
      return {
        eyebrow: '已有待确认数据',
        title: '继续正式导入',
        description: `${pendingStaging} 份扫描结果等待检查，确认导入后才会更新账户。`,
        label: '检查并确认导入',
        path: '/system/data/import-discs',
        icon: ScanLine,
      }
    if (!home.discs.length)
      return {
        eyebrow: '仓库尚未建立',
        title: '扫描或导入本地数据',
        description: '前往扫描页，读取游戏中的驱动盘。检查结果并确认导入后，即可开始配装。',
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
  const nextSignal =
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
  const assetCacheLabel =
    assetCacheStatus.kind === 'checking'
      ? '正在读取本机图片'
      : assetCacheStatus.kind === 'preparing'
        ? `正在准备图鉴素材 ${assetCacheStatus.completed}/${officialCatalogAssets.length}`
        : assetCacheStatus.kind === 'ready'
          ? '本机素材已就绪'
          : assetCacheStatus.kind === 'idle'
            ? '图鉴图片尚未下载'
            : assetCacheStatus.kind === 'incomplete'
              ? '图鉴图片需要更新或补全'
              : assetCacheStatus.message
  const assetCacheDetail =
    assetCacheStatus.kind === 'checking'
      ? '正在确认本机已有图片。'
      : assetCacheStatus.kind === 'idle'
        ? '下载后自动加载，保存在此浏览器。'
        : assetCacheStatus.kind === 'incomplete'
          ? '已有图片会保留，下载时只补齐需要更新的图片。'
          : assetCacheStatus.kind === 'error'
            ? '已有图片和账户资料保留，点击下方按钮重试。'
            : assetCacheStatus.kind === 'preparing'
              ? '下载完成后自动加载，可继续使用其他功能。'
              : '代理人、音擎、邦布和驱动盘图片保存在本机。'
  const assetDownloadLabel =
    assetCacheStatus.kind === 'checking'
      ? '正在读取图片…'
      : assetCacheStatus.kind === 'preparing'
        ? '正在下载图片…'
        : assetCacheStatus.kind === 'error'
          ? '重试下载并加载'
          : '下载并加载图片'
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
        discArtUrls={assetCacheStatus.kind === 'ready' ? discArtUrls : []}
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
          label: assetDownloadLabel,
          disabled: assetOperationPending,
          onClick: () => void downloadVisualAssets(),
        }}
        onManageImages={() => assetDialog.current?.showModal()}
        journey={journey}
      />
      <dialog
        id="home-asset-dialog"
        ref={assetDialog}
        className="home-asset-dialog"
        aria-labelledby="home-asset-dialog-title"
        aria-describedby="home-asset-dialog-note"
      >
        <header>
          <h2 id="home-asset-dialog-title">图鉴图片</h2>
          <button
            type="button"
            className="button button--quiet home-asset-dialog__close"
            aria-label="关闭图片管理"
            onClick={() => assetDialog.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <p role="status">{assetCacheLabel}</p>
        <p id="home-asset-dialog-note">仅删除图片，不影响账户资料。</p>
        <footer>
          <button
            className="button button--quiet"
            type="button"
            disabled={assetOperationPending}
            onClick={() => void removeVisualAssets()}
          >
            {removingImages ? '正在删除图片' : '删除本机图片缓存'}
          </button>
          <button
            className="home-primary-action"
            type="button"
            disabled={assetOperationPending}
            onClick={() => void downloadVisualAssets()}
          >
            {assetDownloadLabel}
          </button>
        </footer>
      </dialog>
    </>
  )
}
