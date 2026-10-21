import type { GameData31CatalogEntity } from './gameData31CatalogSources'

export const gameData33CatalogCheckedAt = '2026-10-21T07:12:21.000Z'
export const gameData33OfficialUpdateUrl = 'https://zenless.hoyoverse.com/zh-cn/news/166963'
export const gameData33OfficialPhaseOneUrl = 'https://zenless.hoyoverse.com/en-us/news/166926'
export const gameData33ProviderManifestSha256 =
  '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
export const gameData33SourceDeltaSha256 =
  '4993f373445b5bf4267ea59b6362d4ec4c8d78b01bbe121611ea83d8960f3d58'

/** Minimal frozen source inventory. Scheduled objects are retained as research,
 * never appended to the installed catalogue by clock rollover. */
export const gameData33SourceIdentities = [
  {
    stableId: 'agent-phoenix',
    gameId: '1641',
    domain: 'agent',
    displayName: '菲欧妮',
    releaseState: 'released',
    releaseAt: '2026-10-21',
    rawSha256: '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe',
  },
  {
    stableId: 'agent-severian',
    gameId: '1631',
    domain: 'agent',
    displayName: '赛维里安',
    releaseState: 'scheduled',
    releaseAt: '2026-11-11T12:00:00+08:00',
    rawSha256: '89f3a03b90fca880851352d6d686e6bbe658411d7b4cdf6b78d2a14a97ff5974',
  },
  {
    stableId: 'wengine-14164',
    gameId: '14164',
    domain: 'wengine',
    displayName: '涅槃初翎',
    releaseState: 'released',
    releaseAt: '2026-10-21',
    rawSha256: '006b40349cce50cff242630edec086520ff6f3f196da86e92d935c20794c77ff',
  },
  {
    stableId: 'wengine-14163',
    gameId: '14163',
    domain: 'wengine',
    displayName: '禁罪囚笼',
    releaseState: 'scheduled',
    releaseAt: '2026-11-11T12:00:00+08:00',
    rawSha256: 'd87697490b2748eca391d718e9937c7b44c8dc41960dff4b03af4e9041daebc4',
  },
  {
    stableId: 'wengine-13022',
    gameId: '13022',
    domain: 'wengine',
    displayName: '烛光诡计',
    releaseState: 'scheduled',
    releaseAt: '2026-10-22T10:00:00+08:00',
    rawSha256: 'ef41d4335e37e6319cf53f146d1fdc5c11f46e079b93793c964692c303b1ca76',
  },
] as const

export function gameData33NumericSourceUrl(domain: 'agent' | 'wengine', id: string) {
  return `https://static.nanoka.cc/zzz/3.3/zh/${domain === 'agent' ? 'character' : 'weapon'}/${id}.json`
}

export const gameData33CatalogEntities: GameData31CatalogEntity[] = gameData33SourceIdentities
  .filter((identity) => identity.releaseState === 'released')
  .map((identity) => {
    const url = gameData33NumericSourceUrl(identity.domain, identity.gameId)
    return {
      id: identity.stableId,
      domain: identity.domain,
      displayName: identity.displayName,
      identity: {
        kind: 'game_evidence',
        projectStableId: identity.stableId,
        gameStableId: identity.gameId,
        sourceLocator: `${url}#sha256=${identity.rawSha256}`,
      },
      status: 'candidate',
      fields: {
        rarity: 'S',
        specialty: 'anomaly',
        releasePhase: 'phase_1',
        releaseAt: identity.releaseAt,
        officialScopeUrl: gameData33OfficialPhaseOneUrl,
        evidenceGameVersion: '3.3',
        numericSourceProvider: 'nanoka',
        upstreamRawSha256: identity.rawSha256,
        providerManifestSha256: gameData33ProviderManifestSha256,
        ...(identity.domain === 'agent'
          ? { attribute: 'fire', faction: '坎卜斯黑枝', factionSourceKey: 'nanoka:camp:12' }
          : {
              signatureAgentId: 'agent-phoenix',
              baseStatKey: 'atk',
              rawBaseStatValue: 48,
              secondaryStatKey: 'anomMas_',
              rawSecondaryStatValue: 0.12,
              sourceRawSecondaryStatValue: 1200,
              sourceSecondaryStatDivisor: 10000,
            }),
      },
      source: {
        id: `nanoka-3.3-${identity.domain}-${identity.gameId}`,
        url,
        sourceVersion: '3.3',
        checkedAt: gameData33CatalogCheckedAt,
        contentHash: identity.rawSha256,
        licenseBoundary:
          'Nanoka/Hakushin派生的最小结构化字段；不是GO或MIT来源，不与GO/Gachabase构成独立交叉。官方仅证明发行身份。未确认媒体再分发许可，不复制正文或媒体，不晋升Formal或精准DPS。',
      },
      gaps: ['目录存在不代表账户拥有；战斗事件、条件被动及素材许可由独立合同准入。'],
    }
  })
