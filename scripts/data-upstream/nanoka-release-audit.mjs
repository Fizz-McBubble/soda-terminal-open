/** Offline adapter for already-frozen Nanoka release records. No adoption or network. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contentHash, diffIdentityMaps, stableStringify } from './release-delta-core.mjs'
import { flattenFields } from './source-field-flattening.mjs'

const domains = ['character', 'weapon', 'equipment', 'bangboo']
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const jsonEqual = (a, b) => stableStringify(a) === stableStringify(b)
const present = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const fail = (message) => {
  throw new Error(message)
}

/** Display `main`/`growth` are aliases for the selected row (damage, daze, etc.).
 * One Skill ID can appear in several display rows; retain its underlying typed
 * parameters exactly once and reject conflicts rather than counting extra hits. */
export function collectSkillParameters(skill) {
  const parameters = new Map()
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (present(node.param)) {
      for (const [id, raw] of Object.entries(node.param)) {
        if (!/^\d+$/.test(id) || !present(raw)) continue
        const values = Object.fromEntries(
          Object.entries(raw).filter(([key]) => !['main', 'growth', 'format'].includes(key)),
        )
        if (!Object.keys(values).length) continue
        if (parameters.has(id) && !jsonEqual(parameters.get(id), values))
          fail(`Conflicting skill parameter identity: ${id}`)
        parameters.set(id, values)
      }
    }
    for (const child of Object.values(node)) visit(child)
  }
  visit(skill)
  return Object.fromEntries([...parameters].sort(([a], [b]) => a.localeCompare(b)))
}

function projectRecord(domain, raw) {
  if (domain === 'character') {
    return {
      numeric: {
        stats: raw.stats ?? null,
        level: raw.level ?? null,
        extra_level: raw.extra_level ?? null,
        skillParameters: collectSkillParameters(raw.skill),
      },
      mechanics: {
        skill: raw.skill ?? null,
        passive: raw.passive ?? null,
        talent: raw.talent ?? null,
        potential: raw.potential ?? null,
        potential_detail: raw.potential_detail ?? null,
      },
      guidance: {
        strategy: raw.strategy ?? null,
        fairy_recommend: raw.fairy_recommend ?? null,
        skill_priority: raw.skill_priority ?? null,
      },
    }
  }
  if (domain === 'weapon') {
    return {
      numeric: {
        base_property: raw.base_property ?? null,
        rand_property: raw.rand_property ?? null,
        level: raw.level ?? null,
        stars: raw.stars ?? null,
      },
      mechanics: { talents: raw.talents ?? null, weapon_type: raw.weapon_type ?? null },
      guidance: {},
    }
  }
  // Keep every field for discs/Bangboo; do not guess which new field is cosmetic.
  return { numeric: raw, mechanics: raw, guidance: {} }
}

function changedFields(before, after) {
  const a = new Map(flattenFields(before).map(({ fieldPath, value }) => [fieldPath, value]))
  const b = new Map(flattenFields(after).map(({ fieldPath, value }) => [fieldPath, value]))
  return [...new Set([...a.keys(), ...b.keys()])].sort().flatMap((fieldPath) => {
    const hasBefore = a.has(fieldPath),
      hasAfter = b.has(fieldPath)
    if (hasBefore && hasAfter && jsonEqual(a.get(fieldPath), b.get(fieldPath))) return []
    return [
      {
        fieldPath,
        beforePresent: hasBefore,
        afterPresent: hasAfter,
        ...(hasBefore ? { before: a.get(fieldPath) } : {}),
        ...(hasAfter ? { after: b.get(fieldPath) } : {}),
        disposition: !hasAfter ? 'missing_from_snapshot_not_deletion' : 'requires_review',
      },
    ]
  })
}

