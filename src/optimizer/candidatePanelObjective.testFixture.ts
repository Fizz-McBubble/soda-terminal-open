import { createEmptyRoster } from '../assault/catalog'
import { driveDiscData } from '../data/gameData'
import type { BuildProfile, DriveDisc, StatKey } from '../domain/schemas'
import type { OptimizerKnowledge } from './optimizeBuild'

export function supportObjectiveFixture(agentId: string, highAttack = false) {
  const agent = {
    ...createEmptyRoster().agents.find((item) => item.agentId === agentId)!,
    owned: true,
    level: 60,
    skillLevels: { basic: 12, dodge: 12, assist: 12, special: 12, chain: 12, core: 7 },
    wEngineDetails: { id: 'wengine-14002', name: '逍遥游球', level: 60, refinement: 1 },
  }
  const makeDisc = (slot: DriveDisc['slot'], energy = false): DriveDisc => {
    const mainStat = (
      [
        'hp_flat',
        'atk_flat',
        'def_flat',
        'atk_percent',
        'atk_percent',
        energy ? 'energy_regen' : 'atk_percent',
      ] as StatKey[]
    )[slot - 1]!
    const stats: StatKey[] =
      slot <= 3
        ? ['atk_percent', slot === 2 ? 'hp_flat' : 'atk_flat', 'crit_rate', 'hp_percent']
        : ['atk_flat', 'crit_rate', 'hp_percent', 'def_percent']
    return {
      id: `${agentId}-${slot}${energy ? '-energy' : ''}`,
      setId: slot <= 4 ? 'set-astral-voice' : 'set-swing-jazz',
      slot,
      level: 15,
      rarity: 'S',
      mainStat,
      subStats: stats.map((stat, index) => ({
        stat,
        value:
          driveDiscData!.rules.subStatStepsByRarity.S.find((step) => step.stat === stat)!
            .baseValue * (index === 0 && highAttack ? 6 : index === 2 && !highAttack ? 6 : 1),
        upgrades: index === 0 && highAttack ? 5 : index === 2 && !highAttack ? 5 : 0,
      })),
      locked: false,
      favorite: false,
      tags: [],
      createdAt: '2026-09-14T00:00:00Z',
      updatedAt: '2026-09-14T00:00:00Z',
      dataVersion: 'test',
    }
  }
  const discs = ([1, 2, 3, 4, 5, 6] as const).map((slot) => makeDisc(slot))
  const energyDisc = makeDisc(6, true)
  const profile: BuildProfile = {
    id: agentId,
    agentId,
    name: 'isolated source objective',
    role: 'support',
    statWeights: { atk_percent: 1, atk_flat: 1, crit_rate: 1 },
    mainStatFit: {
      '4': { atk_percent: 1 },
      '5': { atk_percent: 1 },
      '6': { atk_percent: 1, energy_regen: 0.1 },
    },
    setFit: { 'set-astral-voice': 1, 'set-swing-jazz': 1 },
    version: 'test',
    isDefault: false,
    sourceTemplateId: null,
    archived: false,
    createdAt: '2026-09-14T00:00:00Z',
    updatedAt: '2026-09-14T00:00:00Z',
  }
  const knowledge: OptimizerKnowledge = {
    mainStats: { '4': ['atk_percent'], '5': ['atk_percent'], '6': ['atk_percent', 'energy_regen'] },
    minimumSubstatValues: {},
    setPlans: [
      { pattern: '4+2', primarySets: ['set-astral-voice'], secondarySets: ['set-swing-jazz'] },
    ],
    contentHash: 'isolated-source-objective',
  }
  return { agent, discs, energyDisc, inventory: [...discs, energyDisc], profile, knowledge }
}
