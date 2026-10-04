import type { DriveDisc } from '../domain/schemas'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import { discSubStatLabel } from './publicDiscFacts'
import { readableDetail } from './warehouseRetentionCopy'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]
const stats = (keys: string[]) =>
  keys.map((key) => discSubStatLabel(key as DriveDisc['mainStat'])).join('、')

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
    return `目前只有 ${value.meaningfulStats.length} 条重点副词条；本号位至少 ${guidance.minimumLines} 条才考虑继续投入。`
  if (guidance.minimumCoreLines !== null && value.coreStats.length < guidance.minimumCoreLines)
    return '缺少这个构筑需要的核心副词条，暂不建议继续强化。'
  if (value.potentialTarget !== null && use.possibleFinalScore.upper < value.potentialTarget)
    return '即使剩余强化都往有利方向发展，也达不到当前保留标准。'
  if (value.progressFloor !== null && use.currentScore < value.progressFloor)
    return '已有强化落在适用词条上的次数不足，建议停手。'
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
  if (!info) return <p>这份旧分析没有词条明细，请重新分析后查看。</p>
  const investment = investmentReason(use, discLevel)
  return (
    <div className="warehouse-retention__fit">
      <dl>
        <div>
          <dt>套装用途</dt>
          <dd>
            {use.twoPieceFit !== 'incompatible' && info.twoPieceEffect ? (
              <p>两件：{info.twoPieceEffect}</p>
            ) : null}
            {use.fourPieceFit !== 'incompatible' && info.fourPieceEffect ? (
              <p>
                四件{use.fourPieceFit === 'conditional' ? '（有使用条件）' : ''}：
                {info.fourPieceEffect}需结合整套配装确认。
              </p>
            ) : (
              <p>此用途只取两件效果。</p>
            )}
          </dd>
        </div>
        <div>
          <dt>主词条</dt>
          <dd>
            {disc && disc.slot <= 3
              ? `${disc.slot} 号位固定为${stats([disc.mainStat])}。`
              : `${disc ? `${disc.slot} 号位：` : ''}${stats(info.mainStats) || '适用主词条待确认'}。`}
            {use.mainFit === 'conditional' ? '当前主词条有使用条件。' : null}
          </dd>
        </div>
        <div>
          <dt>副词条方向</dt>
          <dd>
            {stats(info.subStats) || '以主词条功能为主'}
            {info.minorStats.length ? `；次要参考：${stats(info.minorStats)}` : ''}。
          </dd>
        </div>
        <div>
          <dt>这张盘</dt>
          <dd>
            <strong>
              {info.matchedStats.length ? `${stats(info.matchedStats)}有用` : '尚无匹配的副词条'}
            </strong>
            {info.unusedStats.length ? `；${stats(info.unusedStats)}不计入这个构筑的目标` : ''}。
          </dd>
        </div>
      </dl>
      {investment ? <p className="warehouse-retention__reason">{investment}</p> : null}
      {use.agentId === 'agent-claret' ? (
        <p className="warehouse-retention__hint">
          暴伤的作用是将初始值的 35%
          转为暴击率，不直接放大锐暴伤害。参考分不表示暴伤与暴率收益相等。
        </p>
      ) : null}
      {use.useState === 'conditional' ? <p>上述用途有队伍或配装条件，确认后再投入。</p> : null}
      {use.useState === 'missing_fact' ? <p>这一用途尚有资料待确认，不能据此决定清理。</p> : null}
      {use.functionalState === 'needs_build_context' ? (
        <p>还需在完整配装中确认功能是否达标。</p>
      ) : null}
      {use.functionalState === 'ready' && use.functionDetail ? (
        <p>{readableDetail(use.functionDetail)}</p>
      ) : null}
    </div>
  )
}
