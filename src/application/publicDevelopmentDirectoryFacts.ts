import type { DevelopmentWorkbenchFactsInput } from './publicDevelopmentWorkbenchFacts'
import type { DevelopmentDirectoryDecision } from './publicDevelopmentDirectoryContract'
import { contentHash } from './contentHash'
import { rosterFingerprintFacts } from './publicRosterFingerprintFacts'
import { publicDevelopmentDirectoryCatalog } from './publicDevelopmentDirectoryCatalog'

export type DevelopmentDirectoryFactsRequest = { input: DevelopmentWorkbenchFactsInput }
export type DevelopmentDirectorySourceDecision = Pick<
  DevelopmentDirectoryDecision,
  'agentId' | 'cinemaLevels' | 'skillPriorityGroups' | 'skills'
>
export type DevelopmentDirectoryFacts = {
  contract: 'soda-development-directory-facts/v1'
  authority: 'not_evaluated'
  accountId: string
  inputFingerprint: string
  decisions: DevelopmentDirectorySourceDecision[]
}
export function developmentDirectoryFactsFingerprint({ input }: DevelopmentDirectoryFactsRequest) {
  const { warehouse, drafts, activePlanIds, developmentPriorityAgentIds } = input
  return contentHash({
    warehouse: { ...warehouse, roster: rosterFingerprintFacts(warehouse.roster) },
    drafts,
    activePlanIds,
    developmentPriorityAgentIds,
  })
}
const skillKeys = new Set(['basic', 'dodge', 'assist', 'special', 'chain', 'core'])
const level = (value: unknown) =>
  value === null ||
  (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 16)
const optionalLevel = (value: unknown) => value === undefined || level(value)
// Invalid observed levels can be reported as evidence in a blocked next-level result.
const observedLevel = (value: unknown) =>
  value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
function validNextLevel(value: unknown) {
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return (
    ['supported', 'partial', 'no_upgrade', 'unknown', 'unsupported'].includes(String(row.status)) &&
    ['title', 'gainText', 'materialsText', 'tooltip'].every(
      (key) => typeof row[key] === 'string',
    ) &&
    ['fromLevel', 'toLevel', 'fromBaseLevel', 'toBaseLevel'].every((key) =>
      observedLevel(row[key]),
    ) &&
    (row.reasonCode === undefined || typeof row.reasonCode === 'string') &&
    (row.nextAction === undefined || typeof row.nextAction === 'string') &&
    (row.missingInputs === undefined ||
      (Array.isArray(row.missingInputs) &&
        row.missingInputs.every((item) =>
          ['current_level', 'target_level', 'mindscape_bonus'].includes(item),
        )))
  )
}
function validSkill(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  const derived = row.sodaDerived
  return (
    typeof row.key === 'string' &&
    skillKeys.has(row.key) &&
    typeof row.label === 'string' &&
    level(row.targetLevel) &&
    typeof row.priority === 'boolean' &&
    (row.recommended === undefined || typeof row.recommended === 'string') &&
    (row.targetType === undefined ||
      ['exact_integer', 'minimum_reference', 'soda_derived'].includes(String(row.targetType))) &&
    optionalLevel(row.exactTarget) &&
    optionalLevel(row.minimumReference) &&
    validNextLevel(row.nextLevel) &&
    (derived === null ||
      (typeof derived === 'object' &&
        !Array.isArray(derived) &&
        typeof (derived as Record<string, unknown>).band === 'string' &&
        typeof (derived as Record<string, unknown>).label === 'string' &&
        level((derived as Record<string, unknown>).targetLevel) &&
        (derived as Record<string, unknown>).targetLevel !== null &&
        optionalLevel((derived as Record<string, unknown>).baseTargetLevel)))
  )
}
export function isCurrentDevelopmentDirectoryFacts(
  value: DevelopmentDirectoryFacts | null | undefined,
  request: DevelopmentDirectoryFactsRequest,
) {
  if (
    !value ||
    value.contract !== 'soda-development-directory-facts/v1' ||
    value.authority !== 'not_evaluated' ||
    !request.input.warehouse.accountId ||
    value.accountId !== request.input.warehouse.accountId ||
    value.inputFingerprint !== developmentDirectoryFactsFingerprint(request) ||
    !Array.isArray(value.decisions)
  )
    return false
  const eligible = new Set(
    publicDevelopmentDirectoryCatalog
      .filter((entry) => entry.releaseState === 'released' && entry.accountOwnable)
      .map((entry) => entry.stableId),
  )
  const ids = request.input.warehouse.roster.agents
    .filter((agent) => agent.owned && eligible.has(agent.agentId))
    .map((agent) => agent.agentId)
    .sort()
  return (
    value.decisions.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof row.agentId === 'string' &&
        Array.isArray(row.skills) &&
        row.skills.length === skillKeys.size &&
        new Set(row.skills.map((skill) => skill?.key)).size === skillKeys.size &&
        row.skills.every(validSkill) &&
        Array.isArray(row.skillPriorityGroups) &&
        row.skillPriorityGroups.every(
          (group) =>
            Array.isArray(group) &&
            group.every((key) => typeof key === 'string' && skillKeys.has(key)),
        ) &&
        (row.cinemaLevels === null ||
          (Array.isArray(row.cinemaLevels) &&
            row.cinemaLevels.every(
              (level) => Number.isInteger(level) && level >= 1 && level <= 6,
            ))),
    ) && contentHash(value.decisions.map((row) => row.agentId).sort()) === contentHash(ids)
  )
}
