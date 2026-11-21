import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import ramielHero from '../assets/golden-sample/ramiel-user-cutout-1152.webp'
import ramielHeroSmall from '../assets/golden-sample/ramiel-user-cutout-576.webp'
import ramielHeroLarge from '../assets/golden-sample/ramiel-user-cutout-1536.webp'
import {
  getVisualAssetInstallErrorMessage,
  officialCatalogAssets,
  resolveCachedVisualAsset,
} from '../assets/visualAssets'
import {
  ensureOfficialCatalogInstalled,
  cancelOfficialCatalogInstall,
  removeOfficialCatalogImages,
  getOfficialCatalogInstallStatus,
  subscribeOfficialCatalogInstallStatus,
} from '../assets/visualAssetInstallCoordinator'
import { HomeAssetDialog } from './HomeAssetDialog'
import { F5HomeGoldenView } from '../components/F5GoldenViews'
import { database } from '../db/databaseCore'
import { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import {
  deriveDashboardHeadline,
  deriveDashboardJourney,
  deriveDashboardNextAction,
  deriveDashboardNextSignal,
  type PendingStagingRead,
} from './dashboardPresentation'

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
  const [pendingStagingRetry, setPendingStagingRetry] = useState(0)
  const pendingStagingRead = useLiveQuery(async (): Promise<PendingStagingRead> => {
    const accountId = accountInput?.warehouse.accountId
    if (!accountId) return { status: 'ready', accountId: null, count: 0 }
    try {
      const staging = await database.accountScanImportBatches
        .where('accountId')
        .equals(accountId)
        .toArray()
      return {
        status: 'ready',
        accountId,
        count: staging.filter((batch) => batch.importHistory.at(-1)?.action !== 'imported').length,
      }
    } catch {
      return {
        status: 'error',
        accountId,
        message: '暂时无法核对待导入结果。',
      }
    }
  }, [accountInput?.warehouse.accountId, pendingStagingRetry])
  const currentAccountId = accountInput?.warehouse.accountId
  const pendingStagingStatus =
    !currentAccountId || pendingStagingRead?.accountId !== currentAccountId
      ? ('loading' as const)
      : pendingStagingRead.status === 'error'
        ? ('error' as const)
        : pendingStagingRead.count > 0
          ? ('pending' as const)
          : ('none' as const)
  const pendingStagingCount =
    pendingStagingRead?.status === 'ready' && pendingStagingRead.accountId === currentAccountId
      ? pendingStagingRead.count
      : null
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
    } catch (error) {
      setAssetManagementError(getVisualAssetInstallErrorMessage(error))
    }
  }

  async function removeVisualAssets() {
    if (assetOperationPending) return
    setRemovingImages(true)
    setAssetManagementError(null)
    try {
      await removeOfficialCatalogImages()
      setAssetCacheStatus(getOfficialCatalogInstallStatus())
    } catch {
      setAssetManagementError('部分图片未能删除，请重试。')
    } finally {
      setDiscArtUrls([])
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
        {decisionWorld.canRepairApplicationData ? (
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
  const savedTeamPlans = home.drafts.filter(
    (draft) => draft.kind === 'team' && draft.state === 'saved',
  )
  const nextAction = deriveDashboardNextAction({
    home,
    pendingStagingStatus,
    pendingStagingCount,
    pendingStagingRead,
    ownedAgents,
    savedTeamPlans,
    decisionWorld,
  })

  const journey = deriveDashboardJourney({
    home,
    ownedAgents,
    savedTeamPlans,
    nextActionPath: nextAction.path,
    decisionWorldStatus: decisionWorld.status,
  })
  const localStatus = !home.account
    ? '尚未选择本地账户'
    : !home.discs.length
      ? pendingStagingStatus === 'loading'
        ? '正在读取扫描结果'
        : pendingStagingStatus === 'error'
          ? '扫描结果暂时无法读取'
          : pendingStagingStatus === 'pending'
            ? '扫描结果等待确认'
            : '等待首次扫描'
      : decisionWorld.status === 'stale'
        ? '配装建议待更新'
        : '本地资料可以继续使用'
  const homeStageLabel = !home.account
    ? '首次使用'
    : decisionWorld.calculation
      ? '资料已记录'
      : pendingStagingStatus === 'loading'
        ? '正在读取扫描结果'
        : pendingStagingStatus === 'error'
          ? '扫描结果待重试'
          : pendingStagingStatus === 'pending'
            ? '扫描结果待确认'
            : decisionWorld.status === 'stale'
              ? '资料待刷新'
              : savedTeamPlans.length
                ? '方案可继续'
                : '账户可用'
  const headline = deriveDashboardHeadline(nextAction.title)
  const retryAnalysis = () => {
    if (retryingAccountRead) return
    setRetryingAccountRead(true)
    const retry =
      decisionWorld.status === 'error' && decisionWorld.canRepairApplicationData
        ? decisionWorld.repairApplicationData()
        : decisionWorld.refresh()
    void retry.catch(() => undefined).finally(() => setRetryingAccountRead(false))
  }
  const nextSignal = deriveDashboardNextSignal({
    hasAccount: Boolean(home.account),
    hasDiscs: Boolean(home.discs.length),
    decisionWorld,
    retryingAccountRead,
    pendingStagingStatus,
    pendingStagingRead,
    savedTeamPlansLength: savedTeamPlans.length,
    retryAnalysis,
    setPendingStagingRetry,
  })
  const assetCacheLabel =
    assetManagementError ??
    (assetCacheStatus.kind === 'loading'
      ? `图鉴图片 ${assetCacheStatus.completed}/${assetCacheStatus.total}`
      : assetCacheStatus.kind === 'ready'
        ? '图鉴图片已就绪'
        : assetCacheStatus.kind === 'idle'
          ? '图鉴图片待补齐'
          : assetCacheStatus.kind === 'partial'
            ? `图鉴图片还差 ${assetCacheStatus.failed} 张`
            : '图鉴图片加载失败')
  const assetCacheDetail =
    assetCacheStatus.kind === 'error' || assetCacheStatus.kind === 'partial'
      ? '已有图片继续显示；可稍后补齐。'
      : assetCacheStatus.kind === 'loading'
        ? '正在准备资产与配装页面的展示图片。'
        : '资产与配装页面会使用这些图片。'
  const assetDownloadLabel =
    assetCacheStatus.kind === 'loading'
      ? '正在更新图片…'
      : assetCacheStatus.kind === 'ready'
        ? '检查图片更新'
        : assetCacheStatus.kind === 'idle'
          ? '重新加载图片'
          : '补齐图片'
  return (
    <>
      <F5HomeGoldenView
        statusLabel={homeStageLabel}
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
          assetLabel: assetCacheLabel,
          assetDetail: assetCacheDetail,
        }}
        assetAction={{
          label:
            assetCacheStatus.kind === 'ready' && !assetManagementError
              ? '图片已更新'
              : assetDownloadLabel,
          disabled:
            assetOperationPending || (assetCacheStatus.kind === 'ready' && !assetManagementError),
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
        isDownloading={assetCacheStatus.kind === 'loading'}
        cancelDownloadVisualAssets={() => {
          cancelOfficialCatalogInstall()
          setAssetCacheStatus(getOfficialCatalogInstallStatus())
        }}
      />
    </>
  )
}
