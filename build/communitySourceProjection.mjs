import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import ts from 'typescript'

const privateLocator =
  /(?:(?<![A-Za-z0-9?])[A-Za-z]:[\\/]|\/(?:Users|home)\/|(?:^|[\s\\/])(?:outputs|docs[\\/]audits)[\\/]|^file:\/\/)/iu

function publicSourceReference(value) {
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 32)
  return `soda-source-ref:${digest}`
}

function projectValue(value) {
  if (typeof value === 'string')
    return privateLocator.test(value) ? publicSourceReference(value) : value
  if (Array.isArray(value)) return value.map(projectValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, projectValue(entry)]),
    )
  return value
}

/**
 * Remove maintainer filesystem locators without changing gameplay numbers, rules, or source hashes.
 * The opaque reference is deterministic for equality checks; published file hashes are separate.
 */
export function projectCommunitySourceText(source, filename) {
  const cleanName = filename.split('?')[0]
  if (extname(cleanName) === '.json') {
    const parsed = JSON.parse(source)
    const projected = projectValue(parsed)
    // A safe JSON source is also an installed raw policy input. Preserve its
    // bytes so public projection cannot invalidate an otherwise identical model.
    if (JSON.stringify(projected) === JSON.stringify(parsed)) return source
    return `${JSON.stringify(projected)}\n`
  }
  if (!/\.(?:ts|tsx|js|jsx|mjs)$/u.test(cleanName)) return source
  const kind = /\.tsx$/u.test(cleanName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const syntax = ts.createSourceFile(cleanName, source, ts.ScriptTarget.Latest, true, kind)
  const replacements = []
  const comments = new Map()
  const retainComment = (start, end, commentKind) => {
    const comment = source.slice(start, end)
    if (!privateLocator.test(comment)) return
    // Preserve line breaks: a newline inside a comment can affect automatic
    // semicolon insertion even though the comment itself is not executable.
    const breaks = (comment.match(/\r\n|\r|\n/gu) ?? []).join('')
    comments.set(start, {
      start,
      end,
      text:
        commentKind === ts.SyntaxKind.SingleLineCommentTrivia
          ? '// Internal source locator omitted.'
          : `/* Internal source locator omitted.${breaks} */`,
    })
  }
  const visit = (node) => {
    ts.forEachLeadingCommentRange(source, node.pos, retainComment)
    ts.forEachTrailingCommentRange(source, node.end, retainComment)
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
    // Include tokens such as `return`: comments between a keyword/operator and
    // its expression are trailing token trivia, not leading AST-node trivia.
    for (const child of node.getChildren(syntax)) visit(child)
  }
  visit(syntax)
  replacements.push(...comments.values())
  let result = source
  for (const item of replacements.sort((left, right) => right.start - left.start))
    result = result.slice(0, item.start) + item.text + result.slice(item.end)
  return result
}

export function hasPrivateCommunityLocator(text) {
  return privateLocator.test(text)
}
