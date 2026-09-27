import { agentCatalog } from '../../../application/publicRosterNames'
import { Field } from './EditorShared'
import { SelectMenu, type SelectMenuOption } from './SelectMenu'
import type { AgentWEngineDraft } from '../../../accounts/wEngineAssignment'
import type { AccountRoster } from '../../../assault/types'
import type { CatalogItem } from './types'

const currentSignatureWEngineByAgentId: Readonly<Record<string, string>> = {
  'agent-remielle': 'wengine-14158',
}
const catalogWEngineOptionPrefix = 'catalog-wengine:'
function signatureWEngineId(agentId: string) {
  const agent = agentCatalog.find(([stableId]) => stableId === agentId)
  if (!agent) return currentSignatureWEngineByAgentId[agentId]
  const externalStem = agent[3].slice(0, 3)
  return `wengine-${agent[4] === 'S' ? '14' : '13'}${externalStem}`
}

export function WEngineAssignmentField({
  agent,
  catalog,
  draft,
  onChange,
}: {
  agent: CatalogItem
  roster: AccountRoster
  catalog: CatalogItem[]
  draft: AgentWEngineDraft
  onChange: (next: AgentWEngineDraft) => void
}) {
  const engineById = new Map(catalog.map((engine) => [engine.stableId, engine]))
  const signatureId = signatureWEngineId(agent.stableId)
  const eligibleEngines = catalog
    .filter((engine) => engine.specialty === agent.specialty)
    .sort((left, right) => {
      const category = (engine: CatalogItem) =>
        engine.stableId === signatureId
          ? 0
          : engine.rarity === 'S'
            ? 1
            : engine.rarity === 'A'
              ? 2
              : 3
      return category(left) - category(right) || catalog.indexOf(left) - catalog.indexOf(right)
    })
  const groupFor = (engine: CatalogItem) =>
    engine.stableId === signatureId ? '专属音擎' : `${engine.rarity ?? '?'}级`
  const defaultRefinement = (engine: CatalogItem) => (engine.rarity === 'S' ? 1 : 5)
  const options: SelectMenuOption[] = [
    { value: '', label: '暂不选择' },
    ...eligibleEngines.map((engine) => ({
      value: `${catalogWEngineOptionPrefix}${engine.stableId}`,
      label: `${engine.playerName} · ${engine.rarity}级 · Lv 60 · 默认精${defaultRefinement(engine)}`,
      group: groupFor(engine),
      visual: {
        entityId: engine.stableId,
        name: engine.playerName,
      },
    })),
  ]
  const selected = draft.wEngineCatalogId
    ? `${catalogWEngineOptionPrefix}${draft.wEngineCatalogId}`
    : ''
  return (
    <div className="relation-row relation-row--engine wengine-assignment-field f5v-wengine-assignment">
      <label className="field wengine-assignment-field__selector">
        <span>当前音擎</span>
        <SelectMenu
          label="当前音擎"
          value={selected}
          selectedLabel={
            draft.wEngineCatalogId && engineById.has(draft.wEngineCatalogId)
              ? `${engineById.get(draft.wEngineCatalogId)!.playerName} · Lv ${draft.wEngineLevel ?? 60} · 精炼 ${draft.wEngineRefinement ?? 1}`
              : undefined
          }
          options={options}
          onChange={(selection) => {
            const catalogId = selection.startsWith(catalogWEngineOptionPrefix)
              ? selection.slice(catalogWEngineOptionPrefix.length)
              : null
            const engine = catalogId ? engineById.get(catalogId) : null
            onChange({
              wEngineCopyId: null,
              wEngineCatalogId: catalogId,
              wEngineLevel: catalogId ? 60 : null,
              wEngineRefinement: engine ? defaultRefinement(engine) : null,
              wEngineRefinementManuallySet: false,
            })
          }}
        />
        <small>记录该代理人当前使用的音擎、等级与精炼。</small>
      </label>
      {draft.wEngineCatalogId && (
        <div className="wengine-assignment-field__levels">
          <label className="field">
            <span>音擎等级</span>
            <input
              aria-label="音擎等级"
              type="number"
              min="1"
              max="60"
              value={draft.wEngineLevel ?? 60}
              onChange={(event) => onChange({ ...draft, wEngineLevel: Number(event.target.value) })}
            />
          </label>
          <Field
            label="精炼等级"
            value={draft.wEngineRefinement ?? 1}
            min={1}
            max={5}
            onChange={(wEngineRefinement) =>
              onChange({ ...draft, wEngineRefinement, wEngineRefinementManuallySet: true })
            }
          />
        </div>
      )}
    </div>
  )
}
