import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import type { initializeDatabase } from './db/database'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppInitializationGate, AppRouteError, AppRouteLoading } from './components/AppEntryState'
import { AppShell } from './components/AppShell'
import { AccountDecisionWorldProvider } from './application/accountDecisionWorld'
import { shouldAutoCalculateAccountDecision } from './application/decisionRoutePolicy'
import type { CalculationQueryClient } from './application/calculationQueryContract'
import type { RuntimeSelectionReader } from './application/accountDecisionWorldModel'
import { DashboardPage } from './pages/DashboardPage'
import { UsageStatistics } from './usageStatistics/UsageStatistics'
import {
  LegacyAgentsRedirect,
  LegacyAssaultRedirect,
  LegacyBuildAdviceRedirect,
  LegacyDataCenterRedirect,
  LegacyDiscWorkbenchRedirect,
  LegacyAssetDiscDetailRedirect,
  LegacyLoadoutJourneyRedirect,
  LegacyOptimizerAgentRedirect,
  LegacyOptimizerCompareRedirect,
  LegacyOptimizerPlanRedirect,
  LegacyOptimizerRootRedirect,
  LegacyOptimizerTeamRedirect,
  LegacyRosterRedirect,
  LegacyTemplateRedirect,
} from './routes/legacyRedirects'

export type DecisionEnvironment = {
  mode: 'local' | 'remote'
  queryClient: CalculationQueryClient
  runtimeSelectionReader: RuntimeSelectionReader
  repairRuntimeSelection: (() => Promise<unknown>) | null
}

export type HealthProviderComponent = ComponentType<{
  children: ReactNode
  databaseInitializer?: typeof initializeDatabase
}>

function PlayerDecisionWorld({
  decisionEnvironment,
}: {
  decisionEnvironment: DecisionEnvironment
}) {
  const { pathname, search } = useLocation()
  const onlineMode = decisionEnvironment.mode === 'remote'
  const [onlineAllowed, setOnlineAllowed] = useState(() => {
    try {
      return sessionStorage.getItem('soda-online-calculation-consent-v1') === 'allowed'
    } catch {
      return false
    }
  })
  const allowOnlineCalculation = () => {
    try {
      sessionStorage.setItem('soda-online-calculation-consent-v1', 'allowed')
    } catch {
      // Private browsing may block storage; consent still applies to this page.
    }
    setOnlineAllowed(true)
  }
  const queryClient = useMemo<CalculationQueryClient>(() => {
    if (!onlineMode || onlineAllowed) return decisionEnvironment.queryClient
    const requireConsent = () => {
      throw new Error('请先阅读在线计算说明并允许本次页面发送必要计算事实。')
    }
    return {
      ...decisionEnvironment.queryClient,
      releaseAccountDecisionRun: () => undefined,
      calculateAccountDecision: requireConsent,
      queryDecisionPortfolio: requireConsent,
      calculateTargetTeamWarehouseFit: requireConsent,
      queryDevelopmentCandidateAlternatives: requireConsent,
      queryWarehouseDiscTransitionUses: requireConsent,
    }
  }, [onlineAllowed, onlineMode, decisionEnvironment])
  return (
    <AppShell
      onAllowOnlineCalculation={onlineMode && !onlineAllowed ? allowOnlineCalculation : undefined}
    >
      <AppInitializationGate>
        <UsageStatistics />
        <AccountDecisionWorldProvider
          queryClient={queryClient}
          runtimeSelectionReader={decisionEnvironment.runtimeSelectionReader}
          repairRuntimeSelection={decisionEnvironment.repairRuntimeSelection}
          autoCalculate={
            (!onlineMode || onlineAllowed) &&
            shouldAutoCalculateAccountDecision(pathname, search, decisionEnvironment.mode)
          }
        >
          <Outlet />
        </AccountDecisionWorldProvider>
      </AppInitializationGate>
    </AppShell>
  )
}

