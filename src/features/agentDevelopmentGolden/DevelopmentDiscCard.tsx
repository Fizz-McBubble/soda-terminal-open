import { VisualEntityImage } from '../../components/VisualEntityImage'
import type { DiscFact } from './types'
import type { VisualAssetConsumer } from '../../assets/visualAssetSlots'

/** The same six-slot fact card in the workbench and comparison. */
export function DevelopmentDiscCard({
  disc,
  changed,
  slotAction,
  showGrade = true,
  consumer = 'agent-development.workbench',
  conflictContext = 'development',
}: {
  disc: DiscFact
  changed?: boolean | null
  slotAction?: string
  showGrade?: boolean
  consumer?: VisualAssetConsumer
  conflictContext?: 'development' | 'equipment_or_plan'
}) {
  const subs = [...disc.subs]
  while (subs.length < 4) subs.push({ name: '未录入', value: '—', hits: 0 })
  const users = disc.conflicts ?? []
  const usageLabel = (name: string, usage?: NonNullable<DiscFact['conflicts']>[number]['usage']) =>
    conflictContext === 'equipment_or_plan'
      ? `与${name}的${usage === 'current_equipment' ? '当前装备' : usage === 'saved_plan' ? '保存方案' : usage === 'equipment_and_plan' ? '当前装备及保存方案' : '装备或保存方案'}共用`
      : `已用于${name}的养成方案`
  const mainLabel = disc.main.replace(/百分比$/, '').replace(/属性伤害$/, '伤害')
  const statusClass = changed === true ? 'is-changed' : changed === false ? 'is-retained' : ''
  return (
    <article
      className={`disc-card development-disc-card ${statusClass}`.trim()}
      data-slot={disc.slot}
      data-comparison={changed === true ? 'changed' : changed === false ? 'retained' : undefined}
      data-result-layer={disc.slot}
    >
      <header>
        <span className="development-disc-card__slot">{disc.slot}号位</span>
        <div className="development-disc-card__corner">
          <b
            className={`development-disc-card__badge ${
              changed === true ? 'is-changed-badge' : changed === false ? 'is-retained-badge' : ''
            }`.trim()}
          >
            {changed === undefined
              ? !showGrade || disc.grade === '未评定'
                ? (disc.score ?? '—')
                : [disc.grade, disc.score].filter((x) => x !== undefined).join(' · ')
              : changed === null
                ? '候选盘'
                : changed
                  ? '需替换'
                  : '沿用'}
          </b>
          {users.slice(0, 2).map((user) => (
            <span
              className="development-disc-card__user"
              key={user.agentId}
              tabIndex={0}
              role="img"
              aria-label={usageLabel(user.name, user.usage)}
            >
              <VisualEntityImage
                entityType="agent"
                entityId={user.agentId}
                name={user.name}
                slotId="agent.square-avatar"
                consumer={consumer}
              />
              <span className="development-disc-card__tooltip" aria-hidden="true">
                {usageLabel(user.name, user.usage)}
              </span>
            </span>
          ))}
          {users.length > 2 ? (
            <span
              className="development-disc-card__user"
              tabIndex={0}
              role="img"
              aria-label={
                conflictContext === 'equipment_or_plan'
                  ? users
                      .slice(2)
                      .map((user) => usageLabel(user.name, user.usage))
                      .join('；')
                  : `还用于${users
                      .slice(2)
                      .map((user) => user.name)
                      .join('、')}的养成方案`
              }
            >
              +{users.length - 2}
              <span className="development-disc-card__tooltip" aria-hidden="true">
                {conflictContext === 'equipment_or_plan' ? (
                  users
                    .slice(2)
                    .map((user) => usageLabel(user.name, user.usage))
                    .join('；')
                ) : (
                  <>
                    还用于
                    {users
                      .slice(2)
                      .map((user) => user.name)
                      .join('、')}
                    的养成方案
                  </>
                )}
              </span>
            </span>
          ) : null}
        </div>
      </header>
      <div className="development-disc-card__main">
        {disc.visual ? (
          <VisualEntityImage
            className="disc-visual"
            {...disc.visual}
            slotId="drive-disc-set.icon"
            consumer={consumer}
          />
        ) : disc.image ? (
          <img src={disc.image} alt={`${disc.set}图标`} />
        ) : null}
        <span className="development-disc-card__identity">
          <strong>{disc.set}</strong>
          <span
            className="development-disc-card__main-stat"
            title={`${disc.main} ${disc.mainValue} · +${disc.level}`}
          >
            <span>
              {mainLabel} <b>{disc.mainValue}</b>
            </span>{' '}
            <em>+{disc.level}</em>
          </span>
        </span>
      </div>
      <ul>
        {subs.map((sub, index) => (
          <li
            className={
              sub.effective ? 'is-effective' : sub.name === '未录入' ? 'is-empty' : 'is-non-target'
            }
            key={index}
          >
            <span>
              {sub.name}
              {sub.hits > 0 ? <em title={`已强化 ${sub.hits} 次`}>+{sub.hits}</em> : null}
            </span>
            <b>{sub.value}</b>
          </li>
        ))}
      </ul>
      {/\d/.test(disc.effective) || slotAction ? (
        <footer>
          {/\d/.test(disc.effective) ? <span>有效副属性 {disc.effective}</span> : null}
          {slotAction ? <strong className="development-disc-card__slot-action">{slotAction}</strong> : null}
        </footer>
      ) : null}
    </article>
  )
}
