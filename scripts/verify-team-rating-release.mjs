import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraduatedDefaultPlays } from './team-rating-default-plays.mjs'
import { currentGraduatedScoreSourceInputs, verifyCurrentGraduatedScoreArtifact } from './graduated-score-source-identity.mjs'
import { currentGraduatedRatingSourceInputs, verifyCurrentGraduatedRatingArtifact } from './graduated-score-rating-identity.mjs'
import { graduatedTeamRatingBandOrder } from '../src/decision/graduatedTeamRatingBands.ts'
import { parseSourceMaterializationRecipeDocument, sourceMaterializationRecipeFile } from './source-input-recipes.mjs'

export function verifyTeamRatingReleaseBindings({ index, admission, catalog, catalogSha, reviewed, fixedBuilds }) {
  assert.equal(index.gameVersion, catalog.gameVersion, 'BOX score version differs from the catalog')
  assert.equal(index.catalogHash, catalog.contentHash, 'BOX scores refer to a different catalog')
  assert.equal(admission.inputs['generic-team-ranking.v1.json'], catalogSha, 'BOX admission refers to different catalog bytes')
  const catalogTeams = new Map()
  for (const [ordinal, , , play] of catalog.mechanismCatalog.rows) {
    const members = catalog.rows[ordinal].slice(0, 3).map(i => catalog.agentIds[i]).sort().join('|')
    catalogTeams.set(catalog.mechanismCatalog.playIds[play], members)
  }
  const scores = new Map(index.rows.map(row => [row.playId, row]))
  if (index.contract === 'graduated-team-scores/v2') {
    let previousScore = 100
    let previousBand = 0
    for (const row of [...scores.values()].sort((a, b) => a.group - b.group)) {
      const band = graduatedTeamRatingBandOrder[row.band]
      assert.ok(Number.isSafeInteger(row.group) && row.group >= 0 &&
        Number.isSafeInteger(row.score) && row.score >= 0 && row.score <= previousScore &&
        Number.isInteger(band) && band >= previousBand, `BOX score, band or ordering mismatch: ${row.playId}`)
      previousScore = row.score
      previousBand = band
    }
  }
  const teams = new Set(), plays = new Set()
  for (const [members, , ids] of admission.rows) {
    assert.ok(!teams.has(members) && ids.length, `missing or duplicate admitted team ${members}`)
    teams.add(members)
    for (const id of ids) {
      assert.ok(!plays.has(id), `duplicate admitted BOX play ${id}`)
      plays.add(id)
      assert.equal(catalogTeams.get(id), members, `catalog play belongs to a different team: ${id}`)
      assert.equal(scores.get(id)?.members, members, `missing exact-team score: ${id}`)
    }
  }
  assert.ok(teams.size && plays.size === scores.size && scores.size === index.rows.length, 'BOX score coverage differs from admission')
  const defaults = new Map(index.defaultPlays.map(row => [row.members, row.playId]))
  assert.equal(defaults.size, index.defaultPlays.length, 'duplicate BOX default')
  assert.equal(defaults.size, teams.size, 'BOX default coverage differs from admission')
  for (const row of buildGraduatedDefaultPlays(index, admission, reviewed))
    assert.equal(defaults.get(row.members), row.playId, `wrong BOX default for ${row.members}`)

  assert.equal(fixedBuilds.gameVersion, index.gameVersion, 'fixed-build review version differs')
  assert.equal(new Set(fixedBuilds.entries.map(entry => entry.playId)).size, fixedBuilds.entries.length, 'duplicate fixed-build review')
  for (const review of fixedBuilds.entries) {
    const row = scores.get(review.playId)
    assert.equal(row?.members, review.members, `fixed-build review belongs to a different team: ${review.playId}`)
    assert.equal(row.evidence, review.evidence, `review the changed fixed build: ${review.playId}`)
    const members = row.members.split('|')
    assert.ok(review.unconfirmedAgentIds.length && review.unconfirmedAgentIds.every(id => members.includes(id)),
      `unknown fixed-build member: ${review.playId}`)
  }
  return { teams: teams.size, plays: plays.size, fixedBuilds: fixedBuilds.entries.length }
}

