import { vi } from 'vitest'
import { createEmptyRoster } from '../../../assault/catalog'
import type { AssetGoldenProps, DiscItem } from './types'

const set = {
  stableId: 'set-a',
  entityType: 'drive_disc_set' as const,
  playerName: '测试套装',
  rarity: 'S',
  specialty: null,
}
export const assetGoldenDisc = (id: string, revision: string, level = 15): DiscItem => ({
  stableId: id,
  set,
  slot: 4,
  level,
  mainStat: '暴击率',
  subStats: [],
  locked: false,
  favorite: false,
  tags: [],
  protections: [],
  revision,
})

export function assetGoldenProps(
  discs: DiscItem[],
  onSave = vi.fn(),
  accountId = 'account-test',
): AssetGoldenProps {
  const roster = createEmptyRoster('2026-08-14T00:00:00.000Z')
  return {
    accountId,
    accountName: '测试账户',
    accountUpdatedAt: '2026-08-14T00:00:00.000Z',
    accountOptions: [{ id: accountId, displayName: '测试账户' }],
    catalog: {
      agents: roster.agents.slice(0, 1).map((item) => ({
        stableId: item.agentId,
        entityType: 'agent' as const,
        playerName: '测试代理人',
        rarity: 'S',
        specialty: '强攻',
      })),
      wengines: roster.wEngines!.slice(0, 1).map((item) => ({
        stableId: item.engineId,
        entityType: 'wengine' as const,
        playerName: '测试音擎',
        rarity: 'S',
        specialty: '强攻',
      })),
      bangboos: roster.bangboos.slice(0, 1).map((item) => ({
        stableId: item.bangbooId,
        entityType: 'bangboo' as const,
        playerName: '测试邦布',
        rarity: 'S',
        specialty: null,
      })),
    },
    discs,
    roster,
    initialTab: 'discs',
    onNavigate: vi.fn(),
    onPrimaryNavigate: vi.fn(),
    onSave,
    onDeleteDiscs: vi.fn().mockResolvedValue(true),
    onCreateBackup: vi.fn(),
    onInspectBackup: vi.fn(),
    onRestore: vi.fn(),
    onSelectAccount: vi.fn(),
    onDeleteAccount: vi.fn(async () => true),
  }
}
