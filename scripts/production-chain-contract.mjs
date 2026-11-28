import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(appRoot, 'src')
export const productionBuildModeDefinitions = Object.freeze({
  local: {
    entry: 'main.tsx',
    required: [
      'App.tsx',
      'application/browserCalculationQueryClient.ts',
      'application/browserCalculationQuery.worker.ts',
      'application/localCalculationQueryClient.ts',
      'application/remoteCalculationQueryClient.ts',
      'appHealth.tsx',
    ],
    forbidden: ['AppCommunity.tsx', 'AppPublic.tsx', 'appHealthPublic.tsx'],
  },
  community: {
    entry: 'main.community.tsx',
    required: [
      'AppCommunity.tsx',
      'application/accountDecisionWorld.tsx',
      'application/browserCalculationQueryClient.ts',
      'application/browserCalculationQuery.worker.ts',
      'appHealth.tsx',
    ],
    forbidden: [
      'App.tsx',
      'AppPublic.tsx',
      'application/localCalculationQueryClient.ts',
      'application/remoteCalculationQueryClient.ts',
      'appHealthPublic.tsx',
    ],
  },
  public: {
    entry: 'main.public.tsx',
    required: [
      'AppPublic.tsx',
      'application/publicRuntimeSelection.ts',
      'application/remoteCalculationQueryClient.ts',
      'appHealthPublic.tsx',
    ],
    forbidden: [
      'App.tsx',
      'AppCommunity.tsx',
      'application/browserCalculationQueryClient.ts',
      'application/browserCalculationQuery.worker.ts',
      'application/localCalculationQueryClient.ts',
      'appHealth.tsx',
    ],
  },
})
export const productionBuildModes = Object.keys(productionBuildModeDefinitions)

function normalized(path) {
  return relative(sourceRoot, path).replaceAll('\\', '/')
}

