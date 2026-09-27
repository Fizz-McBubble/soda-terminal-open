import { VisualEntityImage } from '../../components/VisualEntityImage'
import type { DiscFact } from './types'
import type { VisualAssetConsumer } from '../../assets/visualAssetSlots'

/** The same six-slot fact card in the workbench and comparison. */
export function DevelopmentDiscCard({
  disc,
  changed,
  consumer = 'agent-development.workbench',
  conflictContext = 'development',
}: {
  disc: DiscFact
  changed?: boolean | null
  consumer?: VisualAssetConsumer
  conflictContext?: 'development' | 'equipment_or_plan'
}) {
  const subs = [...disc.subs]
  while (subs.length < 4) subs.push({ name: '未录入', value: '—', hits: 0 })
  const users = disc.conflicts ?? []
  const usageLabel = (name: string) =>
    conflictContext === 'equipment_or_plan'
      ? `与${name}的装备或保存方案共用`
      : `已用于${name}的养成方案`
  const mainLabel = disc.main.replace(/百分比$/, '').replace(/属性伤害$/, '伤害')
  return (
    <article className="disc-card development-disc-card" data-slot={disc.slot}>
      <header>
        <span>{disc.slot}号位</span>
        <div className="development-disc-card__corner">
          <b>
            {changed === undefined
              ? disc.grade === '未评定'
                ? disc.score
                : [disc.grade, disc.score].filter((x) => x !== undefined).join(' · ')
              : changed === null
                ? '方案用盘'
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
              aria-label={usageLabel(user.name)}
            >
              <VisualEntityImage
                entityType="agent"
                entityId={user.agentId}
                name={user.name}
                slotId="agent.square-avatar"
                consumer={consumer}
              />
              <span className="development-disc-card__tooltip" aria-hidden="true">
                {usageLabel(user.name)}
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
                  ? usageLabel(
                      users
                        .slice(2)
                        .map((user) => user.name)
                        .join('、'),
                    )
                  : `还用于${users
                      .slice(2)
                      .map((user) => user.name)
                      .join('、')}的养成方案`
              }
            >
              +{users.length - 2}
              <span className="development-disc-card__tooltip" aria-hidden="true">
                {conflictContext === 'equipment_or_plan' ? (
                  usageLabel(
                    users
                      .slice(2)
                      .map((user) => user.name)
                      .join('、'),
                  )
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
          <li className={sub.effective ? 'is-effective' : undefined} key={index}>
            <span>
              {sub.name}
              {sub.hits > 0 ? <em>+{sub.hits}</em> : null}
            </span>
            <b>{sub.value}</b>
          </li>
        ))}
      </ul>
      <footer>{/\d/.test(disc.effective) ? `有效副属性 ${disc.effective}` : '有效副属性 —'}</footer>
    </article>
  )
}
