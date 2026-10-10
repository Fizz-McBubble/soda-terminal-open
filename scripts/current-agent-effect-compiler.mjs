import ts from 'typescript'
import { createHash } from 'node:crypto'

const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase()

function callName(node) {
  if (!ts.isCallExpression(node)) return null
  if (ts.isIdentifier(node.expression)) return node.expression.text
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text
  return null
}

export function compileExpressionIr(node, sourceFile) {
  if (!node) return { kind: 'unsupported', syntaxKind: 'MissingExpression' }
  if (ts.isNumericLiteral(node)) return { kind: 'literal', value: Number(node.text) }
  if (ts.isStringLiteral(node)) return { kind: 'literal', value: node.text }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true }
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false }
  if (node.kind === ts.SyntaxKind.NullKeyword) return { kind: 'literal', value: null }
  if (ts.isIdentifier(node)) {
    if (node.text === 'undefined') return { kind: 'literal', value: null }
    return { kind: 'reference', path: node.text }
  }
  if (ts.isPropertyAccessExpression(node)) {
    const receiver = compileExpressionIr(node.expression, sourceFile)
    if (receiver.kind === 'reference')
      return { kind: 'reference', path: `${receiver.path}.${node.name.text}` }
    return { kind: 'property', receiver, property: node.name.text }
  }
  if (ts.isElementAccessExpression(node))
    return {
      kind: 'element',
      receiver: compileExpressionIr(node.expression, sourceFile),
      index: compileExpressionIr(node.argumentExpression, sourceFile),
    }
  if (ts.isCallExpression(node)) {
    const method = ts.isPropertyAccessExpression(node.expression)
    return {
      kind: 'call',
      operator: callName(node) ?? node.expression.getText(sourceFile),
      ...(method ? { receiver: compileExpressionIr(node.expression.expression, sourceFile) } : {}),
      arguments: node.arguments.map((argument) => compileExpressionIr(argument, sourceFile)),
    }
  }
  if (ts.isObjectLiteralExpression(node))
    return {
      kind: 'object',
      entries: node.properties.map((property) =>
        ts.isPropertyAssignment(property)
          ? {
              key: property.name.getText(sourceFile).replace(/^['"]|['"]$/g, ''),
              value: compileExpressionIr(property.initializer, sourceFile),
            }
          : {
              key: property.getText(sourceFile),
              value: { kind: 'unsupported', syntaxKind: 'ObjectProperty' },
            },
      ),
    }
  if (ts.isArrayLiteralExpression(node))
    return {
      kind: 'array',
      items: node.elements.map((element) => compileExpressionIr(element, sourceFile)),
    }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken)
    return {
      kind: 'call',
      operator: 'negate',
      arguments: [compileExpressionIr(node.operand, sourceFile)],
    }
  if (ts.isBinaryExpression(node))
    return {
      kind: 'call',
      operator: `binary:${node.operatorToken.getText(sourceFile)}`,
      arguments: [
        compileExpressionIr(node.left, sourceFile),
        compileExpressionIr(node.right, sourceFile),
      ],
    }
  return { kind: 'unsupported', syntaxKind: ts.SyntaxKind[node.kind] }
}

export function expressionIrHasUnsupported(node) {
  if (!node || typeof node !== 'object') return false
  if (node.kind === 'unsupported') return true
  return Object.values(node).some((value) =>
    Array.isArray(value)
      ? value.some(expressionIrHasUnsupported)
      : expressionIrHasUnsupported(value),
  )
}