/** Source release does not imply that every bundled character is obtainable. */
export function auditNanokaRelease({
  previousVersion,
  targetVersion,
  providerManifest,
  providerManifestSha256,
  records,
  releaseScope,
}) {
  if (!/^\d+\.\d+$/.test(previousVersion) || !/^\d+\.\d+$/.test(targetVersion))
    fail('Explicit major.minor versions required')
  if (!/^[a-f\d]{64}$/i.test(providerManifestSha256 ?? ''))
    fail('Provider manifest SHA256 required')
  if (providerManifest?.zzz?.live !== targetVersion)
    fail('Target is not the provider live release; beta/latest cannot certify it')
  if (!providerManifest.zzz.available?.includes(previousVersion)) fail('Baseline is not available')
  if (
    releaseScope?.gameVersion !== targetVersion ||
    !['phase_i', 'phase_ii'].includes(releaseScope.phase)
  )
    fail('Official release scope version/phase mismatch')
  if (
    !Array.isArray(releaseScope.sources) ||
    !releaseScope.sources.length ||
    releaseScope.sources.some(
      (url) => !/^https:\/\/(?:zenless\.hoyoverse\.com|zzz\.mihoyo\.com)\//.test(url),
    )
  )
    fail('Official release-scope sources required')
  const additions = new Map()
  for (const item of releaseScope.additions ?? []) {
    const key = `${item.domain}:${item.id}`
    if (
      additions.has(key) ||
      !domains.includes(item.domain) ||
      !/^\d+$/.test(item.id) ||
      !['released', 'scheduled', 'announced'].includes(item.releaseState)
    )
      fail('Invalid release addition')
    additions.set(key, item)
  }
  const groups = new Map(),
    inputManifest = []
  for (const record of records) {
    if (
      !domains.includes(record.domain) ||
      ![previousVersion, targetVersion].includes(record.sourceVersion)
    )
      fail('Unexpected record domain/version')
    if (!/^\d+$/.test(record.id) || String(record.data?.id) !== record.id)
      fail('Source record identity mismatch')
    if (!/^[a-f\d]{64}$/i.test(record.sha256 ?? '')) fail('Record SHA256 required')
    const expectedUrl = `https://static.nanoka.cc/zzz/${record.sourceVersion}/zh/${record.domain}/${record.id}.json`
    if (record.url !== expectedUrl) fail('Source locator/version mismatch')
    const key = `${record.sourceVersion}:${record.domain}:${record.id}`
    if (groups.has(key)) fail(`Duplicate record: ${key}`)
    groups.set(key, record)
    inputManifest.push({
      domain: record.domain,
      id: record.id,
      sourceVersion: record.sourceVersion,
      url: record.url,
      sha256: record.sha256,
    })
  }
  const result = []
  for (const domain of domains) {
    const list = (version) =>
      records.filter((r) => r.domain === domain && r.sourceVersion === version)
    const previous = list(previousVersion),
      current = list(targetVersion)
    if (!previous.length || !current.length) fail(`Incomplete domain snapshot: ${domain}`)
    const identity = diffIdentityMaps(
      Object.fromEntries(previous.map((r) => [r.id, r.data.name ?? r.id])),
      Object.fromEntries(current.map((r) => [r.id, r.data.name ?? r.id])),
    )
    const objects = []
    for (const id of [...new Set([...previous, ...current].map((r) => r.id))].sort()) {
      const a = groups.get(`${previousVersion}:${domain}:${id}`)
      const b = groups.get(`${targetVersion}:${domain}:${id}`)
      if (!b) {
        objects.push({ id, change: 'missing_from_snapshot_not_deletion', beforeSha256: a.sha256 })
        continue
      }
      if (!a) {
        const scope = additions.get(`${domain}:${id}`)
        objects.push({
          id,
          change: 'added',
          name: b.data.name,
          afterSha256: b.sha256,
          releaseState: scope?.releaseState ?? 'unresolved',
          stableId: scope?.stableId ?? null,
          adoption: 'not_adopted',
        })
        continue
      }
      const p = projectRecord(domain, a.data),
        q = projectRecord(domain, b.data)
      const rawChanges = changedFields(a.data, b.data)
      objects.push({
        id,
        name: b.data.name,
        change: rawChanges.length ? 'changed' : 'unchanged',
        beforeSha256: a.sha256,
        afterSha256: b.sha256,
        numericChanges: changedFields(p.numeric, q.numeric),
        mechanicChanges: changedFields(p.mechanics, q.mechanics),
        guidanceChanges: changedFields(p.guidance, q.guidance),
        rawChanges,
      })
    }
    result.push({ domain, identity, objects })
  }
  for (const [key] of additions) {
    const [domain, id] = key.split(':')
    if (!groups.has(`${targetVersion}:${domain}:${id}`)) fail(`Announced addition missing: ${key}`)
  }
  inputManifest.sort((a, b) => a.url.localeCompare(b.url))
  const core = {
    schema: 'soda-nanoka-release-audit/v1',
    previousVersion,
    targetVersion,
    phase: releaseScope.phase,
    providerManifestSha256,
    releaseScope,
    inputManifest,
    rootProvenance: 'hakushin_nanoka_game_data_root_not_independent_from_GO_or_Gachabase',
    domains: result,
    boundaries: {
      productionAdopted: false,
      accountWrites: false,
      automaticDeletion: false,
      formalPromotion: false,
      importPromotion: false,
    },
  }
  return { ...core, contentHash: contentHash(core) }
}

