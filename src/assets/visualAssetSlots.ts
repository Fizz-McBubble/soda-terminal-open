import type { VisualAssetEntityType } from './visualAssets'

export type VisualAssetConsumer =
  | 'assets.catalog'
  | 'assets.editor'
  | 'agent-development.overview'
  | 'agent-development.workbench'
  | 'agent-development.comparison'
  | 'box.team-overview'
  | 'box.team-workspace'
  | 'warehouse.action-list'

export type VisualAssetSlotSpec = {
  slotId: string
  entityType: VisualAssetEntityType
  role: string
  variant: string
  fallbackVariants: readonly string[]
  aspectRatio: string
  objectFit: 'contain' | 'cover'
  objectPosition: string
  contentScale: number
  variantPresentation?: Readonly<
    Record<
      string,
      {
        objectFit: 'contain' | 'cover'
        objectPosition: string
        contentScale: number
      }
    >
  >
  minimumSize: { width: number; height: number }
  minimumSizeByConsumer?: Partial<Record<VisualAssetConsumer, { width: number; height: number }>>
  allowedConsumers: readonly VisualAssetConsumer[]
}

/**
 * The executable Foundation R1 image-consumption boundary. Asset identity and provenance
 * stay in visual-assets.v1.json; this registry owns how an approved consumer
 * is allowed to present that asset.
 */
export const visualAssetSlots = {
  'agent.factual-card': {
    slotId: 'agent.factual-card',
    entityType: 'agent',
    role: 'established agent fact card',
    variant: 'full_body',
    fallbackVariants: [],
    aspectRatio: '10 / 7',
    objectFit: 'cover',
    objectPosition: 'center',
    contentScale: 1,
    variantPresentation: {
      full_body: {
        objectFit: 'contain',
        objectPosition: '50% 18%',
        contentScale: 2.5,
      },
    },
    minimumSize: { width: 104, height: 84 },
    minimumSizeByConsumer: { 'agent-development.overview': { width: 76, height: 72 } },
    allowedConsumers: ['assets.catalog', 'agent-development.overview'],
  },
  'agent.square-avatar': {
    slotId: 'agent.square-avatar',
    entityType: 'agent',
    role: 'agent identity avatar',
    variant: 'square_avatar',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 36, height: 36 },
    allowedConsumers: [
      'assets.editor',
      'agent-development.overview',
      'agent-development.workbench',
      'box.team-overview',
      'box.team-workspace',
      'warehouse.action-list',
    ],
  },
  'agent.hero': {
    slotId: 'agent.hero',
    entityType: 'agent',
    role: 'development hero full body',
    variant: 'full_body',
    fallbackVariants: [],
    aspectRatio: '3 / 5',
    objectFit: 'contain',
    objectPosition: '50% 0%',
    contentScale: 1,
    minimumSize: { width: 280, height: 460 },
    allowedConsumers: ['agent-development.workbench'],
  },
  'wengine.equipment-icon': {
    slotId: 'wengine.equipment-icon',
    entityType: 'wengine',
    role: 'equipment identity icon',
    variant: 'catalog_icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 44, height: 44 },
    minimumSizeByConsumer: { 'agent-development.workbench': { width: 32, height: 32 } },
    allowedConsumers: ['agent-development.workbench', 'box.team-workspace'],
  },
  'wengine.catalog-card': {
    slotId: 'wengine.catalog-card',
    entityType: 'wengine',
    role: 'W-Engine catalog identity image',
    variant: 'catalog_icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 72, height: 72 },
    allowedConsumers: ['assets.catalog'],
  },
  'wengine.editor-identity': {
    slotId: 'wengine.editor-identity',
    entityType: 'wengine',
    role: 'W-Engine editor identity image',
    variant: 'catalog_icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 72, height: 72 },
    allowedConsumers: ['assets.editor'],
  },
  'drive-disc-set.icon': {
    slotId: 'drive-disc-set.icon',
    entityType: 'drive_disc_set',
    role: 'drive disc set identity icon',
    variant: 'set_icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 22, height: 18 },
    allowedConsumers: [
      'agent-development.workbench',
      'agent-development.comparison',
      'assets.catalog',
      'box.team-workspace',
      'warehouse.action-list',
    ],
  },
  'bangboo.team-icon': {
    slotId: 'bangboo.team-icon',
    entityType: 'bangboo',
    role: 'team companion identity icon',
    variant: 'icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 64, height: 64 },
    allowedConsumers: ['box.team-overview', 'box.team-workspace'],
  },
  'bangboo.catalog-card': {
    slotId: 'bangboo.catalog-card',
    entityType: 'bangboo',
    role: 'Bangboo catalog identity image',
    variant: 'icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 72, height: 72 },
    allowedConsumers: ['assets.catalog'],
  },
  'bangboo.editor-identity': {
    slotId: 'bangboo.editor-identity',
    entityType: 'bangboo',
    role: 'Bangboo editor identity image',
    variant: 'icon',
    fallbackVariants: [],
    aspectRatio: '1 / 1',
    objectFit: 'contain',
    objectPosition: 'center',
    contentScale: 1,
    minimumSize: { width: 72, height: 72 },
    allowedConsumers: ['assets.editor'],
  },
} as const satisfies Record<string, VisualAssetSlotSpec>

export type VisualAssetSlotId = keyof typeof visualAssetSlots

export function resolveVisualAssetSlot(
  slotId: VisualAssetSlotId,
  consumer: VisualAssetConsumer,
): VisualAssetSlotSpec {
  const slot = visualAssetSlots[slotId]
  if (!(slot.allowedConsumers as readonly VisualAssetConsumer[]).includes(consumer)) {
    throw new Error(`visual_asset_slot_consumer_not_allowed:${slotId}:${consumer}`)
  }
  return slot
}
