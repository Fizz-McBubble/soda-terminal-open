import { getAgentName } from '../application/publicRosterNames'
import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, vi } from 'vitest'
import { database } from '../db/database'
import { scopeLegacyEntity } from '../accounts/types'
import {
  materializeTeamWarehouse,
  type TeamWarehouseMaterializerOptions,
} from '../testing/teamWarehouseMaterializer'

export const optimizerFlowIntegrationTestTimeout = 30_000

/** Capture all three stores to verify that rematching never changes account assets or plans. */
export async function readOptimizerTeamAccountState() {
  return {
    rosters: await database.accountRosters.toArray(),
    discs: await database.accountDriveDiscs.toArray(),
    drafts: await database.accountPlanningDrafts.toArray(),
  }
}

export function setupRealTeamRematchModules() {
  beforeAll(async () => {
    await Promise.all([
      import('../application/localCalculationQueryClientCore'),
      import('../decision/accountDecisionService'),
      import('./optimizer/TeamPicker'),
      import('./TeamPlan'),
    ])
  }, 120_000)
}

/** Visit the selected team's detail directly, without confirming its suggested Bangboo. */
export async function openSourceDefaultTeamDetail() {
  const destination = (await findFitTeamEquipmentButton()).getAttribute('data-player-route')
  if (!destination?.startsWith('/loadouts/team/')) throw new Error('Expected a team detail route')
  await act(async () => {
    window.history.pushState({}, '', destination)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

const optimizerFlowTransitionTimeout = { timeout: 20_000 } as const

export function setupOptimizerFlowTestIsolation() {
  afterEach(() => vi.restoreAllMocks())
  beforeEach(async () => {
    database.close()
    await database.delete()
    await database.open()
    window.history.pushState({}, '', '/optimizer')
  })
}

export function findAnalyzeCurrentTeamButton() {
  return screen.findByRole('button', { name: '分析当前队伍' }, optimizerFlowTransitionTimeout)
}

export async function findCurrentTeamRecommendations() {
  return waitFor(
    () => within(screen.getByRole('main')).getByRole('list', { name: '当前推荐' }),
    optimizerFlowTransitionTimeout,
  )
}

export async function findFitTeamEquipmentButton() {
  const actions = await screen.findByRole(
    'navigation',
    { name: '所选队伍操作' },
    optimizerFlowTransitionTimeout,
  )
  return within(actions).findByRole('button', { name: '搭配装备' }, optimizerFlowTransitionTimeout)
}

/** Select the original reviewed core explicitly; list order is not a core identity. */
export async function selectSameCoreFixtureTeam(user: {
  click: (target: HTMLElement) => Promise<unknown>
}) {
  const teams = await findCurrentTeamRecommendations()
  const core = await within(teams).findByRole(
    'button',
    { name: /^蕾米埃尔.*[维薇]琳娜/u },
    optimizerFlowTransitionTimeout,
  )
  await user.click(core)
}

export async function findTeamEquipmentHeading() {
  // A restored lazy route can replace the initial shell; query the live main each time.
  return waitFor(
    () => within(screen.getByRole('main')).getByRole('heading', { name: /的方案配装/ }),
    optimizerFlowTransitionTimeout,
  )
}

/** Route identity can change before React commits the new formation. */
export function readSettledTeamMemberTabs(memberIds: readonly string[]) {
  const names = memberIds.map((id) => getAgentName(id))
  return waitFor(
    () => {
      const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
      expect(tabs).toHaveLength(names.length)
      for (const name of names) expect(tabs.filter((tab) => tab?.includes(name))).toHaveLength(1)
      return tabs
    },
    { timeout: optimizerFlowIntegrationTestTimeout },
  )
}

/**
 * Seeds the constraint-aware team warehouse fixture through the shared materializer so the Vitest
 * suites and the real public-build journey E2E cannot drift into two sets of rules.
 */
export async function seedTeamWarehouse(options: TeamWarehouseMaterializerOptions = {}) {
  return materializeTeamWarehouse(database, options)
}

/** Add a distinct legal physical item so the live calculation input actually changes. */
export async function addWarehouseDisc() {
  const disc = await database.accountDriveDiscs.toCollection().first()
  if (!disc) throw new Error('Expected a test drive disc')
  const spare = scopeLegacyEntity(
    disc.accountId,
    { ...disc, id: `${disc.id}-spare` },
    new Date().toISOString(),
  )
  await act(async () => {
    await database.accountDriveDiscs.add(spare)
  })
}
