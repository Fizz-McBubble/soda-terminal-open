import { agentCatalog, getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { legalAscensionsForLevel } from '../../../gameDataPacks/panel/wEngineGrowth'
import { SelectMenu, type SelectMenuOption } from './SelectMenu'
import type { AgentWEngineDraft } from '../../../accounts/wEngineAssignment'
import type { AccountRoster } from '../../../assault/types'
import type { CatalogItem } from './types'

const currentSignatureWEngineByAgentId: Readonly<Record<string, string>> = {
  'agent-remielle': 'wengine-14158',
}
const catalogWEngineOptionPrefix = 'catalog-wengine:'
function ascensionsForLevel(level: number | null | undefined): number[] {
  return level == null ? [] : legalAscensionsForLevel(level, true)
}
function signatureWEngineId(agentId: string) {
  const agent = agentCatalog.find(([stableId]) => stableId === agentId)
  if (!agent) return currentSignatureWEngineByAgentId[agentId]
  const externalStem = agent[3].slice(0, 3)
  return `wengine-${agent[4] === 'S' ? '14' : '13'}${externalStem}`
}
function normalizedSpecialty(value: string | null | undefined) {
  return value === 'attack' ? 'damage' : value
}
function specialtyMatches(agentSpecialty: string | null, engineSpecialty: string | null) {
  const agent = normalizedSpecialty(agentSpecialty)
  return agent != null && agent === normalizedSpecialty(engineSpecialty)
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
  const recordableEngines = [...catalog].sort((left, right) => {
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
    ...recordableEngines.map((engine) => ({
      value: `${catalogWEngineOptionPrefix}${engine.stableId}`,
      label: `${engine.playerName} · ${engine.rarity}级 · Lv 60 · 默认精${defaultRefinement(engine)}${
        specialtyMatches(agent.specialty, engine.specialty)
          ? ''
          : ` · 特性不符（${getAgentSpecialtyLabel(engine.specialty)}）· 被动不生效`
      }`,
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
  const selectedEngine = draft.wEngineCatalogId ? engineById.get(draft.wEngineCatalogId) : undefined
  const selectedSpecialtyMismatch = Boolean(
    selectedEngine && !specialtyMatches(agent.specialty, selectedEngine.specialty),
  )
  return (
    <div className="relation-row relation-row--engine wengine-assignment-field f5v-wengine-assignment">
      <label className="field wengine-assignment-field__selector">
        <span>当前使用</span>
        <SelectMenu
          label="当前音擎"
          value={selected}
          selectedLabel={
            selectedEngine
              ? `${selectedEngine.playerName}${
                  selectedSpecialtyMismatch ? ' · 特性不符 · 被动不生效' : ''
                }`
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
              // Selecting this option explicitly accepts its displayed Lv60/refinement.
              wEngineLevelManuallySet: Boolean(engine),
              wEngineAscension: engine ? 5 : null,
              wEngineAscensionManuallySet: Boolean(engine),
              wEngineRefinement: engine ? defaultRefinement(engine) : null,
              wEngineRefinementManuallySet: Boolean(engine),
            })
          }}
        />
        {selectedSpecialtyMismatch ? (
          <small>
            {getAgentSpecialtyLabel(selectedEngine?.specialty)}
            特性不符；可以记录实际装备，但该音擎被动不生效。
          </small>
        ) : null}
      </label>
      {draft.wEngineCatalogId && (
        <div className="wengine-assignment-field__levels">
          <label className="field">
            <span>音擎等级</span>
            <input
              aria-label="音擎等级"
              type="number"
              min="0"
              max="60"
              value={draft.wEngineLevel ?? ''}
              onChange={(event) => {
                const level = event.target.value === '' ? null : Number(event.target.value)
                const stages = ascensionsForLevel(level)
                const ascension =
                  draft.wEngineAscension != null && stages.includes(draft.wEngineAscension)
                    ? draft.wEngineAscension
                    : stages.length === 1
                      ? stages[0]
                      : null
                onChange({
                  ...draft,
                  wEngineLevel: level,
                  wEngineLevelManuallySet: true,
                  wEngineAscension: ascension,
                  wEngineAscensionManuallySet: ascension !== draft.wEngineAscension,
                })
              }}
            />
          </label>
          <label className="field">
            <span>精炼等级</span>
            <input
              aria-label="精炼等级"
              type="number"
              min="1"
              max="5"
              value={draft.wEngineRefinement ?? ''}
              onChange={(event) =>
                onChange({
                  ...draft,
                  wEngineRefinement: event.target.value === '' ? null : Number(event.target.value),
                  wEngineRefinementManuallySet: true,
                })
              }
            />
          </label>
        </div>
      )}
    </div>
  )
}
