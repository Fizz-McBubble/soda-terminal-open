import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableContentHash } from '../src/domain/stableContentHash.ts'
import { isReviewedCompletionEvidence } from '../src/decision/teamCompletionEvidence.ts'
import {
  createTeamIndexPayloadReader,
  createTeamIndexPayloadWriter,
  packTeamIndexNodes,
  unpackTeamIndexNodes,
} from '../src/decision/teamIndexPayload.ts'

const root = fileURLToPath(new URL('../src/gameDataPacks/generated/', import.meta.url))
const load = (file) => readFile(resolve(root, file), 'utf8').then(JSON.parse)
const [intrinsic, generic, admission, prepared] = await Promise.all([
  load('current31-team-intrinsic-index.v1.json'),
  load('generic-team-ranking.v1.json'),
  load('default-team-admission.3.3.json'),
  load('box-default-formation-ranks.3.3.json'),
])
const admitted = new Set(admission.rows.map(([team]) => team))
const key = (ids, row) =>
  row
    .slice(0, 3)
    .map((i) => ids[i])
    .sort()
    .join('|')
const withoutHash = ({ contentHash: _, ...value }) => value
if (
  generic.contentHash !== admission.catalog ||
  generic.intrinsicIndexContentHash !== intrinsic.contentHash ||
  prepared.catalog !== generic.contentHash ||
  ![intrinsic, generic].every(
    (value) => stableContentHash(withoutHash(value)) === value.contentHash,
  )
)
  throw new Error('BOX startup inputs are not the same current ranking release.')

function envelope(source, keys, value) {
  return {
    storageContract: 'soda-team-startup-index/v1',
    fullHash: source.contentHash,
    keys,
    indexSize: source.rows.length,
    artifact: { ...value, contentHash: stableContentHash(value) },
  }
}

function projectIntrinsic() {
  const read = createTeamIndexPayloadReader(unpackTeamIndexNodes(intrinsic.details.data))
  const writer = createTeamIndexPayloadWriter()
  const keys = [],
    roots = [],
    rows = [],
    formationFlags = []
  for (const [ordinal, row] of intrinsic.rows.entries()) {
    const formation = key(intrinsic.agentIds, row)
    if (!admitted.has(formation) && !(row[3] === 0 && row[4] >= 0 && row[4] <= 2)) continue
    const detail = read(intrinsic.details.roots[ordinal])
    if (!admitted.has(formation) && !isReviewedCompletionEvidence(detail)) continue
    roots.push(writer.add(detail))
    rows.push(row)
    formationFlags.push(intrinsic.formationFlags[ordinal])
    keys.push(formation)
  }
  if (![...admitted].every((team) => keys.includes(team)))
    throw new Error('BOX startup intrinsic projection lost an admitted team.')
  return envelope(intrinsic, keys, {
    ...withoutHash(intrinsic),
    inputFiles: {},
    rows,
    formationFlags,
    details: { ...intrinsic.details, data: packTeamIndexNodes(writer.nodes), roots },
  })
}

function remap(values, output) {
  const indices = new Map()
  return (ordinal) => {
    if (ordinal < 0) return ordinal
    if (!indices.has(ordinal)) {
      if (values[ordinal] === undefined)
        throw new Error('BOX startup dictionary reference invalid.')
      indices.set(ordinal, output.length)
      output.push(values[ordinal])
    }
    return indices.get(ordinal)
  }
}

