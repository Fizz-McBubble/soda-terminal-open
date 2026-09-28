import {
  applyPublicMindscapeSkillLevelChange as applyMindscapeSkillLevelChange,
  getPublicDefaultAgentSkillLevels as getDefaultAgentSkillLevels,
  getPublicAgentSkillMaxFor as getAgentSkillMaxFor,
} from '../../../application/publicAssetAgentProgression'
import { CatalogReferencePanel } from './CatalogReference'
import { getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { Field, Identity, Save } from './EditorShared'
import { SelectMenu } from './SelectMenu'
import { WEngineAssignmentField } from './WEngineAssignmentField'
import { useDraft } from './state'
import type { AgentDraft, AssetGoldenProps, CatalogItem } from './types'

export function AgentEditor({ props, item }: { props: AssetGoldenProps; item: CatalogItem }) {
  const source = props.roster.agents.find((x) => x.agentId === item.stableId)!
  const revision = JSON.stringify({ source })
  const current = {
    ...source,
    skillLevels: { ...source.skillLevels },
    wEngineRefinement: source.wEngineDetails.refinement,
    wEngineLevel: source.wEngineDetails.level,
    wEngineCatalogId: source.wEngineDetails.id,
    wEngineRefinementManuallySet: false,
  }
  const { draft, setDraft, baseRevision, stale, rebase } = useDraft<AgentDraft>(current, revision)
  const skillMax = (field: 'basic' | 'dodge' | 'assist' | 'special' | 'chain') =>
    getAgentSkillMaxFor(field, draft.mindscape)
  if (props.accountId === 'no-account') {
    return (
      <>
        <div className="asset-editor-heading">
          {Identity(
            item,
            `${item.rarity ?? ''}级 · ${getAgentSpecialtyLabel(item.specialty)}`,
            '图鉴预览',
          )}
        </div>
        <CatalogReferencePanel item={item} />
        <p className="selection-context">创建本机账户后可记录拥有情况与养成进度。</p>
      </>
    )
  }
  return (
    <>
      <div className="asset-editor-heading">
        {Identity(item, `${item.rarity ?? ''}级 · ${getAgentSpecialtyLabel(item.specialty)}`)}
        <Save
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
      {stale && (
        <p className="draft-stale" role="alert">
          账户资料已更新；请刷新后重新确认再保存。
        </p>
      )}
      <CatalogReferencePanel item={item} />
      <section className="editor-section">
        <h3>养成进度</h3>
        <div className={`fields${item.supportsPotentialImage ? '' : ' three'}`}>
          <label className="field">
            <span>拥有</span>
            <SelectMenu
              label="拥有"
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
                const mindscape = item.rarity === 'A' ? 6 : draft.mindscape
                const skillLevels = getDefaultAgentSkillLevels(item.rarity, mindscape)
                setDraft({
                  ...draft,
                  owned,
                  mindscape,
                  progressionManuallySet: false,
                  skillLevels: {
                    ...skillLevels,
                    core: 7,
                  },
                })
              }}
            />
          </label>
          <Field
            label="等级"
            value={draft.level}
            min={1}
            onChange={(level) => setDraft({ ...draft, level })}
          />
          <Field
            label="影画"
            value={draft.mindscape}
            max={6}
            onChange={(mindscape) => {
              const skillLevels = applyMindscapeSkillLevelChange(
                draft.skillLevels,
                draft.mindscape,
                mindscape,
              )
              setDraft({ ...draft, mindscape, skillLevels, progressionManuallySet: true })
            }}
          />
          {item.supportsPotentialImage && (
            <Field
              label="潜能影像"
              value={draft.potentialImage ?? 6}
              max={6}
              onChange={(potentialImage) => setDraft({ ...draft, potentialImage })}
            />
          )}
        </div>
      </section>
      <section className="editor-section">
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
        <h3>当前音擎</h3>
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
  )
}
