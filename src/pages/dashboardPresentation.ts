import { Database, RefreshCw, ScanLine, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supportsPotentialImage } from '../assault/agentCapabilities'
import type { useAccountDecisionWorld } from '../application/accountDecisionWorld'
import { inspectSkillInvestments } from '../decision/accountDecisionBands'
import { resolveWEngine } from '../decision/wEngineResolver'

export type PendingStagingRead =
  | { status: 'ready'; accountId: string | null; count: number }
  | { status: 'error'; accountId: string; message: string }

type DecisionWorld = ReturnType<typeof useAccountDecisionWorld>
type LiveInput = NonNullable<DecisionWorld['liveInput']>
type Warehouse = LiveInput['warehouse']

export interface DashboardHomeData {
  account: Warehouse['account'] | null
  roster: Warehouse['roster'] | null
  discs: Warehouse['discs']
  drafts: LiveInput['drafts']
}

export type DashboardAgent = NonNullable<NonNullable<DashboardHomeData['roster']>['agents']>[number]
export type DashboardDraft = DashboardHomeData['drafts'][number]

export interface DashboardNextAction {
  eyebrow: string
  title: string
  description: string
  label: string
  path: string
  icon: LucideIcon
}

export interface DashboardJourneyStep {
  label: string
  description: string
  path: string
  icon: LucideIcon
  ready: boolean
  state: 'recovery' | 'current' | 'ready' | 'upcoming'
}

function hasSixResolvedDiscSlots(agent: DashboardAgent, discs: DashboardHomeData['discs']) {
  const ids = agent.equippedDiscIds
  if (!ids || ids.length !== 6 || new Set(ids).size !== 6) return false
  const discById = new Map(discs.map((disc) => [disc.id, disc]))
  const slots = ids.flatMap((id) => {
    const slot = discById.get(id)?.slot
    return slot !== undefined && Number.isInteger(slot) && slot >= 1 && slot <= 6 ? [slot] : []
  })
  return slots.length === 6 && new Set(slots).size === 6
}

