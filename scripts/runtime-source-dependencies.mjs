import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const modulePattern = /\.(?:[cm]?[jt]sx?)$/iu
const literal = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))

function parseSource(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  if (file.parseDiagnostics.length) throw new Error(`Cannot parse source dependencies: ${fileName}`)
  return file
}

/** Match verbatimModuleSyntax: inline type specifiers leave import/export {} and
 * therefore still evaluate the module. Only whole-declaration type edges erase. */
export function moduleDependencyEdges(source, fileName = 'input.ts') {
  const file = parseSource(source, fileName)
  const edges = []
  const add = (specifier, kind, syntax) => edges.push({ specifier, kind, syntax })
  function visit(node) {
    if (ts.isImportDeclaration(node))
      add(node.moduleSpecifier.text, node.importClause?.isTypeOnly ? 'type' : 'runtime', 'import')
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier)
      add(node.moduleSpecifier.text, node.isTypeOnly ? 'type' : 'runtime', 'export')
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      add(node.argument.literal.text, 'type', 'import-type')
    else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'glob' &&
      ts.isMetaProperty(node.expression.expression) &&
      node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    ) {
      const patterns = ts.isArrayLiteralExpression(node.arguments[0])
        ? node.arguments[0].elements
        : [node.arguments[0]]
      const options = node.arguments[1]
      const raw =
        options &&
        ts.isObjectLiteralExpression(options) &&
        options.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
            property.name.text === 'query' &&
            literal(property.initializer) &&
            property.initializer.text === '?raw',
        )
      for (const pattern of patterns) {
        if (!literal(pattern) || /[*?{}[\]!]/u.test(pattern.text))
          throw new Error(`Unsupported glob runtime input requires explicit expansion: ${fileName}`)
        add(`${pattern.text}${raw ? '?raw' : ''}`, 'runtime', 'glob')
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const value = node.moduleReference.expression
      if (literal(value)) add(value.text, node.isTypeOnly ? 'type' : 'runtime', 'import-equals')
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const value = node.arguments[0]
      if (!literal(value))
        throw new Error(`Non-literal runtime import requires a declared input: ${fileName}`)
      add(value.text, 'runtime', 'call')
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return edges
}

export function runtimeModuleSpecifiers(source, fileName) {
  return [
    ...new Set(
      moduleDependencyEdges(source, fileName)
        .filter((edge) => edge.kind === 'runtime')
        .map((edge) => edge.specifier),
    ),
  ]
}

/** SSR calls are execution inputs of this producer function. Verification-only
 * functions in the same script must not introduce a producer -> consumer edge. */
export function producerSsrModuleSpecifiers(source, owner, fileName = 'producer.mjs') {
  const file = parseSource(source, fileName)
  const declaration = file.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === owner,
  )
  if (!declaration?.body) throw new Error(`Producer function not found: ${fileName}#${owner}`)
  const imports = new Set()
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'ssrLoadModule'
    ) {
      if (!literal(node.arguments[0]))
        throw new Error(`Non-literal SSR input: ${fileName}#${owner}`)
      imports.add(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(declaration.body)
  return [...imports]
}

function withinRoot(root, absolute, label) {
  const relative = path.relative(root, absolute)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`${label} escaped app root: ${absolute}`)
  return relative.split(path.sep).join('/')
}

/** Ordinary ESM cycles are deduplicated; a generated-output back edge is an
 * error, never a reason to silently omit a real runtime input. */
export async function collectRuntimeSourceInputs({
  root,
  entries,
  forbiddenInputs = [],
  label = 'Source closure',
}) {
  const lexicalRoot = path.resolve(root)
  const physicalRoot = await realpath(lexicalRoot)
  const forbidden = new Set(forbiddenInputs)
  const pending = entries.map((entry) => ({
    absolute: path.resolve(
      physicalRoot,
      withinRoot(lexicalRoot, path.resolve(lexicalRoot, entry), label),
    ),
    module: true,
  }))
  const sources = new Map()
  const traversed = new Set()

  async function checkedFile(absolute) {
    const relative = withinRoot(physicalRoot, absolute, label)
    if (forbidden.has(relative)) throw new Error(`${label} generated-output back edge: ${relative}`)
    const physical = await realpath(absolute)
    const canonical = withinRoot(physicalRoot, physical, label)
    if (forbidden.has(canonical))
      throw new Error(`${label} generated-output back edge: ${canonical}`)
    return (await stat(physical)).isFile() ? { absolute: physical, relative: canonical } : null
  }

  async function resolveImport(importer, specifier) {
    const clean = specifier.split(/[?#]/u)[0]
    if (
      !clean.startsWith('.') &&
      !clean.startsWith('/') &&
      !clean.startsWith('file:') &&
      !/^[a-z]:[\\/]/iu.test(clean)
    )
      return null
    const base = clean.startsWith('file:')
      ? fileURLToPath(clean)
      : /^[a-z]:[\\/]/iu.test(clean)
        ? path.resolve(clean)
        : clean.startsWith('/')
          ? path.resolve(physicalRoot, clean.slice(1))
          : path.resolve(path.dirname(importer), clean)
    // Reject traversal before any file read, and reject junction/symlink escapes
    // after realpath, before reading content.
    withinRoot(physicalRoot, base, label)
    const candidates = /\.(?:[cm]?[jt]sx?|json)$/iu.test(base)
      ? [base]
      : [
          base,
          ...['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.jsx', '.json'].map(
            (extension) => `${base}${extension}`,
          ),
          ...['index.ts', 'index.tsx', 'index.mts', 'index.mjs', 'index.js', 'index.json'].map(
            (name) => path.join(base, name),
          ),
        ]
    for (const candidate of candidates) {
      try {
        const resolved = await checkedFile(candidate)
        if (resolved) return { ...resolved, module: !/[?&](?:raw|url)(?:[=&#]|$)/u.test(specifier) }
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error
      }
    }
    throw new Error(`Cannot resolve ${label} runtime import ${specifier} from ${importer}`)
  }

  while (pending.length) {
    const input = pending.pop()
    const checked = await checkedFile(input.absolute)
    if (!checked) throw new Error(`${label} input is not a file: ${input.absolute}`)
    const { absolute, relative } = checked
    if (!sources.has(relative)) sources.set(relative, await readFile(absolute))
    if (!input.module || !modulePattern.test(relative) || traversed.has(relative)) continue
    traversed.add(relative)
    for (const specifier of runtimeModuleSpecifiers(
      sources.get(relative).toString('utf8'),
      relative,
    )) {
      const dependency = await resolveImport(absolute, specifier)
      if (dependency) pending.push(dependency)
    }
  }
  return [...sources]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, content]) => ({ path: file, content }))
}
