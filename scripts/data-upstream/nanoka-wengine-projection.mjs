/**
 * Offline Nanoka W-Engine numeric projection and validation.
 * Extracts static panel bases, secondary growth, and refinement parameter arrays.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const FROZEN_PROVIDER_MANIFEST_PIN =
  '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'

export const KNOWN_33_WENGINES = {
  14164: {
    stableId: 'wengine-14164',
    gameId: '14164',
    playerName: '涅槃初翎',
    nativeKey: 'FirstPlumageOfNirvana',
    rarity: 'S',
    specialty: 'anomaly',
    expectedRawSha256: '006b40349cce50cff242630edec086520ff6f3f196da86e92d935c20794c77ff',
    releaseStatus: 'released_first_half',
    releaseAt: '2026-10-21T11:00:00+08:00',
    baseKey: 'atk',
    secondaryKey: 'anomMas_',
    refinementExtract: (talentDesc) => {
      // "装备者的异常精通提升90点；队伍中任意角色对敌人造成的属性异常伤害产生暴击时，装备者造成的火属性伤害提升40%..."
      const apMatch = talentDesc.match(/异常精通提升(?:<color=[^>]+>)?(\d+)(?:<\/color>)?点/)
      const fireMatch = talentDesc.match(/火属性伤害(?:<\/color>)?提升(?:<color=[^>]+>)?(\d+)%/)
      if (!apMatch || !fireMatch)
        throw new Error(`Failed to parse 14164 talent params: ${talentDesc}`)
      return [Number(apMatch[1]), Number(fireMatch[1]) / 100]
    },
  },
  13022: {
    stableId: 'wengine-13022',
    gameId: '13022',
    playerName: '烛光诡计',
    nativeKey: 'TrickOfCandleglow',
    rarity: 'A',
    specialty: 'armorer',
    expectedRawSha256: 'ef41d4335e37e6319cf53f146d1fdc5c11f46e079b93793c964692c303b1ca76',
    releaseStatus: 'pending_event',
    releaseAt: '2026-10-22T10:00:00+08:00',
    baseKey: 'def',
    secondaryKey: 'def_',
    refinementExtract: (talentDesc) => {
      // "装备者暴击率提升8%，持续40秒；装备者对当前生命值低于最大值50%的敌人造成的伤害提升15%。"
      const critMatch = talentDesc.match(/暴击率提升(?:<color=[^>]+>)?([\d.]+)%/)
      const dmgMatch = talentDesc.match(/伤害提升(?:<color=[^>]+>)?([\d.]+)%/)
      if (!critMatch || !dmgMatch)
        throw new Error(`Failed to parse 13022 talent params: ${talentDesc}`)
      return [Number(critMatch[1]) / 100, Number(dmgMatch[1]) / 100]
    },
  },
  14163: {
    stableId: 'wengine-14163',
    gameId: '14163',
    playerName: '禁罪囚笼',
    nativeKey: 'CageOfConfinedSin',
    rarity: 'S',
    specialty: 'damage',
    expectedRawSha256: 'd87697490b2748eca391d718e9937c7b44c8dc41960dff4b03af4e9041daebc4',
    releaseStatus: 'released_second_half',
    releaseAt: '2026-11-11T12:00:00+08:00',
    baseKey: 'atk',
    secondaryKey: 'crit_',
    refinementExtract: (talentDesc) => {
      // "装备者暴击率提升20%...攻击力提升10%...无视目标15%风属性伤害抗性"
      const critMatch = talentDesc.match(/暴击率提升(?:<color=[^>]+>)?([\d.]+)%/)
      const atkMatch = talentDesc.match(/攻击力提升(?:<color=[^>]+>)?([\d.]+)%/)
      const resMatch = talentDesc.match(/无视目标(?:<color=[^>]+>)?([\d.]+)%/)
      if (!critMatch || !atkMatch || !resMatch)
        throw new Error(`Failed to parse 14163 talent params: ${talentDesc}`)
      return [Number(critMatch[1]) / 100, Number(atkMatch[1]) / 100, Number(resMatch[1]) / 100]
    },
  },
}

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function calculateWEngineBaseStat(baseValue, level, ascension) {
  // S / A-Rank Level 60 Ascension 5 multiplier: 1 + 9.4090 + 0.8922 * 5 = 14.87
  const mult = 1 + (level === 60 ? 9.409 : 0) + 0.8922 * ascension
  return Math.floor(baseValue * mult)
}

export function calculateWEngineSecondaryStat(baseSecondaryValue, ascension) {
  return +(baseSecondaryValue * (1 + 0.3 * ascension)).toFixed(4)
}

export function projectNanokaWEngine(raw, options = {}) {
  const meta = KNOWN_33_WENGINES[raw.id]
  if (!meta) throw new Error(`Unsupported weapon ID: ${raw.id}`)

  const baseVal = raw.base_property.value
  const secRaw = raw.rand_property.value
  const secVal = secRaw > 100 ? +(secRaw / 10000).toFixed(4) : secRaw

  const level60BaseStatValue = calculateWEngineBaseStat(baseVal, 60, 5)
  const level60SecondaryValue = calculateWEngineSecondaryStat(secVal, 5)

  const passiveParameterTable = []
  for (let r = 1; r <= 5; r++) {
    const talentDesc = raw.talents?.[String(r)]?.desc
    if (!talentDesc) throw new Error(`Missing talent refinement ${r} for weapon ${raw.id}`)
    const params = meta.refinementExtract(talentDesc)
    passiveParameterTable.push({ refinement: r, params })
  }

  const staticStats = {
    baseStat: { key: meta.baseKey, value: baseVal },
    level60BaseStat: { key: meta.baseKey, value: level60BaseStatValue },
    secondaryStatKey: meta.secondaryKey,
    secondaryStatBaseValue: secVal,
    level60SecondaryValue,
    ...(meta.baseKey === 'atk'
      ? { atkBase: baseVal, level60BaseAttack: level60BaseStatValue }
      : {}),
  }

  return {
    stableId: meta.stableId,
    gameId: String(raw.id),
    playerName: meta.playerName,
    nativeKey: meta.nativeKey,
    rarity: meta.rarity,
    specialty: meta.specialty,
    releaseStatus: meta.releaseStatus,
    releaseAt: meta.releaseAt,
    staticStats,
    passiveParameterTable,
    source: {
      provider: 'nanoka',
      url: `https://static.nanoka.cc/zzz/3.3/zh/weapon/${raw.id}.json`,
      rawSha256: options.rawSha256 ?? meta.expectedRawSha256,
      providerManifestSha256: options.providerManifestSha256 ?? FROZEN_PROVIDER_MANIFEST_PIN,
      locators: {
        baseProperty: 'base_property',
        randProperty: 'rand_property',
        talents: 'talents.1..5',
      },
    },
    formulaAdoption: {
      status: 'wrap_or_adapt',
      todoMarkers: [],
    },
  }
}

export function readFrozenWEngine(root, weaponId, options = {}) {
  if (!root) throw new Error('Missing root directory for readFrozenWEngine')
  const expectedPin = options.expectedProviderManifestSha256 ?? FROZEN_PROVIDER_MANIFEST_PIN
  const manifestPath = join(root, 'nanoka-manifest.json')
  const manifestBytes = readFileSync(manifestPath)
  const manifestSha = sha(manifestBytes)
  if (expectedPin && manifestSha !== expectedPin) {
    throw new Error(`Provider manifest pin mismatch: expected ${expectedPin}, got ${manifestSha}`)
  }

  const relPath = `nanoka/3.3/zh/weapon/${weaponId}.json`
  const filePath = join(root, relPath)
  const fileBytes = readFileSync(filePath)
  const fileSha = sha(fileBytes)
  const meta = KNOWN_33_WENGINES[weaponId]
  if (meta && fileSha !== meta.expectedRawSha256) {
    throw new Error(`Weapon raw SHA mismatch: expected ${meta.expectedRawSha256}, got ${fileSha}`)
  }

  const raw = JSON.parse(fileBytes.toString('utf8'))
  return projectNanokaWEngine(raw, {
    rawSha256: fileSha,
    providerManifestSha256: manifestSha,
  })
}
