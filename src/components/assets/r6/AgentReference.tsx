import { getAssetAttributeLabel } from '../../../application/publicAssetIdentityLabels'
import {
  getAgentEncyclopedia,
  getAgentCatalogBaseStats,
} from '../../../gameDataPacks/currentEncyclopedia'
import { CatalogStats } from './CatalogReferenceShared'
import { AgentSkillReference } from './AgentSkillReference'
import type { AgentReferenceProgress } from './types'
import './AgentReference.css'

export function AgentReferencePanel({
  stableId,
  attribute,
  view = 'full',
  progress,
}: {
  stableId: string
  attribute?: string | null
  view?: 'full' | 'skills'
  progress?: AgentReferenceProgress
}) {
  const entry = getAgentEncyclopedia(stableId)
  if (!entry) return null
  const attributeLabel = getAssetAttributeLabel(attribute ?? entry.attribute)
  const attributeText = [attributeLabel, entry.specialAttribute]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(' · ')
  return (
    <div className="agent-reference catalog-detail-reader">
      <AgentSkillReference
        stableId={stableId}
        progress={progress}
        overview={
          view === 'full'
            ? () => (
                <>
                  <section className="editor-section" aria-label="代理人身份">
                    <dl className="agent-reference__identity">
                      {attributeText && (
                        <div>
                          <dt>属性</dt>
                          <dd>{attributeText}</dd>
                        </div>
                      )}
                      {entry.fullName && (
                        <div>
                          <dt>全名</dt>
                          <dd>{entry.fullName}</dd>
                        </div>
                      )}
                      {entry.faction && (
                        <div>
                          <dt>阵营</dt>
                          <dd>{entry.faction}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                  <div className="agent-reference__base">
                    <CatalogStats
                      title="基础属性 · 60级"
                      label="代理人基础属性"
                      stats={getAgentCatalogBaseStats(stableId)}
                      note="未装备音擎、驱动盘，未计核心强化"
                    />
                  </div>
                </>
              )
            : undefined
        }
      />
    </div>
  )
}