function resolveModule(fromPath, specifier) {
  if (!specifier.startsWith('.')) return null
  const target = resolve(dirname(fromPath), specifier)
  for (const candidate of [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    resolve(target, 'index.ts'),
    resolve(target, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function dynamicImportSpecifier(node) {
  if (!node || !ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword)
    return null
  const [specifier] = node.arguments
  return specifier && ts.isStringLiteral(specifier) ? specifier.text : null
}

export function sourceImports(source) {
  const imports = []
  const file = ts.createSourceFile(
    'source.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text)
    const dynamicImport = dynamicImportSpecifier(node)
    if (dynamicImport) imports.push(dynamicImport)
    // Vite's module Worker is a production entry too, even though it is not an import.
    if (ts.isNewExpression(node) && node.expression.getText(file) === 'Worker') {
      const url = node.arguments?.[0]
      if (
        url &&
        ts.isNewExpression(url) &&
        url.expression.getText(file) === 'URL' &&
        url.arguments?.[0] &&
        ts.isStringLiteral(url.arguments[0]) &&
        url.arguments[1]?.getText(file) === 'import.meta.url'
      )
        imports.push(url.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return imports
}

export function reachableProductionSources(entry = resolve(sourceRoot, 'App.tsx')) {
  const pending = [entry]
  const visited = new Map()
  while (pending.length) {
    const path = pending.pop()
    if (!path || visited.has(path)) continue
    const source = readFileSync(path, 'utf8')
    visited.set(path, source)
    for (const specifier of sourceImports(source)) {
      const imported = resolveModule(path, specifier)
      if (imported && !visited.has(imported)) pending.push(imported)
    }
  }
  return visited
}

function requireText(issues, sources, path, fragments) {
  const source = sources.get(resolve(sourceRoot, path))
  if (!source) {
    issues.push(`required production source is not reachable: ${path}`)
    return
  }
  for (const fragment of fragments) {
    if (!source.includes(fragment)) issues.push(`${path} missing contract fragment: ${fragment}`)
  }
}

function parsedSource(source) {
  return ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function unwrapParentheses(node) {
  while (node && ts.isParenthesizedExpression(node)) node = node.expression
  return node
}

function objectProperty(node, property) {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined
  return node.properties.find(
    (entry) =>
      ts.isPropertyAssignment(entry) &&
      (ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)) &&
      entry.name.text === property,
  )?.initializer
}

function jsxTag(node, file) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(file)
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
    return node.tagName.getText(file)
  return null
}

function ownerNode(file, owner) {
  let matched = null
  function find(node) {
    if (
      ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
        node.name?.getText(file) === owner) ||
      (ts.isVariableDeclaration(node) &&
        node.name.getText(file) === owner &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) ||
      (ts.isPropertyAssignment(node) &&
        node.name.getText(file) === owner &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
    ) {
      matched = node
      return
    }
    ts.forEachChild(node, find)
  }
  find(file)
  return matched
}

function ownerContains(file, owner, matches) {
  const node = ownerNode(file, owner)
  if (!node) return false
  function visit(child) {
    return matches(child) || ts.forEachChild(child, visit)
  }
  return Boolean(visit(node))
}

/** Returns executable text for the named function, excluding comments elsewhere and example strings. */
export function sourceOwnerText(source, owner) {
  const file = parsedSource(source)
  return ownerNode(file, owner)?.getText(file) ?? null
}

function sourceWithoutComments(source) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, source)
  const commentRanges = []
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    )
      commentRanges.push([scanner.getTokenFullStart(), scanner.getTokenEnd()])
  }
  if (!commentRanges.length) return source
  let result = ''
  let cursor = 0
  for (const [start, end] of commentRanges) {
    result += source.slice(cursor, start)
    result += source.slice(start, end).replace(/[^\r\n]/gu, ' ')
    cursor = end
  }
  return result + source.slice(cursor)
}

/**
 * Returns the local binding produced by a `lazy(() => import(...).then(...))`
 * declaration only when both the module and named export match.
 */
export function lazyComponentBinding(source, specifier, exportName) {
  const file = parsedSource(source)
  let matched = null
  function find(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(file) === 'lazy'
    ) {
      const [factory] = node.initializer.arguments
      if (factory && ts.isArrowFunction(factory)) {
        const load = unwrapParentheses(factory.body)
        if (
          ts.isCallExpression(load) &&
          ts.isPropertyAccessExpression(load.expression) &&
          load.expression.name.text === 'then' &&
          dynamicImportSpecifier(load.expression.expression) === specifier
        ) {
          const [projectModule] = load.arguments
          if (projectModule && ts.isArrowFunction(projectModule)) {
            const module = projectModule.parameters[0]?.name
            const component = objectProperty(unwrapParentheses(projectModule.body), 'default')
            if (
              module &&
              ts.isIdentifier(module) &&
              component &&
              ts.isPropertyAccessExpression(component) &&
              ts.isIdentifier(component.expression) &&
              component.expression.text === module.text &&
              component.name.text === exportName
            )
              matched = node.name.text
          }
        }
      }
    }
    if (!matched) ts.forEachChild(node, find)
  }
  find(file)
  return matched
}

export function sourceOwnerBindsRouterRoute(source, owner, layout, path, specifier, exportName) {
  const file = parsedSource(source)
  return ownerContains(file, owner, (node) => {
    if (!ts.isCallExpression(node) || node.expression.getText(file) !== 'createBrowserRouter')
      return false
    const [routes] = node.arguments
    if (!routes || !ts.isArrayLiteralExpression(routes)) return false
    return routes.elements.some((route) => {
      const element = objectProperty(route, 'element')
      const children = objectProperty(route, 'children')
      if (
        !element ||
        jsxTag(element, file) !== layout ||
        !children ||
        !ts.isArrayLiteralExpression(children)
      )
        return false
      return children.elements.some((child) => {
        const pathname = objectProperty(child, 'path')
        const lazy = objectProperty(child, 'lazy')
        if (
          !pathname ||
          !ts.isStringLiteral(pathname) ||
          pathname.text !== path ||
          !lazy ||
          !ts.isArrowFunction(lazy)
        )
          return false
        let result = lazy.body
        if (ts.isBlock(lazy.body)) {
          const end = lazy.body.statements.at(-1)
          if (
            !end ||
            !ts.isReturnStatement(end) ||
            !end.expression ||
            !lazy.body.statements.slice(0, -1).every(ts.isExpressionStatement)
          )
            return false
          result = end.expression
        }
        const component = objectProperty(unwrapParentheses(result), 'Component')
        if (
          !component ||
          !ts.isPropertyAccessExpression(component) ||
          component.name.text !== exportName
        )
          return false
        const module = unwrapParentheses(component.expression)
        return (
          ts.isAwaitExpression(module) && dynamicImportSpecifier(module.expression) === specifier
        )
      })
    })
  })
}

/**
 * Checks that the named owner renders a component only in its exact route
 * branch. This retains executable route evidence for lazily imported pages.
 */
export function sourceOwnerRendersComponentAtPath(source, owner, component, pathname) {
  const file = parsedSource(source)
  const ownerSource = ownerNode(file, owner)
  if (!ownerSource) return false
  let matched = false
  function containsComponent(node) {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(file) === component
    )
      return true
    return ts.forEachChild(node, containsComponent) ?? false
  }
  function inspect(node) {
    if (ts.isIfStatement(node)) {
      const condition = node.expression
      if (
        ts.isBinaryExpression(condition) &&
        condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isPropertyAccessExpression(condition.left) &&
        condition.left.getText(file) === 'location.pathname' &&
        ts.isStringLiteral(condition.right) &&
        condition.right.text === pathname &&
        containsComponent(node.thenStatement)
      ) {
        matched = true
        return
      }
    }
    ts.forEachChild(node, inspect)
  }
  inspect(ownerSource)
  return matched
}

