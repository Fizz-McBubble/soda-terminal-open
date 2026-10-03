import { describe, expect, it } from 'vitest'
import {
  getCandidateWarehouseConstraint,
  type CandidateWarehouseConstraint,
} from '../gameDataPacks/candidateWarehouseConstraints'
import { resolveRetentionUseFacts } from './absoluteDiscRetentionUseFacts'

function syntheticConstraint(
  overrides: Partial<CandidateWarehouseConstraint> & { agentId: string },
): CandidateWarehouseConstraint {
  return {
    agentId: overrides.agentId,
    agentName: overrides.agentName ?? 'Synthetic Agent',
    gameVersion: overrides.gameVersion ?? '3.0',
    status: overrides.status ?? 'candidate',
    sources: overrides.sources ?? [
      {
        id: `test-source-${overrides.agentId}`,
        url: 'https://test.example/build',
        sourceVersion: '3.0',
        checkedAt: '2026-09-28T00:00:00.000Z',
        contentHash: 'TESTHASH1234567890',
        licenseBoundary: 'Test boundary',
        verified: true,
      },
    ],
    setIds: overrides.setIds ?? ['set-woodpecker-electro'],
    setPlans: overrides.setPlans ?? [],
    unresolvedSetDirections: overrides.unresolvedSetDirections ?? [],
    setPlanReadiness: overrides.setPlanReadiness ?? {
      status: 'executable',
      pattern: '4+2',
      primarySetIds: ['set-woodpecker-electro'],
      secondarySetIds: [],
    },
    mainStats: overrides.mainStats ?? {
      '4': ['crit_rate'],
      '5': ['ice_dmg'],
      '6': ['atk_percent'],
    },
    subStatWeights: overrides.subStatWeights ?? {
      crit_rate: 1.0,
      crit_dmg: 1.0,
      atk_percent: 0.8,
    },
    wEngineDirections: overrides.wEngineDirections ?? [],
    teamAndBangbooPreconditions: overrides.teamAndBangbooPreconditions ?? [],
    progressionDirection: overrides.progressionDirection ?? [],
    gaps: overrides.gaps ?? [],
    boundary: 'Test boundary',
    contentHash: 'TESTCONTENTHASH0987654321',
  }
}

