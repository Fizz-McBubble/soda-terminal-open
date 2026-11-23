import type { GameData31CatalogEntity } from './gameData31CatalogSources'

import {
  gameData33CatalogCheckedAt,
  gameData33OfficialUpdateUrl,
  gameData33OfficialPhaseOneUrl,
  gameData33OfficialPhaseTwoUrl,
  gameData33ProviderManifestSha256,
  gameData33SourceIdentities,
} from '../domain/releasedIdentitySource33.ts'
export {
  gameData33CatalogCheckedAt,
  gameData33ScopeEffectiveAsOf,
  gameData33OfficialUpdateUrl,
  gameData33OfficialPhaseOneUrl,
  gameData33OfficialPhaseTwoUrl,
  gameData33OfficialPhaseTwoMirrorUrl,
  gameData33PhaseTwoRerunIdentities,
  gameData33ProviderManifestSha256,
  gameData33SourceDeltaSha256,
  gameData33SourceIdentities,
} from '../domain/releasedIdentitySource33.ts'

export function gameData33NumericSourceUrl(domain: 'agent' | 'wengine', id: string) {
  return `https://static.nanoka.cc/zzz/3.3/zh/${domain === 'agent' ? 'character' : 'weapon'}/${id}.json`
}

export const gameData33CatalogEntities: GameData31CatalogEntity[] = gameData33SourceIdentities
  .filter((identity) => identity.releaseState === 'released')
  .map((identity) => {
    const url = gameData33NumericSourceUrl(identity.domain, identity.gameId)
    const isPhoenix = identity.stableId === 'agent-phoenix'
    const isSeverian = identity.stableId === 'agent-severian'
    const isPhaseTwo = isSeverian || identity.stableId === 'wengine-14163'
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
        rarity: identity.stableId === 'wengine-13022' ? 'A' : 'S',
        specialty:
          identity.stableId === 'wengine-13022'
            ? 'armorer'
            : isSeverian || identity.stableId === 'wengine-14163'
              ? 'damage'
              : 'anomaly',
        releasePhase: isPhaseTwo ? 'phase_2' : 'phase_1',
        releaseAt: identity.releaseAt,
        officialScopeUrl:
          identity.stableId === 'wengine-13022'
            ? gameData33OfficialUpdateUrl
            : isPhaseTwo
              ? gameData33OfficialPhaseTwoUrl
              : gameData33OfficialPhaseOneUrl,
        evidenceGameVersion: '3.3',
        numericSourceProvider: 'nanoka',
        upstreamRawSha256: identity.rawSha256,
        providerManifestSha256: gameData33ProviderManifestSha256,
        ...(isPhoenix
          ? { attribute: 'fire', faction: '坎卜斯黑枝', factionSourceKey: 'nanoka:camp:12' }
          : isSeverian
            ? { attribute: 'wind', faction: '新艾利都治安局', factionSourceKey: 'nanoka:camp:7' }
            : identity.stableId === 'wengine-14164'
              ? {
                  signatureAgentId: 'agent-phoenix',
                  baseStatKey: 'atk',
                  rawBaseStatValue: 48,
                  secondaryStatKey: 'anomMas_',
                  rawSecondaryStatValue: 0.12,
                  sourceRawSecondaryStatValue: 1200,
                  sourceSecondaryStatDivisor: 10000,
                }
              : identity.stableId === 'wengine-14163'
                ? {
                    signatureAgentId: 'agent-severian',
                    baseStatKey: 'atk',
                    rawBaseStatValue: 48,
                    secondaryStatKey: 'crit_',
                    rawSecondaryStatValue: 0.096,
                    sourceRawSecondaryStatValue: 960,
                    sourceSecondaryStatDivisor: 10000,
                  }
                : {
                    baseStatKey: 'def',
                    rawBaseStatValue: 24,
                    secondaryStatKey: 'def_',
                    rawSecondaryStatValue: 0.16,
                    sourceRawSecondaryStatValue: 1600,
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