/** Inspects executable syntax inside the named owner, excluding comments and example strings. */
export function sourceOwnerCalls(source, owner, expression, jsx = false) {
  const file = parsedSource(source)
  return ownerContains(file, owner, (node) =>
    jsx
      ? jsxTag(node, file) === expression
      : ts.isCallExpression(node) && node.expression.getText(file) === expression,
  )
}

function sourceOwnerPassesComponentProp(source, owner, component, property, expression) {
  const file = parsedSource(source)
  return ownerContains(file, owner, (node) => {
    if (
      (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) ||
      jsxTag(node, file) !== component
    )
      return false
    return node.attributes.properties.some(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(file) === property &&
        attribute.initializer &&
        ts.isJsxExpression(attribute.initializer) &&
        attribute.initializer.expression?.getText(file) === expression,
    )
  })
}

function requireOwnerCall(issues, sources, path, owner, expression, jsx = false) {
  const source = sources.get(resolve(sourceRoot, path))
  if (!source || !sourceOwnerCalls(source, owner, expression, jsx))
    issues.push(`${path} missing executable delegation: ${owner} -> ${expression}`)
}

function requireOwnerFragment(issues, sources, path, owner, label, pattern) {
  const source = sources.get(resolve(sourceRoot, path))
  const ownerText = source ? sourceOwnerText(source, owner) : null
  if (!ownerText || !pattern.test(sourceWithoutComments(ownerText)))
    issues.push(`${path} missing safe ${owner} contract: ${label}`)
}

function requireImportedOwnerCall(issues, sources, path, importedPath, symbol, owner, jsx = false) {
  const source = sources.get(resolve(sourceRoot, path))
  let binding = null
  if (source) {
    const file = parsedSource(source)
    for (const statement of file.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        resolveModule(resolve(sourceRoot, path), statement.moduleSpecifier.text) !==
          resolve(sourceRoot, importedPath)
      )
        continue
      const names = statement.importClause?.namedBindings
      if (!names || !ts.isNamedImports(names) || statement.importClause.isTypeOnly) continue
      for (const named of names.elements)
        if (!named.isTypeOnly && (named.propertyName?.text ?? named.name.text) === symbol)
          binding = named.name.text
    }
  }
  if (
    !binding ||
    !sources.has(resolve(sourceRoot, importedPath)) ||
    !sourceOwnerCalls(source, owner, binding, jsx)
  )
    issues.push(`${path} missing imported delegation: ${owner} -> ${importedPath}#${symbol}`)
}