export function compileFunctionalInputs(formulaSource, formulaFile) {
  const sourceFile = ts.createSourceFile(formulaFile, formulaSource, ts.ScriptTarget.Latest, true)
  const inputs = []
  const visit = (node) => {
    const operator = callName(node)
    if (
      ts.isCallExpression(node) &&
      ['customShield', 'customHeal'].includes(operator) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[1]
    ) {
      const valueNode = node.arguments[1]
      const expression = valueNode.getText(sourceFile)
      const expressionIr = compileExpressionIr(valueNode, sourceFile)
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line
      const preceding = formulaSource.split(/\r?\n/).slice(Math.max(0, line - 3), line)
      inputs.push({
        inputId: node.arguments[0].text,
        kind: operator === 'customShield' ? 'shield' : 'heal',
        locator: `${formulaFile}:${line + 1}`,
        numericExpression: {
          classification: 'upstream_expression_available',
          expressionSha256: sha256(expression),
          expressionIr,
          expressionIrReady: !expressionIrHasUnsupported(expressionIr),
          todoFlagged: preceding.some((sourceLine) => /\bTODO\b/i.test(sourceLine)),
        },
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return inputs
}

export function compileEffectRecipients(formulaSource, formulaFile) {
  const sourceFile = ts.createSourceFile(
    formulaFile,
    formulaSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const effects = []
  const aliases = new Map()
  const visitAliases = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      aliases.set(node.name.text, node.initializer)
    ts.forEachChild(node, visitAliases)
  }
  visitAliases(sourceFile)
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ['registerBuff', 'registerBuffFormula'].includes(callName(node)) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const registration = callName(node)
      // Pinned util/sheet.ts: registerBuffFormula always includes the entry.
      // Its fourth argument controls UI listing only; only registerBuff has
      // a fifth includeOriginalEntry argument that can make an effect event-only.
      if (registration === 'registerBuffFormula' && node.arguments.length > 4)
        throw new Error(`Unsupported registerBuffFormula signature in ${formulaFile}`)
      const argument = node.arguments[1]
      const valueNode =
        argument && ts.isIdentifier(argument) ? (aliases.get(argument.text) ?? argument) : argument
      const expression = valueNode?.getText(sourceFile) ?? ''
      const valueExpression = expression
      const expressionIr = compileExpressionIr(valueNode, sourceFile)
      const expressionOperators = new Set()
      if (valueNode) {
        const collectOperators = (expressionNode) => {
          const name = callName(expressionNode)
          if (name) expressionOperators.add(name)
          ts.forEachChild(expressionNode, collectOperators)
        }
        collectOperators(valueNode)
      }
      const genericConditionalIdentifiers = [
        'boolConditional',
        'listConditional',
        'numConditional',
      ].filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(valueExpression))
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line
      const precedingLines = formulaSource.split(/\r?\n/).slice(Math.max(0, line - 3), line)
      const todoFlagged = precedingLines.some((sourceLine) => /\bTODO\b/i.test(sourceLine))
      const recipients = [
        ...(expression.includes('ownBuff.') ? ['self'] : []),
        ...(expression.includes('notOwnBuff.') ? ['other_agent'] : []),
        ...(expression.includes('teamBuff.') ? ['team'] : []),
        ...(expression.includes('enemyDebuff.') ? ['enemy'] : []),
      ]
      if (recipients.length)
        effects.push({
          effectId: node.arguments[0].text,
          applicationScope:
            registration === 'registerBuff' &&
            node.arguments[4]?.kind === ts.SyntaxKind.FalseKeyword
              ? 'event_only'
              : 'generic',
          recipients: [...new Set(recipients)],
          locator: `${formulaFile}:${line + 1}`,
          numericExpression: {
            classification:
              genericConditionalIdentifiers.length > 0
                ? 'declarative_baseline_input'
                : valueExpression
                  ? 'upstream_expression_available'
                  : 'missing_expression',
            operators: [...expressionOperators].sort(),
            dependencyKinds: [
              ...(valueExpression.includes('dm.') ? ['mapped_stat'] : []),
              ...(valueExpression.includes('char.') ? ['character_state'] : []),
              ...(valueExpression.includes('team.') ? ['team_state'] : []),
              ...(/(?:\.ifOn\(|cmp[A-Z]|Conditional)/.test(valueExpression)
                ? ['conditional_state']
                : []),
              ...(/\d/.test(valueExpression) ? ['literal'] : []),
            ],
            genericConditionalIdentifiers,
            todoFlagged,
            todoBoundary: todoFlagged
              ? 'upstream TODO is preserved as a fail-closed capability boundary; it does not invalidate the expression IR outside the affected condition'
              : null,
            expressionSha256: sha256(valueExpression),
            expressionIr,
            expressionIrReady: !expressionIrHasUnsupported(expressionIr),
          },
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return effects
}

/** The same derived fields are used by the full generator and a bounded replay. */
export function deriveFormulaEffectCoverage(formulaEffects) {
  const effects = formulaEffects.flatMap((item) => item.effects)
  const count = (predicate) =>
    effects.filter((effect) => predicate(effect.numericExpression)).length
  return {
    formulaEffectContracts: formulaEffects.length,
    formulaEffects: effects.length,
    upstreamNumericExpressionAvailable: count(
      (expression) => expression.classification === 'upstream_expression_available',
    ),
    genericPlaceholderOrTodoExpressions: count(
      (expression) => expression.classification === 'generic_placeholder_or_todo',
    ),
    declarativeBaselineInputExpressions: count(
      (expression) => expression.classification === 'declarative_baseline_input',
    ),
    todoBoundaryExpressions: count((expression) => expression.todoFlagged),
    missingNumericExpressions: count(
      (expression) => expression.classification === 'missing_expression',
    ),
    sharedExpressionIrReady: count(
      (expression) =>
        expression.classification !== 'missing_expression' && expression.expressionIrReady,
    ),
    sharedExpressionIrPending: count(
      (expression) =>
        expression.classification !== 'missing_expression' && !expression.expressionIrReady,
    ),
    numericExpressionOperatorPatternCount: new Set(
      effects.map((effect) => effect.numericExpression.operators.join('+')),
    ).size,
    effectRecipientPatternCount: new Set(
      formulaEffects.map((item) =>
        [...new Set(item.effects.flatMap((effect) => effect.recipients))].sort().join('+'),
      ),
    ).size,
  }
}

export function effectCatalogContentHash(catalog) {
  const clone = structuredClone(catalog)
  delete clone.contentHash
  return sha256(`${JSON.stringify(clone)}\n`)
}

export const luciaEffectReplayPin = Object.freeze({
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  version: '3.2-phase-ii',
  path: 'libs/zzz/formula/src/data/char/sheets/Lucia.ts',
  lfSha256: 'DB62E8F87CB8CC05777C6E381BA705933763EFE1AA01A217322D049B71C1E725',
  adoptedSha256: 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
})

/** Only the previously omitted pinned Lucia effect may be added. Any drift aborts. */
export function replayPinnedLuciaEffects(catalog, source) {
  const pin = luciaEffectReplayPin
  if (
    catalog.generatedFrom?.formulaRepository !== 'https://github.com/frzyc/genshin-optimizer' ||
    catalog.generatedFrom?.formulaCommit !== pin.commit ||
    catalog.generatedFrom?.sourceInputManifest?.commit !== pin.commit ||
    catalog.gameVersion !== pin.version ||
    catalog.contentHash !== effectCatalogContentHash(catalog)
  )
    throw new Error('Lucia replay catalog source/version/content hash mismatch')
  const lf = source.replaceAll('\r\n', '\n')
  const crlf = lf.replaceAll('\n', '\r\n')
  if (sha256(lf) !== pin.lfSha256 || sha256(crlf) !== pin.adoptedSha256)
    throw new Error('Lucia replay source bytes mismatch')
  const rows = catalog.formulaEffects.filter((row) => row.upstreamKey === 'Lucia')
  if (rows.length !== 1) throw new Error('Lucia replay requires exactly one existing row')
  const old = rows[0]
  if (
    old.externalId !== '1451' ||
    old.source.commit !== pin.commit ||
    old.source.repository !== catalog.generatedFrom.formulaRepository ||
    old.source.formulaPath !== pin.path ||
    old.source.formulaSha256 !== pin.adoptedSha256 ||
    catalog.generatedFrom.sourceInputManifest.files[pin.path] !== pin.adoptedSha256
  )
    throw new Error('Lucia replay row source binding mismatch')
  const effects = compileEffectRecipients(crlf, 'Lucia.ts')
  const functionalInputs = compileFunctionalInputs(crlf, 'Lucia.ts')
  const omittedId = 'exSpecial_sheerForce'
  const existing = effects.filter((effect) => effect.effectId !== omittedId)
  if (
    JSON.stringify(existing) !==
    JSON.stringify(old.effects.filter((effect) => effect.effectId !== omittedId))
  )
    throw new Error('Lucia replay changes an existing effect; integration decision required')
  if (JSON.stringify(functionalInputs) !== JSON.stringify(old.functionalInputs))
    throw new Error('Lucia replay changes existing functional inputs')
  const additions = effects.filter((effect) => effect.effectId === omittedId)
  if (
    additions.length !== 1 ||
    additions[0].applicationScope !== 'generic' ||
    additions[0].numericExpression.todoFlagged ||
    !additions[0].numericExpression.expressionIrReady
  )
    throw new Error('Lucia replay must compile exactly one ready generic omitted effect')
  const prior = old.effects.filter((effect) => effect.effectId === omittedId)
  if (prior.length && JSON.stringify(prior) !== JSON.stringify(additions))
    throw new Error('Lucia replay omitted effect differs from previous replay')
  const result = structuredClone(catalog)
  result.formulaEffects.find((row) => row.upstreamKey === 'Lucia').effects = effects
  Object.assign(result.coverage, deriveFormulaEffectCoverage(result.formulaEffects))
  result.contentHash = effectCatalogContentHash(result)
  return result
}
