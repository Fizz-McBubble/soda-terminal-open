/**
 * Offline, candidate-only snapshot differ. This is an interchange adapter, NOT a
 * second production registry. Existing L1/L2/L3 adoption and currentFieldAuthority
 * remain authoritative. No network, account writes, file writes or promotion.
 */
import { createHash } from 'node:crypto'

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
function invariant(condition, message) {
  if (!condition) throw new Error(message)
}
function text(value, name) {
  invariant(
    typeof value === 'string' && value.trim().length > 0,
    `${name}: nonempty string required`,
  )
}
function plain(value, name) {
  invariant(
    value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value)),
    `${name}: JSON object required`,
  )
}

/** Stable across object-key ordering; meaningful array order is preserved. */
export function stableStringify(value) {
  const active = new Set()
  function visit(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean')
      return JSON.stringify(item)
    if (typeof item === 'number') {
      invariant(
        Number.isFinite(item),
        'Non-finite number is forbidden (JSON would silently emit null)',
      )
      return JSON.stringify(item)
    }
    invariant(typeof item === 'object', 'Only JSON values are accepted')
    invariant(!active.has(item), 'Circular input is forbidden')
    active.add(item)
    let output
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) invariant(own(item, i), 'Sparse arrays are forbidden')
      output = '[' + item.map(visit).join(',') + ']'
    } else {
      plain(item, 'value')
      output =
        '{' +
        Object.keys(item)
          .sort(compare)
          .map((key) => JSON.stringify(key) + ':' + visit(item[key]))
          .join(',') +
        '}'
    }
    active.delete(item)
    return output
  }
  return visit(value)
}
export function contentHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex').toUpperCase()
}
function withHash(report) {
  return { ...report, reportContentSha256: contentHash(report) }
}
const boundaries = Object.freeze({
  candidateOnly: true,
  productionAdopted: false,
  productionWrites: false,
  accountWrites: false,
  automaticDeletion: false,
  formalPromotion: false,
  importPromotion: false,
})

/** atk_base is the old schema, NOT a default for a new/unknown stat. */
export function normalizeWEngineRecord(raw) {
  plain(raw, 'W-Engine')
  stableStringify(raw)
  invariant(!own(raw, 'baseStat'), 'baseStat is reserved for the normalized output')
  const legacy = own(raw, 'atk_base')
  const modern = own(raw, 'base_statkey') || own(raw, 'base_statvalue')
  invariant(legacy || modern, 'Missing base-stat schema')
  let key, value
  if (modern) {
    invariant(own(raw, 'base_statkey') && own(raw, 'base_statvalue'), 'Incomplete base-stat pair')
    key = raw.base_statkey
    value = raw.base_statvalue
    invariant(['atk', 'def'].includes(key), `Unreviewed base-stat kind: ${key}`)
  } else {
    key = 'atk'
    value = raw.atk_base
  }
  invariant(
    typeof value === 'number' && Number.isFinite(value) && value >= 0,
    'Invalid base-stat value',
  )
  if (legacy && modern)
    invariant(key === 'atk' && raw.atk_base === value, 'Conflicting legacy and modern base stats')
  const normalized = Object.fromEntries(
    Object.entries(raw).filter(
      ([k]) => !['atk_base', 'base_statkey', 'base_statvalue'].includes(k),
    ),
  )
  // Preserve all other fields (including unknown fields) so schema additions are not discarded.
  normalized.baseStat = { key, value }
  return normalized
}

export function compareWEngineRecords(previous, current) {
  const before = normalizeWEngineRecord(previous)
  const after = normalizeWEngineRecord(current)
  const semanticChanged = contentHash(before) !== contentHash(after)
  const rawChanged = contentHash(previous) !== contentHash(current)
  return withHash({
    schema: 'soda-wengine-schema-delta/v1',
    change: semanticChanged ? 'semantic_changed' : rawChanged ? 'schema_only' : 'unchanged',
    rawChanged,
    semanticChanged,
    before,
    after,
    growthFormulaEvaluated: false,
    beforeHash: contentHash(previous),
    afterHash: contentHash(current),
    boundaries,
  })
}

