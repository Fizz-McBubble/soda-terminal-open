/** Replay the Phoenix paid skill material row only from the pinned offline source. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { readFrozenPhoenix } from './nanoka-agent-projection.mjs'

const rawSha256 = '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe'
const providerManifestSha256 = '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
const skills = ['basic', 'dodge', 'special', 'chain', 'assist']
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

function checkedTable(table, paidRows, hasCapRow) {
  if (!table || typeof table !== 'object' || Array.isArray(table))
    throw new Error('Missing skill material table')
  const expected = Array.from({ length: paidRows + Number(hasCapRow) }, (_, index) =>
    String(index + 1),
  )
  if (JSON.stringify(Object.keys(table)) !== JSON.stringify(expected))
    throw new Error('Unexpected skill material levels')
  for (const level of expected) {
    const row = table[level]
    if (!row || typeof row !== 'object' || Array.isArray(row))
      throw new Error(`Invalid material row ${level}`)
    const entries = Object.entries(row)
    if (
      Number(level) > paidRows
        ? entries.length !== 0
        : !entries.length ||
          entries.some(
            ([id, quantity]) =>
              !/^\d+$/.test(id) || !Number.isSafeInteger(quantity) || quantity <= 0,
          )
    )
      throw new Error(`Invalid material row ${level}`)
  }
  return table
}

export function projectPhoenixSkillMaterials33(bytes, expectedRawSha256 = rawSha256) {
  if (hash(bytes) !== rawSha256 || expectedRawSha256.toLowerCase() !== rawSha256)
    throw new Error('Phoenix skill materials raw SHA256 mismatch')
  const raw = JSON.parse(bytes)
  if (
    raw.id !== 1641 ||
    raw.name !== '菲欧妮' ||
    raw.weapon_type?.[3] !== '异常' ||
    raw.element_type?.[201] !== '火属性'
  )
    throw new Error('Phoenix skill materials source identity mismatch')
  if (JSON.stringify(Object.keys(raw.skill ?? {})) !== JSON.stringify(skills))
    throw new Error('Phoenix skill keys or order drifted')
  const combatTables = {},
    combatTableBySkill = {}
  for (const [index, skill] of skills.entries()) {
    const key = `table${index}`
    combatTables[key] = checkedTable(raw.skill[skill].material, 11, true)
    combatTableBySkill[skill] = key
  }
  return {
    agentId: 'agent-phoenix',
    gameId: '1641',
    sourceName: raw.name,
    attribute: 'fire',
    status: 'supported',
    coreCosts: checkedTable(raw.passive?.materials, 6, false),
    combatTables,
    combatTableBySkill,
    source: {
      url: 'https://static.nanoka.cc/zzz/3.3/zh/character/1641.json',
      sourceVersion: '3.3',
      sha256: rawSha256.toUpperCase(),
    },
  }
}

export function readFrozenPhoenixSkillMaterials33(root) {
  const numeric = readFrozenPhoenix(root, {
    expectedProviderManifestSha256: providerManifestSha256,
  })
  return projectPhoenixSkillMaterials33(
    readFileSync(join(root, 'nanoka/3.3/zh/character/1641.json')),
    numeric.source.sha256,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = (name) => process.argv[process.argv.indexOf(name) + 1]
  if (!process.argv.includes('--frozen-root') || !process.argv.includes('--output'))
    throw new Error('Usage: --frozen-root <pinned-input-root> --output <new-json-path>')
  const result = readFrozenPhoenixSkillMaterials33(argument('--frozen-root'))
  const output = resolve(argument('--output'))
  const formatted = await format(JSON.stringify(result, null, 2), {
    ...(await resolveConfig(output)),
    parser: 'json',
  })
  writeFileSync(output, formatted, { flag: 'wx' })
  console.log(
    JSON.stringify({
      agentId: result.agentId,
      coreRows: 6,
      combatSkills: 5,
      combatRowsPerSkill: 11,
      sourceSha256: result.source.sha256,
    }),
  )
}
