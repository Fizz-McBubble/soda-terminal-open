import { getCurrentDriveDiscFormulaData } from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { getCurrentFormulaContractRequirements } from './currentFormulaMechanicContracts'
import { reviewedDriveDiscSemanticsIdentity32 as identity } from './reviewedDriveDiscSemanticsIdentity32'
import type {
  PlanningConditionCatalogInput32,
  PlanningConditionProjection32,
} from './currentPlanningConditionCatalog32'

export type DriveDiscFormulaRuntime32 = {
  flags?: Readonly<Record<string, boolean>>
  numbers?: Readonly<Record<string, number>>
  accumulators?: Readonly<Record<string, number>>
}
export type DriveDiscEventRuntimeBinding32 = {
  providerAgentId: string
  setId: string
  runtime: DriveDiscFormulaRuntime32
}
const labels: Record<string, string> = {
  'KingOfTheSummit:launchExSpecialOrChain':
    '山大王：穿戴者施放强化特殊技或连携技后的15秒增益仍有效',
  'AstralVoice:astral': '静听嘉音：当前15秒内有效的星语层数',
  'AstralVoice:eligible_event_owner':
    '静听嘉音：这次伤害的角色经快速支援入场，且15秒受益效果仍有效',
  'MoonlightLullaby:exSpecial_ult_used':
    '月光骑士颂：穿戴者施放强化特殊技或终结技后的25秒增益仍有效',
  'SwingJazz:chain_or_ult': '摇滚爵士：穿戴者施放连携技或终结技后的12秒增益仍有效',
  'ProtoPunk:def_assist_or_evasive_assist':
    '原始朋克：队员发动防御支援或回避支援后的10秒增益仍有效',
}
const repository = 'https://github.com/frzyc/genshin-optimizer'
export function getReviewedDriveDiscSource32(setId: string) {
  const pin = identity.sources[setId as keyof typeof identity.sources]
  const source = getCurrentDriveDiscFormulaData(setId)
  return pin && source?.upstreamKey === pin.key && source.fourPieceFormula.sha256 === pin.sha256
    ? { pin, source }
    : null
}

/** Vocabulary depends on actual four-piece wearers; two-piece bonuses are panel operands. */
export function appendReviewedDriveDiscConditions32(
  result: PlanningConditionProjection32,
  input: PlanningConditionCatalogInput32,
) {
  for (const equipped of input.equippedDriveDiscs ?? []) {
    if (equipped.pieces < 4 || !(equipped.setId in identity.sources)) continue
    const bound = getReviewedDriveDiscSource32(equipped.setId)
    const requirements = getCurrentFormulaContractRequirements('drive_disc', equipped.setId)
    if (!input.memberIds.includes(equipped.providerAgentId) || !bound || !requirements) {
      result.blockers.push(`四件套条件来源或真实穿戴者不匹配：${equipped.setId}`)
      continue
    }
    const sourceRefs = [
      `${repository}@${identity.commit}`,
      `${bound.source.fourPieceFormula.path}#sha256=${bound.pin.sha256}`,
      `libs/zzz/formula/src/meta/disc/${bound.pin.key}/conditionals.ts#sha256=${bound.pin.conditionalsSha256}`,
      `libs/zzz/dm-localization/assets/locales/en/disc_${bound.pin.key}_gen.json#sha256=${bound.pin.localizationSha256}`,
      identity.revision,
    ]
    const references = [
      ...requirements.flags.filter((ref) => !ref.startsWith('eq:own.char.')),
      ...requirements.accumulators,
      ...(equipped.setId === 'set-astral-voice' ? ['AstralVoice:eligible_event_owner'] : []),
    ]
    for (const ref of references) {
      if (!labels[ref]) {
        result.blockers.push(`四件套条件尚未审核：${equipped.setId}/${ref}`)
        continue
      }
      const stack = ref === 'AstralVoice:astral'
      const referenceKey = `disc:${equipped.setId}:${ref}`
      if (
        result.defs.some(
          (row) =>
            row.providerAgentId === equipped.providerAgentId && row.referenceKey === referenceKey,
        )
      ) {
        result.blockers.push(`重复的四件套穿戴绑定：${equipped.providerAgentId}/${equipped.setId}`)
        continue
      }
      result.defs.push({
        providerAgentId: equipped.providerAgentId,
        referenceKey,
        label: labels[ref],
        valueKind: stack ? 'number' : 'boolean',
        ...(stack ? { minimum: 0, maximum: 3 } : {}),
        sourceRefs,
      })
      result.evidence.push({
        providerAgentId: equipped.providerAgentId,
        referenceKey,
        discSetId: equipped.setId,
        runtimeReference: ref,
        unit: stack ? 'integer_stack' : 'boolean_state',
        integerOnly: stack,
        meaning: labels[ref],
        effectKeys: [`disc:${equipped.setId}:four-piece`],
        eventScopes: [],
        sourceRefs,
      })
    }
  }
}

/** No unknown condition is turned into an inactive trigger. */
export function bindDeclaredDriveDiscRuntime32(
  bindings: readonly DriveDiscEventRuntimeBinding32[],
  providerAgentId: string,
  setId: string,
) {
  const matches = bindings.filter(
    (row) => row.providerAgentId === providerAgentId && row.setId === setId,
  )
  return matches.length === 1 ? matches[0]!.runtime : null
}
