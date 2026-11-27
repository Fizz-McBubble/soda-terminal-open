import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import ts from 'typescript'
import type { Plugin } from 'vite'

const catalogNames = [
  'generated/current-agent-decision-mechanic-catalog.v1.json',
  'generated/current-agent-mechanic-catalog.v1.json',
  'data/reviewed-team-image-directions.3.1.json',
  'data/reviewed-team-nested-directions.3.1.json',
] as const
const evidenceFile =
  'src/gameDataPacks/generated/l3-b04c7cc7ac8ad6279074/agentDevelopmentEvidence.ts'
const encyclopediaFile = 'src/gameDataPacks/data/current-encyclopedia-display.3.3.json'
const planningEventSetFile = 'src/gameDataPacks/data/reviewed-planning-event-set32.v1.json'
const prefix = '\0soda-catalog:'
const workerSlimPrefix = '\0soda-worker-slim:'
const serialize = (value: unknown) => `JSON.parse(${JSON.stringify(JSON.stringify(value))})`

const workerEncyclopediaPinAgentIds = new Set([
  'agent-lycaon',
  'agent-cissia',
  'agent-astra',
  'agent-rina',
  'agent-seed',
])

const workerEncyclopediaPinImporters = new Set([
  'reviewedLycaonDamageTaken32.ts',
  'reviewedCissiaEventEffects32.ts',
  'reviewedAstraCoreAttack32.ts',
  'reviewedRinaCleanupWindow32.ts',
  'reviewedSeedVanguard32.ts',
])

/**
 * Project the 3.39 MB encyclopedia down to the exact fields read by the 5 reviewed
 * calculation pin guards inside Worker bundles, live-extracted at build time so zero drift
 * is possible while keeping calculation source files byte-identical for hash gates.
 */
export function slimWorkerEncyclopediaPayload(raw: Record<string, unknown>) {
  const agents = Array.isArray(raw.agents) ? raw.agents : []
  return {
    agents: agents
      .filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) &&
          typeof row === 'object' &&
          typeof (row as { stableId?: unknown }).stableId === 'string' &&
          workerEncyclopediaPinAgentIds.has((row as { stableId: string }).stableId),
      )
      .map((row) => {
        const stableId = row.stableId as string
        const source = row.source as Record<string, unknown> | undefined
        if (stableId !== 'agent-astra') {
          return { stableId, source: { sha256: source?.sha256 } }
        }
        const core = Array.isArray(row.core)
          ? row.core
              .filter(
                (entry): entry is Record<string, unknown> =>
                  Boolean(entry) &&
                  typeof entry === 'object' &&
                  (entry as { level?: unknown }).level === 7,
              )
              .map((entry) => ({
                level: entry.level,
                effects: Array.isArray(entry.effects)
                  ? entry.effects.slice(0, 1).map((e: Record<string, unknown>) => ({
                      description: e?.description ?? '',
                    }))
                  : [],
              }))
          : []
        const skills = Array.isArray(row.skills)
          ? row.skills
              .map((skill: Record<string, unknown>) => ({
                effects: Array.isArray(skill?.effects)
                  ? skill.effects
                      .filter(
                        (effect: Record<string, unknown>) =>
                          effect?.name === '和弦' || effect?.name === '普通攻击：终曲',
                      )
                      .map((effect: Record<string, unknown>) => ({
                        name: effect.name,
                        description: effect.description ?? '',
                      }))
                  : [],
              }))
              .filter((skill) => skill.effects.length > 0)
          : []
        return {
          stableId,
          source: { sha256: source?.sha256 },
          core,
          skills,
        }
      }),
  }
}

/**
 * Project the 2.31 MB planning event qualification JSON down to only the fields hashed by
 * reviewedPlanningEventSetIdentity32.ts, live-extracted at build time with zero hash drift.
 */
export function slimWorkerPlanningEventSetIdentityPayload(raw: Record<string, unknown>) {
  return {
    qualificationId: raw.qualificationId,
    gameVersion: raw.gameVersion,
    semanticIdentityHash: raw.semanticIdentityHash,
    scope: raw.scope,
    regression: raw.regression,
  }
}

/**
 * Project the 2.31 MB planning event qualification JSON down to the exact capsuleSchema fields
 * validated by reviewedPlanningEventSet32.ts (drops ~99.4% unused calibration/source blobs).
 */
