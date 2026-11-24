import { lazy, Suspense, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { getActiveAccount } from '../../accounts/repository'
import {
  hasSavedTeamPanel,
  loadSavedTeamPanelWarehouse,
} from '../../accounts/savedTeamPanelWarehouse'
import { loadCoreWarehouseForAccount } from '../../accounts/coreWarehouse'
import { getAccountPlanningDraft } from '../../accounts/planningDraftReads'
import { useAccountDecisionWorld } from '../../application/accountDecisionWorldHooks'
import { useF5AccountSummary } from '../../components/f5AccountSummaryContext'
import { AccountRequiredState } from '../../components/ui/AccountRequiredState'
import { AppLoadingState } from '../../components/AppEntryState'
import { InvalidPlan } from '../InvalidPlan'
import { PublicSavedTeamHistory } from '../PublicSavedTeamHistory'

import '../team-loadout-journey.css'

const Editor = lazy(() => import('./SavedPlan').then((module) => ({ default: module.SavedPlan })))

const SavedPanel =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? null
    : lazy(() =>
        import('./SavedPlanPanelView').then((module) => ({ default: module.SavedPlanPanelView })),
      )

export function SavedPlanRoute() {
  const { planId = '' } = useParams()
  const mode = useOutletContext<'local' | 'remote' | undefined>()
  const [params, setParams] = useSearchParams()
  const snapshotView = mode === 'local' && SavedPanel !== null && params.get('review') !== '1'
  const summary = useF5AccountSummary()
  const world = useAccountDecisionWorld()
  const accountId = summary?.accountId
  const result = useLiveQuery(async () => {
    if (!accountId) return null
    const [account, plan] = await Promise.all([
      getActiveAccount(),
      getAccountPlanningDraft(accountId, planId),
    ])
    if (account?.id !== accountId) return null
    const scoped = snapshotView && hasSavedTeamPanel(plan)
    const warehouse =
      scoped && plan
        ? await loadSavedTeamPanelWarehouse(account, plan)
        : await loadCoreWarehouseForAccount(account)
    return { warehouse, plan, planId, scoped, snapshotView }
  }, [accountId, planId, snapshotView])
  const requested = useRef('')
  const identity = JSON.stringify([accountId, planId])
  const needsReplay =
    snapshotView &&
    result?.plan &&
    !result.scoped &&
    result.snapshotView === snapshotView &&
    result.planId === planId &&
    result.warehouse.accountId === accountId
  useEffect(() => {
    if (!needsReplay) {
      requested.current = ''
      return
    }
    if (requested.current === identity) return
    if (world.status === 'current' && world.run.input.warehouse.accountId === accountId) return
    requested.current = identity
    void world.refresh()
  }, [needsReplay, identity, accountId, world])
  if (summary && !summary.hydrating && !accountId)
    return <AccountRequiredState title="先创建或选择账户" />
  if (
    !accountId ||
    summary?.hydrating ||
    !result ||
    (mode && result.snapshotView !== snapshotView) ||
    result.planId !== planId ||
    result.warehouse.accountId !== accountId
  )
    return <AppLoadingState title="正在读取已保存方案" />
  const { plan, warehouse } = result
  if (!plan || plan.accountId !== accountId)
    return <InvalidPlan back="/loadouts/team" label="方案" />
  const pending =
    plan.kind === 'team' && !plan.teamPortfolioSnapshot ? (
      <PublicSavedTeamHistory plan={plan} warehouse={warehouse} verifying />
    ) : (
      <AppLoadingState title="正在读取已保存方案" />
    )
  const run = world.run
  if (
    !result.scoped &&
    (world.status === 'loading' || (run && run.input.warehouse.accountId !== accountId))
  )
    return pending
  if (result.scoped && SavedPanel) {
    const review = () =>
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set('review', '1')
        return next
      })
    return (
      <Suspense fallback={pending}>
        <SavedPanel key={plan.scopedId} plan={plan} warehouse={warehouse} onReview={review} />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={pending}>
      <Editor
        key={plan.scopedId}
        plan={plan}
        warehouse={warehouse}
        decision={run?.snapshot}
        readOnly={!run || world.status !== 'current'}
        pending={pending}
      />
    </Suspense>
  )
}
