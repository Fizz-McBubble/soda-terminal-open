import legacyDisplay from './data/current-wengine-display.3.1.json'
import reviewedDisplay32 from './data/reviewed-wengine-display.3.2.json'

/** Text-only projection; each catalog retains its own version and source identity. */
export const reviewedWEngineDisplay32 = reviewedDisplay32
export type WEngineDisplayEntry = (typeof legacyDisplay.items)[number]
export const currentWEngineDisplayEntries: readonly WEngineDisplayEntry[] = [
  ...legacyDisplay.items,
  ...reviewedDisplay32.items,
]
const byId = new Map<string, WEngineDisplayEntry>([
  ...legacyDisplay.items.map((item) => [item.stableId, item] as const),
  ...reviewedDisplay32.items.map((item) => [item.stableId, item] as const),
])

export function getReviewedWEngineDisplay(stableId: string): WEngineDisplayEntry | undefined {
  return byId.get(stableId)
}