function hasKnownApplicablePotential(agent: DashboardAgent) {
  if (!supportsPotentialImage(agent.agentId)) return true
  const value = agent.potentialImage
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

export function deriveDashboardDevelopmentGap(
  home: Pick<DashboardHomeData, 'roster' | 'discs'>,
  ownedAgents: readonly DashboardAgent[],
) {
  return ownedAgents.some((agent) => {
    const skills = inspectSkillInvestments(agent)
    return (
      agent.level !== 60 ||
      agent.completeness !== 'complete' ||
      resolveWEngine({ agent, legacyWEngines: home.roster?.wEngines }).current === null ||
      skills.knownGapCount > 0 ||
      skills.unknownCount > 0 ||
      !hasKnownApplicablePotential(agent) ||
      !hasSixResolvedDiscSlots(agent, home.discs)
    )
  })
}

export function deriveDashboardNextAction({
  home,
  pendingStagingStatus,
  pendingStagingCount,
  pendingStagingRead,
  ownedAgents,
  savedTeamPlans,
  decisionWorld,
}: {
  home: DashboardHomeData | undefined
  pendingStagingStatus: 'loading' | 'error' | 'pending' | 'none'
  pendingStagingCount: number | null
  pendingStagingRead: PendingStagingRead | undefined
  ownedAgents: DashboardAgent[]
  savedTeamPlans: DashboardDraft[]
  decisionWorld: DecisionWorld
}): DashboardNextAction {
  if (!home?.account)
    return {
      eyebrow: '从首次扫描开始',
      title: '创建账户并扫描',
      description: '先建立本机账户，再扫描游戏仓库。',
      label: '前往扫描与导入',
      path: '/system/scanner',
      icon: Database,
    }
  if (!home.discs.length && pendingStagingStatus === 'loading')
    return {
      eyebrow: '正在读取扫描结果',
      title: '等待扫描结果',
      description: '读取完成后会显示可导入的驱动盘。',
      label: '查看扫描与导入',
      path: '/system/scanner',
      icon: ScanLine,
    }
  if (!home.discs.length && pendingStagingStatus === 'error')
    return {
      eyebrow: '扫描结果暂时不可用',
      title: '重新读取扫描结果',
      description: `${pendingStagingRead?.status === 'error' ? pendingStagingRead.message : '读取失败。'} 可前往扫描页重试。`,
      label: '查看扫描与导入',
      path: '/system/scanner',
      icon: ScanLine,
    }
  if (!home.discs.length && pendingStagingStatus === 'pending' && pendingStagingCount)
    return {
      eyebrow: '已有待确认数据',
      title: '继续检查并导入',
      description: `${pendingStagingCount} 份扫描结果等待确认。`,
      label: '导入',
      path: '/system/data/import-discs',
      icon: ScanLine,
    }
  if (!home.discs.length)
    return {
      eyebrow: '还没有驱动盘记录',
      title: '扫描或导入本地数据',
      description: '把游戏中的驱动盘记录到当前账户，然后开始配装。',
      label: '继续：扫描与导入',
      path: '/system/scanner',
      icon: ScanLine,
    }
  if (!ownedAgents.length)
    return {
      eyebrow: '驱动盘已记录',
      title: '记录代理人资料',
      description: '记录拥有的代理人，再为他们搭配驱动盘。',
      label: '查看我的资产',
      path: '/assets/agents',
      icon: Users,
    }
  if (
    (decisionWorld.status === 'current' || decisionWorld.status === 'unavailable') &&
    ownedAgents.length < 3 &&
    !savedTeamPlans.length
  )
    return {
      eyebrow: '记录拥有的代理人',
      title: '记录代理人资料',
      description: '记录至少三名拥有的代理人，再选择队伍配装。',
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
      path: '/loadouts/team',
      icon: Users,
    }
  return {
    eyebrow:
      decisionWorld.status === 'stale'
        ? '配装建议待更新'
        : decisionWorld.run?.decisionAuthority.status === 'ready'
          ? '可按当前仓库搭配队伍'
          : '选择队伍并配装',
    ...shared,
    path:
      shared.path === '/loadouts/team' && decisionWorld.status === 'stale'
        ? '/loadouts/team?reanalyze=1'
        : shared.path,
    description: shared.description,
    label: `继续：${shared.label}`,
    icon:
      decisionWorld.status === 'stale'
        ? RefreshCw
        : shared.path === '/warehouse/discs'
          ? ShieldCheck
          : Users,
  }
}

export function deriveDashboardJourney({
  home,
  ownedAgents,
  savedTeamPlans,
  nextActionPath,
  decisionWorldStatus,
}: {
  home: DashboardHomeData
  ownedAgents: DashboardAgent[]
  savedTeamPlans: DashboardDraft[]
  nextActionPath: string
  decisionWorldStatus: string
}): DashboardJourneyStep[] {
  const developmentGap = deriveDashboardDevelopmentGap(home, ownedAgents)
  const journeyCore = [
    {
      label: '扫描与导入',
      description: home.discs.length ? `已导入 ${home.discs.length} 张驱动盘` : '尚未建立仓库',
      path: '/system/scanner',
      icon: ScanLine,
      ready: Boolean(home?.discs.length),
    },
    {
      label: '我的资产',
      description: home.account
        ? ownedAgents.length
          ? `已记录 ${ownedAgents.length} 名代理人`
          : '等待记录代理人'
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
        : '等待记录代理人',
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
      nextActionPath === step.path ||
      nextActionPath.startsWith(`${step.path}/`) ||
      nextActionPath.startsWith(`${step.path}?`),
  )
  const recoveryJourneyIndex = decisionWorldStatus === 'stale' ? 3 : -1
  return journeyCore.map((step, index) => ({
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
}

export function deriveDashboardHeadline(title: string): [string, string] {
  switch (title) {
    case '创建账户并扫描':
      return ['创建账户', '开始扫描']
    case '继续完成当前方案':
      return ['继续完成', '当前方案']
    case '更新配装建议':
      return ['更新', '配装建议']
    case '建立或恢复账户':
      return ['建立或恢复', '本地账户']
    case '扫描或导入本地数据':
      return ['扫描或导入', '本地资料']
    case '继续检查并导入':
      return ['继续检查', '确认导入']
    case '等待扫描结果':
      return ['等待读取', '扫描结果']
    case '重新读取扫描结果':
      return ['重新读取', '扫描结果']
    case '记录代理人资料':
      return ['记录代理人', '已有装备']
    case '重新生成队伍方案':
      return ['恢复队伍', '配装方案']
    case '选择队伍并配装':
      return ['选择队伍', '搭配装备']
    default:
      return ['查看当前', '队伍方案']
  }
}

export function deriveDashboardNextSignal({
  hasAccount,
  hasDiscs,
  decisionWorld,
  retryingAccountRead,
  pendingStagingStatus,
  pendingStagingRead,
  savedTeamPlansLength,
  retryAnalysis,
  setPendingStagingRetry,
}: {
  hasAccount: boolean
  hasDiscs: boolean
  decisionWorld: DecisionWorld
  retryingAccountRead: boolean
  pendingStagingStatus: 'loading' | 'error' | 'pending' | 'none'
  pendingStagingRead: PendingStagingRead | undefined
  savedTeamPlansLength: number
  retryAnalysis: () => void
  setPendingStagingRetry: (updater: (value: number) => number) => void
}) {
  const ordinaryNextSignal =
    decisionWorld.status === 'stale'
      ? {
          label: '配装建议待更新',
          summary: '按当前角色和装备更新建议。',
        }
      : savedTeamPlansLength
        ? {
            label: `${savedTeamPlansLength} 份队伍方案已保存`,
            summary: '打开方案继续配装。',
          }
        : {
            label: '使用旅程',
            summary: '下方五个入口会保留当前状态，可直接进入已完成或正在处理的步骤。',
            hidden: true,
          }

  if (hasAccount && (decisionWorld.calculation || retryingAccountRead)) {
    return {
      label:
        decisionWorld.calculation?.phase === 'reading_account'
          ? '正在读取账户资料'
          : decisionWorld.calculation?.phase === 'preparing_rules'
            ? '正在准备分析资料'
            : '正在分析账户资料',
      summary: '可先查看资产，分析完成后查看配装建议。',
      busy: true,
      action: decisionWorld.cancelCalculation
        ? { label: '停止分析', onClick: decisionWorld.cancelCalculation }
        : undefined,
    }
  }

  if (hasAccount && decisionWorld.calculationCancelled && decisionWorld.status !== 'error') {
    return {
      label: '分析已取消',
      summary: '',
      action: { label: '重新分析', onClick: retryAnalysis },
    }
  }

  if (hasAccount && decisionWorld.analysisIssue) {
    return {
      label: '分析未完成',
      summary: decisionWorld.analysisIssue.message,
      alert: true,
      action: { label: '重试分析', onClick: retryAnalysis },
    }
  }

  if (hasAccount && decisionWorld.status === 'error') {
    return {
      label: '当前分析未完成',
      summary: decisionWorld.message,
      alert: true,
      action: {
        label: decisionWorld.canRepairApplicationData ? '恢复应用资料' : '重新分析',
        onClick: retryAnalysis,
      },
    }
  }

  if (hasAccount && !hasDiscs && pendingStagingStatus === 'loading') {
    return {
      label: '正在读取扫描结果',
      summary: '读取完成后会显示可导入的驱动盘。',
      busy: true,
    }
  }

  if (hasAccount && !hasDiscs && pendingStagingStatus === 'error') {
    return {
      label: '待导入数据读取失败',
      summary:
        pendingStagingRead?.status === 'error'
          ? `${pendingStagingRead.message} 可前往扫描页重试。`
          : '可前往扫描页重新读取。',
      alert: true,
      action: {
        label: '重试核对',
        onClick: () => setPendingStagingRetry((value) => value + 1),
      },
    }
  }

  return ordinaryNextSignal
}
