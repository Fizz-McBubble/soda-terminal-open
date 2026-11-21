import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { readFrozenSeverian } from './nanoka-agent-projection.mjs'
const root = process.argv[2]
const projection = readFrozenSeverian(root, {
  expectedProviderManifestSha256:
    '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029',
})
if (projection.source.sha256 !== '89f3a03b90fca880851352d6d686e6bbe658411d7b4cdf6b78d2a14a97ff5974')
  throw Error('Severian raw pin mismatch')
const raw = JSON.parse(readFileSync(join(root, 'nanoka/3.3/zh/character/1631.json'), 'utf8'))
const coreCritDamageBonusByLevel = []
const coreDamageBonusByLevel = []
const coreWindTeammateExtraDamageBonusByLevel = []
for (let i = 0; i < 7; i++) {
  const row = raw.passive.level[1631501 + i]
  const match = row.desc[0].match(
    /^赛维里安的暴击伤害提升<color=#2BAD00>([\d.]+)%<\/color>，造成的伤害提升<color=#2BAD00>([\d.]+)%<\/color>，若队伍中存在其他风属性角色则伤害额外提升<color=#2BAD00>([\d.]+)%<\/color>；/,
  )
  if (row.level !== i + 1 || !match) throw Error('Severian core passive source mismatch')
  coreCritDamageBonusByLevel.push(Number(match[1]) / 100)
  coreDamageBonusByLevel.push(Number(match[2]) / 100)
  coreWindTeammateExtraDamageBonusByLevel.push(Number(match[3]) / 100)
}
const addMatch = raw.passive.level[1631501].desc[1].match(
  /赛维里安每拥有1%暴击率，会使自身的攻击力提升([\d.]+)点，最多计入(\d+)%暴击率。/,
)
if (!addMatch || Number(addMatch[1]) !== 8.5 || Number(addMatch[2]) !== 100)
  throw Error('Severian additional ability source mismatch')
if (
  !Array.isArray(raw.potential) ||
  raw.potential.length ||
  Object.keys(raw.potential_detail).length
)
  throw Error('Potential absence mismatch')
if (raw.hit_type?.['101'] !== '斩击' || Object.keys(raw.hit_type).length !== 1)
  throw Error('Severian attack semantic source mismatch')
const data = {
  schema: 'soda-reviewed-severian-numeric/v1',
  gameVersion: '3.3',
  stableId: 'agent-severian',
  externalId: '1631',
  attackType: { gameEnum: 101, key: 'slash', locator: 'hit_type.101' },
  identity: { rarity: 'S', attribute: 'wind', specialty: 'attack', faction: 'nanoka:camp:7' },
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
      coreStats: 'extra_level.1..6.extra (12101=atk;21101=crit_dmg_)',
      corePassive: 'passive.level.1631501..1631507.desc[0]:first-clause',
      additionalAbility: 'passive.level.1631501..1631507.desc[1]',
      potential: 'potential;potential_detail',
    },
  },
  combatPassives: {
    coreCritDamageBonusByLevel,
    coreDamageBonusByLevel,
    coreWindTeammateExtraDamageBonusByLevel,
    additionalAbilityCritRateToAtk: {
      atkPerCritRatePercent: Number(addMatch[1]),
      maxCritRatePercent: Number(addMatch[2]),
      maxAtkBonus: Number(addMatch[1]) * Number(addMatch[2]),
    },
  },
  potentialAbsence: { potentialEmpty: true, potentialDetailEmpty: true },
  boundary:
    'Transformed numeric facts only; no copied source prose, media or executable skill events. Nanoka redistribution license is not asserted.',
}
const output = fileURLToPath(
  new URL('../../src/gameDataPacks/data/reviewed-severian-numeric.3.3.json', import.meta.url),
)
writeFileSync(
  output,
  await format(JSON.stringify(data, null, 2), {
    ...(await resolveConfig(output)),
    parser: 'json',
  }),
)
