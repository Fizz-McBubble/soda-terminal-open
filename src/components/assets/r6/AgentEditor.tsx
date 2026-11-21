import { useState } from 'react'
import {
  applyPublicMindscapeSkillLevelChange as applyMindscapeSkillLevelChange,
  getPublicDefaultAgentSkillLevels as getDefaultAgentSkillLevels,
  getPublicAgentSkillMaxFor as getAgentSkillMaxFor,
} from '../../../application/publicAssetAgentProgression'
import { CatalogReferencePanel } from './CatalogReference'
import { resolveRosterPotentialImage } from '../../../accounts/rosterFacts'
import { getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { Field, Identity, Save } from './EditorShared'
import { SelectMenu } from './SelectMenu'
import { WEngineAssignmentField } from './WEngineAssignmentField'
import { useDraft } from './state'
import { legalAscensionsForLevel } from '../../../gameDataPacks/panel/wEngineGrowth'
import { hasObservedAgentField } from '../../../accounts/observedAgentFacts'
import type { AgentDraft, AssetGoldenProps, CatalogItem } from './types'
import './AgentEditor.css'

export function AgentEditor({
  props,
  item,
  purpose = 'assets',
  onCancel,
}: {
  props: Pick<AssetGoldenProps, 'accountId' | 'roster' | 'catalog' | 'onSave'>
  item: CatalogItem
  purpose?: 'assets' | 'current'
  onCancel?: () => void
}) {
  const source = props.roster.agents.find((x) => x.agentId === item.stableId)!
  const [view, setView] = useState<'edit' | 'reference'>('edit')
  const revision = JSON.stringify({ source })
  const current = {
    ...source,
    skillLevels: { ...source.skillLevels },
    wEngineRefinement: source.wEngineDetails.refinement,
    wEngineLevel: source.wEngineDetails.level,
    wEngineLevelManuallySet: false,
    wEngineAscensionManuallySet: false,
    ...('ascension' in source.wEngineDetails
      ? { wEngineAscension: source.wEngineDetails.ascension }
      : {}),
    wEngineCatalogId: source.wEngineDetails.id,
    wEngineRefinementManuallySet: false,
  }
  const { draft, dirty, setDraft, baseRevision, stale, rebase } = useDraft<AgentDraft>(
    current,
    revision,
    JSON.stringify([props.accountId, item.stableId]),
    { retainOnUnmount: purpose === 'assets' },
  )
  const showPotentialImage = Boolean(item.supportsPotentialImage && draft.owned)
  const potentialImage = draft.potentialImage
  const skillMax = (field: 'basic' | 'dodge' | 'assist' | 'special' | 'chain') =>
    getAgentSkillMaxFor(field, draft.mindscape)
  if (props.accountId === 'no-account') {
    return (
      <div className="agent-editor" data-purpose={purpose}>
        <div className="agent-editor__content">
          <div className="asset-editor-heading">
            {Identity(
              item,
              `${item.rarity ?? ''}级 · ${getAgentSpecialtyLabel(item.specialty)}`,
              '图鉴预览',
            )}
          </div>
          <CatalogReferencePanel item={item} />
          <p className="selection-context">创建本机账户后可记录拥有情况与养成进度。</p>
        </div>
      </div>
    )
  }
  return (
    <div className="agent-editor" data-purpose={purpose}>
      <div className="agent-editor__content">
        <div className="asset-editor-heading">
          {Identity(item, `${item.rarity ?? ''}级 · ${getAgentSpecialtyLabel(item.specialty)}`)}
        </div>
        {view === 'edit' ? (
          <>
            {dirty || (item.rarity === 'A' && draft.owned) ? (
              <p
                className="agent-editor-state"
                data-state={dirty ? 'dirty' : 'current'}
                role="status"
                aria-live="polite"
              >
                {dirty ? <span>有未保存的修改</span> : null}
                {item.rarity === 'A' && draft.owned ? (
                  <small>
                    A 级已拥有代理人默认账户基线为 M6、技能 15、核心 7；快读或手动记录优先。
                  </small>
                ) : null}
              </p>
            ) : null}
            {stale && (
              <p className="draft-stale" role="alert">
                账户资料已更新；请刷新后重新确认再保存。
              </p>
            )}
            <section className="editor-section agent-editor-progress">
              <h3>养成进度</h3>
              <div className={`fields${showPotentialImage ? '' : ' three'}`}>
                <label className="field">
                  <span>拥有状态</span>
                  <SelectMenu
                    label="拥有状态"
                    value={draft.owned ? 'yes' : 'no'}
                    options={[
                      { value: 'yes', label: '已拥有' },
                      { value: 'no', label: '未拥有' },
                    ]}
                    onChange={(value) => {
                      const owned = value === 'yes'
                      if (!owned || draft.owned) {
                        setDraft({ ...draft, owned })
                        return
                      }
                      const preserveProgression =
                        source.progressionManuallySet === true ||
                        source.manualSource === 'manual_override' ||
                        source.source === 'showcase' ||
                        source.source === 'roster_snapshot' ||
                        source.source === 'external_export'
                      const mindscape =
                        item.rarity === 'A' &&
                        !preserveProgression &&
                        !hasObservedAgentField(source, 'mindscape')
                          ? 6
                          : draft.mindscape
                      const defaults = getDefaultAgentSkillLevels(item.rarity, mindscape)
                      const skillLevels = Object.fromEntries(
                        Object.entries(defaults).map(([field, value]) => [
                          field,
                          preserveProgression ||
                          hasObservedAgentField(
                            source,
                            `skillLevels.${field as keyof typeof defaults}`,
                          )
                            ? (draft.skillLevels[field as keyof typeof defaults] ?? value)
                            : value,
                        ]),
                      ) as typeof defaults
                      setDraft({
                        ...draft,
                        owned,
                        mindscape,
                        progressionManuallySet:
                          preserveProgression && source.progressionManuallySet === true,
                        ...(item.supportsPotentialImage
                          ? {
                              potentialImage:
                                preserveProgression ||
                                hasObservedAgentField(source, 'potentialImage')
                                  ? draft.potentialImage
                                  : resolveRosterPotentialImage(
                                      item.stableId,
                                      draft.potentialImage,
                                    ),
                            }
                          : {}),
                        skillLevels: {
                          ...skillLevels,
                          core:
                            preserveProgression || hasObservedAgentField(source, 'skillLevels.core')
                              ? (draft.skillLevels.core ?? 7)
                              : 7,
                        },
                      })
                    }}
                  />
                </label>
                <Field
                  label="等级"
                  value={draft.level}
                  min={1}
                  max={60}
                  onChange={(level) => {
                    const stages = legalAscensionsForLevel(level)
                    setDraft({
                      ...draft,
                      level,
                      ascension:
                        draft.ascension != null && stages.includes(draft.ascension)
                          ? draft.ascension
                          : stages.length === 1
                            ? stages[0]
                            : null,
                    })
                  }}
                />
                <label className="field">
                  <span>影画</span>
                  <SelectMenu
                    label="影画"
                    value={String(draft.mindscape)}
                    options={Array.from({ length: 7 }, (_, index) => ({
                      value: String(index),
                      label: String(index),
                    }))}
                    onChange={(value) => {
                      const mindscape = Number(value)
                      const skillLevels = applyMindscapeSkillLevelChange(
                        draft.skillLevels,
                        draft.mindscape,
                        mindscape,
                      )
                      setDraft({
                        ...draft,
                        mindscape,
                        skillLevels,
                        progressionManuallySet: true,
                        manualProgression: { ...draft.manualProgression, mindscape },
                      })
                    }}
                  />
                </label>
                {showPotentialImage && (
                  <label className="field">
                    <span>潜能影像</span>
                    <SelectMenu
                      label="潜能影像"
                      value={potentialImage == null ? 'unknown' : String(potentialImage)}
                      options={[
                        { value: 'unknown', label: '未知' },
                        { value: '0', label: '未开启（0）' },
                        ...Array.from({ length: 6 }, (_, index) => ({
                          value: String(index + 1),
                          label: String(index + 1),
                        })),
                      ]}
                      onChange={(value) => {
                        const potentialImage = value === 'unknown' ? undefined : Number(value)
                        const manualProgression = { ...draft.manualProgression }
                        if (potentialImage === undefined) delete manualProgression.potentialImage
                        else manualProgression.potentialImage = potentialImage
                        setDraft({ ...draft, potentialImage, manualProgression })
                      }}
                    />
                  </label>
                )}
              </div>
            </section>
            <section className="editor-section agent-editor-skills">
              <h3>技能与核心</h3>
              <div className="fields three">
                <Field
                  label="普攻"
                  value={draft.skillLevels.basic ?? 1}
                  min={1}
                  max={skillMax('basic')}
                  onChange={(basic) =>
                    setDraft({
                      ...draft,
                      skillLevels: { ...draft.skillLevels, basic },
                      progressionManuallySet: true,
                    })
                  }
                />
                <Field
                  label="闪避"
                  value={draft.skillLevels.dodge ?? 1}
                  min={1}
                  max={skillMax('dodge')}
                  onChange={(dodge) =>
                    setDraft({
                      ...draft,
                      skillLevels: { ...draft.skillLevels, dodge },
                      progressionManuallySet: true,
                    })
                  }
                />
                <Field
                  label="支援技"
                  value={draft.skillLevels.assist ?? 1}
                  min={1}
                  max={skillMax('assist')}
                  onChange={(assist) =>
                    setDraft({
                      ...draft,
                      skillLevels: { ...draft.skillLevels, assist },
                      progressionManuallySet: true,
                    })
                  }
                />
                <Field
                  label="特殊技"
                  value={draft.skillLevels.special ?? 1}
                  min={1}
                  max={skillMax('special')}
                  onChange={(special) =>
                    setDraft({
                      ...draft,
                      skillLevels: { ...draft.skillLevels, special },
                      progressionManuallySet: true,
                    })
                  }
                />
                <Field
                  label="连携技"
                  value={draft.skillLevels.chain ?? 1}
                  min={1}
                  max={skillMax('chain')}
                  onChange={(chain) =>
                    setDraft({
                      ...draft,
                      skillLevels: { ...draft.skillLevels, chain },
                      progressionManuallySet: true,
                    })
                  }
                />
                <Field
                  label="核心技"
                  value={draft.skillLevels.core ?? 1}
                  min={1}
                  max={7}
                  onChange={(core) =>
                    setDraft({
                      ...draft,
                      skillLevels: { ...draft.skillLevels, core },
                      progressionManuallySet: true,
                    })
                  }
                />
              </div>
            </section>
            <section className="editor-section">
              <h3>音擎</h3>
              <div className="relation">
                <WEngineAssignmentField
                  agent={item}
                  roster={props.roster}
                  catalog={props.catalog.wengines}
                  draft={draft}
                  onChange={(next) => setDraft({ ...draft, ...next })}
                />
              </div>
            </section>
          </>
        ) : (
          <CatalogReferencePanel
            item={item}
            agentView={purpose === 'current' ? 'skills' : 'full'}
            agentProgress={draft}
          />
        )}
      </div>
      <div className="agent-editor__actions">
        {import.meta.env.VITE_SODA_PUBLIC_BUILD !== 'true' && (
          <button
            className="button button--quiet agent-editor__view-toggle"
            type="button"
            onClick={() => setView(view === 'edit' ? 'reference' : 'edit')}
          >
            {view === 'reference'
              ? '返回录入'
              : purpose === 'current'
                ? '查看技能与潜能'
                : '查看图鉴资料'}
          </button>
        )}
        <div className="agent-editor__save-actions">
          {onCancel && (
            <button className="button" type="button" onClick={onCancel}>
              取消编辑
            </button>
          )}
          <div hidden={view !== 'edit'}>
            <Save
              disabled={view !== 'edit'}
              label="保存代理人资料"
              onSave={async () => {
                const savedRevision = await props.onSave({
                  kind: 'agents',
                  stableId: item.stableId,
                  baseRevision,
                  draft,
                })
                if (typeof savedRevision === 'string') rebase(draft, savedRevision)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