function checkMap(map) {
  plain(map, 'identity map')
  const names = new Set()
  for (const [id, name] of Object.entries(map)) {
    text(id, 'ID')
    text(name, 'name')
    invariant(!names.has(name), `Duplicate upstream identity name: ${name}`)
    names.add(name)
  }
}
export function diffIdentityMaps(previous, current) {
  checkMap(previous)
  checkMap(current)
  const changes = []
  let unchanged = 0
  for (const id of [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort(
    compare,
  )) {
    if (!own(previous, id)) changes.push({ id, change: 'added', before: null, after: current[id] })
    else if (!own(current, id))
      changes.push({ id, change: 'missing_from_snapshot', before: previous[id], after: null })
    else if (previous[id] !== current[id])
      changes.push({
        id,
        change: 'identity_label_changed',
        before: previous[id],
        after: current[id],
      })
    else unchanged++
  }
  return withHash({
    schema: 'soda-upstream-identity-delta/v1',
    identitySpace: 'upstream_game_id_not_soda_stable_id',
    beforeHash: contentHash(previous),
    afterHash: contentHash(current),
    counts: {
      before: Object.keys(previous).length,
      after: Object.keys(current).length,
      added: changes.filter((row) => row.change === 'added').length,
      missingFromSnapshot: changes.filter((row) => row.change === 'missing_from_snapshot').length,
      identityLabelChanged: changes.filter((row) => row.change === 'identity_label_changed').length,
      unchanged,
    },
    changes,
    boundaries,
  })
}

const volatilities = new Set([
  'static_definition',
  'runtime_mechanic',
  'meta_evaluation',
  'product_policy',
])
const continuityChecks = [
  'exactPriorReplay',
  'releasedStableIdentity',
  'scopedDeltaUnchanged',
  'noFieldConflict',
]
const versionPattern = /^\d+\.\d+(?:\.\d+)?$/
function compareVersion(a, b) {
  const x = a.split('.').map(Number),
    y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

/** The target version and source version deliberately do NOT belong to field identity. */
function rowKey(row, identitySpace) {
  plain(row, 'row')
  for (const key of ['domain', 'stableObjectId', 'fieldPath']) text(row[key], key)
  invariant(!['unresolved', 'unknown'].includes(row.stableObjectId), 'Unresolved stable identity')
  invariant(own(row, 'value'), 'Explicit value required (null is permitted; missing is not)')
  text(row.unit, 'unit')
  invariant(volatilities.has(row.fieldVolatility), 'fieldVolatility classification required')
  return stableStringify([
    identitySpace,
    row.domain,
    row.stableObjectId,
    row.fieldPath,
    row.context ?? null,
  ])
}
function eligibility(row, targetVersion) {
  const reasons = []
  const a = row.applicability
  if (!a || a.evaluatedForVersion !== targetVersion) reasons.push('not_evaluated_for_target')
  if (a?.releaseState !== 'released') reasons.push('not_released')
  if (!['verified_current', 'continuous'].includes(a?.state))
    reasons.push('unprocessed_applicability')
  if (!Array.isArray(row.sources) || row.sources.length === 0)
    reasons.push('source_evidence_unavailable')
  for (const source of row.sources ?? []) {
    if (!source || typeof source !== 'object') {
      reasons.push('invalid_source')
      continue
    }
    if (source.channel !== 'release') reasons.push('non_release_source')
    if (!versionPattern.test(source.sourceVersion ?? '')) reasons.push('unresolved_source_version')
    else if (compareVersion(source.sourceVersion, targetVersion) > 0)
      reasons.push('future_source_version')
    for (const key of ['rootProvenance', 'sourceRef'])
      if (typeof source[key] !== 'string' || !source[key].trim())
        reasons.push(`source_${key}_unavailable`)
    if (typeof source.contentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(source.contentHash))
      reasons.push('source_hash_unavailable')
    if (a?.state === 'verified_current' && source.sourceVersion !== targetVersion)
      reasons.push('older_source_requires_continuity')
  }
  if (a?.state === 'continuous') {
    if (row.fieldVolatility !== 'static_definition') reasons.push('nonstatic_continuity_forbidden')
    if (!continuityChecks.every((key) => a.continuityCheck?.[key] === true))
      reasons.push('continuity_checks_incomplete')
    if (
      !Array.isArray(a.continuityCheck?.evidenceRefs) ||
      !a.continuityCheck.evidenceRefs.some((r) => typeof r === 'string' && r.trim())
    )
      reasons.push('continuity_evidence_unavailable')
  }
  return [...new Set(reasons)].sort(compare)
}
function snapshotGroups(snapshot) {
  plain(snapshot, 'snapshot')
  invariant(snapshot.schema === 'soda-release-field-snapshot/v1', 'Unsupported snapshot schema')
  text(snapshot.scopeId, 'scopeId')
  text(snapshot.identitySpace, 'identitySpace')
  invariant(versionPattern.test(snapshot.targetVersion), 'Explicit numeric targetVersion required')
  invariant(snapshot.channel === 'release', 'Only released snapshots are accepted')
  invariant(['phase_i', 'phase_ii'].includes(snapshot.phase), 'Explicit release phase required')
  invariant(Array.isArray(snapshot.rows), 'rows array required')
  stableStringify(snapshot)
  const groups = new Map()
  for (const row of snapshot.rows) {
    const key = rowKey(row, snapshot.identitySpace)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  const result = new Map()
  for (const [key, rows] of groups) {
    const values = [
      ...new Set(rows.map((r) => contentHash({ value: r.value, unit: r.unit }))),
    ].sort(compare)
    const reasons = [...new Set(rows.flatMap((r) => eligibility(r, snapshot.targetVersion)))].sort(
      compare,
    )
    if (values.length > 1) reasons.push('conflicting_values')
    if (new Set(rows.map((r) => r.fieldVolatility)).size > 1) reasons.push('conflicting_volatility')
    const sources = [
      ...new Map(rows.flatMap((r) => r.sources ?? []).map((s) => [stableStringify(s), s])).values(),
    ].sort((a, b) => compare(stableStringify(a), stableStringify(b)))
    const applicability = [
      ...new Set(rows.map((r) => stableStringify(r.applicability ?? null))),
    ].sort(compare)
    result.set(key, {
      key: JSON.parse(key),
      semanticHash: values.length === 1 ? values[0] : null,
      provenanceHash: contentHash(sources),
      applicabilityHash: contentHash(applicability),
      independentRoots: new Set(sources.map((s) => s?.rootProvenance).filter(Boolean)).size,
      sourceRowCount: rows.length,
      reasons: reasons.sort(compare),
    })
  }
  return result
}

/** Deterministic field diff after alias resolution. No removal instruction is ever emitted. */
export function diffReleaseFields(previous, current, options = {}) {
  const old = snapshotGroups(previous),
    next = snapshotGroups(current)
  invariant(
    previous.scopeId === current.scopeId,
    'Different scopeId: compare like-for-like exports only',
  )
  invariant(
    previous.identitySpace === current.identitySpace,
    'Identity spaces differ: resolve aliases first',
  )
  invariant(
    compareVersion(previous.targetVersion, current.targetVersion) <= 0,
    'Version downgrade requires a separate reviewed rollback',
  )
  if (previous.targetVersion === current.targetVersion)
    invariant(
      !(previous.phase === 'phase_ii' && current.phase === 'phase_i'),
      'Phase regression requires a separate reviewed rollback',
    )
  const beforeHash = contentHash(previous),
    afterHash = contentHash(current)
  if (options.expectedBaseHash !== undefined)
    invariant(options.expectedBaseHash === beforeHash, 'Baseline hash mismatch; rebase the delta')
  const changes = [],
    unchanged = [],
    evidenceOnly = [],
    applicabilityChanges = [],
    quarantine = []
  for (const key of [...new Set([...old.keys(), ...next.keys()])].sort(compare)) {
    const a = old.get(key),
      b = next.get(key)
    if (!b) {
      quarantine.push({
        key: a.key,
        reason: 'missing_from_snapshot_not_deletion',
        beforeHash: a.semanticHash,
      })
      continue
    }
    if (a?.reasons.length || b.reasons.length) {
      quarantine.push({
        key: b.key,
        reason: 'field_not_ready',
        previousReasons: a?.reasons ?? [],
        currentReasons: b.reasons,
      })
      continue
    }
    if (!a || a.semanticHash !== b.semanticHash)
      changes.push({
        key: b.key,
        change: a ? 'changed' : 'added',
        beforeHash: a?.semanticHash ?? null,
        afterHash: b.semanticHash,
        independentRoots: b.independentRoots,
      })
    else {
      unchanged.push(b.key)
      if (a.provenanceHash !== b.provenanceHash)
        evidenceOnly.push({ key: b.key, beforeHash: a.provenanceHash, afterHash: b.provenanceHash })
      if (a.applicabilityHash !== b.applicabilityHash) applicabilityChanges.push(b.key)
    }
  }
  return withHash({
    schema: 'soda-release-field-delta/v1',
    scopeId: current.scopeId,
    targetVersion: current.targetVersion,
    phase: current.phase,
    beforeHash,
    afterHash,
    counts: {
      semanticChanges: changes.length,
      semanticUnchanged: unchanged.length,
      evidenceOnly: evidenceOnly.length,
      applicabilityChanges: applicabilityChanges.length,
      quarantined: quarantine.length,
    },
    changes,
    evidenceOnly,
    applicabilityChanges,
    quarantine,
    reviewStatus: quarantine.length
      ? 'blocked_fields_present'
      : 'candidate_delta_ready_for_existing_adoption_review',
    // This is NOT the production fingerprint; existing currentDataAuthorityProjection owns it.
    boundaries,
  })
}
