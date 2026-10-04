import { screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { database } from '../db/database'
import {
  materializeTeamWarehouse,
  type TeamWarehouseMaterializerOptions,
} from '../testing/teamWarehouseMaterializer'

export const optimizerFlowIntegrationTestTimeout = 30_000

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

export function findCurrentTeamRecommendations() {
  return screen.findByRole('list', { name: '当前推荐' }, optimizerFlowTransitionTimeout)
}

export function findFitTeamEquipmentButton() {
  return screen.findByRole('button', { name: '搭配装备' }, optimizerFlowTransitionTimeout)
}

export function findTeamEquipmentHeading() {
  return screen.findByRole('heading', { name: /的方案配装/ }, optimizerFlowTransitionTimeout)
}

/**
 * Seeds the constraint-aware team warehouse fixture through the shared materializer so the Vitest
 * suites and the real public-build journey E2E cannot drift into two sets of rules.
 */
export async function seedTeamWarehouse(options: TeamWarehouseMaterializerOptions = {}) {
  return materializeTeamWarehouse(database, options)
}