export function slimWorkerPlanningEventSetQualificationPayload(raw: Record<string, unknown>) {
  const records = Array.isArray(raw.records) ? raw.records : []
  return {
    schema: raw.schema,
    gameVersion: raw.gameVersion,
    upstreamCommit: raw.upstreamCommit,
    qualificationId: raw.qualificationId,
    semanticIdentityHash: raw.semanticIdentityHash,
    ready: raw.ready,
    scope: raw.scope,
    records: records.map((entry: Record<string, unknown>) => {
      const record = (entry?.record ?? {}) as Record<string, unknown>
      const verification = (entry?.verification ?? {}) as Record<string, unknown>
      return {
        record: {
          entity_id: record.entity_id,
          event_id: record.event_id,
          formula_family: record.formula_family,
          capability: record.capability,
        },
        verification: {
          ready: verification.ready,
        },
      }
    }),
  }
}

/**
 * Build plugin that avoids bundling multi-megabyte full JSON payloads into
 * calculation/identity/qualification guards that only inspect a handful of fields.
 */
export function workerRuntimePayloadSlimming(): Plugin {
  const virtualModules = new Map<string, string>()
  let root = ''
  return {
    name: 'soda-worker-runtime-payload-slimming',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      virtualModules.clear()
    },
    resolveId(source, importer) {
      if (source.startsWith(workerSlimPrefix)) return source
      if (!importer) return null
      const cleanImporter = importer.split('?', 1)[0]
      const importerBase = basename(cleanImporter)
      if (
        importerBase === 'agentSearchAliases.ts' &&
        source === '../gameDataPacks/currentEncyclopediaData'
      ) {
        const binding = resolve(dirname(cleanImporter), source + '.ts')
        const data = readFileSync(binding, 'utf8').match(
          /^import source from '([^']+\.json)\?raw'\r?$/m,
        )
        if (!data?.[1]) throw new Error('Agent search encyclopedia binding changed')
        const file = resolve(dirname(binding), data[1])
        const id = `${workerSlimPrefix}agent-search-names.js`
        if (!virtualModules.has(id)) {
          const { agents } = JSON.parse(readFileSync(file, 'utf8')) as {
            agents: { stableId: string; fullName: string }[]
          }
          virtualModules.set(
            id,
            `export default ${serialize({ agents: agents.map(({ stableId, fullName }) => ({ stableId, fullName })) })};`,
          )
        }
        this.addWatchFile(binding)
        this.addWatchFile(file)
        return id
      }
      if (source.includes('?') || !source.endsWith('.json')) return null
      const resolvedFile = resolve(dirname(cleanImporter), source)
      if (
        resolvedFile === resolve(root, encyclopediaFile) &&
        workerEncyclopediaPinImporters.has(importerBase)
      ) {
        const id = `${workerSlimPrefix}encyclopedia-pins.js`
        if (!virtualModules.has(id)) {
          const parsed = JSON.parse(readFileSync(resolvedFile, 'utf8')) as Record<string, unknown>
          virtualModules.set(
            id,
            `export default ${serialize(slimWorkerEncyclopediaPayload(parsed))};`,
          )
        }
        this.addWatchFile(resolvedFile)
        return id
      }
      if (
        resolvedFile === resolve(root, planningEventSetFile) &&
        importerBase === 'reviewedPlanningEventSetIdentity32.ts'
      ) {
        const id = `${workerSlimPrefix}planning-event-set-identity.js`
        if (!virtualModules.has(id)) {
          const parsed = JSON.parse(readFileSync(resolvedFile, 'utf8')) as Record<string, unknown>
          virtualModules.set(
            id,
            `export default ${serialize(slimWorkerPlanningEventSetIdentityPayload(parsed))};`,
          )
        }
        this.addWatchFile(resolvedFile)
        return id
      }
      if (
        resolvedFile === resolve(root, planningEventSetFile) &&
        importerBase === 'reviewedPlanningEventSet32.ts'
      ) {
        const id = `${workerSlimPrefix}planning-event-set-qualification.js`
        if (!virtualModules.has(id)) {
          const parsed = JSON.parse(readFileSync(resolvedFile, 'utf8')) as Record<string, unknown>
          virtualModules.set(
            id,
            `export default ${serialize(slimWorkerPlanningEventSetQualificationPayload(parsed))};`,
          )
        }
        this.addWatchFile(resolvedFile)
        return id
      }
      return null
    },
    load(id) {
      return virtualModules.get(id) ?? null
    },
  }
}

