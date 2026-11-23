import { memberFacts, type Member } from './teamStrengthMemberFacts'
import { compatibleCapabilities } from './teamStrengthSupportCapabilities'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { evaluateTeamPredicate, type TeamContext } from '../teamEngine/teamMethodR1'
import {
  createTeamStrengthReferenceRuntimeMember,
  resolveTeamStrengthReferencePotential,
} from './teamStrengthReferenceState'
import {
  currentTeamStrengthReferenceConditions,
  type TeamStrengthReferenceConditions,
} from './teamStrengthReferenceConditions'
import { getCurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import { teamPlayBackgroundEvidence } from './teamStrengthBackgroundActions'
import { getAgentName } from '../application/publicRosterNames'
import { planningEventDisplayLabel32 } from '../application/planningEventDisplay32'
import {
  finiteTeamPlayContract,
  isCompleteFiniteTeamPlay,
  type FiniteTeamPlay,
  type TeamPlayCondition,
  type TeamPlayContribution,
  type TeamPlayRole,
} from './teamFinitePlayContract'
import { resolveTeamPlaySupportContribution } from './teamPlaySupportContribution'
import {
  teamPlayOutputRoutes,
  compileTeamPlayMechanismProof,
  teamPlayContributionMatchesSystem,
  resolveOrdinaryAnomalyContribution,
} from './teamPlayMechanicEvidence'
import { isAdmittedTeamPlay, deduplicateTeamPlays } from '../domain/teamPlayMechanismContract'
import reusedDirections from '../gameDataPacks/data/reviewed-team-direction-reuse.3.1.json'
import { stableContentHash } from '../domain/stableContentHash'
export { finiteTeamPlayContract } from './teamFinitePlayContract'
export type { FiniteTeamPlay, TeamPlayRole, TeamPlayCondition } from './teamFinitePlayContract'
export type TeamMechanismDirection = {
  status: 'conditional' | 'unresolved'
  primaryOutputAgentId: string | null
  evidenceRefs: string[]
  recipients: Array<{ providerAgentId: string; recipientAgentId: string; effectIdentity: string }>
  playability: FiniteTeamPlay | null
  variants: FiniteTeamPlay[]
  boundary: string
}
const rulesById = new Map(current31TeamEngineD1Pack.agentRules.map((r) => [r.agentId, r]))
const unique = (values: string[]) => [...new Set(values)]
function sourceRefs(member: Member) {
  const source = getCurrentAgentEventContract(member.agentId)!.source
  return [`${source.repository}@${source.commit}`, `${source.formulaPath}#${source.formulaSha256}`]
}
function actionLabel(member: Member, eventIds: string[]) {
  return planningEventDisplayLabel32(member.agentId, eventIds[0] ?? '') ?? '已核对的来源动作'
}
function ordinaryAction(member: Member) {
  // A declared ordinary buildup action is separate from an off-field charged
  // release. No ordinary anomaly, complete ownership, or proc rate is inferred.
  return (
    member.actionFacts.sourceActions.find(
      (action) =>
        action.anomalyBuildup > 0 &&
        action.execution !== 'background_trigger' &&
        !/charged|frostmoon|salchow|hold/i.test(action.actionId) &&
        ['basic', 'special', 'assist', 'dodge'].includes(action.skill),
    ) ?? null
  )
}

/** Identify a finite play for all three members. A single compatible buff is
 * insufficient. Unknown runtime states remain explicit conditions; this proves
 * a usable direction, never a tier, uptime, resource cycle or whole-team damage. */
export function resolveTeamMechanismDirection(
  memberIds: readonly string[],
  inputConditions?: TeamStrengthReferenceConditions,
): TeamMechanismDirection {
  const ids = [...memberIds].sort()
  const boundary =
    '条件玩法方向；满足列出的触发、资源与交接条件后采用。未评级，不代表循环频率或整队伤害排名。'
  const unresolved: TeamMechanismDirection = {
    status: 'unresolved',
    primaryOutputAgentId: null,
    evidenceRefs: [],
    recipients: [],
    playability: null,
    variants: [],
    boundary,
  }
  if (ids.length !== 3 || new Set(ids).size !== 3) return unresolved
  const members = ids.map((id) =>
    memberFacts(id, ids, resolveTeamStrengthReferencePotential(id, inputConditions)),
  )
  const rules = ids.map((id) => rulesById.get(id))
  if (members.some((m) => !m) || rules.some((r) => !r)) return unresolved
  const known = members.filter((m) => m !== null)
  const agents = rules.filter((r) => r !== undefined)
  const requestedConditions = inputConditions ?? currentTeamStrengthReferenceConditions(ids)
  const runtimeMembers = known.map((member) =>
    createTeamStrengthReferenceRuntimeMember(member.agentId, requestedConditions),
  )
  const conditions: TeamStrengthReferenceConditions = {
    ...requestedConditions,
    mindscapeByAgentId: Object.fromEntries(
      runtimeMembers.map((member) => [member.agentId, member.mindscape]),
    ),
    potentialByAgentId: Object.fromEntries(
      runtimeMembers
        .filter((member) => member.potential !== null)
        .map((member) => [member.agentId, member.potential as number]),
    ),
  }
  const context: TeamContext = {
    agents,
    producedTags: new Set(agents.flatMap((r) => r.produces)),
    agentStateById: Object.fromEntries(
      ids.map((id) => {
        const member = runtimeMembers.find((row) => row.agentId === id)!
        return [id, { mindscape: member.mindscape, potentialImage: member.potential }]
      }),
    ),
  }
  const abilities = new Map(
    agents.map((r) => [
      r.agentId,
      r.additionalAbility.status === 'none' ||
        (r.additionalAbility.status === 'modeled' &&
          evaluateTeamPredicate(r.additionalAbility.predicate, context)),
    ]),
  )
  const capacity = compatibleCapabilities(
    known,
    abilities,
    context,
    conditions.recipientContext,
    conditions,
    true,
  )
  // A rejected source slot does not invalidate other sourced roles of that actor.
  const declared = conditions.recipientContext?.primaryOutputAgentId
  const routes = new Map(
    known.map((member) => {
      const runtime = runtimeMembers.find((row) => row.agentId === member.agentId)!
      return [
        member.agentId,
        teamPlayOutputRoutes({
          member,
          memberIds: ids,
          teammates: known,
          mindscape: runtime.mindscape,
          potential: runtime.potential ?? null,
          abilityActive: abilities.get(member.agentId) === true,
          conditions,
        }),
      ]
    }),
  )
  const outputs = known
    .filter(
      (m) =>
        m.actionReady &&
        m.actionFacts.damage &&
        (declared ? m.agentId === declared : routes.get(m.agentId)!.length > 0),
    )
    .sort((a, b) => b.demand - a.demand || a.agentId.localeCompare(b.agentId))
  const variants: FiniteTeamPlay[] = []
  for (const primary of outputs) {
    // Receive buffs by the chosen action/scaling, including nonconventional carries.
    const primaryCapacity = ['support', 'defense'].includes(primary.specialty)
      ? compatibleCapabilities(
          known,
          abilities,
          context,
          { ...conditions.recipientContext, primaryOutputAgentId: primary.agentId },
          conditions,
          true,
        )
      : capacity
    for (const route of routes.get(primary.agentId)!) {
      const primaryAction = route.action
      const branchIdentity = primaryAction.sourceBranch
        ? stableContentHash({
            actionId: primaryAction.actionId,
            branchId: primaryAction.sourceBranch,
            events: primaryAction.eventIds,
            quantities: primaryAction.quantities,
            requirements: primaryAction.sourceRequirements ?? [],
            sequence: primaryAction.sourceSequence,
            sources: primaryAction.sourceRefs ?? [],
          })
        : null
      const outputSystem = route.system
      const roles: TeamPlayRole[] = [
        {
          agentId: primary.agentId,
          role: 'primary_output',
          purpose: `${getAgentName(primary.agentId)}承担本玩法的主要输出。`,
          eventIds: primaryAction.eventIds,
          sourceRefs: unique([...sourceRefs(primary), ...(primaryAction.sourceRefs ?? [])]),
        },
      ]
      const requirements: TeamPlayCondition[] = [
        {
          agentId: primary.agentId,
          kind: 'resource',
          label: `准备${getAgentName(primary.agentId)}所选输出动作的能量或专属资源；不预设连续施放次数。`,
          referenceKeys: branchIdentity ? [`source_action_branch:${branchIdentity}`] : [],
          sourceRefs: unique([...sourceRefs(primary), ...(primaryAction.sourceRefs ?? [])]),
        },
      ]
      for (const predicate of route.predicates)
        requirements.push({
          agentId: primary.agentId,
          kind: 'trigger',
          label: `${getAgentName(primary.agentId)}须满足所选输出动作的触发条件。`,
          referenceKeys: [predicate.effectKey, ...predicate.referenceKeys],
          sourceRefs: predicate.sourceRefs,
        })
      const tradeoffs: string[] = []
      const contributions: TeamPlayContribution[] = []
      // Reuse this historical action route only where the current source still
      // has the actual counter. It adds a conditional route, never a team tier.
      const ammoRoute = reusedDirections.records.find(
        (record) => record.claimId === 'miyoushe-55577682-zhu-yuan-koleda-lucy',
      )
      const zhu =
        primary.agentId === 'agent-zhu-yuan' ? getCurrentAgentEventContract(primary.agentId) : null
      const counter =
        zhu?.source.formulaSha256 ===
        'A85922CD98A29243BE040AC16D0F359A6D24147968BF9BAD8EF5391FE74DB640'
          ? zhu.eventContract.events.find(
              (event) => event.eventId === 'dodge.DodgeCounterFireBlast.hit-0',
            )
          : null
      if (ammoRoute?.source && counter) {
        roles[0]!.eventIds = unique([...roles[0]!.eventIds, counter.eventId])
        requirements.push({
          agentId: primary.agentId,
          kind: 'resource',
          label: '通过朱鸢闪避反击准备霰弹，再交接输出窗口。',
          referenceKeys: [],
          sourceRefs: [
            ...sourceRefs(primary),
            `${ammoRoute.source.url}#${ammoRoute.source.normalizedBodySha256}`,
          ],
        })
      }
      if (outputSystem === 'attribute_anomaly')
        requirements.push({
          agentId: primary.agentId,
          kind: 'original_anomaly',
          label: '目标须已有对应原异常，采用实际施加者的属性；追加结算仍需自身资源与触发动作。',
          referenceKeys: [],
          sourceRefs: sourceRefs(primary),
        })
      for (const member of known.filter((m) => m.agentId !== primary.agentId)) {
        const contacts = primaryCapacity.coverageEvidence.filter(
          (row) =>
            row.recipientAgentId === primary.agentId &&
            row.providerAgentId === member.agentId &&
            teamPlayContributionMatchesSystem(row.capability, outputSystem, primary, conditions),
        )
        const refs = sourceRefs(member)
        const support = resolveTeamPlaySupportContribution({
          memberIds: ids,
          members: runtimeMembers,
          providerAgentId: member.agentId,
          recipientAgentId: primary.agentId,
          contacts,
          conditions,
          sourceRefs: refs,
        })
        const background = teamPlayBackgroundEvidence(member)
        // A real background event remains a contribution even when the kit also buffs or stuns.
        if (background) {
          const eventIds = background.eventIds
          contributions.push({
            providerAgentId: member.agentId,
            recipientAgentId: primary.agentId,
            role: 'background_output',
            eventIds,
            effectKeys: support?.link.effectKeys ?? [],
            state: 'conditional',
            sourceRefs: unique([...background.sourceRefs, ...(support?.link.sourceRefs ?? [])]),
          })
          roles.push({
            agentId: member.agentId,
            role: 'background_output',
            purpose: `${getAgentName(member.agentId)}在后台配合${getAgentName(primary.agentId)}输出。`,
            eventIds,
            sourceRefs: background.sourceRefs,
          })
          requirements.push({
            agentId: member.agentId,
            kind: 'resource',
            label: `准备${getAgentName(member.agentId)}的后台动作，再由场上成员触发。`,
            referenceKeys: [...background.preparedConditions, ...(support?.referenceKeys ?? [])],
            sourceRefs: background.sourceRefs,
          })
          continue
        }
        const anomalyPreparation =
          member.specialty !== 'stun' &&
          (!support || support.link.effectKeys.every((key) => /:m[1-6](?:_|$)/i.test(key)))
            ? resolveOrdinaryAnomalyContribution({
                primary,
                member,
                abilityActive: abilities.get(primary.agentId) === true,
                mindscape: runtimeMembers.find((row) => row.agentId === primary.agentId)!.mindscape,
                conditions,
              })
            : null
        if (anomalyPreparation) {
          const eventIds = anomalyPreparation.action.eventIds
          const sourceRefs = unique([
            ...refs,
            ...anomalyPreparation.sourceRefs,
            ...(support?.link.sourceRefs ?? []),
          ])
          contributions.push({
            providerAgentId: member.agentId,
            recipientAgentId: primary.agentId,
            role: 'ordinary_anomaly',
            eventIds,
            effectKeys: support?.link.effectKeys ?? [],
            state: 'conditional',
            sourceRefs,
          })
          roles.push({
            agentId: member.agentId,
            role: 'ordinary_anomaly',
            purpose: `${getAgentName(member.agentId)}为${getAgentName(primary.agentId)}准备所需的原异常。`,
            eventIds,
            sourceRefs,
          })
          requirements.push(
            {
              agentId: member.agentId,
              kind: 'original_anomaly',
              label: '以实际积蓄动作形成所需异常，采用实际施加者的属性。',
              referenceKeys: eventIds,
              sourceRefs,
            },
            {
              agentId: member.agentId,
              kind: 'field_handoff',
              label: '完成异常积蓄后交还输出窗口。',
              referenceKeys: eventIds,
              sourceRefs,
            },
          )
          for (const predicate of anomalyPreparation.predicates)
            requirements.push({
              agentId: primary.agentId,
              kind: 'trigger',
              label: '满足原异常结算动作的触发条件。',
              referenceKeys: [predicate.effectKey, ...predicate.referenceKeys],
              sourceRefs: predicate.sourceRefs,
            })
          continue
        }
        if (support) {
          const stun = member.specialty === 'stun' ? member.actionFacts.stun : null
          const stunEvents = stun && stun.dazeMultiplier > 0 ? stun.eventIds : []
          const ordinary =
            outputSystem === 'attribute_anomaly' && member.specialty === 'anomaly'
              ? ordinaryAction(member)
              : null
          support.link.eventIds = ordinary?.eventIds ?? stunEvents
          if (stunEvents.length) {
            support.link.role = 'stun'
            support.link.state = 'conditional'
          } else if (ordinary) {
            support.link.role = 'ordinary_anomaly'
            support.link.state = 'conditional'
          }
          contributions.push(support.link)
          roles.push({
            agentId: member.agentId,
            role: support.link.role,
            purpose: `${getAgentName(member.agentId)}把已核对的增益交给${getAgentName(primary.agentId)}。${stunEvents.length ? '并以来源动作积累失衡，交接输出窗口。' : ordinary ? '短时切入用真实常规动作施加异常后交回站场；不预设紊乱次数。' : ''}`,
            eventIds: support.link.eventIds,
            sourceRefs: support.link.sourceRefs,
          })
          requirements.push(
            {
              agentId: member.agentId,
              kind: 'trigger',
              label: `先触发${getAgentName(member.agentId)}的支援效果，再由${getAgentName(primary.agentId)}在有效窗口内输出。`,
              referenceKeys: support.referenceKeys,
              sourceRefs: support.link.sourceRefs,
            },
            {
              agentId: member.agentId,
              kind: 'recipient',
              label: `${getAgentName(primary.agentId)}须实际接到增益；护盾或交接增益不默认覆盖全队。`,
              referenceKeys: [],
              sourceRefs: support.link.sourceRefs,
            },
          )
          if (stunEvents.length)
            requirements.push({
              agentId: member.agentId,
              kind: 'field_handoff',
              label: `${getAgentName(member.agentId)}实际积累失衡后交接；失衡期增益只在对应窗口采用，不预设整轮覆盖或次数。`,
              referenceKeys: [],
              sourceRefs: refs,
            })
          if (ordinary)
            requirements.push(
              {
                agentId: member.agentId,
                kind: 'original_anomaly',
                label: `${getAgentName(member.agentId)}须以常规积蓄动作实际形成目标异常；特殊脱手招式不自动替代。`,
                referenceKeys: [],
                sourceRefs: refs,
              },
              {
                agentId: member.agentId,
                kind: 'field_handoff',
                label: `为${getAgentName(member.agentId)}安排实际切入动作，再交还${getAgentName(primary.agentId)}；不同时占用完整站场。`,
                referenceKeys: [],
                sourceRefs: refs,
              },
            )
          continue
        }
        const stun = member.specialty === 'stun' ? member.actionFacts.stun : null
        if (stun && stun.dazeMultiplier > 0) {
          contributions.push({
            providerAgentId: member.agentId,
            recipientAgentId: primary.agentId,
            role: 'stun',
            eventIds: stun.eventIds,
            effectKeys: [],
            state: 'conditional',
            sourceRefs: refs,
          })
          roles.push({
            agentId: member.agentId,
            role: 'stun',
            purpose: `${getAgentName(member.agentId)}负责积累失衡并交出输出窗口。`,
            eventIds: stun.eventIds,
            sourceRefs: refs,
          })
          requirements.push({
            agentId: member.agentId,
            kind: 'field_handoff',
            label: `${getAgentName(member.agentId)}使用${actionLabel(member, stun.eventIds)}积累失衡，再切回${getAgentName(primary.agentId)}；未证明每轮失衡次数。`,
            referenceKeys: [],
            sourceRefs: refs,
          })
          tradeoffs.push('击破替补提供失衡方向，不继承另一名队友的减防、子弹或伤害增益。')
          continue
        }
        const ordinary = ordinaryAction(member)
        const differentAnomaly =
          primary.specialty === 'anomaly' &&
          member.specialty === 'anomaly' &&
          (member.agentId === 'agent-miyabi' ? 'frost' : member.attribute) !==
            (primary.agentId === 'agent-miyabi' ? 'frost' : primary.attribute)
        if (ordinary && differentAnomaly) {
          contributions.push({
            providerAgentId: member.agentId,
            recipientAgentId: primary.agentId,
            role: 'ordinary_anomaly',
            eventIds: ordinary.eventIds,
            effectKeys: [],
            state: 'conditional',
            sourceRefs: refs,
          })
          roles.push({
            agentId: member.agentId,
            role: 'ordinary_anomaly',
            purpose: `${getAgentName(member.agentId)}通过实际积蓄动作补充另一种异常。`,
            eventIds: ordinary.eventIds,
            sourceRefs: refs,
          })
          requirements.push(
            {
              agentId: member.agentId,
              kind: 'original_anomaly',
              label: `${getAgentName(member.agentId)}需实际打出${actionLabel(member, ordinary.eventIds)}并形成普通异常；仅离场蓄力释放不算自动触发。`,
              referenceKeys: [],
              sourceRefs: refs,
            },
            {
              agentId: member.agentId,
              kind: 'field_handoff',
              label: `${getAgentName(member.agentId)}短时上场后交回${getAgentName(primary.agentId)}，两人不同时按完整站场计算。`,
              referenceKeys: [],
              sourceRefs: refs,
            },
          )
          tradeoffs.push(
            '普通异常归属与触发次数需要实际状态；不把别的角色的专属紊乱或资源能力移给替补。',
          )
          continue
        }
        const primaryRule = rulesById.get(primary.agentId)!
        const abilityEffects = primaryCapacity.selfCoverageEvidence.filter(
          (row) =>
            row.providerAgentId === primary.agentId && row.effectIdentity.startsWith('ability_'),
        )
        if (
          abilityEffects.length &&
          primaryRule.additionalAbility.status === 'modeled' &&
          abilities.get(primary.agentId) &&
          !evaluateTeamPredicate(primaryRule.additionalAbility.predicate, {
            ...context,
            agents: agents.filter((r) => r.agentId !== member.agentId),
            producedTags: new Set(
              agents.filter((r) => r.agentId !== member.agentId).flatMap((r) => r.produces),
            ),
          }) &&
          member.actionFacts.damage &&
          member.actionReady
        ) {
          contributions.push({
            providerAgentId: member.agentId,
            recipientAgentId: primary.agentId,
            role: 'activation_partner',
            eventIds: member.actionFacts.damage.eventIds,
            effectKeys: unique(
              abilityEffects.map((effect) => `${primary.agentId}:${effect.effectIdentity}`),
            ),
            state: 'conditional',
            sourceRefs: [...refs, ...sourceRefs(primary)],
          })
          roles.push({
            agentId: member.agentId,
            role: 'activation_partner',
            purpose: `${getAgentName(member.agentId)}满足${getAgentName(primary.agentId)}实际依赖的搭档条件，并以分开的动作窗口参与。`,
            eventIds: member.actionFacts.damage.eventIds,
            sourceRefs: [...refs, ...sourceRefs(primary)],
          })
          requirements.push({
            agentId: member.agentId,
            kind: 'field_handoff',
            label: `${getAgentName(member.agentId)}与${getAgentName(primary.agentId)}分配独立操作窗口；不能同时按两人完整站场推算收益。`,
            referenceKeys: [],
            sourceRefs: [...refs, ...sourceRefs(primary)],
          })
        }
      }
      if (roles.length !== 3 || new Set(roles.map((role) => role.agentId)).size !== 3) continue
      const play: FiniteTeamPlay = {
        contract: finiteTeamPlayContract,
        memberIds: [...ids].sort(),
        primaryOutputAgentId: primary.agentId,
        outputSystem,
        roles,
        contributions,
        conditions: requirements,
        reason: roles.map((role) => role.purpose).join(''),
        tradeoffs: unique([
          ...tradeoffs,
          '这是有条件的搭配方向；与另一队的整队高低仍需同条件整体依据。',
        ]),
      }
      play.mechanismProof = compileTeamPlayMechanismProof(
        play,
        route,
        new Map(known.map((member) => [member.agentId, member])),
        conditions,
      )
      if (isCompleteFiniteTeamPlay(play, [...ids].sort().join('|'))) variants.push(play)
    }
  }
  const uniqueVariants = deduplicateTeamPlays(variants)
  // Preserve deliberate carry preference; hashing is identity, never a strength order.
  uniqueVariants.sort(
    (a, b) =>
      outputs.findIndex((m) => m.agentId === a.primaryOutputAgentId) -
        outputs.findIndex((m) => m.agentId === b.primaryOutputAgentId) ||
      routes.get(a.primaryOutputAgentId)!.findIndex((r) => r.system === a.outputSystem) -
        routes.get(b.primaryOutputAgentId)!.findIndex((r) => r.system === b.outputSystem),
  )
  const playability =
    uniqueVariants.find((play) => isAdmittedTeamPlay(play, ids.join('|'))) ?? uniqueVariants[0]
  if (!playability) return unresolved
  const recipients = playability.contributions.flatMap((link) =>
    link.effectKeys.map((key) => ({
      providerAgentId: link.providerAgentId,
      recipientAgentId: link.recipientAgentId,
      effectIdentity: key.startsWith(`${link.providerAgentId}:`)
        ? key.slice(link.providerAgentId.length + 1)
        : key,
    })),
  )
  return {
    status: 'conditional',
    primaryOutputAgentId: playability.primaryOutputAgentId,
    evidenceRefs: unique(playability.roles.flatMap((role) => role.sourceRefs)),
    recipients,
    playability,
    variants: uniqueVariants,
    boundary,
  }
}
