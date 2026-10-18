export type SourceResourceGrantTrigger32 = {
  id: string
  providerAgentId: string
  mechanism:
    | 'anby_additional_dodge_counter_energy'
    | 'claret_contamination_decibels'
    | 'remielle_m1_assist_decibels'
    | 'roxy_investigation_entry_energy'
    | 'reviewed_support_ultimate_energy'
    | 'yidhari_hp_loss_decibels'
    | 'yuzuha_ultimate_energy'
    | 'yuzuha_m1_investigation_entry_energy'
  atSeconds: number
  /** Source-stated HP percentage lost at this event, not a net start/end delta. */
  hpLossPercent?: number
  /** Next actual switch after this ultimate. null explicitly declares none in
   * this window; absence leaves the additional grant unknown. */
  nextSwitchIn?: { agentId: string; atSeconds: number } | null
  sourceRefs: readonly string[]
}

export type SourceResourceGrantDeclaration32 = {
  authority: 'declared_resource_triggers'
  durationSeconds: number
  /** null means no preceding trigger; missing is unknown. A preceding time
   * must not be later than the window start. */
  lastTriggerAtSeconds: Readonly<Record<string, number | null>>
  triggers: readonly SourceResourceGrantTrigger32[]
  /** Explicit pre-window state for receipt and overflow. Absence keeps receipt unknown. */
  resourceStates?: readonly SourceResourceReceiptState32[]
  sourceRefs: readonly string[]
}

export type SourceResourceReceiptState32 = {
  agentId: string
  unit: 'energy_points' | 'decibel_points'
  initialValue: number
  /** null means the game contract declares no cap for this window. */
  capacity: number | null
  sourceRefs: readonly string[]
}

const grantMechanisms = new Set<SourceResourceGrantTrigger32['mechanism']>([
  'anby_additional_dodge_counter_energy',
  'claret_contamination_decibels',
  'remielle_m1_assist_decibels',
  'roxy_investigation_entry_energy',
  'reviewed_support_ultimate_energy',
  'yidhari_hp_loss_decibels',
  'yuzuha_ultimate_energy',
  'yuzuha_m1_investigation_entry_energy',
])
const receiptUnits = new Set<SourceResourceReceiptState32['unit']>([
  'energy_points',
  'decibel_points',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim())
}

function isSourceRefs(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isReceiptState(value: unknown): value is SourceResourceReceiptState32 {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.agentId) &&
    typeof value.unit === 'string' &&
    receiptUnits.has(value.unit as SourceResourceReceiptState32['unit']) &&
    isFiniteNonNegative(value.initialValue) &&
    (value.capacity === null ||
      (isFiniteNonNegative(value.capacity) && value.capacity >= value.initialValue)) &&
    isSourceRefs(value.sourceRefs)
  )
}

function isNextSwitch(value: unknown) {
  if (value === null) return true
  return isRecord(value) && isNonEmptyString(value.agentId) && isFiniteNonNegative(value.atSeconds)
}

function isTrigger(value: unknown): value is SourceResourceGrantTrigger32 {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.providerAgentId) &&
    typeof value.mechanism === 'string' &&
    grantMechanisms.has(value.mechanism as SourceResourceGrantTrigger32['mechanism']) &&
    isFiniteNonNegative(value.atSeconds) &&
    (value.hpLossPercent === undefined ||
      (isFiniteNonNegative(value.hpLossPercent) && value.hpLossPercent <= 100)) &&
    (value.nextSwitchIn === undefined || isNextSwitch(value.nextSwitchIn)) &&
    isSourceRefs(value.sourceRefs)
  )
}

export function isSourceResourceGrantDeclaration32(
  value: unknown,
): value is SourceResourceGrantDeclaration32 {
  if (!isRecord(value)) return false
  if (
    value.authority !== 'declared_resource_triggers' ||
    typeof value.durationSeconds !== 'number' ||
    !Number.isFinite(value.durationSeconds) ||
    value.durationSeconds <= 0 ||
    !isRecord(value.lastTriggerAtSeconds) ||
    !Object.entries(value.lastTriggerAtSeconds).every(
      ([key, row]) =>
        Boolean(key.trim()) && (row === null || (typeof row === 'number' && Number.isFinite(row))),
    ) ||
    !Array.isArray(value.triggers) ||
    !value.triggers.every(isTrigger) ||
    !isSourceRefs(value.sourceRefs)
  )
    return false
  return (
    value.resourceStates === undefined ||
    (Array.isArray(value.resourceStates) && value.resourceStates.every(isReceiptState))
  )
}

export type SourceResourceGrantValidation32 =
  | { status: 'absent' }
  | { status: 'valid'; declaration: SourceResourceGrantDeclaration32 }
  | { status: 'invalid'; reason: 'resource_grant_declaration_missing_or_invalid' }

export function validateSourceResourceGrantDeclaration32(
  value: unknown,
): SourceResourceGrantValidation32 {
  if (value === undefined) return { status: 'absent' }
  return isSourceResourceGrantDeclaration32(value)
    ? { status: 'valid', declaration: value }
    : { status: 'invalid', reason: 'resource_grant_declaration_missing_or_invalid' }
}
