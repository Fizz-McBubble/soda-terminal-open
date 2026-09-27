import { defaultWEngineRefinement, type resolveWEngine } from '../decision/wEngineResolver'
import { currentWEngineStaticCatalog } from '../gameDataPacks/currentWEngineStaticCatalog'

function selectorWEngineRarity(rarity: string | null): 'S' | 'A' | 'B' {
  return rarity === 'S' || rarity === 'A' || rarity === 'B' ? rarity : 'B'
}

export function createWEngineSelectionOptions(input: {
  specialty: string | null
  resolution: ReturnType<typeof resolveWEngine>
}) {
  const { specialty, resolution } = input
  const compatibleWEngines = currentWEngineStaticCatalog.items.filter(
    (item) => item.specialty === specialty,
  )
  const recommendedEngineIds = new Map<string, string>([
    ...(resolution.recommendedPrimary
      ? [[resolution.recommendedPrimary.engineId, '推荐首选'] as const]
      : []),
    ...resolution.recommendedAlternatives.map((engine) => [engine.engineId, '推荐替代'] as const),
  ])
  const currentOnlyEngine =
    resolution.current &&
    !compatibleWEngines.some((engine) => engine.stableId === resolution.current!.engineId)
      ? resolution.current
      : null
  const candidates: Array<{ stableId: string; playerName: string; rarity: 'S' | 'A' | 'B' }> = [
    ...compatibleWEngines.map(({ stableId, playerName, rarity }) => ({
      stableId,
      playerName,
      rarity: selectorWEngineRarity(rarity),
    })),
    ...(currentOnlyEngine
      ? [
          {
            stableId: currentOnlyEngine.engineId,
            playerName: currentOnlyEngine.name,
            rarity: selectorWEngineRarity(currentOnlyEngine.rarity),
          },
        ]
      : []),
  ]
  return candidates
    .sort((left, right) => {
      const groupRank = (engine: (typeof candidates)[number]) =>
        recommendedEngineIds.has(engine.stableId)
          ? recommendedEngineIds.get(engine.stableId) === '推荐首选'
            ? 0
            : 1
          : engine.stableId === currentOnlyEngine?.engineId
            ? 2
            : 3
      return (
        groupRank(left) - groupRank(right) ||
        (left.rarity === 'S' ? 0 : left.rarity === 'A' ? 1 : 2) -
          (right.rarity === 'S' ? 0 : right.rarity === 'A' ? 1 : 2) ||
        left.playerName.localeCompare(right.playerName, 'zh-CN')
      )
    })
    .map((engine) => ({
      engineId: engine.stableId,
      label: `${engine.playerName} · ${engine.rarity}级 · Lv.60 · 默认精${defaultWEngineRefinement(engine.rarity)}`,
      defaultRefinement: defaultWEngineRefinement(engine.rarity),
      group:
        recommendedEngineIds.get(engine.stableId) ??
        (engine.stableId === currentOnlyEngine?.engineId ? '当前实际' : `${engine.rarity}级`),
      visual: { entityId: engine.stableId, name: engine.playerName },
    }))
}
