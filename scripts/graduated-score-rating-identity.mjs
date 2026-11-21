import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { runtimeImportSpecifiers } from './graduated-score-source-identity.mjs'

const appRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const roots = ['scripts/materialize-graduated-team-scores.mjs', 'scripts/graduated-score-lineage.mjs',
  'scripts/graduated-score-rating-identity.mjs', 'scripts/build-team-rating-production.mjs', 'src/decision/referenceTeamRatingMethod.ts',
  'src/decision/referenceTeamScore.ts', 'src/decision/referenceRatingVerification.ts']
const sha = value => createHash('sha256').update(value).digest('hex')

export async function currentGraduatedRatingSourceInputs(readFileFn = readFile) {
  const pending = roots.map(p => path.resolve(appRoot, p)), files = new Map()
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, resolveJsonModule: true }
  while (pending.length) {
    const file = pending.pop()
    if (files.has(file)) continue
    const bytes = await readFileFn(file)
    files.set(file, sha(bytes))
    if (file.endsWith('.json')) continue
    for (const specifier of runtimeImportSpecifiers(bytes.toString('utf8'), file)) {
      if (!specifier.startsWith('.') || /\.(?:css|scss|svg|png|webp|jpg)$/i.test(specifier)) continue
      const result = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule
      if (!result) throw new Error(`unresolved graduated rating input: ${file} -> ${specifier}`)
      const target = path.resolve(result.resolvedFileName)
      if (!target.startsWith(appRoot + path.sep) || target.includes(`${path.sep}node_modules${path.sep}`)) continue
      // State-source hashing and the generated result are separately bound; neither is rating logic.
      if (target === path.join(appRoot, 'scripts/graduated-score-source-identity.mjs') ||
        target === path.join(appRoot, 'src/gameDataPacks/generated/graduated-team-scores.v1.json')) continue
      if (!target.endsWith('.d.ts')) pending.push(target)
    }
  }
  return [...files].map(([file, digest]) => [path.relative(appRoot, file).replaceAll('\\', '/'), digest])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
}
export async function currentGraduatedRatingSourceIdentity(readFileFn = readFile) {
  return sha(JSON.stringify(await currentGraduatedRatingSourceInputs(readFileFn)))
}
export async function verifyGraduatedRatingSourceIdentity(artifact, current) {
  if (!Array.isArray(artifact?.rows)) throw new Error('invalid graduated score rows')
  if (artifact.rows.length && artifact.ratingSourceHash !== (current ?? await currentGraduatedRatingSourceIdentity()))
    throw new Error('graduated rating source identity changed; rescore and review results')
}
export async function verifyCurrentGraduatedRatingArtifact() {
  await verifyGraduatedRatingSourceIdentity(JSON.parse(await readFile(new URL('../src/gameDataPacks/generated/graduated-team-scores.v1.json', import.meta.url), 'utf8')))
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await verifyCurrentGraduatedRatingArtifact()
