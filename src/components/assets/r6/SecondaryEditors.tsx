import { VisualEntityImage } from '../../VisualEntityImage'
import { CatalogReferencePanel } from './CatalogReference'
import { getAgentSpecialtyLabel } from '../../../application/publicRosterNames'
import { Field, Identity, Save } from './EditorShared'
import { SelectMenu } from './SelectMenu'
import { useDraft } from './state'
import type { AssetGoldenProps, BangbooDraft, CatalogItem, DiscItem } from './types'

export function WEngineEditor({ props, item }: { props: AssetGoldenProps; item: CatalogItem }) {
  const users = props.roster.agents.filter((agent) => agent.wEngineDetails.id === item.stableId)
  return (
    <>
      {Identity(item, `${item.rarity ?? ''}级 · ${getAgentSpecialtyLabel(item.specialty)}`)}
      <CatalogReferencePanel item={item} />
      {users.length > 0 && (
        <section className="editor-section" aria-label="使用代理人">
          <h3>使用代理人</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {users.map((agent) => {
              const name =
                props.catalog.agents.find((entry) => entry.stableId === agent.agentId)
                  ?.playerName ?? agent.agentId
              return (
                <span key={agent.agentId} title={name} className="engine-user-avatar">
                  <VisualEntityImage
                    entityType="agent"
                    entityId={agent.agentId}
                    slotId="agent.square-avatar"
                    consumer="assets.editor"
                    name={name}
                  />
                </span>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}

export function BangbooEditor({ props, item }: { props: AssetGoldenProps; item: CatalogItem }) {
  const source = props.roster.bangboos.find((x) => x.bangbooId === item.stableId)!
  const revision = JSON.stringify(source)
  const { draft, setDraft, baseRevision, stale } = useDraft<BangbooDraft>({ ...source }, revision)
  return (
    <>
      <div className="asset-editor-heading">
        {Identity(item, `${item.rarity ?? ''}级邦布`)}
        <Save
          label="保存邦布资料"
          onSave={async () => {
            await props.onSave({ kind: 'bangboos', stableId: item.stableId, baseRevision, draft })
          }}
        />
      </div>
      {stale && (
        <p className="draft-stale" role="alert">
          邦布资料已更新；请刷新后重新确认再保存。
        </p>
      )}
      <CatalogReferencePanel
        item={item}
        skillLevel={draft.skillLevel ?? 1}
        additionalAbilityLevel={draft.additionalAbilityLevel ?? 1}
      />
      <section className="editor-section">
        <h3>培养进度</h3>
        <div className="fields three">
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
                setDraft({
                  ...draft,
                  owned,
                  ...(owned && !draft.owned
                    ? {
                        level: 60,
                        ...(item.rarity === 'S' && draft.starsManuallySet !== true
                          ? { stars: 1, starsManuallySet: false }
                          : {}),
                      }
                    : {}),
                })
              }}
            />
          </label>
          <Field
            label="等级"
            value={draft.level ?? 1}
            min={1}
            onChange={(level) => setDraft({ ...draft, level })}
          />
          <Field
            label="星级"
            value={draft.stars ?? 1}
            min={1}
            max={5}
            onChange={(stars) => setDraft({ ...draft, stars, starsManuallySet: true })}
          />
          <label className="field">
            <span>主动技等级</span>
            <SelectMenu
              label="主动技等级"
              value={draft.skillLevel === null ? 'unconfirmed' : String(draft.skillLevel)}
              options={[
                { value: 'unconfirmed', label: '未确认' },
                ...Array.from({ length: 10 }, (_, index) => ({
                  value: String(index + 1),
                  label: `等级 ${index + 1}`,
                })),
              ]}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  skillLevel: value === 'unconfirmed' ? null : Number(value),
                })
              }
            />
          </label>
          <label className="field">
            <span>额外能力等级</span>
            <SelectMenu
              label="额外能力等级"
              value={
                draft.additionalAbilityLevel === null
                  ? 'unconfirmed'
                  : String(draft.additionalAbilityLevel)
              }
              options={[
                { value: 'unconfirmed', label: '未确认' },
                ...Array.from({ length: 5 }, (_, index) => ({
                  value: String(index + 1),
                  label: `等级 ${index + 1}`,
                })),
              ]}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  additionalAbilityLevel: value === 'unconfirmed' ? null : Number(value),
                })
              }
            />
          </label>
        </div>
      </section>
    </>
  )
}

export function DiscEditor({ item }: { props: AssetGoldenProps; item: DiscItem }) {
  return (
    <>
      <div className="asset-editor-heading">
        {Identity(item.set, `${item.slot}号位 · +${item.level}`)}
      </div>
      <CatalogReferencePanel item={item.set} />
      <section className="editor-section disc-editor-stats">
        <h3>词条</h3>
        <div className="main-stat">
          <span>
            主词条 · <strong>{item.mainStat}</strong>
          </span>
          {item.mainValue && <strong>{item.mainValue}</strong>}
        </div>
        <dl className="stats">
          {item.subStats.map((stat) => (
            <div key={stat.stat}>
              <dt>
                <strong>{stat.stat}</strong>
                <em>+{stat.upgrades}</em>
              </dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="editor-section">
        {item.protections.includes('equipped') || item.protections.includes('planned') ? (
          <p className="inventory-protection-note">
            该盘已被{item.protections.includes('equipped') ? '当前装备' : ''}
            {item.protections.includes('equipped') && item.protections.includes('planned')
              ? '和'
              : ''}
            {item.protections.includes('planned') ? '已保存方案' : ''}引用，解除关系前不可删除。
          </p>
        ) : null}
      </section>
    </>
  )
}
