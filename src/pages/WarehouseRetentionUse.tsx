import type { DriveDisc } from '../domain/schemas'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import {
  retentionDiscSetRelationship,
  type RetentionDiscSetRelationship,
} from '../warehouse/warehouseRetentionGuidance'
import { discSubStatLabel } from './publicDiscFacts'
import { playerCondition, readableDetail } from './warehouseRetentionCopy'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]
type SetPlan = NonNullable<Use['guidance']>['branchSetPlan']

const stats = (keys: string[]) =>
  keys.map((key) => discSubStatLabel(key as DriveDisc['mainStat'])).join('、')
const setNames = (sets: Array<{ name: string | null }>) => {
  const names = sets.flatMap((set) => (set.name ? [set.name] : []))
  return names.join(' / ')
}
function setRoleCopy(
  role: RetentionDiscSetRelationship,
  plan: SetPlan | undefined,
  setName: string,
  fourPieceFit: Use['fourPieceFit'],
): { title: string; detail: string } | null {
  if (role === 'primary') {
    return {
      title:
        plan?.pattern === '4+2' || plan?.pattern === '4+unconfirmed'
          ? '可作为主套'
          : '可作为二件套',
      detail:
        (plan?.pattern === '4+2' || plan?.pattern === '4+unconfirmed') &&
        fourPieceFit !== 'incompatible'
          ? `${setName}需搭配另外三张同套驱动盘。`
          : `${setName}需搭配另一张同套驱动盘。`,
    }
  }
  if (role === 'secondary') {
    return {
      title: '可作为副套',
      detail: `${setName}需搭配另一张同套驱动盘。`,
    }
  }
  if (role === 'potential') {
    return {
      title: '词条适合，套装需调整',
      detail: `${setName}不在这套推荐搭配中。`,
    }
  }
  if (role === 'conditional') {
    return null
  }
  if (role === 'mismatch') {
    return {
      title: '套装不适合',
      detail: '这张盘的套装不适合这套搭配。',
    }
  }
  return null
}

function investmentReason(use: Use, discLevel: number) {
  const { investment: value, guidance } = use
  if (
    !value ||
    !guidance ||
    value.qualified !== false ||
    !value.remainingNodes ||
    discLevel >= 15 ||
    (use.functionalState && use.functionalState !== 'none')
  )
    return null
  if (guidance.minimumLines !== null && value.meaningfulStats.length < guidance.minimumLines)
    return `目前只有 ${value.meaningfulStats.length} 条重点副词条；这个号位通常要至少 ${guidance.minimumLines} 条才值得继续强化。`
  if (guidance.minimumCoreLines !== null && value.coreStats.length < guidance.minimumCoreLines)
    return '缺少这个用途需要的核心副词条，建议停手。'
  if (value.potentialTarget !== null && use.possibleFinalScore.upper < value.potentialTarget)
    return '即使剩余强化都命中有用词条，也达不到这一用途的保留要求。'
  if (value.progressFloor !== null && use.currentScore < value.progressFloor)
    return '已有强化命中有用词条的次数不足，建议停手。'
  return null
}

export function WarehouseRetentionUse({
  use,
  disc,
  discLevel,
}: {
  use: Use
  disc?: DriveDisc
  discLevel: number
}) {
  const info = use.guidance
  if (!info) return null
  const investment = investmentReason(use, discLevel)
  const branchSetPlan = info.branchSetPlan
  const setRole = retentionDiscSetRelationship(disc?.setId, use)
  const isPlanMember = setRole === 'primary' || setRole === 'secondary'
  const setName = info.currentSet?.name ?? '这个套装'
  const roleCopy = setRoleCopy(setRole, branchSetPlan, setName, use.fourPieceFit)
  const conditions = [
    ...new Set(
      isPlanMember
        ? (branchSetPlan?.conditionDetails
            .map((detail) => playerCondition(detail, use.profileId))
            .filter((value): value is string => !!value) ?? [])
        : [],
    ),
  ]
  return (
    <div className="warehouse-retention__fit" aria-label="当前用途详情">
      <p className="warehouse-retention__current-match">
        <span>这盘与用途</span>
        <strong>
          {info.matchedStats.length ? `${stats(info.matchedStats)}符合用途` : '暂无匹配副词条'}
        </strong>
      </p>
      <dl className="warehouse-retention__facts">
        {roleCopy ? (
          <div>
            <dt>套装搭配</dt>
            <dd>
              <strong>{roleCopy.title}</strong>
              {!isPlanMember || !branchSetPlan ? <p>{roleCopy.detail}</p> : null}
              {isPlanMember && branchSetPlan ? (
                <section className="warehouse-retention__set-plan">
                  <h4>推荐套装</h4>
                  {branchSetPlan.pattern === '4+2' || branchSetPlan.pattern === '4+unconfirmed' ? (
                    <>
                      <p>四件：{setNames(branchSetPlan.primarySets)}</p>
                      {branchSetPlan.secondarySets.some((set) => set.name) ? (
                        <p>二件：{setNames(branchSetPlan.secondarySets)}</p>
                      ) : null}
                    </>
                  ) : (
                    <p>三套各二件：{setNames(branchSetPlan.primarySets)}</p>
                  )}
                </section>
              ) : null}
            </dd>
          </div>
        ) : null}
        {conditions.length ? (
          <div>
            <dt>使用条件</dt>
            <dd>
              <ul>
                {conditions.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>词条要求</dt>
          <dd>
            {(disc && disc.slot <= 3) || info.mainStats.length ? (
              <p>
                {disc && disc.slot <= 3
                  ? `${disc.slot} 号位固定为${stats([disc.mainStat])}。`
                  : `${disc ? `${disc.slot} 号位：` : ''}${stats(info.mainStats)}。`}
              </p>
            ) : null}
            {info.subStats.length || use.functionalMain ? (
              <p>
                {stats(info.subStats) || '以主词条功能为主'}
                {info.minorStats.length ? `；次要参考：${stats(info.minorStats)}` : ''}。
              </p>
            ) : null}
          </dd>
        </div>
      </dl>
      <div className="warehouse-retention__notes">
        {investment ? <p className="warehouse-retention__reason">{investment}</p> : null}
        {use.agentId === 'agent-claret' ? (
          <p className="warehouse-retention__hint">
            初始暴击伤害的 35% 转为初始暴击率，不直接提高锐暴伤害。
          </p>
        ) : null}
        {use.functionalState === 'ready' && use.functionDetail ? (
          <p>{readableDetail(use.functionDetail)}</p>
        ) : null}
      </div>
    </div>
  )
}
