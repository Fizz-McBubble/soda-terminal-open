import { currentDriveDiscRecommendationCatalog } from '../../../gameDataPacks/currentDriveDiscRecommendationCatalog'
import bangbooDisplay from '../../../gameDataPacks/data/current-bangboo-display.3.1.json'
import { EffectDescription } from '../../EffectDescription'
import { WEngineReferencePanel } from './WEngineReference'
import type { CatalogItem } from './types'

type CatalogReference = {
  title: string
  facts: Array<{ label: string; name?: string; value: string }>
}

function bangbooReference(
  item: CatalogItem,
  skillLevel: number,
  additionalAbilityLevel: number,
): CatalogReference | null {
  const entry = bangbooDisplay.items.find((entry) => entry.stableId === item.stableId)
  if (!entry) return null
  return {
    title: '技能效果',
    facts: entry.skills.map((skill) => {
      const level = skill.slot === 'b' ? additionalAbilityLevel : skillLevel
      const effect = skill.levels.find((entry) => entry.level === level) ?? skill.levels[0]
      const role = skill.slot === 'a' ? '主动技' : skill.slot === 'b' ? '额外能力' : '邦布连携技'
      return {
        label: `${role} · Lv.${effect.level}`,
        name: effect.name,
        value: effect.description.replace(/^\[[^\]]+\]\s*/, ''),
      }
    }),
  }
}

function driveDiscReference(item: CatalogItem): CatalogReference | null {
  const set = currentDriveDiscRecommendationCatalog.find((entry) => entry.id === item.stableId)
  return set
    ? {
        title: '套装效果',
        facts: [
          { label: '2件套', value: set.twoPieceEffect },
          { label: '4件套', value: set.fourPieceEffect },
        ],
      }
    : null
}

export function CatalogReferencePanel({
  item,
  skillLevel = 1,
  additionalAbilityLevel = 1,
}: {
  item: CatalogItem
  skillLevel?: number
  additionalAbilityLevel?: number
}) {
  if (item.entityType === 'wengine')
    return <WEngineReferencePanel key={item.stableId} stableId={item.stableId} />
  const reference =
    item.entityType === 'bangboo'
      ? bangbooReference(item, skillLevel, additionalAbilityLevel)
      : item.entityType === 'drive_disc_set'
        ? driveDiscReference(item)
        : null
  if (!reference) return null
  return (
    <section className="editor-section catalog-reference" aria-label={reference.title}>
      <h3>{reference.title}</h3>
      <dl className="catalog-reference__facts">
        {reference.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              {fact.name && (
                <>
                  <strong className="catalog-reference__name">{fact.name}</strong>
                  {'\n'}
                </>
              )}
              <EffectDescription text={fact.value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
