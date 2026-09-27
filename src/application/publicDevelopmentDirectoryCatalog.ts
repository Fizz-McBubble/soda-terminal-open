import { agentCatalog } from './publicRosterNames'
import { currentReleasedIdentityMap } from '../gameDataPacks/currentReleasedIdentityMap'

// Display order frozen from the current 3.1 released directory, then checked
// against its private authority in the paired contract test.
const displayOrder = [
  'agent-sigrid',
  'agent-remielle',
  'agent-norma',
  'agent-pyrois',
  'agent-velina',
  'agent-starlight-billy',
  'agent-promeia',
  'agent-cissia',
  'agent-nangong',
  'agent-aria',
  'agent-sunna',
  'agent-zhao',
  'agent-ye-shunguang',
  'agent-banyue',
  'agent-dialyn',
  'agent-yidhari',
  'agent-lucia',
  'agent-orphie-magus',
  'agent-seed',
  'agent-alice',
  'agent-yuzuha',
  'agent-ju-fufu',
  'agent-yixuan',
  'agent-hugo',
  'agent-vivian',
  'agent-trigger',
  'agent-soldier-0-anby',
  'agent-evelyn',
  'agent-astra',
  'agent-miyabi',
  'agent-harumasa',
  'agent-lighter',
  'agent-yanagi',
  'agent-burnice',
  'agent-caesar',
  'agent-jane',
  'agent-qingyi',
  'agent-zhu-yuan',
  'agent-nekomata',
  'agent-soldier-11',
  'agent-koleda',
  'agent-lycaon',
  'agent-grace',
  'agent-ellen',
  'agent-rina',
  'agent-manato',
  'agent-pan-yinhu',
  'agent-pulchra',
  'agent-seth',
  'agent-anby',
  'agent-nicole',
  'agent-corin',
  'agent-billy',
  'agent-anton',
  'agent-ben',
  'agent-soukaku',
  'agent-lucy',
  'agent-piper',
] as const
const orderById = new Map<string, number>(displayOrder.map((id, index) => [id, index]))

/** Released identities and labels only. Build and progression advice stays in the private query. */
export const publicDevelopmentDirectoryCatalog = [
  ...agentCatalog
    .filter(([, , , , , , , releaseState]) => releaseState === 'released')
    .map(([stableId, playerName, specialty, , rarity, attribute]) => ({
      stableId,
      playerName,
      specialty,
      rarity,
      attribute,
      releaseState: 'released' as const,
      accountOwnable: true,
    })),
  ...currentReleasedIdentityMap.entries
    .filter((entry) => entry.stableId === 'agent-remielle' || entry.stableId === 'agent-sigrid')
    .map((entry) => ({
      stableId: entry.stableId,
      playerName: entry.playerName,
      specialty: entry.stableId === 'agent-remielle' ? 'anomaly' : 'damage',
      rarity: 'S',
      attribute: entry.stableId === 'agent-remielle' ? 'lumiflux' : 'ice',
      releaseState: 'released' as const,
      accountOwnable: true,
    })),
].sort(
  (left, right) =>
    (orderById.get(left.stableId) ?? Number.MAX_SAFE_INTEGER) -
    (orderById.get(right.stableId) ?? Number.MAX_SAFE_INTEGER),
)
