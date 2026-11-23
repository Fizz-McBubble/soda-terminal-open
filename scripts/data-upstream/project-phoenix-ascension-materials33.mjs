/** Offline extraction of the five actual Phoenix transitions; no class lookup. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFrozenPhoenix } from './nanoka-agent-projection.mjs'

const rawSha256 = '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe'
const providerManifestSha256 = '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function projectPhoenixAscensionMaterials33(bytes, expectedRawSha256 = rawSha256) {
  if (sha256(bytes) !== rawSha256 || expectedRawSha256.toLowerCase() !== rawSha256)
    throw new Error('Phoenix materials raw SHA256 mismatch')
  const raw = JSON.parse(bytes)
  if (raw.id !== 1641 || raw.weapon_type?.[3] !== '异常' || raw.element_type?.[201] !== '火属性')
    throw new Error('Phoenix materials source identity mismatch')
  const steps = Array.from({ length: 5 }, (_, index) => {
    const ascension = index + 1
    const row = raw.level?.[ascension]
    if (
      row?.level_max !== ascension * 10 ||
      row.level_min !== index * 10 ||
      !row.materials ||
      !Object.keys(row.materials).length ||
      Object.entries(row.materials).some(
        ([id, quantity]) => !/^\d+$/.test(id) || !Number.isSafeInteger(quantity) || quantity <= 0,
      )
    )
      throw new Error(`Invalid Phoenix source material transition: level.${ascension}`)
    return {
      ascension,
      levelCapBefore: row.level_max,
      levelCapAfter: raw.level[ascension + 1]?.level_max,
      materials: row.materials,
      sourceLocator: `level[${ascension}].materials`,
    }
  })
  if (
    steps.some((step, index) => step.levelCapAfter !== (index + 2) * 10) ||
    Object.keys(raw.level?.[6]?.materials ?? {}).length !== 0
  )
    throw new Error('Phoenix source does not contain exactly five ascension transitions')
  if (
    !Array.isArray(raw.level_exp) ||
    raw.level_exp.length !== 60 ||
    raw.level_exp[59] !== 0 ||
    raw.level_exp.slice(0, 59).some((value) => !Number.isSafeInteger(value) || value <= 0)
  )
    throw new Error('Phoenix level experience schedule unresolved')
  return {
    contract: 'soda-phoenix-ascension-materials/v1',
    agentId: 'agent-phoenix',
    gameId: '1641',
    sourceVersion: '3.3',
    attribute: 'fire',
    specialty: 'anomaly',
    source: {
      provider: 'nanoka',
      url: 'https://static.nanoka.cc/zzz/3.3/zh/character/1641.json',
      sourceVersion: '3.3',
      sha256: rawSha256,
      providerManifestSha256,
    },
    steps,
    levelExperience: {
      sourceLocator: 'level_exp[0..59]',
      minimumLevel: 1,
      maximumLevel: 60,
      experienceToNextLevel: raw.level_exp,
      totalExperience1To60: raw.level_exp.reduce((sum, quantity) => sum + quantity, 0),
      itemConversion: 'not_provided_by_this_source',
    },
    boundary:
      'Exact source item IDs and quantities for level-cap transitions; level EXP demand is separate. No XP-item conversion, skill/core costs, account holdings or completed progression is inferred.',
  }
}

export function readFrozenPhoenixAscensionMaterials33(root) {
  const numeric = readFrozenPhoenix(root, {
    expectedProviderManifestSha256: providerManifestSha256,
  })
  const bytes = readFileSync(join(root, 'nanoka/3.3/zh/character/1641.json'))
  return projectPhoenixAscensionMaterials33(bytes, numeric.source.sha256)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = (name) => process.argv[process.argv.indexOf(name) + 1]
  if (!process.argv.includes('--frozen-root') || !process.argv.includes('--output'))
    throw new Error('Usage: --frozen-root <pinned-input-root> --output <new-json-path>')
  const result = readFrozenPhoenixAscensionMaterials33(argument('--frozen-root'))
  writeFileSync(resolve(argument('--output')), `${JSON.stringify(result, null, 2)}\n`, {
    flag: 'wx',
  })
  console.log(
    JSON.stringify({
      agentId: result.agentId,
      transitions: result.steps.length,
      totalExperience1To60: result.levelExperience.totalExperience1To60,
    }),
  )
}