describe('resolveRetentionUseFacts: sourced facts resolver', () => {
  describe('1. attackcrit: direct damage dealer scaling with ATK + Crit', () => {
    it('resolves valid crit, attack and matching element, with incompatible non-matching elements and no-shield', () => {
      const base = getCandidateWarehouseConstraint('agent-ellen')!
      expect(base).toBeDefined()
      const facts = resolveRetentionUseFacts(base, 'agent-ellen')

      expect(facts.goal).toBe('crit_damage')
      expect(facts.scalingStats).toContain('atk_percent')
      expect(facts.scalingStats).toContain('crit_rate')
      expect(facts.scalingStats).toContain('crit_dmg')
      expect(facts.coreStats).toEqual(expect.arrayContaining(['atk_flat', 'crit_rate']))

      // Positive cases
      expect(facts.effects.atk_.state).toBe('valid')
      expect(facts.effects.crit_.state).toBe('valid')
      expect(facts.effects.crit_dmg_.state).toBe('valid')
      expect(facts.effects.ice_dmg_.state).toBe('valid')
      expect(facts.effects.ice_dmg_.predicateId).toBe('matching_elemental_damage_channel')

      // Negative cases
      expect(facts.effects.fire_dmg_.state).toBe('incompatible')
      expect(facts.effects.fire_dmg_.predicateId).toBe('non_matching_element_damage_channel')
      expect(facts.effects.electric_dmg_.state).toBe('incompatible')
      expect(facts.effects.shield_.state).toBe('incompatible')
      expect(facts.effects.shield_.predicateId).toBe('no_shield_mechanic_in_kit')

      // Incidental survivability
      expect(facts.effects.def_.state).toBe('incidental')
      expect(facts.effects.hp_.state).toBe('incidental')
      expect(facts.effects.hp_.predicateId).toBe('generic_survivability_benefit')
    })
  })

  describe('2. anomalycrit exception: Jane Doe special Assault crit mechanic', () => {
    it('keeps Jane assault crit inputs separate from ordinary crit substats', () => {
      const janeConstraint = getCandidateWarehouseConstraint('agent-jane')!
      const janeFacts = resolveRetentionUseFacts(janeConstraint, 'agent-jane')

      expect(janeFacts.goal).toBe('anomaly_damage')
      expect(janeFacts.effects.anomProf.state).toBe('valid')
      expect(janeFacts.effects.anomMas_.state).toBe('valid')
      expect(janeFacts.effects.physical_dmg_.state).toBe('valid')

      // Jane's sourced assault crit rate uses AP; ordinary CR/CD are not its inputs.
      expect(janeFacts.effects.crit_.state).toBe('incidental')
      expect(janeFacts.effects.crit_.predicateId).toBe('special_anomaly_crit_uses_proficiency')
      expect(janeFacts.effects.crit_dmg_.state).toBe('incidental')
      expect(janeFacts.effects.crit_dmg_.predicateId).toBe('special_anomaly_crit_uses_proficiency')
      expect(janeFacts.scalingStats).toContain('crit_rate')

      // Non-matching element incompatible
      expect(janeFacts.effects.fire_dmg_.state).toBe('incompatible')

      // Standard anomaly comparison (e.g. Grace)
      const graceConstraint = getCandidateWarehouseConstraint('agent-grace')!
      const graceFacts = resolveRetentionUseFacts(graceConstraint, 'agent-grace')
      expect(graceFacts.goal).toBe('anomaly_damage')
      expect(graceFacts.effects.crit_.state).toBe('incidental')
      expect(graceFacts.effects.crit_.predicateId).toBe('non_crit_anomaly_channel')
      expect(graceFacts.effects.crit_dmg_.state).toBe('incidental')
      expect(graceFacts.effects.electric_dmg_.state).toBe('valid')
      expect(graceFacts.effects.physical_dmg_.state).toBe('incompatible')
    })
  })

  describe('3. no-shield defense: defense specialty alone is NOT shield proof', () => {
    it('validates shield for active shielders and marks shield incompatible for non-shielders', () => {
      const caesarConstraint = getCandidateWarehouseConstraint('agent-caesar')!
      const caesarFacts = resolveRetentionUseFacts(caesarConstraint, 'agent-caesar')
      expect(caesarFacts.effects.shield_.state).toBe('valid')
      expect(caesarFacts.effects.shield_.predicateId).toBe('active_shield_mechanic_in_kit')

      // Synthetic defense agent with zero shield mechanics
      const noShieldDefense = syntheticConstraint({
        agentId: 'agent-custom-no-shield',
        mainStats: { '4': ['def_percent'], '5': ['fire_dmg'], '6': ['def_percent'] },
        progressionDirection: ['专注于近战格挡与防守反击反伤，无队伍护盾生成'],
      })
      const noShieldFacts = resolveRetentionUseFacts(noShieldDefense, 'agent-custom-no-shield')
      expect(noShieldFacts.effects.shield_.state).toBe('incompatible')
      expect(noShieldFacts.effects.shield_.predicateId).toBe('no_shield_mechanic_in_kit')
      expect(noShieldFacts.effects.shield_.detail).toContain(
        'defense specialty alone is not shield proof',
      )
    })
  })

  describe('4. HP/DEF scaling: Manato (HP) and Ben (DEF)', () => {
    it('validates hp_ for HP-scaling damage and def_ for DEF-scaling defense', () => {
      // Manato: HP-scaling fire damage dealer
      const manatoConstraint = getCandidateWarehouseConstraint('agent-manato')!
      const manatoFacts = resolveRetentionUseFacts(manatoConstraint, 'agent-manato')
      expect(manatoFacts.effects.hp_.state).toBe('valid')
      expect(manatoFacts.effects.hp_.predicateId).toBe('hp_scaling_mechanical_input')
      expect(manatoFacts.scalingStats).toContain('hp_percent')
      expect(manatoFacts.effects.fire_dmg_.state).toBe('valid')
      expect(manatoFacts.effects.ice_dmg_.state).toBe('incompatible')

      // Ben: DEF-scaling fire defense agent
      const benConstraint = getCandidateWarehouseConstraint('agent-ben')!
      const benFacts = resolveRetentionUseFacts(benConstraint, 'agent-ben')
      expect(benFacts.effects.def_.state).toBe('valid')
      expect(benFacts.effects.def_.predicateId).toBe('def_scaling_mechanical_input')
      expect(benFacts.scalingStats).toContain('def_percent')
      expect(benFacts.effects.shield_.state).toBe('valid')
    })
  })

  describe('5. pen/sheerdamage: rupture sheer bypasses defense', () => {
    it('marks pen_ incompatible for Rupture sheer damage, distinguishing pen_ratio vs flat pen', () => {
      // Rupture agent with sheer damage (e.g. Yidhari)
      const yidhariConstraint = getCandidateWarehouseConstraint('agent-yidhari')!
      const yidhariFacts = resolveRetentionUseFacts(yidhariConstraint, 'agent-yidhari')

      expect(yidhariFacts.effects.pen_.state).toBe('incompatible')
      expect(yidhariFacts.effects.pen_.predicateId).toBe('sheer_bypasses_defense')
      expect(yidhariFacts.effects.pen_.detail).toContain('bypasses 100% of enemy defense')
      expect(yidhariFacts.effects.ice_dmg_.state).toBe('valid')
      expect(yidhariFacts.effects.hp_.state).toBe('valid')

      // Standard attacker where pen_ is valid or incidental
      const ellenConstraint = getCandidateWarehouseConstraint('agent-ellen')!
      const ellenFacts = resolveRetentionUseFacts(ellenConstraint, 'agent-ellen')
      expect(ellenFacts.effects.pen_.state).toBe('valid')
      expect(ellenFacts.effects.pen_.predicateId).toBe('penetration_ratio_primary_target')
    })
  })

  describe('6. basic/dash/aftershock: action-primary proof vs generic buttons', () => {
    it('validates source-bound primary rotations and avoids false action tagging', () => {
      // Ellen: basic attack primary rotation
      const ellenConstraint = getCandidateWarehouseConstraint('agent-ellen')!
      const ellenFacts = resolveRetentionUseFacts(ellenConstraint, 'agent-ellen')
      expect(ellenFacts.actions.basic.state).toBe('valid')
      expect(ellenFacts.actions.basic.predicateId).toBe('basic_attack_primary_damage')
      expect(ellenFacts.actions.aftershock.state).toBe('incompatible')
      expect(ellenFacts.actions.aftershock.predicateId).toBe('no_aftershock_mechanic_in_kit')

      // Soldier 0 Anby: reviewed self Aftershock rotation, independent of set identity
      const soldier0Constraint = getCandidateWarehouseConstraint('agent-soldier-0-anby')!
      const soldier0Facts = resolveRetentionUseFacts(soldier0Constraint, 'agent-soldier-0-anby')
      expect(soldier0Facts.actions.aftershock.state).toBe('valid')
      expect(soldier0Facts.actions.aftershock.predicateId).toBe('aftershock_primary_damage_focus')

      // Harumasa: Dash attack primary
      const harumasaConstraint = getCandidateWarehouseConstraint('agent-harumasa')!
      const harumasaFacts = resolveRetentionUseFacts(harumasaConstraint, 'agent-harumasa')
      expect(harumasaFacts.actions.dash.state).toBe('valid')
      expect(harumasaFacts.actions.dash.predicateId).toBe('dash_attack_primary_damage')

      // Nicole (Support): basic is incidental, aftershock is incompatible
      const nicoleConstraint = getCandidateWarehouseConstraint('agent-nicole')!
      const nicoleFacts = resolveRetentionUseFacts(nicoleConstraint, 'agent-nicole')
      expect(nicoleFacts.actions.basic.state).toBe('incidental')
      expect(nicoleFacts.actions.basic.predicateId).toBe('generic_basic_attack_action')
      expect(nicoleFacts.actions.aftershock.state).toBe('incompatible')
    })
  })

  describe('7. special attribute: Miyabi Frost mapping to Ice', () => {
    it('maps special frost attribute to ice_dmg_ as valid and marks other elements incompatible', () => {
      const miyabiConstraint = getCandidateWarehouseConstraint('agent-miyabi')!
      const miyabiFacts = resolveRetentionUseFacts(miyabiConstraint, 'agent-miyabi')

      expect(miyabiFacts.effects.ice_dmg_.state).toBe('valid')
      expect(miyabiFacts.effects.ice_dmg_.predicateId).toBe('matching_elemental_damage_channel')
      expect(miyabiFacts.effects.fire_dmg_.state).toBe('incompatible')
      expect(miyabiFacts.effects.physical_dmg_.state).toBe('incompatible')
      expect(miyabiFacts.effects.electric_dmg_.state).toBe('incompatible')
      expect(miyabiFacts.effects.ether_dmg_.state).toBe('incompatible')
      expect(miyabiFacts.effects.wind_dmg_.state).toBe('incompatible')
    })
  })

  describe('8. equal effect families: shared 2pc utility independent of 4pc condition or set identity', () => {
    it('shares equal two-piece effect utility across different sets in the same stat family', () => {
      const soukakuConstraint = getCandidateWarehouseConstraint('agent-soukaku')!
      const soukakuFacts = resolveRetentionUseFacts(soukakuConstraint, 'agent-soukaku')

      // enerRegen_ provided by both Swing Jazz and Moonlight Lullaby
      expect(soukakuFacts.effects.enerRegen_.state).toBe('valid')
      expect(soukakuFacts.effects.enerRegen_.predicateId).toBe('energy_regeneration_primary_target')

      // atk_ provided by both Hormone Punk and Astral Voice
      expect(soukakuFacts.effects.atk_.state).toBe('conditional')
      expect(soukakuFacts.effects.atk_.predicateId).toBe(
        'source-functional-stat-input-m0-p0-r2:atk_',
      )

      // 2-piece utility does not require 4-piece condition or ownership
      expect(soukakuFacts.effects.enerRegen_.evidenceIds.length).toBeGreaterThan(0)
    })
  })

  describe('9. named condition & missing facts handling', () => {
    it('returns missing_fact for constraints with missing sources without fabricating incompatibility', () => {
      const missingConstraint = syntheticConstraint({
        agentId: 'agent-unknown',
        status: 'missing',
        sources: [],
      })
      const facts = resolveRetentionUseFacts(missingConstraint, 'agent-unknown')

      expect(facts.goal).toBe('unknown')
      expect(facts.effects.atk_.state).toBe('missing_fact')
      expect(facts.effects.atk_.predicateId).toBe('missing_build_source')
      expect(facts.actions.basic.state).toBe('missing_fact')
      expect(facts.actions.basic.predicateId).toBe('missing_build_source')
      expect(facts.actions.aftershock.state).toBe('missing_fact')
    })

    it('keeps an unknown actor missing when only teammate text mentions aftershock', () => {
      const conditionalAftershock = syntheticConstraint({
        agentId: 'agent-custom-aftershock',
        setIds: ['set-woodpecker-electro'],
        teamAndBangbooPreconditions: ['队伍中有追加攻击队友时触发协同 aftershock'],
      })
      const facts = resolveRetentionUseFacts(conditionalAftershock, 'agent-custom-aftershock')
      expect(facts.actions.aftershock.state).toBe('missing_fact')
      expect(facts.actions.aftershock.predicateId).toBe('aftershock_actor_action_contract_missing')
    })
  })
})
