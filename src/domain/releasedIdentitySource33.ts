export const gameData33CatalogCheckedAt = '2026-10-21T07:12:21.000Z'
export const gameData33ScopeEffectiveAsOf = '2026-11-11T04:00:00.000Z'
export const gameData33OfficialUpdateUrl = 'https://zenless.hoyoverse.com/zh-cn/news/166963'
export const gameData33OfficialPhaseOneUrl = 'https://zenless.hoyoverse.com/en-us/news/166926'
export const gameData33OfficialPhaseTwoUrl = 'https://zenless.hoyoverse.com/m/zh-cn/news/167269'
export const gameData33OfficialPhaseTwoMirrorUrl = 'https://zzz.mihoyo.com/news/167288'
export const gameData33ProviderManifestSha256 =
  '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
export const gameData33SourceDeltaSha256 =
  '4993f373445b5bf4267ea59b6362d4ec4c8d78b01bbe121611ea83d8960f3d58'

export const gameData33PhaseTwoRerunIdentities = [
  {
    stableId: 'agent-norma',
    gameId: '1571',
    domain: 'agent',
    displayName: '诺姆',
    rerunWindowStart: '2026-11-11T12:00:00+08:00',
    rerunWindowEnd: '2026-12-01T14:59:00+08:00',
  },
  {
    stableId: 'wengine-14157',
    gameId: '14157',
    domain: 'wengine',
    displayName: '首席跟班',
    rerunWindowStart: '2026-11-11T12:00:00+08:00',
    rerunWindowEnd: '2026-12-01T14:59:00+08:00',
  },
] as const

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
    releaseState: 'released',
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
    releaseState: 'released',
    releaseAt: '2026-11-11T12:00:00+08:00',
    rawSha256: 'd87697490b2748eca391d718e9937c7b44c8dc41960dff4b03af4e9041daebc4',
  },
  {
    stableId: 'wengine-13022',
    gameId: '13022',
    domain: 'wengine',
    displayName: '烛光诡计',
    releaseState: 'released',
    releaseAt: '2026-10-22T10:00:00+08:00',
    rawSha256: 'ef41d4335e37e6319cf53f146d1fdc5c11f46e079b93793c964692c303b1ca76',
  },
] as const
