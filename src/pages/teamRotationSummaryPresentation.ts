import reviewed from '../gameDataPacks/data/reviewed-team-rotation-summaries.3.3.json'
import { playerFacingAgentLabel } from '../application/playerFacingLabels'
import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'
import { isCompleteFiniteTeamPlay } from '../domain/finiteTeamPlayContract'
import { canonicalTeamPlayIdentity } from '../domain/teamPlayMechanismContract'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'

export type TeamRotationSummarySource = {
  contract: string
  gameVersion: string
  rows: readonly {
    playId: string
    memberIds: readonly string[]
    primaryAgentId: string
    opening: string
    handoff?: string
    loop: string
    burst: string
    evidence: { axisSha256: string; policySha256: string }
  }[]
}

export type TeamStructuredRhythm = Readonly<{
  opening: string
  loop: string
  burst: string
}>

/** A team's summary belongs only to the explicitly selected play. */
export function presentTeamRotationSummary(
  item: Pick<TeamLoadoutOverviewItem, 'agentIds' | 'playDirection'>,
  source: TeamRotationSummarySource = reviewed,
) {
  const play = item.playDirection
  if (
    !play ||
    source.contract !== 'team-rotation-summaries/v1' ||
    source.gameVersion !== currentVersionProjection.gameVersion
  )
    return null
  const members = [...item.agentIds].sort().join('|')
  if (
    item.agentIds.length !== 3 ||
    new Set(item.agentIds).size !== 3 ||
    [...play.memberIds].sort().join('|') !== members
  )
    return null
  const id = canonicalTeamPlayIdentity(play)
  const matches = source.rows.filter(
    (row) =>
      row.playId === id &&
      row.memberIds.length === 3 &&
      new Set(row.memberIds).size === 3 &&
      [...row.memberIds].sort().join('|') === members &&
      row.primaryAgentId === play.primaryOutputAgentId &&
      [row.opening, row.loop, row.burst].every((text) => typeof text === 'string' && text.trim()),
  )
  return matches.length === 1 ? matches[0]! : null
}

function formatNames(ids: readonly string[]) {
  return [...new Set(ids)].map(playerFacingAgentLabel).join('、')
}

/** Deterministic structural rhythm derived strictly from verified play roles and system.
 * Shown only when no hand-reviewed play-by-play rotation summary exists. */
export function presentTeamStructuredRhythm(
  item: Pick<TeamLoadoutOverviewItem, 'agentIds' | 'playDirection'>,
): TeamStructuredRhythm | null {
  const play = item.playDirection
  if (!play || item.agentIds.length !== 3 || !isCompleteFiniteTeamPlay(play, [...item.agentIds].sort().join('|')))
    return null
  const primaryName = playerFacingAgentLabel(play.primaryOutputAgentId)
  const byRole = (role: string) =>
    play.roles.filter((entry) => entry.role === role && entry.agentId !== play.primaryOutputAgentId).map((entry) => entry.agentId)
  const supports = byRole('support')
  const stuns = byRole('stun')
  const anomalies = byRole('ordinary_anomaly')
  const backgrounds = byRole('background_output')
  const partners = byRole('activation_partner')
  const openers = [...supports, ...backgrounds, ...stuns, ...anomalies, ...partners]
  const openerNames = formatNames(openers.slice(0, 2))

  switch (play.outputSystem) {
    case 'attribute_anomaly': {
      const anomalyNames = formatNames(anomalies)
      const supportNames = formatNames([...supports, ...backgrounds, ...stuns])
      return {
        opening: supportNames
          ? `${supportNames}先手施加增益或后台效果，再切${primaryName}与队友开始积累属性异常。`
          : `${primaryName}起手积累属性异常，为后续紊乱与衔接铺垫。`,
        loop: anomalyNames
          ? `${primaryName}与${anomalyNames}交替触发不同属性异常结算紊乱${supportNames ? `，${supportNames}按持续时间补足增益` : ''}。`
          : `${primaryName}围绕异常积蓄与核心技能持续站场${supportNames ? `，${supportNames}穿插补足增益与资源` : ''}。`,
        burst: `异常状态就绪或敌人失衡时，由${primaryName}集中释放强化特殊技与终结技收割伤害。`,
      }
    }
    case 'rupture': {
      const supportNames = formatNames([...supports, ...backgrounds])
      const stunNames = formatNames(stuns)
      return {
        opening: openerNames
          ? `${openerNames}先手启动队伍增益或后台协同，再切${primaryName}入场积攒资源。`
          : `${primaryName}起手积攒核心资源，进入命破输出循环。`,
        loop: stunNames
          ? `${stunNames}负责推进失衡，${primaryName}在常态维持贯穿输出与资源回复${supportNames ? `，${supportNames}及时续上增益` : ''}。`
          : `${primaryName}持续站场积累贯穿资源并释放核心技能${supportNames ? `，${supportNames}穿插维持增益覆盖` : ''}。`,
        burst: `核心资源充足或进入失衡窗口时，由${primaryName}集中打出强化特殊技与终结技。`,
      }
    }
    case 'aftershock': {
      const bgNames = formatNames([...backgrounds, ...stuns])
      const supportNames = formatNames(supports)
      return {
        opening: openerNames
          ? `${openerNames}先手启动后台协同与队伍增益，再交由${primaryName}接管前台。`
          : `${primaryName}前台起手并带动队友协同攻击。`,
        loop: `${primaryName}保持前台进攻频率以持续触发追加攻击${bgNames ? `，${bgNames}按需补足后台协同资源` : ''}${supportNames ? `，${supportNames}维持增益` : ''}。`,
        burst: `敌人失衡或增益齐备时，${primaryName}集中释放强化技能与终结技放大追加爆发。`,
      }
    }
    case 'sharp': {
      const stunNames = formatNames(stuns)
      const supportNames = formatNames([...supports, ...backgrounds])
      return {
        opening: openerNames
          ? `${openerNames}先手铺好减防、增益或后台攻击，随后切${primaryName}进入锋御连段。`
          : `${primaryName}起手进入锋御连段并积累资源。`,
        loop: `${primaryName}通过强化特殊技与核心连段维持锋御节奏${stunNames ? `，${stunNames}穿插推进失衡` : ''}${supportNames ? `，${supportNames}及时续上辅助效果` : ''}。`,
        burst: `失衡或连携窗口内切回${primaryName}打满完整锋御爆发连段与终结技。`,
      }
    }
    default: {
      const stunNames = formatNames(stuns)
      const supportNames = formatNames([...supports, ...backgrounds, ...partners])
      return {
        opening: openerNames
          ? `${openerNames}先手启动增益或后台效果，为${primaryName}铺垫输出窗口。`
          : `${primaryName}起手积攒能量与核心资源。`,
        loop: stunNames
          ? `${stunNames}负责积累失衡${supportNames ? `，${supportNames}保持增益覆盖` : ''}，${primaryName}衔接常态输出与资源准备。`
          : `${primaryName}持续站场输出并积攒能量${supportNames ? `，${supportNames}按技能周期速切补足增益` : ''}。`,
        burst: stunNames
          ? `敌人失衡后接连携，切${primaryName}在增益覆盖期内集中释放强化特殊技与终结技。`
          : `核心资源与队伍增益齐备时，由${primaryName}集中释放强化特殊技与终结技。`,
      }
    }
  }
}
