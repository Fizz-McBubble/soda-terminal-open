import { stableContentHash } from '../gameDataPacks/types'
import {
  planningAnomalyEventBundleFormulaHash,
  planningAnomalyEventBundleFormulaIdentity,
} from './planningAnomalyEventBundle'
import { planningAnomalyPiperSupportAdoption } from './planningAnomalySupportAdoption'
import {
  planningDirectEventBundleFormulaHash,
  planningDirectEventBundleFormulaIdentity,
} from './planningDirectEventBundle'
import {
  planningDirectBillySupportAdoption,
  planningDirectNekomataEventAdoption,
} from './planningDirectSupportAdoption'
import {
  planningSheerEventBundleFormulaHash,
  planningSheerEventBundleFormulaIdentity,
} from './planningSheerEventBundle'
import { planningSheerManatoSupportAdoption } from './planningSheerSupportAdoption'

export const planningFormulaFamilyStatuses = [
  'engine_ready_no_current_subjects',
  'runtime_adapter_ready',
  'unsupported',
] as const

export type PlanningFormulaFamilyStatus = (typeof planningFormulaFamilyStatuses)[number]

const families = [
  {
    familyId: 'standard_direct_event_bundle',
    status: 'runtime_adapter_ready',
    capabilities: ['planning_damage', 'planning_dps'],
    formulaHash: planningDirectEventBundleFormulaHash,
    currentSubjectIds: [
      planningDirectBillySupportAdoption.agentId,
      planningDirectNekomataEventAdoption.agentId,
    ],
    modelGradeEventSubjectIds: [
      planningDirectBillySupportAdoption.agentId,
      planningDirectNekomataEventAdoption.agentId,
    ],
    blockers: [],
    identity: planningDirectEventBundleFormulaIdentity,
  },
  {
    familyId: 'anomaly_disorder',
    status: 'runtime_adapter_ready',
    capabilities: ['planning_damage', 'planning_dps'],
    formulaHash: planningAnomalyEventBundleFormulaHash,
    currentSubjectIds: [planningAnomalyPiperSupportAdoption.agentId],
    modelGradeEventSubjectIds: [planningAnomalyPiperSupportAdoption.agentId],
    blockers: [],
    identity: planningAnomalyEventBundleFormulaIdentity,
  },
  {
    familyId: 'rupture_sheer',
    status: 'runtime_adapter_ready',
    capabilities: ['planning_damage', 'planning_dps'],
    formulaHash: planningSheerEventBundleFormulaHash,
    currentSubjectIds: [planningSheerManatoSupportAdoption.agentId],
    modelGradeEventSubjectIds: [planningSheerManatoSupportAdoption.agentId],
    blockers: [],
    identity: planningSheerEventBundleFormulaIdentity,
  },
  {
    familyId: 'special_settlement',
    status: 'unsupported',
    capabilities: [],
    formulaHash: null,
    currentSubjectIds: [],
    modelGradeEventSubjectIds: [],
    blockers: [
      'Character-specific replacement or settlement operators require named formula adapters.',
    ],
    identity: null,
  },
  {
    familyId: 'off_field_summon',
    status: 'unsupported',
    capabilities: [],
    formulaHash: null,
    currentSubjectIds: [],
    modelGradeEventSubjectIds: [],
    blockers: [
      'Off-field and summon event ownership, trigger conditions and static coverage are not closed.',
    ],
    identity: null,
  },
  {
    familyId: 'bangboo_damage',
    status: 'unsupported',
    capabilities: [],
    formulaHash: null,
    currentSubjectIds: [],
    modelGradeEventSubjectIds: [],
    blockers: ['Bangboo stats, event ownership and damage formula inputs are not closed.'],
    identity: null,
  },
] as const

const planningFormulaFamilyRegistryCore = {
  schema: 'soda-planning-formula-family-registry/v1',
  gameVersion: '3.1',
  families,
  boundary:
    'An executable engine is not a supported current subject. Numeric claims require a separate Formal support row and real-account calculation projection.',
} as const

export const planningFormulaFamilyRegistry = Object.freeze({
  ...planningFormulaFamilyRegistryCore,
  contentHash: stableContentHash(planningFormulaFamilyRegistryCore),
})
