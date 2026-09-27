import type { LucideIcon } from 'lucide-react'
import { Archive, House, ScanLine, ShieldCheck, Sparkles, Users } from 'lucide-react'

export type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
  description: string
  available?: boolean
}
export type NavigationGroup = { label: string; items: NavigationItem[] }
export type Breadcrumb = { label: string; path?: string }
export type RouteMeta = {
  title: string
  group?: string
  breadcrumbs: Breadcrumb[]
  backTo?: string
  backLabel?: string
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: '',
    items: [
      { label: '首页', path: '/', icon: House, description: '账号准备与下一步', available: true },
      {
        label: '扫描与导入',
        path: '/system/scanner',
        icon: ScanLine,
        description: '扫描游戏中的驱动盘并更新仓库',
        available: true,
      },
      {
        label: '我的资产',
        path: '/assets',
        icon: ShieldCheck,
        description: '账户、备份与四类资产',
        available: true,
      },
      {
        label: '代理人养成',
        path: '/development',
        icon: Sparkles,
        description: '当前状态、目标与差距',
        available: true,
      },
      {
        label: '队伍配装',
        path: '/loadouts/team',
        icon: Users,
        description: '选择队伍并搭配驱动盘',
        available: true,
      },
      {
        label: '驱动盘分析',
        path: '/warehouse/discs',
        icon: Archive,
        description: '筛选值得保留和可考虑清理的驱动盘',
        available: true,
      },
    ],
  },
]

export const quickActions = [
  { label: '扫描与导入', path: '/system/scanner', icon: ScanLine, tone: 'cyan' },
  { label: '查看仓库', path: '/warehouse/discs', icon: Archive, tone: 'orange' },
] as const

export const mobileNavigation = [
  { label: '首页', path: '/', icon: House },
  { label: '扫描', path: '/system/scanner', icon: ScanLine },
  { label: '资产', path: '/assets', icon: ShieldCheck },
  { label: '养成', path: '/development', icon: Sparkles },
  { label: '队伍', path: '/loadouts/team', icon: Users },
  { label: '驱动盘', path: '/warehouse/discs', icon: Archive },
] as const

export const allNavigationItems = navigationGroups.flatMap((group) => group.items)

export function isPrimaryNavigationCurrent(path: string, pathname: string) {
  if (path === '/') return pathname === '/'
  if (path === '/system/scanner')
    return pathname === '/system/scanner' || pathname === '/system/data/import-discs'
  if (path === '/assets')
    return pathname.startsWith('/assets') || pathname === '/system/data' || pathname === '/roster'

  if (path === '/development')
    return pathname.startsWith('/development') || pathname.startsWith('/optimizer/agent')
  if (path === '/loadouts/team')
    return (
      pathname.startsWith('/loadouts/team') ||
      pathname.startsWith('/loadouts/plans/') ||
      pathname.startsWith('/optimizer/team') ||
      pathname === '/optimizer'
    )

  return pathname === path || pathname.startsWith(`${path}/`)
}

