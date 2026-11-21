/** Player-facing identity labels shared by catalog cards and reference details. */
export const assetAttributeIcons: Readonly<Record<string, { label: string; id?: string }>> = {
  electric: { label: '电', id: 'attribute-electric' },
  ether: { label: '以太', id: 'attribute-ether' },
  fire: { label: '火', id: 'attribute-fire' },
  ice: { label: '冰', id: 'attribute-ice' },
  physical: { label: '物理', id: 'attribute-physical' },
  wind: { label: '风', id: 'attribute-wind' },
  lumiflux: { label: '流明', id: 'attribute-lumiflux' },
  frost: { label: '烈霜' },
}
export function getAssetAttributeLabel(key: string | null | undefined) {
  return key ? assetAttributeIcons[key]?.label : undefined
}
