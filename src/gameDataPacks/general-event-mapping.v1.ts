import {
  generalDirectDamageEventSchema,
  type GeneralDirectDamageEvent,
} from './general-event-mapping-core'

export const generalEventMappingVersion = 'soda-general-event-mapping-v1' as const
export const generalEventSourceCommit = 'eabba1f092b282cccb3f028b7253a1db3dac5208' as const

const event = (value: GeneralDirectDamageEvent) => generalDirectDamageEventSchema.parse(value)

/** Source facts only. Benchmark enemy/loadout policy is deliberately absent. */
export const generalEventSourceFacts = Object.freeze([
  event({
    eventId: 'agent-billy.basic.BasicAttackFullFirepower.hit-2',
    actorId: 'agent-billy',
    sourceVersion: generalEventSourceCommit,
    targetVersion: '3.1',
    actionId: 'BasicAttackFullFirepower',
    hitIndex: 2,
    formulaFamily: 'attack_scaled_direct_damage',
    multiplier: { base: 0.618, growthPerSkillLevel: 0.057, unit: 'ratio' },
    hitCount: { value: 1, unit: 'count' },
    damageType: 'physical',
    conditionRefs: [],
    evidenceRefs: [
      'GO:Billy.ts:sha256:91202DCC7AAE626B739B6657EA903BF83C9C9FFBE353F0442C2D01B3F1FF240E',
      'GO:Billy.json:sha256:EC555A3E843C3145A2374551D649843792B2EBE46ABDAE8104958E439CE478B2',
    ],
  }),
  event({
    eventId: 'agent-nekomata.basic.BasicAttackKittySlash.hit-0',
    actorId: 'agent-nekomata',
    sourceVersion: generalEventSourceCommit,
    targetVersion: '3.1',
    actionId: 'BasicAttackKittySlash',
    hitIndex: 0,
    formulaFamily: 'attack_scaled_direct_damage',
    multiplier: { base: 0.552, growthPerSkillLevel: 0.051, unit: 'ratio' },
    hitCount: { value: 1, unit: 'count' },
    damageType: 'physical',
    conditionRefs: [],
    evidenceRefs: [
      'GO:Nekomata.ts:sha256:C411CB4139307402CDCC0F39C9B5E41E0A76E1BA3F88E0F1746DB454B807D5D9',
      'GO:Nekomata.json:sha256:ECEA79B87E044463E5DBF7E818D09ACD0256E0E906EE1DAB266F862D8BC43AD4',
    ],
  }),
  event({
    eventId: 'agent-remielle.basic.BasicAttackLeap.hit-0',
    actorId: 'agent-remielle',
    sourceVersion: generalEventSourceCommit,
    targetVersion: '3.1',
    actionId: 'BasicAttackLeap',
    hitIndex: 0,
    formulaFamily: 'attack_scaled_direct_damage',
    multiplier: { base: 0.312, growthPerSkillLevel: 0.029, unit: 'ratio' },
    hitCount: { value: 1, unit: 'count' },
    damageType: 'lumiflux',
    conditionRefs: [],
    evidenceRefs: [
      'GO:Remielle.ts:sha256:75AF20EB1BA2266489D8901F948DB4AE51C73D5DE73C172F09B2349CFD503225',
      'GO:Remielle.json:sha256:E09C72F57CDB21349A8C43EDBF3BB944F1CAB475544F8CECC6921537A0474EB3',
    ],
  }),
])

export function getGeneralEventSourceFact(actorId: string) {
  return generalEventSourceFacts.find((entry) => entry.actorId === actorId) ?? null
}