/** Preserve JSON values and order while giving the bundler independently cacheable modules. */
export function catalogModules(value: Record<string, unknown>, identity: string) {
  const modules = new Map<string, string>()
  const metadata = { ...value }
  const imports: string[] = []
  const assignments: string[] = []
  for (const [key, items] of Object.entries(value)) {
    if (!Array.isArray(items) || items.length === 0) continue
    metadata[key] = []
    const groups: unknown[][] = []
    let group: unknown[] = []
    let bytes = 0
    for (const item of items) {
      const size = Buffer.byteLength(JSON.stringify(item))
      if (group.length && bytes + size > 160_000) {
        groups.push(group)
        group = []
        bytes = 0
      }
      group.push(item)
      bytes += size
    }
    if (group.length) groups.push(group)
    const bindings = groups.map((items, index) => {
      const id = `${prefix}${identity}:${key}-${index}.js`
      const binding = `part${imports.length}`
      modules.set(id, `export default ${serialize(items)};`)
      imports.push(`import ${binding} from ${JSON.stringify(id)};`)
      return binding
    })
    assignments.push(`catalog[${JSON.stringify(key)}] = [].concat(${bindings.join(',')});`)
  }
  const entry = `${prefix}${identity}:catalog.js`
  modules.set(
    entry,
    `${imports.join('\n')}\nconst catalog = ${serialize(metadata)};\n${assignments.join('\n')}\nexport default catalog;`,
  )
  return { entry, modules }
}

/** Extract only the generated JSON payload; retain the module's typed public API. */
export function evidenceModules(source: string) {
  const ast = ts.createSourceFile('evidence.ts', source, ts.ScriptTarget.Latest, true)
  const payload = ast.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => declaration.name.getText(ast) === 'l3AgentDevelopmentEvidencePayload',
      ),
  )
  const initializer = payload?.declarationList.declarations[0]?.initializer
  if (!payload || !initializer || !ts.isStringLiteral(initializer)) {
    throw new Error('Generated evidence payload structure changed')
  }
  const generated = catalogModules(JSON.parse(initializer.text), 'agent-development-evidence')
  const expression = 'JSON.parse(l3AgentDevelopmentEvidencePayload)'
  const withoutPayload = source.slice(0, payload.getStart(ast)) + source.slice(payload.end)
  if (withoutPayload.split(expression).length !== 2) {
    throw new Error('Generated evidence consumer structure changed')
  }
  return {
    ...generated,
    code: `import catalogPayload from ${JSON.stringify(generated.entry)};\n${withoutPayload.replace(expression, 'catalogPayload')}`,
  }
}

export function catalogCodeSplitting(
  projectSource?: (source: string, file: string) => string,
): Plugin {
  const modules = new Map<string, string>()
  const entries = new Map<string, string>()
  let root = ''
  return {
    name: 'soda-catalog-code-splitting',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      modules.clear()
      entries.clear()
    },
    resolveId(source, importer) {
      if (source.startsWith(prefix)) return source
      if (!importer || source.includes('?') || !source.endsWith('.json')) return null
      const file = resolve(dirname(importer), source)
      const name = catalogNames.find((name) => file === resolve(root, 'src/gameDataPacks', name))
      if (!name) return null
      let entry = entries.get(file)
      if (!entry) {
        const source = readFileSync(file, 'utf8')
        const generated = catalogModules(
          JSON.parse(projectSource ? projectSource(source, file) : source),
          basename(name),
        )
        entry = generated.entry
        entries.set(file, entry)
        for (const [id, code] of generated.modules) modules.set(id, code)
      }
      this.addWatchFile(file)
      return entry
    },
    load(id) {
      return modules.get(id) ?? null
    },
    transform(code, id) {
      if (resolve(id) !== resolve(root, evidenceFile)) return null
      const generated = evidenceModules(projectSource ? projectSource(code, id) : code)
      for (const [moduleId, source] of generated.modules) modules.set(moduleId, source)
      this.addWatchFile(id)
      return { code: generated.code, map: null }
    },
  }
}
