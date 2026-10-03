import { createPhysicalCritProfileFixture } from './physicalCritProfileFixture'
import { defaultTeamPortfolioPreference } from '../accounts/teamPortfolioPreference'
import type { AgentDiscProfile } from '../assault/engine'
import { createEmptyRoster } from '../assault/catalog'
import { currentWEngineDirectory } from '../assault/planningCatalog'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { buildAccountDecisionSnapshot } from '../decision/accountDecisionService'

const mainStats: Record<number, StatKey> = {
  1: 'hp_flat',
  2: 'atk_flat',
  3: 'def_flat',
  4: 'crit_rate',
  5: 'physical_dmg',
  6: 'atk_percent',
}

export const n4RecommendationValidationFixtureDefinition = Object.freeze({
  fixtureClass: 'synthetic_exhaustive_stress' as const,
  representativeAccount: false,
  validClaims: [
    'candidate_universe_coverage',
    'determinism',
    'result_visibility',
    'exhaustive_oracle_regression',
    'performance',
  ] as const,
  invalidClaims: [
    'real_account_priority',
    'top3_product_validity',
    'cross_agent_build_comparability',
    'team_rating_product_acceptance',
  ] as const,
  boundary: '全角色/全音擎/统一物理暴击盘的合成压力样本；不得称为代表账号或产品有效性证据。',
})

export function n4ValidationDisc(index: number): DriveDisc {
  const slot = (index % 6) + 1
  return {
    id: `decision-disc-${index}`,
    setId: slot <= 4 ? 'set-fanged-metal' : 'set-woodpecker-electro',
    slot: slot as DriveDisc['slot'],
    level: 15,
    rarity: 'S',
    mainStat: mainStats[slot],
    subStats: [
      { stat: 'crit_rate', value: 9.6, upgrades: 3 },
      { stat: 'crit_dmg', value: 9.6, upgrades: 1 },
      { stat: 'def_flat', value: 15, upgrades: 1 },
    ],
    locked: false,
    favorite: false,
    tags: [],
    createdAt: '2026-08-23T00:00:00.000Z',
    updatedAt: '2026-08-23T00:00:00.000Z',
    dataVersion: 'zzz-drive-disc-3.1-c2',
  }
}

export function n4ValidationProfile(agentId: string): AgentDiscProfile {
  return createPhysicalCritProfileFixture(agentId, { version: '3.1-c2', gameVersion: '3.1' })
}

export function buildN4RecommendationValidationSnapshot() {
  const roster = createEmptyRoster('2026-08-23T00:00:00.000Z')
  const ownedAgentIds = roster.agents.map((agent) => agent.agentId)
  // This fixture declares a complete synthetic account, not an observed
  // player's unknown skills. Preserve every explicit core and fill only the
  // missing full-progression baseline so source-bound stat conversion is valid.
  roster.agents = roster.agents.map((agent) => ({
    ...agent,
    owned: true,
    skillLevels: { ...agent.skillLevels, core: agent.skillLevels.core ?? 7 },
  }))
  roster.bangboos = roster.bangboos.map((bangboo) => ({
    ...bangboo,
    owned: true,
    skillLevel: 10,
    additionalAbilityLevel: 5,
  }))
  roster.wEngines = currentWEngineDirectory
    .filter((engine) => engine.releaseState === 'released' && engine.accountOwnable)
    .map((engine) => ({
      copyId: `full-${engine.id}`,
      engineId: engine.id,
      level: 60,
      refinement: 1,
      equippedAgentId: null,
      manualSource: 'manual_initial_default' as const,
    }))
  return buildAccountDecisionSnapshot({
    warehouse: {
      accountId: 'account-c2-contract',
      account: {
        id: 'account-c2-contract',
        displayName: 'C2 contract fixture',
        createdAt: '2026-08-23T00:00:00.000Z',
        updatedAt: '2026-08-23T00:00:00.000Z',
        isDefault: true,
        status: 'active',
        source: 'manual',
      },
      discs: Array.from({ length: 400 }, (_, index) => n4ValidationDisc(index)),
      roster,
    },
    profiles: ownedAgentIds.map(n4ValidationProfile),
    drafts: [],
    activePlanIds: {},
    developmentPriorityAgentIds: [
      'agent-ye-shunguang',
      'agent-dialyn',
      'agent-zhao',
      'agent-aria',
      'agent-sunna',
      'agent-yuzuha',
      'agent-promeia',
      'agent-nangong',
      'agent-pyrois',
      'agent-norma',
    ],
    preference: { ...defaultTeamPortfolioPreference, teamCount: 3 },
    capturedAt: '2026-08-23T00:00:00.000Z',
  })
}
