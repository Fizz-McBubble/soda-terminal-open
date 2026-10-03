import { database, type SodaDatabase } from '../db/databaseCore'
import type { AccountRoster, ScenarioResult } from '../assault/types'
import {
  assertBangbooSkillFacts,
  assertRosterAscensionFacts,
  createEmptyRoster,
  hydrateRosterDefaults,
} from './rosterHydration'

const ROSTER_KEY = 'assault-roster-v1'
const RESULT_PREFIX = 'assault-result:'

function normalizeCoreLevel(value: unknown): number | null {
  if (typeof value === 'number' && value >= 1 && value <= 7) return value
  if (typeof value !== 'string') return null
  if (/^[1-7]$/.test(value)) return Number(value)
  const level = value.toUpperCase().charCodeAt(0) - 64
  return level >= 1 && level <= 7 ? level : null
}

export async function getRoster(db: SodaDatabase = database): Promise<AccountRoster> {
  const setting = await db.settings.get(ROSTER_KEY)
  const stored = setting?.value as Partial<AccountRoster> | undefined
  if (!stored?.agents) return createEmptyRoster()
  const hydrated = hydrateRosterDefaults(stored)
  return {
    ...hydrated,
    agents: hydrated.agents.map((agent) => ({
      ...agent,
      skillLevels: { ...agent.skillLevels, core: normalizeCoreLevel(agent.skillLevels.core) },
    })),
  }
}

export async function saveRoster(roster: AccountRoster, db: SodaDatabase = database) {
  assertBangbooSkillFacts(roster)
  assertRosterAscensionFacts(roster)
  const value = { ...roster, updatedAt: new Date().toISOString() }
  await db.settings.put({ key: ROSTER_KEY, value })
  return value
}

export async function saveScenarioResult(result: ScenarioResult, db: SodaDatabase = database) {
  const id = `${result.scenario.scope}-${Date.now()}`
  await db.settings.put({ key: `${RESULT_PREFIX}${id}`, value: { ...result, id } })
  return id
}

export async function getScenarioResult(id: string, db: SodaDatabase = database) {
  const setting = await db.settings.get(`${RESULT_PREFIX}${id}`)
  return setting?.value as (ScenarioResult & { id: string }) | undefined
}
