import type { AgentDiscProfile } from '../assault/engine'

/** Synthetic physical/critical fixture; callers retain their own version identity. */
export function createPhysicalCritProfileFixture(
  agentId: string,
  versions: Pick<AgentDiscProfile, 'version' | 'gameVersion'>,
): AgentDiscProfile {
  return {
    agentId,
    ...versions,
    confidence: 'high',
    statWeights: { crit_rate: 1, crit_dmg: 0.8 },
    mainStatFit: {
      '4': { crit_rate: 1 },
      '5': { physical_dmg: 1 },
      '6': { atk_percent: 1 },
    },
    setFit: { 'set-fanged-metal': 1, 'set-woodpecker-electro': 0.8 },
    setPlans: [
      {
        pattern: '4+2',
        primarySets: ['set-fanged-metal'],
        secondarySets: ['set-woodpecker-electro'],
      },
    ],
    mainStats: {
      '4': ['crit_rate'],
      '5': ['physical_dmg'],
      '6': ['atk_percent'],
    },
  }
}