const root = fileURLToPath(new URL('../', import.meta.url))
const ratingFiles = ['generated/graduated-team-scores.v1.json', 'generated/default-team-admission.3.3.json',
  'generated/generic-team-ranking.v1.json', 'data/default-team-admission-reviewed-plays.3.3.json',
  'data/team-rating-fixed-build-references.3.3.json'].map(file => 'src/gameDataPacks/' + file)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
export const frozenRatingSourceFile = 'build/verified-team-rating-inputs.json'

async function readRatingBindings(appRoot) {
  const bytes = await Promise.all(ratingFiles.map(file => readFile(resolve(appRoot, file))))
  const [index, admission, catalog, reviewed, fixedBuilds] = bytes.map(file => JSON.parse(file))
  const coverage = verifyTeamRatingReleaseBindings({ index, admission, catalog, reviewed, fixedBuilds, catalogSha: sha(bytes[2]) })
  return { index, coverage, files: Object.fromEntries(ratingFiles.map((file, i) => [file, sha(bytes[i])])) }
}

// Source exports ship precomputed results. Bind their original scoring inputs
// and every distributed projection of those inputs before creating the source manifest.
export async function freezeTeamRatingSource(appRoot, projectedHashes) {
  const { index, files } = await readRatingBindings(appRoot)
  const readOriginal = (file, ...options) => readFile(resolve(appRoot, relative(root, file)), ...options)
  const algorithm = await currentGraduatedScoreSourceInputs(readOriginal)
  const rating = await currentGraduatedRatingSourceInputs(readOriginal)
  assert.equal(sha(JSON.stringify(algorithm)), index.algorithmSourceHash, 'unverified combat inputs at source export')
  assert.equal(sha(JSON.stringify(rating)), index.ratingSourceHash, 'unverified rating inputs at source export')
  for (const [file, digest] of Object.entries(files))
    assert.equal(projectedHashes[file], digest, `source export changed an installed rating artifact: ${file}`)
  const inputs = new Set([...algorithm, ...rating].map(([file]) => file))
  const shipped = Object.fromEntries([...inputs].filter(file => Object.hasOwn(projectedHashes, file))
    .sort().map(file => [file, projectedHashes[file]]))
  return { contract: 'verified-team-rating-inputs/v1', files, algorithm, rating, shipped }
}

export async function verifyInstalledTeamRatingRelease({ sourceKind = 'private' } = {}) {
  const { coverage, index, files } = await readRatingBindings(root)
  if (sourceKind === 'private') {
    await verifyCurrentGraduatedScoreArtifact()
    await verifyCurrentGraduatedRatingArtifact()
    return coverage
  }
  assert.equal(sourceKind, 'public')
  const proof = JSON.parse(await readFile(resolve(root, frozenRatingSourceFile)))
  assert.equal(proof.contract, 'verified-team-rating-inputs/v1')
  assert.deepEqual(proof.files, files, 'public rating artifacts have changed since source verification')
  assert.equal(sha(JSON.stringify(proof.algorithm)), index.algorithmSourceHash)
  assert.equal(sha(JSON.stringify(proof.rating)), index.ratingSourceHash)
  // The public source authority has already verified its manifest and materialized split files.
  const allInputs = new Set([...proof.algorithm, ...proof.rating].map(([file]) => file))
  const manifest = JSON.parse(await readFile(resolve(root, 'SOURCE-MANIFEST.json')))
  const publicFiles = new Map(Object.entries(manifest.files))
  if (publicFiles.has(sourceMaterializationRecipeFile)) {
    const recipes = parseSourceMaterializationRecipeDocument(await readFile(resolve(root, sourceMaterializationRecipeFile)))
    for (const recipe of recipes) publicFiles.set(recipe.target, recipe.targetSha256)
  }
  const published = [...publicFiles.keys()].filter(file => allInputs.has(file)).sort()
  assert.ok(published.length > 0)
  assert.deepEqual(Object.keys(proof.shipped).sort(), published, 'published rating input coverage changed')
  for (const file of published) assert.equal(proof.shipped[file], publicFiles.get(file), `public rating dependency differs: ${file}`)
  for (const [file, expected] of Object.entries(proof.shipped)) {
    assert.ok(allInputs.has(file) && /^(src|scripts|build)\/[\w./-]+$/.test(file) && !file.split('/').includes('..'), 'invalid rating input path')
    assert.equal(sha(await readFile(resolve(root, file))), expected, `modified published rating dependency: ${file}`)
  }
  return coverage
}