// Match the module namespace to its tuple entry in the Promise.all callback.
function promiseModuleSpecifier(file, call, namespace) {
  for (let node = call.parent; node; node = node.parent) {
    if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) continue
    const binding = node.parameters[0]?.name
    if (!binding || !ts.isArrayBindingPattern(binding)) continue
    const index = binding.elements.findIndex(
      (element) =>
        ts.isBindingElement(element) &&
        !element.dotDotDotToken &&
        ts.isIdentifier(element.name) &&
        element.name.text === namespace,
    )
    if (index < 0) continue
    const then = node.parent
    if (
      !ts.isCallExpression(then) ||
      then.arguments[0] !== node ||
      !ts.isPropertyAccessExpression(then.expression) ||
      then.expression.name.text !== 'then'
    )
      return null
    const all = then.expression.expression
    if (!ts.isCallExpression(all) || all.expression.getText(file) !== 'Promise.all') return null
    const [modules] = all.arguments
    return modules && ts.isArrayLiteralExpression(modules)
      ? dynamicImportSpecifier(modules.elements[index])
      : null
  }
  return null
}

function requirePromiseModuleOwnerCall(issues, sources, path, importedPath, symbol, owner) {
  const absolute = resolve(sourceRoot, path)
  const target = resolve(sourceRoot, importedPath)
  const source = sources.get(absolute)
  const file = source && parsedSource(source)
  const matched =
    file &&
    ownerContains(file, owner, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression))
        return false
      const namespace = node.expression.expression
      if (!ts.isIdentifier(namespace) || node.expression.name.text !== symbol) return false
      const specifier = promiseModuleSpecifier(file, node, namespace.text)
      return specifier !== null && resolveModule(absolute, specifier) === target
    })
  if (!matched || !sources.has(target))
    issues.push(`${path} missing imported delegation: ${owner} -> ${importedPath}#${symbol}`)
}