function projectGeneric() {
  const sourceRefs = [],
    proofs = [],
    playIdentities = [],
    rows = [],
    keys = []
  const useSource = remap(generic.sourceRefs, sourceRefs)
  const useProof = remap(generic.proofs, proofs)
  const useIdentity = remap(generic.playIdentities, playIdentities)
  const evidence = {}
  const ordinals = new Map()
  for (const [ordinal, original] of generic.rows.entries()) {
    const formation = key(generic.agentIds, original)
    if (!admitted.has(formation)) continue
    if (original[3] !== 0) throw new Error('BOX startup admission includes unranked formation.')
    const row = [...original]
    row[9] = useProof(row[9])
    row[10] = useIdentity(row[10])
    const proof = generic.evidence[formation]
    if (proof) {
      const {
        sourceRefs,
        sourceAuthority,
        primaryOutputAgentId,
        classificationBasis,
        referenceInterval,
      } = proof
      evidence[formation] = {
        sourceRefs,
        sourceAuthority,
        primaryOutputAgentId,
        classificationBasis,
        referenceInterval,
      }
    }
    ordinals.set(ordinal, rows.length)
    rows.push(row)
    keys.push(formation)
  }
  if (rows.length !== admitted.size) throw new Error('BOX startup generic coverage mismatch.')
  for (const [index, [subject, basis, ...refs]] of proofs.entries())
    proofs[index] = [subject, basis, ...refs.map(useSource)]
  const familyKeys = [],
    playIds = []
  const useFamily = remap(generic.mechanismCatalog.familyKeys, familyKeys)
  const usePlay = remap(generic.mechanismCatalog.playIds, playIds)
  const catalogRows = generic.mechanismCatalog.rows.flatMap(([ordinal, variant, family, play]) =>
    ordinals.has(ordinal)
      ? [[ordinals.get(ordinal), variant, useFamily(family), usePlay(play)]]
      : [],
  )
  return envelope(generic, keys, {
    ...withoutHash(generic),
    inputFingerprints: [],
    sourceRefs,
    proofs,
    playIdentities,
    rows,
    evidence,
    mechanismCatalog: { ...generic.mechanismCatalog, rows: catalogRows, familyKeys, playIds },
    evidenceCoverage: {
      gradedReferences: Object.keys(evidence).length,
      compactRows: rows.filter((row) => row[9] >= 0).length,
    },
    coverage: { total: rows.length, recommended: rows.length, exploration: 0, unsupported: 0 },
  })
}

function projectPrepared() {
  const index = new Map(prepared.agentIds.map((id, ordinal) => [id, ordinal]))
  const width = index.size
  const positions = new Set(
    [...admitted].map((team) => {
      const indices = team
        .split('|')
        .map((id) => index.get(id))
        .sort((a, b) => a - b)
      if (indices.length !== 3 || indices.some((value) => value === undefined))
        throw new Error('BOX startup prepared ranking has an unknown member.')
      return indices[0] * width ** 2 + indices[1] * width + indices[2]
    }),
  )
  const templates = []
  const useTemplate = remap(prepared.templates, templates)
  const bangbooShortlists = []
  const useShortlist = remap(prepared.bangbooShortlists ?? [], bangbooShortlists)
  const formations = prepared.formations
    .filter(([position]) => positions.has(position))
    .map(([position, template, order, bangboo]) => [
      position,
      useTemplate(template),
      order,
      ...(bangboo === undefined ? [] : [useShortlist(bangboo)]),
    ])
  if (formations.length !== admitted.size)
    throw new Error('BOX startup prepared ranking coverage mismatch.')
  return {
    ...prepared,
    templates,
    formations,
    ...(prepared.bangbooShortlists ? { bangbooShortlists } : {}),
  }
}

for (const [name, content] of [
  ['box-startup-intrinsic.v1.json', projectIntrinsic()],
  ['box-startup-generic.v1.json', projectGeneric()],
  ['box-startup-prepared.v1.json', projectPrepared()],
]) {
  const file = resolve(root, name)
  const bytes = JSON.stringify(content) + '\n'
  if (process.argv.includes('--check')) {
    if ((await readFile(file, 'utf8')) !== bytes)
      throw new Error('BOX startup projection is stale: ' + name)
  } else {
    await writeFile(file, bytes)
  }
  console.log(
    JSON.stringify({
      name,
      rows: content.keys?.length ?? content.formations.length,
      bytes: Buffer.byteLength(bytes),
    }),
  )
}