export function readFrozenNanokaAudit({
  detailManifestPath,
  providerManifestPath,
  expectedProviderSha256,
  releaseScopePath,
  previousVersion,
  targetVersion,
}) {
  const providerBytes = readFileSync(providerManifestPath)
  if (sha256(providerBytes) !== expectedProviderSha256?.toLowerCase())
    fail('Provider manifest byte hash mismatch')
  const detail = JSON.parse(readFileSync(detailManifestPath, 'utf8'))
  const records = detail.items.map((row) => {
    if (row.status !== 'read_hash_verified') fail(`Unread source: ${row.url}`)
    const bytes = readFileSync(row.path)
    if (sha256(bytes) !== row.sha256.toLowerCase()) fail(`Source byte hash mismatch: ${row.url}`)
    return { ...row, data: JSON.parse(bytes) }
  })
  return auditNanokaRelease({
    previousVersion,
    targetVersion,
    providerManifest: JSON.parse(providerBytes),
    providerManifestSha256: expectedProviderSha256,
    records,
    releaseScope: JSON.parse(readFileSync(releaseScopePath, 'utf8')),
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    options = {}
  const names = new Set([
    '--detail-manifest',
    '--provider-manifest',
    '--provider-sha256',
    '--release-scope',
    '--previous-version',
    '--target-version',
    '--output-root',
  ])
  for (let i = 0; i < args.length; i += 2) {
    if (!names.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]])
      fail(`Invalid option: ${args[i]}`)
    options[args[i]] = args[i + 1]
  }
  if (Object.keys(options).length !== names.size)
    fail('All named inputs and explicit output root required')
  const report = readFrozenNanokaAudit({
    detailManifestPath: options['--detail-manifest'],
    providerManifestPath: options['--provider-manifest'],
    expectedProviderSha256: options['--provider-sha256'],
    releaseScopePath: options['--release-scope'],
    previousVersion: options['--previous-version'],
    targetVersion: options['--target-version'],
  })
  const summary = {
    contentHash: report.contentHash,
    previousVersion: report.previousVersion,
    targetVersion: report.targetVersion,
    sourceRecords: report.inputManifest.length,
    domains: report.domains.map(({ domain, identity, objects }) => ({
      domain,
      counts: identity.counts,
      numericChangedObjects: objects.filter((x) => x.numericChanges?.length).map((x) => x.id),
      mechanicChangedObjects: objects.filter((x) => x.mechanicChanges?.length).map((x) => x.id),
      guidanceChangedObjects: objects.filter((x) => x.guidanceChanges?.length).map((x) => x.id),
      added: objects.filter((x) => x.change === 'added'),
    })),
    boundaries: report.boundaries,
  }
  const output = resolve(options['--output-root'])
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'source-delta.json'), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(join(output, 'source-delta-summary.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify(summary))
}
