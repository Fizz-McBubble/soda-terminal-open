import { createEmptyRoster } from '../assault/catalog'
import type { CoreWarehouse } from '../accounts/coreFlow'
import type { DriveDisc, StatKey } from '../domain/schemas'
import { gameData32BuildSources } from '../gameDataPacks/gameData32BuildGuidance'

/** Minimal derived guidance, not fitted coefficients or copied guide text.
 * Rechecked 2026-10-08 against the original page (last build update: patch 3.2).
 * The guide's weapon comparisons include Norma + Rina; these personal fixtures
 * deliberately do not claim to reproduce that full-team calculation.
 */
export const claretCalibrationSource = {
  ...gameData32BuildSources.claretGuide!,
  recheckedAt: '2026-10-08',
  orderedStats: ['crit_rate', 'def_percent', 'crit_dmg', 'pen', 'def_flat'],
  comparisonScope: 'conditional-direction-only',
  guideConditions: [
    'Level 60; signature target includes core, weapon and team critical-rate buffs.',
    'Weapon rankings use Norma + Rina and are not personal affix marginal gains.',
    'Critical damage converts to initial critical rate at 0.35; sharp damage uses laceration.',
    'PEN and secondary sets depend on enemy defense and team penetration / defense shred.',
  ],
  modelConditions: [
    'Synthetic level60 M0 potential0, skills12/core7, signature level60 P1.',
    'Reviewed prepared personal held-special / maim / subduing-axe fixed events.',
    'Four Thorned Rose plus two Soul Rock; no teammate or full-cycle claim.',
    'One first critical check and one additional check; each probability is capped at 100%, so sharp CR saturates at 200%.',
  ],
} as const

const steps: Partial<Record<StatKey, number>> = {
  crit_rate: 2.4,
  crit_dmg: 4.8,
  def_percent: 4.8,
  def_flat: 15,
  atk_percent: 3,
  atk_flat: 19,
  pen: 9,
}

/** All values are standard S-affix increments; at most five upgrades per disc.
 * These are explanatory synthetic six-disc inputs, never real account data.
 */
export function statWeightCalibrationFixture(
  agentId: 'agent-claret' | 'agent-billy' = 'agent-claret',
  upgradedStat: 'crit_rate' | 'crit_dmg' | 'def_percent' | 'atk_percent' | null = null,
) {
  const claret = agentId === 'agent-claret'
  const roster = createEmptyRoster('2026-10-08T00:00:00.000Z')
  const agent = roster.agents.find((row) => row.agentId === agentId)!
  Object.assign(agent, {
    owned: true,
    level: 60,
    ascension: 5,
    mindscape: 0,
    potentialImage: 0,
    skillLevels: { ...agent.skillLevels, basic: 12, special: 12, chain: 12, core: 7 },
    wEngineDetails: {
      id: claret ? 'wengine-14161' : 'wengine-12001',
      name: null,
      level: 60,
      ascension: 5,
      refinement: 1,
    },
  })
  const discs: DriveDisc[] = ([1, 2, 3, 4, 5, 6] as const).map((slot) => {
    const mainStat = (
      {
        1: 'hp_flat',
        2: 'atk_flat',
        3: 'def_flat',
        4: 'crit_rate',
        5: claret ? 'electric_dmg' : 'physical_dmg',
        6: claret ? 'def_percent' : 'atk_percent',
      } as const
    )[slot]
    const scaling = claret ? 'def_percent' : 'atk_percent'
    const fallback = claret ? 'def_flat' : 'atk_flat'
    const stats: StatKey[] = ['crit_rate', 'crit_dmg', scaling, 'pen']
    const affixes = stats.map((stat) => (stat === mainStat ? fallback : stat))
    // A level15 four-affix S disc has five upgrade rolls. If the requested
    // stat conflicts with the main stat, place those five rolls into PEN.
    const rollTarget = upgradedStat && affixes.includes(upgradedStat) ? upgradedStat : 'pen'
    return {
      id: `calibration-${agentId}-${upgradedStat ?? 'base'}-${slot}`,
      slot,
      setId: claret
        ? slot <= 4
          ? 'set-34200'
          : 'set-soul-rock'
        : slot <= 2
          ? 'set-woodpecker-electro'
          : slot <= 4
            ? 'set-hormone-punk'
            : 'set-puffer-electro',
      rarity: 'S',
      level: 15,
      mainStat,
      subStats: affixes.map((stat) => ({
        stat,
        value: steps[stat]! * (stat === rollTarget ? 6 : 1),
        upgrades: stat === rollTarget ? 5 : 0,
      })),
      locked: false,
      favorite: false,
      tags: [],
      createdAt: '2026-10-08T00:00:00.000Z',
      updatedAt: '2026-10-08T00:00:00.000Z',
      dataVersion: '3.2',
    }
  })
  const warehouse: CoreWarehouse = {
    accountId: 'synthetic-stat-weight-calibration',
    account: null,
    roster,
    discs,
  }
  return { warehouse, discs, agentId }
}