export default function AppCore({
  databaseInitializer,
  decisionEnvironment,
  HealthProvider,
}: {
  databaseInitializer?: typeof initializeDatabase
  decisionEnvironment: DecisionEnvironment
  HealthProvider: HealthProviderComponent
}) {
  const [router] = useState(() =>
    createBrowserRouter([
      {
        HydrateFallback: AppRouteLoading,
        ErrorBoundary: AppRouteError,
        element: <PlayerDecisionWorld decisionEnvironment={decisionEnvironment} />,
        children: [
          {
            path: 'development/:agentId/loadouts',
            lazy: async () => ({
              Component: (await import('./pages/AgentLoadoutComparisonPage'))
                .AgentLoadoutComparisonPage,
            }),
          },
          {
            path: 'development/:agentId',
            lazy: async () => ({
              Component: (await import('./pages/AgentDevelopmentWorkbenchPage'))
                .AgentDevelopmentWorkbenchPage,
            }),
          },
          {
            path: 'development',
            lazy: async () => ({
              Component: (await import('./pages/AgentDevelopmentGoldenDirectoryPage'))
                .AgentDevelopmentGoldenDirectoryPage,
            }),
          },
          { index: true, element: <DashboardPage /> },
          {
            path: 'assets',
            lazy: async () => ({
              Component: (await import('./pages/AssetCenterPage')).AssetCenterPage,
            }),
          },
          {
            path: 'assets/:assetType',
            lazy: async () => ({
              Component: (await import('./pages/AssetCenterPage')).AssetCenterPage,
            }),
          },
          {
            path: 'warehouse/discs',
            lazy: async () => ({
              Component: (await import('./pages/WarehouseDiscsPage')).WarehouseDiscsPage,
            }),
          },
          {
            path: 'agents/:agentId',
            element: <LegacyAgentsRedirect />,
          },
          {
            path: 'agents',
            element: <LegacyAgentsRedirect />,
          },
          {
            path: 'workbench/disc-analysis',
            element: <LegacyDiscWorkbenchRedirect />,
          },
          {
            path: 'optimizer',
            element: <LegacyOptimizerRootRedirect />,
          },
          {
            path: 'loadouts/team',
            lazy: async () => ({
              Component: (await import('./pages/OptimizerFlowPage')).OptimizerFlowPage,
            }),
          },
          {
            path: 'loadouts/team/portfolio',
            element: <Navigate replace to="/loadouts/team" />,
          },
          {
            path: 'loadouts/team/:teamKey',
            lazy: async () => ({
              Component: (await import('./pages/OptimizerFlowPage')).OptimizerFlowPage,
            }),
          },
          {
            path: 'loadouts/team/result',
            element: <LegacyLoadoutJourneyRedirect />,
          },
          {
            path: 'loadouts/agent',
            element: <LegacyLoadoutJourneyRedirect />,
          },
          {
            path: 'loadouts/agent/:agentId',
            element: <LegacyLoadoutJourneyRedirect />,
          },
          {
            path: 'loadouts/agent/result',
            element: <LegacyLoadoutJourneyRedirect />,
          },
          {
            path: 'loadouts/compare',
            element: <LegacyOptimizerCompareRedirect />,
          },
          {
            path: 'loadouts/plans/:planId',
            lazy: async () => ({
              Component: (await import('./pages/OptimizerFlowPage')).OptimizerFlowPage,
            }),
          },
          {
            path: 'optimizer/team',
            element: <LegacyOptimizerTeamRedirect />,
          },
          {
            path: 'optimizer/team/result',
            element: <LegacyOptimizerTeamRedirect />,
          },
          {
            path: 'optimizer/team/:teamKey',
            element: <LegacyOptimizerTeamRedirect />,
          },
          {
            path: 'optimizer/agent',
            element: <LegacyOptimizerAgentRedirect />,
          },
          {
            path: 'optimizer/agent/result',
            element: <LegacyOptimizerAgentRedirect />,
          },
          {
            path: 'optimizer/agent/:agentId',
            element: <LegacyOptimizerAgentRedirect />,
          },
          {
            path: 'optimizer/compare',
            element: <LegacyOptimizerCompareRedirect />,
          },
          {
            path: 'optimizer/plans/:planId',
            element: <LegacyOptimizerPlanRedirect />,
          },
          {
            path: 'roster',
            element: <LegacyRosterRedirect />,
          },
          {
            path: 'assault/optimizer',
            element: <LegacyAssaultRedirect />,
          },
          {
            path: 'assault/results/:id',
            element: <Navigate to="/loadouts/team" replace />,
          },
          {
            path: 'assets/discs/:discId',
            element: <LegacyAssetDiscDetailRedirect />,
          },
          {
            path: 'assets/discs/:discId/edit',
            element: <LegacyAssetDiscDetailRedirect />,
          },
          {
            path: 'system/templates',
            element: <LegacyTemplateRedirect />,
          },
          {
            path: 'system/data',
            element: <LegacyDataCenterRedirect />,
          },
          {
            path: 'system/data/import-discs',
            lazy: async () => ({
              Component: (await import('./pages/FormalDiscImportPage')).FormalDiscImportPage,
            }),
          },
          {
            path: 'system/scanner',
            lazy: async () => ({
              Component: (await import('./pages/ScannerAssistantPage')).ScannerAssistantPage,
            }),
          },
          {
            path: 'system/help',
            lazy: async () => ({
              Component: (await import('./pages/HelpAndPrivacyPage')).HelpAndPrivacyPage,
            }),
          },
          ...(import.meta.env.DEV
            ? [
                {
                  path: 'system/data/review-dev',
                  lazy: async () => ({
                    Component: (await import('./pages/DataManagementPage')).DevDataManagementPage,
                  }),
                },
                {
                  path: 'system/data/audit',
                  lazy: async () => ({
                    Component: (await import('./pages/DataManagementPage'))
                      .DevPlayerAccountAuditPage,
                  }),
                },
              ]
            : []),
          {
            path: 'knowledge/data',
            element: <Navigate to="/" replace />,
          },
          {
            path: 'knowledge/build',
            element: <LegacyBuildAdviceRedirect />,
          },
          {
            path: '*',
            lazy: async () => ({
              Component: (await import('./pages/PlaceholderPage')).PlaceholderPage,
            }),
          },
        ],
      },
    ]),
  )

  const routerView = <RouterProvider router={router} />
  return (
    <AppErrorBoundary>
      <HealthProvider databaseInitializer={databaseInitializer}>
        <AppInitializationGate loadingFallback={routerView}>{routerView}</AppInitializationGate>
      </HealthProvider>
    </AppErrorBoundary>
  )
}
