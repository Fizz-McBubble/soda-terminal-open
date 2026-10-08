import type { AccountRoster } from '../../../assault/types'
import type { DiscOrderKey } from '../../../domain/discOrdering'

export type AssetTab = 'account' | 'agents' | 'wengines' | 'bangboos' | 'discs'
export type CatalogKind = Exclude<AssetTab, 'account'>

export type CatalogItem = {
  stableId: string
  entityType: 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set'
  playerName: string
  rarity: string | null
  specialty: string | null
  attribute?: string | null
  supportsPotentialImage?: boolean
}

export type DiscItem = {
  stableId: string
  set: CatalogItem
  slot: number
  level: number
  mainStat: string
  mainStatKey?: string
  importBatchId?: DiscOrderKey['importBatchId']
  importSource?: DiscOrderKey['importSource']
  mainValue?: string
  subStats: Array<{ stat: string; value: string; upgrades: number }>
  locked: boolean
  favorite: boolean
  tags: string[]
  protections: Array<'locked' | 'favorite' | 'equipped' | 'planned'>
  revision: string
}

export type AgentDraft = Pick<
  AccountRoster['agents'][number],
  | 'owned'
  | 'level'
  | 'mindscape'
  | 'potentialImage'
  | 'skillLevels'
  | 'wEngineCopyId'
  | 'progressionManuallySet'
> & {
  wEngineCatalogId?: string | null
  wEngineLevel?: number | null
  wEngineRefinement?: number | null
  wEngineRefinementManuallySet?: boolean
}
export type BangbooDraft = Pick<
  AccountRoster['bangboos'][number],
  'owned' | 'level' | 'stars' | 'starsManuallySet' | 'skillLevel' | 'additionalAbilityLevel'
>
export type DiscDraft = Pick<DiscItem, 'locked' | 'favorite' | 'tags'>

export type TypedAssetSave =
  | { kind: 'agents'; stableId: string; baseRevision: string; draft: AgentDraft }
  | { kind: 'bangboos'; stableId: string; baseRevision: string; draft: BangbooDraft }
  | { kind: 'discs'; stableId: string; baseRevision: string; draft: DiscDraft }

export type BackupPreview = {
  fileName: string
  accountName: string
  exportedAt: string
  scope: string
  payload: unknown
}

export type LocalAccountOption = {
  id: string
  displayName: string
}

export type AssetGoldenProps = {
  accountId: string
  accountName: string
  accountUpdatedAt: string
  accountOptions: LocalAccountOption[]
  catalog: Record<'agents' | 'wengines' | 'bangboos', CatalogItem[]>
  discs: DiscItem[]
  roster: AccountRoster
  initialTab?: AssetTab
  initialSelection?: Partial<Record<CatalogKind, string>>
  message?: string
  onNavigate: (destination: AssetTab) => void
  onPrimaryNavigate: (destination: string) => void
  onSelectAgent?: (agentId: string) => void
  onSave: (payload: TypedAssetSave) => Promise<string | null | void>
  onDeleteDiscs: (stableIds: string[], baseRevisions: Record<string, string>) => Promise<boolean>
  onCreateBackup: () => Promise<void>
  onInspectBackup: (file: File) => Promise<BackupPreview>
  onRestore: (preview: BackupPreview) => Promise<void>
  onSelectAccount: (accountId: string) => Promise<void>
  onDeleteAccount: (accountId: string) => Promise<boolean>
  onRestoreAcceptanceAccount?: () => Promise<void>
}
