import type {
  CatalogEffect,
  CatalogSkillGroup,
  CatalogStat,
} from '../../../gameDataPacks/currentEncyclopedia'
import { EffectDescription } from '../../EffectDescription'
import './CatalogReferenceDetails.css'

export function CatalogStats({
  title,
  stats,
  label,
  note,
}: {
  title: string
  stats: CatalogStat[]
  label: string
  note?: string
}) {
  if (!stats.length) return null
  return (
    <section className="editor-section wengine-reference" aria-label={label}>
      <h3>{title}</h3>
      {note && <p className="wengine-reference__requirement">{note}</p>}
      <dl className="wengine-reference__stats">
        {stats.map((stat, index) => (
          <div key={`${stat.label}:${index}`}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function CatalogEffects({ effects }: { effects: CatalogEffect[] }) {
  return (
    <dl className="catalog-reference__facts">
      {effects.map((effect, index) => (
        <div key={`${effect.name}:${index}`}>
          <dt>{effect.name}</dt>
          <dd>
            <EffectDescription text={effect.description} />
            {effect.properties.length > 0 && (
              <dl className="catalog-reference__properties">
                {effect.properties.map((property, i) => (
                  <div key={`${property.label}:${i}`}>
                    <dt>{property.label}</dt>
                    <dd>
                      <EffectDescription text={property.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function CatalogGroups({ groups }: { groups: CatalogSkillGroup[] }) {
  return (
    <div className="catalog-reference__disclosures">
      {groups.map((group, index) => (
        <details key={`${group.slot}:${index}`}>
          <summary>{group.title}</summary>
          <CatalogEffects effects={group.effects} />
        </details>
      ))}
    </div>
  )
}

export function CatalogEffectDisclosure({
  title,
  effects,
}: {
  title: string
  effects: CatalogEffect[]
}) {
  if (!effects.length) return null
  return (
    <details>
      <summary>{title}</summary>
      <CatalogEffects effects={effects} />
    </details>
  )
}
