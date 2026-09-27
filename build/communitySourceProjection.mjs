import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import ts from 'typescript'

const privateLocator = /(?:(?<![A-Za-z0-9])[A-Za-z]:[\\/]|\/(?:Users|home)\/|(?:^|[\\/])(?:outputs|docs[\\/]audits)[\\/]|^file:\/\/)/iu

function publicSourceReference(value) {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 32)
  return `soda-source-ref:${digest}`
}

function projectValue(value) {
  if (typeof value === 'string')
    return privateLocator.test(value) ? publicSourceReference(value) : value
  if (Array.isArray(value)) return value.map(projectValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, projectValue(entry)]))
  return value
}

/**
 * Remove maintainer filesystem locators without changing gameplay numbers, rules, or source hashes.
 * The opaque reference is deterministic for equality checks; published file hashes are separate.
 */
export function projectCommunitySourceText(source, filename) {
  const cleanName = filename.split('?')[0]
  if (extname(cleanName) === '.json') {
    const projected = projectValue(JSON.parse(source))
    return `${JSON.stringify(projected)}\n`
  }
  if (!/\.(?:ts|tsx|js|jsx|mjs)$/u.test(cleanName)) return source
  const kind = /\.tsx$/u.test(cleanName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const syntax = ts.createSourceFile(cleanName, source, ts.ScriptTarget.Latest, true, kind)
  const replacements = []
  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      privateLocator.test(node.text)
    ) {
      let value = publicSourceReference(node.text)
      if (/^\s*[\[{]/u.test(node.text)) {
        try {
          value = JSON.stringify(projectValue(JSON.parse(node.text)))
        } catch {
          // A normal string containing a brace still receives an opaque reference.
        }
      }
      replacements.push({
        start: node.getStart(syntax),
        end: node.getEnd(),
        text: JSON.stringify(value),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(syntax)
  let result = source
  for (const item of replacements.sort((left, right) => right.start - left.start))
    result = result.slice(0, item.start) + item.text + result.slice(item.end)
  return result
}

export function hasPrivateCommunityLocator(text) {
  return privateLocator.test(text)
}