export function routedContentHasDecisionProvider(source, owner = 'PlayerDecisionWorld') {
  const file = ts.createSourceFile(
    'App.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let outlets = 0
  let protectedOutlets = 0
  let unwrapped = false
  const scannerGuards = new Set()
  function registerScannerGuards(ownerNode) {
    const body = ts.isVariableDeclaration(ownerNode) ? ownerNode.initializer?.body : ownerNode.body
    const statements = body?.statements ?? []
    const declarations = statements
      .filter(ts.isVariableStatement)
      .filter((statement) => statement.declarationList.flags & ts.NodeFlags.Const)
      .flatMap((statement) => [...statement.declarationList.declarations])
    const hasRoutePath = declarations.some(
      (declaration) =>
        ts.isObjectBindingPattern(declaration.name) &&
        declaration.name.elements.some(
          (element) =>
            element.name.getText(file) === 'pathname' &&
            (element.propertyName?.getText(file) ?? 'pathname') === 'pathname',
        ) &&
        declaration.initializer &&
        ts.isCallExpression(declaration.initializer) &&
        declaration.initializer.expression.getText(file) === 'useLocation',
    )
    if (!hasRoutePath) return
    for (const declaration of declarations) {
      const expression = declaration.initializer
      if (
        ts.isIdentifier(declaration.name) &&
        expression &&
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isStringLiteral(expression.right) &&
        expression.right.text === '/system/scanner' &&
        expression.left.getText(file).replace(/\s/g, '') ===
          "pathname.replace(/\\/+$/,'').toLowerCase()"
      )
        scannerGuards.add(declaration.name.text)
    }
  }
  function visit(node, insideProvider = false, scannerOnly = false) {
    if (ts.isConditionalExpression(node)) {
      visit(node.condition, insideProvider, scannerOnly)
      const isScannerGuard =
        ts.isIdentifier(node.condition) && scannerGuards.has(node.condition.text)
      visit(node.whenTrue, insideProvider, scannerOnly || isScannerGuard)
      visit(node.whenFalse, insideProvider, scannerOnly)
      return
    }
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(file)
      if (tag === 'Outlet') {
        outlets += 1
        protectedOutlets += Number(insideProvider)
        unwrapped ||= !insideProvider && !scannerOnly
      }
      for (const child of node.children)
        visit(child, insideProvider || tag === 'AccountDecisionWorldProvider', scannerOnly)
      return
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === 'Outlet') {
      outlets += 1
      protectedOutlets += Number(insideProvider)
      unwrapped ||= !insideProvider && !scannerOnly
    }
    ts.forEachChild(node, (child) => visit(child, insideProvider, scannerOnly))
  }
  function find(node) {
    if (
      (ts.isFunctionDeclaration(node) && node.name?.getText(file) === owner) ||
      (ts.isVariableDeclaration(node) &&
        node.name.getText(file) === owner &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
    ) {
      registerScannerGuards(node)
      visit(node)
      return
    }
    ts.forEachChild(node, find)
  }
  find(file)
  return outlets > 0 && protectedOutlets > 0 && !unwrapped
}

export function inspectProductionChain(sources = reachableProductionSources()) {
  const issues = []
  // Shell/loading/statistics render before account analysis. Routed
  // decision consumers enter through a protected Outlet. Only the exact
  // scanner route guard may bypass it.
  const composition = sources.get(resolve(sourceRoot, 'AppCore.tsx')) ?? ''
  if (!routedContentHasDecisionProvider(composition))
    issues.push('PlayerDecisionWorld Outlet is not enclosed by AccountDecisionWorldProvider')
  requireImportedOwnerCall(
    issues,
    sources,
    'AppCore.tsx',
    'application/accountDecisionWorld.tsx',
    'AccountDecisionWorldProvider',
    'PlayerDecisionWorld',
    true,
  )
  if (
    !sourceOwnerBindsRouterRoute(
      composition,
      'AppCore',
      'PlayerDecisionWorld',
      'loadouts/team',
      './pages/optimizer/TeamPicker',
      'TeamPicker',
    )
  )
    issues.push(
      'AppCore.tsx missing lazy /loadouts/team route to TeamPicker under PlayerDecisionWorld',
    )
  for (const [path, owner] of [
    ['AppCore.tsx', 'PlayerDecisionWorld'],
    ['components/AppShell.tsx', 'AppShell'],
    ['components/F5VisualShell.tsx', 'F5VisualShell'],
    ['components/AppEntryState.tsx', 'AppInitializationGate'],
    ['usageStatistics/UsageStatistics.tsx', 'UsageStatistics'],
  ]) {
    const source = sources.get(resolve(sourceRoot, path))
    if (source && sourceOwnerCalls(source, owner, 'useAccountDecisionWorld'))
      issues.push(`account decision consumer is outside the route provider: ${path}#${owner}`)
  }

  const bannedReachableModules = [
    'optimizer/boxTeamArchetypeMatcher.ts',
    'optimizer/productSeedBoxPersonalization.ts',
    'optimizer/boxTeamRecommendation.ts',
    'pages/OptimizerPage.tsx',
    'pages/TeamPortfolio.tsx',
  ]
  for (const path of bannedReachableModules) {
    if (sources.has(resolve(sourceRoot, path)))
      issues.push(`legacy/frozen module is production reachable: ${path}`)
  }

  const forbiddenPageCalls = [
    'buildAccountDecisionSnapshot',
    'analyzeAccountWarehouse',
    'solveTeamEngine',
    'coordinateMatchedTeams',
    'matchBoxTeamArchetypes',
    'personalizeProductTeamSeeds',
    'solveCandidateTeamAlternatives',
  ]
  for (const [path, source] of sources) {
    const name = normalized(path)
    if (
      !name.startsWith('pages/') &&
      !name.startsWith('components/') &&
      !name.startsWith('features/')
    )
      continue
    for (const call of forbiddenPageCalls) {
      if (source.includes(call))
        issues.push(`production UI must not create decisions: ${name} references ${call}`)
    }
  }

  requireText(issues, sources, 'application/accountDecisionWorld.tsx', [
    'createAccountDecisionRun',
    'AccountDecisionWorldProvider',
    'CalculationQueryClient',
  ])
  requireText(issues, sources, 'application/localCalculationQueryClient.ts', [
    'createDefaultAccountDecisionSnapshotCalculator',
    'createLocalCalculationQueryClient',
  ])
  requirePromiseModuleOwnerCall(
    issues,
    sources,
    'application/localCalculationQueryClient.ts',
    'application/localCalculationQueryClientCore.ts',
    'createLocalCalculationQueryClientCore',
    'createLocalCalculationQueryClient',
  )
  requireOwnerCall(
    issues,
    sources,
    'application/localCalculationQueryClient.ts',
    'calculateAccountDecision',
    'getClient',
  )
  requireOwnerCall(
    issues,
    sources,
    'application/localCalculationQueryClientCore.ts',
    'calculateAccountDecision',
    'calculateSnapshot',
  )
  requireText(issues, sources, 'application/browserAccountDecisionWorker.ts', [
    'createDefaultAccountDecisionSnapshotCalculator',
    'createBrowserAccountDecisionSnapshotCalculator',
    'accountDecisionSnapshot.worker.ts',
  ])
  requireText(issues, sources, 'application/accountDecisionSnapshot.worker.ts', [
    'buildAccountDecisionSnapshot',
    'calculateAccountDecisionSnapshotWorkerResponse',
  ])
  requireText(issues, sources, 'decision/accountDecisionService.ts', [
    'solveTeamEngine',
    'coordinateDecisionPortfolio',
    'analyzeAccountWarehouse',
  ])
  requireText(issues, sources, 'decision/accountDecisionCoordination.ts', [
    'coordinateDecisionPortfolio',
    'return coordinateMatchedTeams(',
  ])
  for (const path of [
    'pages/DashboardPage.tsx',
    'pages/AgentDevelopmentGoldenDirectoryPage.tsx',
    'pages/AgentDevelopmentWorkbenchPage.tsx',
    'pages/AgentLoadoutComparisonPage.tsx',
    'pages/OptimizerFlowPage.tsx',
    'pages/WarehouseDiscsPage.tsx',
  ])
    requireText(issues, sources, path, ['useAccountDecisionWorld'])
  const optimizerFlow = 'pages/OptimizerFlowPage.tsx'
  requireOwnerCall(
    issues,
    sources,
    optimizerFlow,
    'OptimizerFlowPage',
    'OptimizerFlowWorkspace',
    true,
  )
  for (const recovery of ['currentDecisionWorldForRecovery', 'loadCurrentTeamOverviewFromQuery'])
    requireImportedOwnerCall(
      issues,
      sources,
      optimizerFlow,
      'pages/teamAnalysisRecovery.ts',
      recovery,
      'OptimizerFlowWorkspace',
    )
  const optimizerFlowSource = sources.get(resolve(sourceRoot, optimizerFlow)) ?? ''
  if (
    !sourceOwnerPassesComponentProp(
      optimizerFlowSource,
      'OptimizerFlowWorkspace',
      'TeamPlan',
      'decision',
      'session?.result.decisionSnapshot',
    )
  )
    issues.push(`${optimizerFlow} TeamPlan does not consume the analysis session snapshot`)
  const lazyTeamPicker = lazyComponentBinding(
    optimizerFlowSource,
    './optimizer/TeamPicker',
    'TeamPicker',
  )
  if (
    !optimizerFlowSource ||
    !sourceImports(optimizerFlowSource).includes('./optimizer/TeamPicker')
  )
    issues.push('pages/OptimizerFlowPage.tsx missing lazy import: ./optimizer/TeamPicker')
  if (!lazyTeamPicker)
    issues.push('pages/OptimizerFlowPage.tsx missing dynamic TeamPicker module/export binding')
  if (!optimizerFlowSource || !sources.has(resolve(sourceRoot, 'pages/optimizer/TeamPicker.tsx')))
    issues.push('pages/OptimizerFlowPage.tsx lazy TeamPicker source is not reachable')
  if (
    !optimizerFlowSource ||
    !lazyTeamPicker ||
    !sourceOwnerRendersComponentAtPath(
      optimizerFlowSource,
      'OptimizerFlowPage',
      lazyTeamPicker,
      '/loadouts/team',
    )
  )
    issues.push(
      'pages/OptimizerFlowPage.tsx missing executable lazy TeamPicker /loadouts/team route',
    )
  requireOwnerCall(
    issues,
    sources,
    'pages/optimizer/TeamPicker.tsx',
    'TeamPicker',
    'TeamPickerAccountScope',
    true,
  )
  requireImportedOwnerCall(
    issues,
    sources,
    'pages/optimizer/TeamPicker.tsx',
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'useTeamAnalysisFlow',
    'TeamPickerAccountScope',
  )
  requireOwnerCall(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'startAnalysis',
    'reuseCurrentAnalysis',
  )
  requireOwnerCall(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'startAnalysis',
    'latestDecisionWorld.current.refresh',
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'startAnalysis',
    'explicit refresh gates precede the refresh path',
    /const shouldForceRefresh\s*=\s*forceRefresh\s*\|\|\s*latestDecisionWorld\.current\.analysisIssue\?\.kind === 'run_lost'\s*\|\|\s*Boolean\(rematchRequestRef\.current\)\s*\|\|\s*analysis\.kind === 'stale'\s*\|\|\s*analysis\.kind === 'error'/u,
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'startAnalysis',
    'validated reuse returns before refresh',
    /if \(!shouldForceRefresh\) \{[\s\S]*?const reused = await reuseCurrentAnalysis\(\)[\s\S]*?if \(reused\) return/u,
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'reuseCurrentAnalysis',
    'rematch, lost runs, stale and error sessions reject reuse',
    /if \(\s*Boolean\(rematchRequestRef\.current\)\s*\|\|\s*decisionWorld\.analysisIssue\?\.kind === 'run_lost'\s*\|\|\s*analysis\.kind === 'stale'\s*\|\|\s*analysis\.kind === 'error'\s*\)\s*return false\s*const run = reusableCurrentRun\(decisionWorld, accountSummary\)/u,
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'reuseCurrentAnalysis',
    'route and generation are rechecked before current run reuse',
    /if \(request !== analysisRequestRef\.current \|\| !isCurrentRoute\(\)\)[\s\S]*?const latestRun = reusableCurrentRun\([\s\S]*?latestDecisionWorld\.current,[\s\S]*?latestAccountSummary\.current,[\s\S]*?runId: run\.runId,[\s\S]*?accountId: run\.input\.warehouse\.accountId \?\? '',[\s\S]*?fingerprint: run\.snapshot\.fingerprint\.inputHash/u,
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'reuseCurrentAnalysis',
    'reuse commit rechecks route and generation',
    /queueMicrotask\(\(\) => \{[\s\S]*?if \(request !== analysisRequestRef\.current \|\| !isCurrentRoute\(\)\) return/u,
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'reusableCurrentRun',
    'current account and run identity',
    /decisionWorld\.status !== 'current'[\s\S]*?run\.input\.warehouse\.accountId !== accountSummary\.accountId/u,
  )
  requireOwnerFragment(
    issues,
    sources,
    'pages/optimizer/useTeamAnalysisFlow.ts',
    'reusableCurrentRun',
    'snapshot and live fingerprints',
    /run\.inputFingerprint !== run\.snapshot\.fingerprint\.inputHash[\s\S]*?decisionWorld\.liveFingerprint !== run\.snapshot\.fingerprint\.inputHash/u,
  )
  requireImportedOwnerCall(
    issues,
    sources,
    'pages/optimizer/TeamPicker.tsx',
    'pages/optimizer/useTeamPickerQueries.ts',
    'useTeamPickerQueries',
    'TeamPickerAccountScope',
  )
  requireOwnerCall(
    issues,
    sources,
    'pages/optimizer/useTeamPickerQueries.ts',
    'queryTeamOverview',
    'calculationClient.queryTeamOverviewPresentation',
  )
  requireImportedOwnerCall(
    issues,
    sources,
    'pages/optimizer/useTeamPickerQueries.ts',
    'pages/teamLoadoutPresentationDto.ts',
    'acceptTeamOverviewPresentation',
    'queryTeamOverview',
  )
  // The overview model is built only in the private Query producer the page accepts from.
  requireText(issues, sources, 'pages/privateTeamLoadoutPresentationProducer.ts', [
    'buildTeamLoadoutOverviewModel',
    'teamLoadoutOverviewModel',
  ])
  requireText(issues, sources, 'pages/teamLoadoutOverviewModel.ts', [
    'AccountDecisionSnapshot',
    'decision.claims',
  ])
  for (const retiredJourneySource of [
    'components/AccountDecisionJourneyBar.tsx',
    'decision/accountDecisionJourney.ts',
  ]) {
    if (sources.has(resolve(sourceRoot, retiredJourneySource)))
      issues.push(`retired shared journey overlay re-entered production: ${retiredJourneySource}`)
  }

  const builderOwners = [...sources.entries()]
    .filter(([, source]) => source.includes('buildAccountDecisionSnapshot'))
    .map(([path]) => normalized(path))
    .sort()
  requirePromiseModuleOwnerCall(
    issues,
    sources,
    'application/browserCalculationQuery.worker.ts',
    'decision/accountDecisionService.ts',
    'buildAccountDecisionSnapshot',
    'calculateSnapshot',
  )
  requirePromiseModuleOwnerCall(
    issues,
    sources,
    'application/browserCalculationQuery.worker.ts',
    'application/localCalculationQueryClientCore.ts',
    'createLocalCalculationQueryClientCore',
    'getClient',
  )
  requireOwnerCall(
    issues,
    sources,
    'application/browserCalculationQuery.worker.ts',
    'calculateBrowserQueryResponse',
    'getClient',
  )
  const allowedBuilderOwners = [
    'application/accountDecisionSnapshot.worker.ts',
    'application/browserAccountDecisionWorker.ts',
    'application/browserCalculationQuery.worker.ts',
    'decision/accountDecisionService.ts',
  ]
  for (const owner of builderOwners) {
    if (!allowedBuilderOwners.includes(owner))
      issues.push(`Account Decision builder escaped its authority boundary: ${owner}`)
  }

  return {
    contract: 'soda-production-chain-contract/v1',
    reachableSourceCount: sources.size,
    builderOwners,
    issues,
  }
}

export function parseProductionChainMode(args = process.argv.slice(2)) {
  const index = args.indexOf('--mode')
  if (index < 0) return 'all'
  const mode = args[index + 1]
  if (mode !== 'all' && !productionBuildModes.includes(mode))
    throw new Error(`invalid_production_chain_mode:${mode ?? 'missing'}`)
  return mode
}

export function inspectProductionBuildMode(mode, sources) {
  const definition = productionBuildModeDefinitions[mode]
  if (!definition) throw new Error(`invalid_production_chain_mode:${mode}`)
  const modeSources = sources ?? reachableProductionSources(resolve(sourceRoot, definition.entry))
  const issues = []
  for (const path of definition.required) {
    if (!modeSources.has(resolve(sourceRoot, path)))
      issues.push(`${mode}: required production source is not reachable: ${path}`)
  }
  for (const path of definition.forbidden) {
    if (modeSources.has(resolve(sourceRoot, path)))
      issues.push(`${mode}: cross-mode production source is reachable: ${path}`)
  }
  return {
    mode,
    entry: definition.entry,
    reachableSourceCount: modeSources.size,
    issues,
    status: issues.length ? 'fail' : 'pass',
  }
}

export function inspectAllProductionChains() {
  const shared = inspectProductionChain()
  const modes = productionBuildModes.map((mode) => inspectProductionBuildMode(mode))
  const issues = [...shared.issues, ...modes.flatMap((result) => result.issues)]
  return {
    contract: shared.contract,
    reachableSourceCount: shared.reachableSourceCount,
    builderOwners: shared.builderOwners,
    modes,
    issues,
    status: issues.length ? 'fail' : 'pass',
  }
}

export function runProductionChainContract({
  mode = 'all',
  inspect,
  stdout = console.log,
  stderr = console.error,
  setExitCode = (code) => {
    process.exitCode = code
  },
} = {}) {
  if (mode !== 'all' && !productionBuildModes.includes(mode))
    throw new Error(`invalid_production_chain_mode:${mode}`)
  const result = inspect
    ? inspect()
    : mode === 'all'
      ? inspectAllProductionChains()
      : inspectProductionBuildMode(mode)
  if (result.issues.length) {
    stderr(JSON.stringify(result, null, 2))
    setExitCode(1)
    return { ...result, status: 'fail' }
  }
  stdout(JSON.stringify({ ...result, status: 'pass' }, null, 2))
  return { ...result, status: 'pass' }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  runProductionChainContract({ mode: parseProductionChainMode() })
