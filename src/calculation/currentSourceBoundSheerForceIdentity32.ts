import { stableContentHash } from '../gameDataPacks/types'

export const sheerForceCommonSource32 = Object.freeze({
  repository: 'https://github.com/frzyc/genshin-optimizer',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  path: 'libs/zzz/formula/src/data/common/index.ts',
  sha256: '8C97E50A3B88846F7083290C53604F6545E818CAE3E7E3F8464C18011B2F594F',
  locator: '71-87',
})

// Reviewed source identities, not agent-specific coefficient implementations.
// Each HP contribution is evaluated from its existing mapped-stat expression IR.
export const reviewedSources = new Map([
  [
    'Yixuan',
    [
      '43F11850985726682A1076704F9B0E9ACF3172F18AE4B76DE2AF4B16E3F28E80',
      '10C3CFBA8EE455E7D824B276FA56C9EEBBC11088D0DEDD5435A93C375D10F848',
    ],
  ],
  [
    'Manato',
    [
      '173273745E9E88E9261C54634A71652BC760573A64F99AE0BCEFEFAF0814A3F0',
      'FD3423961CBBBA922F86AED23CDC692E93A3DA18828B92F883BA617D24A9BA93',
    ],
  ],
  [
    'Banyue',
    [
      'F559CE817A8CC1B3A7448AF42C9DBCFF17DABBBA96C6B410CFC9FA72858E92F8',
      'BF45DD9F8F963BE7ACA7183FCA57266B611911D80C3F0EA730C5D25EEC209076',
    ],
  ],
  [
    'Yidhari',
    [
      'B5DD737E76A5D0363C89206EF32CF138AE1371451E82625F218909A563EBE301',
      '0783B00A705D40AD28720A03013D3665FE5180413EE3FE9F183BB1CEE8C4013B',
    ],
  ],
  [
    'StarlightBilly',
    [
      '3CDF6903E1C5ADE4B8694208644E8EAAB1BA9BF1A675EF4DAB40E88EA0CBBD26',
      '2D960C6E9C5D61E56BA6E3155425FF61AE1EFFFC00A80E081DF4005CE1D90BC8',
    ],
  ],
])
export const reviewedStatHashes = new Map([
  ['Yixuan', '3E6EAF7B9138372325C0BD482B2D02C1F2A9D960411B5B3FAE28478945E762CA'],
  ['Manato', '4A13F4606CE3405305928C229E87730462BB1684392ED195395C9F8B20811F1C'],
  ['Banyue', '450E167D7BB239E46C3278989ADB30EC04F2CEFCD910A97A47FBA0843B8D57AD'],
  ['Yidhari', '872BB292CD986F5D608CEAFBE2F4B84FBA6502BA0BC1DB07E016C57FED533BC4'],
  ['StarlightBilly', 'D80021D2F6E78034EEF8CD7556B1F280AE5411FB8C89C86239303BF73A5BF1A5'],
])
export const sourceBoundSheerForceIdentity32 = Object.freeze({
  version: 'source-bound-sheer-initial-final-v1',
  common: sheerForceCommonSource32,
  reviewedSources: [...reviewedSources],
  reviewedStatHashes: [...reviewedStatHashes],
})
export const sourceBoundSheerForceHash32 = stableContentHash(sourceBoundSheerForceIdentity32)

// Exact aliases emitted by communitySourceProjection for the reviewed mapped-stat locators.
// Repository, commit and byte hashes still bind the source before these aliases are accepted.
export const reviewedPublicMappedStatLocators32 = Object.freeze({
  Yixuan: 'soda-source-ref:c53a29fadb975355901878732b433d75',
  Manato: 'soda-source-ref:7b871e97e4c815dc78e1564f2a62e8ff',
  Banyue: 'soda-source-ref:f96cee14c3d7c473c241d09643ee033f',
  Yidhari: 'soda-source-ref:406ff73b1fd14b8368dd81b3aa8764eb',
  StarlightBilly: 'soda-source-ref:f045cbf04da6e7c5217200493151af66',
})
