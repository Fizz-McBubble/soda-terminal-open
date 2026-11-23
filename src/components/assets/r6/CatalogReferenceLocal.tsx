import type { ReactNode } from 'react'
import { currentDriveDiscRecommendationCatalog } from '../../../gameDataPacks/currentDriveDiscRecommendationCatalog'
import { EffectDescription } from '../../EffectDescription'
import { WEngineReferencePanel } from './WEngineReference'
import { AgentReferencePanel } from './AgentReference'
import { BangbooReferencePanel } from './BangbooReference'
import type { CatalogItem, CatalogReferenceProps } from './types'

type CatalogReference = {
  title: string
  facts: Array<{ label: string; name?: string; value: string }>
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
  additionalAbilityLevel = 1,
  agentView,
  agentProgress,
}: CatalogReferenceProps) {
  if (item.entityType === 'agent')
    return (
      <AgentReferencePanel
        key={item.stableId}
        stableId={item.stableId}
        attribute={item.attribute}
        view={agentView}
        progress={agentProgress}
      />
    )
  if (item.entityType === 'wengine')
    return <WEngineReferencePanel key={item.stableId} stableId={item.stableId} />
  if (item.entityType === 'bangboo')
    return (
      <BangbooReferencePanel
        key={`${item.stableId}:${additionalAbilityLevel}`}
        stableId={item.stableId}
        initialStar={additionalAbilityLevel}
      />
    )
  const reference = item.entityType === 'drive_disc_set' ? driveDiscReference(item) : null
  if (!reference) return null
  return <ReferenceFacts reference={reference} />
}

function ReferenceFacts({
  reference,
  controls,
}: {
  reference: CatalogReference
  controls?: ReactNode
}) {
  return (
    <section className="editor-section catalog-reference" aria-label={reference.title}>
      {controls ? (
        <div className="bangboo-reference__heading">
          <h3>{reference.title}</h3>
          {controls}
        </div>
      ) : (
        <h3>{reference.title}</h3>
      )}
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