export function getRouteMeta(pathname: string): RouteMeta {
  if (pathname === '/loadouts' || pathname.startsWith('/loadouts/')) {
    const isSavedPlan = pathname.startsWith('/loadouts/plans/')
    const isTeam =
      pathname === '/loadouts/team' || pathname.startsWith('/loadouts/team/') || isSavedPlan
    const isAgent = pathname === '/loadouts/agent' || pathname.startsWith('/loadouts/agent/')
    const isPortfolio = pathname === '/loadouts/team/portfolio'
    const isResult = isSavedPlan || /\/(team|agent)\/[^/]+$/.test(pathname)
    const scopeLabel = isTeam ? '队伍' : isAgent ? '角色' : '方案'
    const selectionPath = isAgent ? '/loadouts/agent' : '/loadouts/team'
    return {
      title: isTeam ? '队伍配装' : isResult ? `${scopeLabel}方案` : `${scopeLabel}配装`,
      group: '配装旅程',
      breadcrumbs: [
        { label: `${scopeLabel}配装`, path: selectionPath },
        ...(isResult
          ? [
              {
                label: isSavedPlan ? '已保存方案' : isPortfolio ? '队伍配装' : '方案',
              },
            ]
          : []),
      ],
      backTo: isResult ? selectionPath : '/',
      backLabel: isResult ? `返回${scopeLabel}配装` : '返回首页',
    }
  }
  if (pathname === '/warehouse/discs') {
    return {
      title: '驱动盘分析',
      group: '全仓决策',
      breadcrumbs: [{ label: '驱动盘分析' }],
      backTo: '/',
      backLabel: '返回首页',
    }
  }
  if (import.meta.env.DEV && pathname === '/system/data/audit') {
    return {
      title: '只读账户审计',
      breadcrumbs: [{ label: '本地系统' }, { label: '只读账户审计' }],
      backTo: '/system/data',
      backLabel: '返回数据中心',
    }
  }
  if (pathname === '/') {
    return { title: '首页', breadcrumbs: [{ label: '首页' }] }
  }
  if (pathname === '/development' || pathname.startsWith('/development/')) {
    const isWorkbench = /^\/development\/[^/]+$/.test(pathname)
    const isComparison = /^\/development\/[^/]+\/loadouts$/.test(pathname)
    const agentId = pathname.split('/')[2]
    return {
      title: '代理人养成',
      group: '养成旅程',
      breadcrumbs: [
        { label: '代理人养成', path: '/development' },
        ...(isWorkbench || isComparison
          ? [{ label: '养成工作台', path: `/development/${agentId}` }]
          : []),
        ...(isComparison ? [{ label: '方案比较' }] : []),
      ],
      backTo: isComparison ? `/development/${agentId}` : isWorkbench ? '/development' : undefined,
    }
  }
  if (pathname === '/agents' || pathname.startsWith('/agents/'))
    return {
      title: '代理人养成',
      group: '主任务',
      breadcrumbs: [{ label: '代理人养成' }],
      backTo: pathname === '/agents' ? '/development' : '/development',
      backLabel: '返回代理人目录',
    }
  if (pathname === '/assets' || /^\/assets\/(agents|wengines|bangboos|discs)$/.test(pathname)) {
    return {
      title: '我的资产',
      group: '本地档案',
      breadcrumbs: [{ label: '我的资产' }],
      backTo: '/',
      backLabel: '返回首页',
    }
  }
  if (pathname === '/assets/account') {
    return {
      title: '账户与备份',
      group: '我的资产',
      breadcrumbs: [{ label: '我的资产', path: '/assets' }, { label: '账户与备份' }],
      backTo: '/assets',
      backLabel: '返回我的资产',
    }
  }
  if (pathname === '/workbench/disc-analysis') {
    return {
      title: '驱动盘鉴定',
      group: '数据与工具',
      breadcrumbs: [{ label: '数据与工具', path: '/system/data' }, { label: '驱动盘补录' }],
      backTo: '/',
      backLabel: '返回总览',
    }
  }
  if (pathname === '/system/data/import-discs') {
    return {
      title: '导入驱动盘',
      group: '扫描与导入',
      breadcrumbs: [{ label: '扫描与导入', path: '/system/scanner' }, { label: '导入驱动盘' }],
      backTo: '/system/scanner',
      backLabel: '返回扫描与导入',
    }
  }
  if (pathname === '/system/scanner') {
    return {
      title: '扫描与导入',
      group: '本地流程',
      breadcrumbs: [{ label: '扫描与导入' }],
      backTo: '/',
      backLabel: '返回首页',
    }
  }
  if (pathname === '/system/help') {
    return {
      title: '帮助与隐私',
      group: '使用说明',
      breadcrumbs: [{ label: '帮助与隐私' }],
      backTo: '/',
      backLabel: '返回首页',
    }
  }
  if (pathname === '/knowledge/build') {
    return {
      title: '养成建议',
      group: '低频上下文',
      breadcrumbs: [{ label: '低频上下文', path: '/system/data' }, { label: '养成建议' }],
      backTo: '/assets/agents',
      backLabel: '返回代理人资产',
    }
  }
  if (pathname === '/knowledge/data')
    return {
      title: '版本与资料',
      group: '低频上下文',
      breadcrumbs: [{ label: '低频上下文', path: '/system/data' }, { label: '版本与资料' }],
      backTo: '/',
      backLabel: '返回首页',
    }
  if (
    pathname === '/optimizer' ||
    /^\/optimizer\/(team|agent)(?:\/[^/]+)?$/.test(pathname) ||
    pathname === '/optimizer/compare' ||
    pathname.startsWith('/optimizer/plans/')
  ) {
    const isOptimizerRoot = pathname === '/optimizer'
    const isTeam = pathname.includes('/team')
    const isResult =
      /^\/optimizer\/(team|agent)\//.test(pathname) ||
      pathname === '/optimizer/compare' ||
      pathname.startsWith('/optimizer/plans/')
    return {
      title: isOptimizerRoot
        ? '队伍配装'
        : isResult
          ? `${isTeam ? '队伍' : '角色'}方案`
          : `${isTeam ? '队伍' : '角色'}配装`,
      group: '主任务',
      breadcrumbs: [
        { label: '配装', path: '/optimizer/team' },
        {
          label: `${isTeam ? '队伍' : '角色'}配装`,
          path: `/optimizer/${isTeam ? 'team' : 'agent'}`,
        },
        {
          label:
            pathname === '/optimizer/compare'
              ? '方案比较'
              : pathname.startsWith('/optimizer/plans/')
                ? '已保存方案'
                : isResult
                  ? '方案'
                  : '选择对象',
        },
      ],
      backTo: isResult ? `/optimizer/${isTeam ? 'team' : 'agent'}` : '/optimizer/team',
      backLabel: isResult ? '返回选择' : '返回队伍配装',
    }
  }
  if (pathname.startsWith('/assets/discs/')) {
    const isEditing = pathname.endsWith('/edit')
    return {
      title: isEditing ? '编辑驱动盘档案' : '已归档驱动盘',
      group: '我的资产',
      breadcrumbs: [
        { label: '我的资产', path: '/assets' },
        { label: '驱动盘', path: '/assets/discs' },
        { label: isEditing ? '编辑档案' : '已归档详情' },
      ],
      backTo: '/assets/discs',
      backLabel: '返回驱动盘仓库',
    }
  }
  if (pathname.startsWith('/assault/results/')) {
    return {
      title: '队伍方案结果',
      group: '队伍配装',
      breadcrumbs: [{ label: '队伍配装', path: '/loadouts/team' }, { label: '方案结果' }],
      backTo: '/loadouts/team',
      backLabel: '返回队伍配装',
    }
  }
  const item = allNavigationItems.find((candidate) => candidate.path === pathname)
  if (item) {
    const group = navigationGroups.find((candidate) => candidate.items.includes(item))?.label
    return {
      title: item.label,
      group,
      breadcrumbs: [{ label: group ?? '功能' }, { label: item.label }],
      backTo: '/',
      backLabel: '返回总览',
    }
  }
  return {
    title: '页面不存在',
    breadcrumbs: [{ label: '页面不存在' }],
    backTo: '/',
    backLabel: '返回总览',
  }
}
