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
const prefix = '\0soda-catalog:'
const serialize = (value: unknown) => `JSON.parse(${JSON.stringify(JSON.stringify(value))})`

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

export function catalogCodeSplitting(projectSource?: (source: string, file: string) => string): Plugin {
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
