import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFrozenPhoenix } from './nanoka-agent-projection.mjs'
const root = process.argv[2]
const projection = readFrozenPhoenix(root, {
  expectedProviderManifestSha256:
    '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029',
})
if (projection.source.sha256 !== '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe')
  throw Error('Phoenix raw pin mismatch')
const raw = JSON.parse(readFileSync(join(root, 'nanoka/3.3/zh/character/1641.json'), 'utf8'))
const values = Array.from({ length: 7 }, (_, i) => {
  const row = raw.passive.level[1641501 + i]
  const match = row.desc[0].match(/^菲欧妮的异常精通提升<color=#2BAD00>(\d+)<\/color>点；/)
  if (row.level !== i + 1 || !match || Number(match[1]) !== 43 + 7 * i)
    throw Error('Unconditional passive source mismatch')
  return Number(match[1])
})
if (
  !Array.isArray(raw.potential) ||
  raw.potential.length ||
  Object.keys(raw.potential_detail).length
)
  throw Error('Potential absence mismatch')
if (raw.hit_type?.['101'] !== '斩击' || Object.keys(raw.hit_type).length !== 1)
  throw Error('Phoenix attack semantic source mismatch')
const data = {
  schema: 'soda-reviewed-phoenix-numeric/v1',
  gameVersion: '3.3',
  stableId: 'agent-phoenix',
  externalId: '1641',
  attackType: { gameEnum: 101, key: 'slash', locator: 'hit_type.101' },
  identity: { rarity: 'S', attribute: 'fire', specialty: 'anomaly', faction: 'nanoka:camp:12' },
  baseStats: projection.baseStats,
  promotionStats: projection.promotionStats,
  coreStats: projection.coreStats,
  source: {
    provider: 'nanoka',
    url: projection.source.url,
    rawSha256: projection.source.sha256,
    providerManifestSha256: projection.source.providerManifestSha256,
    locators: {
      baseStats: 'stats',
      promotionStats: 'level.1..6',
      coreStats: 'extra_level.1..6.extra (12101=atk;31401=anomMas)',
      corePassive: 'passive.level.1641501..1641507.desc[0]:first-clause',
      potential: 'potential;potential_detail',
    },
  },
  initialPassive: { stat: 'anomProf', condition: 'unconditional', valuesByCoreLevel: values },
  potentialAbsence: { potentialEmpty: true, potentialDetailEmpty: true },
  boundary:
    'Transformed numeric facts only; no copied source prose, media or executable skill events. Nanoka redistribution license is not asserted.',
}
writeFileSync(
  'src/gameDataPacks/data/reviewed-phoenix-numeric.3.3.json',
  JSON.stringify(data, null, 2) + '\n',
)
