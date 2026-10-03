import type { GameData31CatalogEntity } from './gameData31CatalogSources'

export const gameData32UpstreamCommit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'
export const gameData32CatalogCheckedAt = '2026-09-30T12:29:09.2100756Z'
export const gameData32OfficialProgramUrl =
  'https://zenless.hoyoverse.com/en-us/news/165917?catchspider=1&page=feature'
export const gameData32OfficialPhaseTwoUrl =
  'https://zenless.hoyoverse.com/en-us/news/166475?catchSpider=1'

const boundary =
  '仅保存锁定 MIT 上游的最小结构化目录字段及公开来源定位；游戏原文与素材许可另行核对，不复制攻略正文或媒体，不作为 Formal 或精确伤害证明。Hakushin 衍生视图与该上游不算独立交叉。'
const upstreamUrl = (path: string) =>
  `https://github.com/frzyc/genshin-optimizer/blob/${gameData32UpstreamCommit}/${path}`

function entity(
  id: string,
  numericId: string,
  domain: 'agent' | 'wengine',
  displayName: string,
  key: string,
  sha256: string,
  fields: GameData31CatalogEntity['fields'],
): GameData31CatalogEntity {
  const path = `libs/zzz/stats/Data/${domain === 'agent' ? 'Characters' : 'Wengine'}/${key}.json`
  return {
    id,
    domain,
    displayName,
    identity: {
      kind: 'game_evidence',
      projectStableId: id,
      gameStableId: numericId,
      sourceLocator: `GO:${gameData32UpstreamCommit}:${path}; external-id:${numericId}`,
    },
    status: 'candidate',
    fields: {
      ...fields,
      upstreamCommit: gameData32UpstreamCommit,
      upstreamPath: path,
      upstreamRawSha256: sha256,
      evidenceGameVersion: '3.2',
    },
    source: {
      id: `upstream-3.2-${domain}-${numericId}`,
      url: upstreamUrl(path),
      sourceVersion: '3.2',
      checkedAt: gameData32CatalogCheckedAt,
      contentHash: sha256,
      licenseBoundary: boundary,
    },
    gaps: ['目录存在不代表账户拥有；完整战斗上下文与固定时间轴另行校验。'],
  }
}

/** Minimal derived metadata; no copied guide prose, media, guessed release date or level-60 panel. */
export const gameData32CatalogEntities: GameData31CatalogEntity[] = [
  entity(
    'agent-claret',
    '1611',
    'agent',
    '克拉蕾',
    'Claret',
    '49BDB5A6D64AC3CA2727F376765BF97F884C7DDF03F9B954017532757C85388C',
    {
      rarity: 'S',
      specialty: 'armorer',
      attribute: 'electric',
      releasePhase: 'phase_1',
      officialScopeUrl: gameData32OfficialProgramUrl,
      releaseViewUrl: 'https://zzz.gachabase.net/agents/1611/claret/release/3.2.0/18761130?lang=en',
      independentReviewUrl: 'https://www.prydwen.gg/zenless/characters/claret',
    },
  ),
  entity(
    'agent-roxy',
    '1621',
    'agent',
    '洛克茜',
    'Roxy',
    '764769EFD09AAD9D9651B8BD77D3B936AE6760515546333753104890F56587EF',
    {
      rarity: 'S',
      specialty: 'stun',
      attribute: 'wind',
      releasePhase: 'phase_2',
      officialScopeUrl: gameData32OfficialPhaseTwoUrl,
      officialChannelStart: '2026-09-30 12:00 server time',
      officialChannelEnd: '2026-10-20 14:59 server time',
      releaseViewUrl: 'https://zzz.gachabase.net/agents/1621/roxy/release/3.2.0/18761130?lang=en',
    },
  ),
  entity(
    'wengine-14161',
    '14161',
    'wengine',
    '猩红渴望',
    'CrimsonThirst',
    'BD793DAC8D8E9231ECA7B526B9A1DCF1EEA4992F186B18C42E01B7D6A0E7E741',
    {
      rarity: 'S',
      specialty: 'armorer',
      baseStatKey: 'def',
      rawBaseStatValue: 29,
      secondaryStatKey: 'def_',
      rawSecondaryStatValue: 0.192,
      signatureAgentId: 'agent-claret',
      independentReviewUrl: 'https://www.prydwen.gg/zenless/characters/claret',
    },
  ),
  entity(
    'wengine-14162',
    '14162',
    'wengine',
    '绯月银棺',
    'CrimsonMoonCasket',
    '3402C4B09D9D093695813FB8D02330FD05F5D7A69FFB0B2C4EA6C8DB45B1D9EE',
    {
      rarity: 'S',
      specialty: 'stun',
      baseStatKey: 'atk',
      rawBaseStatValue: 48,
      secondaryStatKey: 'enerRegen_',
      rawSecondaryStatValue: 0.24,
      signatureAgentId: 'agent-roxy',
      officialScopeUrl: gameData32OfficialPhaseTwoUrl,
    },
  ),
  entity(
    'wengine-13021',
    '13021',
    'wengine',
    '血髓秘匣',
    'BloodmarrowCoffer',
    '4D099F5B010EB10E03CEC006CBCC1E338F3FC7534DBC409CA2505DFAA2574375',
    {
      rarity: 'A',
      specialty: 'armorer',
      baseStatKey: 'def',
      rawBaseStatValue: 24,
      secondaryStatKey: 'crit_',
      rawSecondaryStatValue: 0.08,
      independentReviewUrl: 'https://www.prydwen.gg/zenless/characters/claret',
    },
  ),
  entity(
    'wengine-13017',
    '13017',
    'wengine',
    '喵运当头',
    'CattyLuck',
    '87A23B15BD008F8A00F1F480DDF2C3CAEDAB5E331370A73E06516CFF10ABDAFB',
    {
      rarity: 'A',
      specialty: 'armorer',
      baseStatKey: 'def',
      rawBaseStatValue: 24,
      secondaryStatKey: 'def_',
      rawSecondaryStatValue: 0.16,
      independentReviewUrl: 'https://www.prydwen.gg/zenless/characters/claret',
    },
  ),
  entity(
    'wengine-12016',
    '12016',
    'wengine',
    '「月相」-弦',
    'LunarSemiluna',
    '872CF94BB95D5F4DE6A1DD36214E51AAE21BC4DB4B3645DC578F86952236D3B9',
    {
      rarity: 'B',
      specialty: 'armorer',
      baseStatKey: 'def',
      rawBaseStatValue: 19,
      secondaryStatKey: 'def_',
      rawSecondaryStatValue: 0.128,
    },
  ),
]
