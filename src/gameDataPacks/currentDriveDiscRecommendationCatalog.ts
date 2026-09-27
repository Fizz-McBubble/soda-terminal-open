import { driveDiscData } from '../data/gameData'
import { gameData31CatalogEntities, scannerDriveDiscCatalog31 } from './gameData31CatalogIntake'
import {
  gameData31RemielleEquipmentIntake,
  getRemielleEquipmentField,
} from './gameData31RemielleEquipmentIntake'
import { stableContentHash } from './types'

export type CurrentDriveDiscRecommendationEntry = {
  id: string
  name: string
  englishName?: string
  aliases: readonly string[]
  twoPieceEffect: string
  fourPieceEffect: string
  version: string
  evidence: 'formal' | 'candidate'
  source: {
    refs: readonly string[]
    contentHashes: readonly string[]
  }
}

const formalSource = {
  refs: driveDiscData?.sources.map((source) => source.id) ?? [],
  contentHashes: driveDiscData?.contentHash ? [driveDiscData.contentHash] : [],
}

const formalEntries: CurrentDriveDiscRecommendationEntry[] = (
  driveDiscData?.driveDiscSets ?? []
).map((set) => ({ ...set, evidence: 'formal' as const, source: formalSource }))

function remielleFieldValue(path: string) {
  return getRemielleEquipmentField(path)?.value
}

function currentCandidateEntry(id: string) {
  return gameData31CatalogEntities.find(
    (entry) => entry.domain === 'drive_disc_set' && entry.identity.projectStableId === id,
  )
}

function sourceForCandidate(id: string, remiellePaths: readonly string[] = []) {
  const candidate = currentCandidateEntry(id)
  const fields = remiellePaths
    .map(getRemielleEquipmentField)
    .filter((field): field is NonNullable<typeof field> => Boolean(field))
  const sourceById = new Map(
    gameData31RemielleEquipmentIntake.sources.map((source) => [source.id, source]),
  )
  const refs = (
    fields.length ? fields.flatMap((field) => field.sourceRefs) : [candidate?.source.id]
  ).filter((ref): ref is string => Boolean(ref))
  return {
    refs: [...new Set(refs)],
    contentHashes: [
      ...new Set(
        (fields.length
          ? refs.map((ref) => sourceById.get(ref)?.contentIdentityHash)
          : [candidate?.source.contentHash]
        ).filter((hash): hash is string => Boolean(hash)),
      ),
    ],
  }
}

function candidateEffects(id: string) {
  if (id === 'set-34100') {
    const twoPiece = remielleFieldValue('set-34100.effect.two_piece') as
      | { anomalyProficiency?: unknown }
      | undefined
    const fourPiece = remielleFieldValue('set-34100.effect.four_piece') as
      | {
          anomalyProficiency?: unknown
          lumifluxAnomalyDamagePercent?: unknown
          durationSeconds?: unknown
          offFieldRetention?: unknown
          trigger?: unknown
        }
      | undefined
    const two =
      typeof twoPiece?.anomalyProficiency === 'number'
        ? `异常精通提升${twoPiece.anomalyProficiency}点。`
        : '2件套效果资料待补齐。'
    const triggerConfirmed =
      Array.isArray(fourPiece?.trigger) &&
      fourPiece.trigger.length === 2 &&
      fourPiece.trigger.includes('enter_field') &&
      fourPiece.trigger.includes('switch_to_active')
    if (!triggerConfirmed)
      return {
        twoPieceEffect: two,
        fourPieceEffect: '4件套触发条件待核对。',
        source: sourceForCandidate(id, [
          'set-34100.effect.two_piece',
          'set-34100.effect.four_piece',
        ]),
      }
    const parts = [
      '进场或切换至前场时',
      typeof fourPiece?.anomalyProficiency === 'number'
        ? `异常精通提升${fourPiece.anomalyProficiency}点`
        : null,
      typeof fourPiece?.lumifluxAnomalyDamagePercent === 'number'
        ? `辉光属性异常伤害提升${fourPiece.lumifluxAnomalyDamagePercent}%`
        : null,
      typeof fourPiece?.durationSeconds === 'number' ? `持续${fourPiece.durationSeconds}秒` : null,
      fourPiece?.offFieldRetention === 'always' ? '后台保留' : null,
    ].filter((part): part is string => Boolean(part))
    return {
      twoPieceEffect: two,
      fourPieceEffect: parts.length ? `${parts.join('；')}。` : '4件套效果资料待补齐。',
      source: sourceForCandidate(id, ['set-34100.effect.two_piece', 'set-34100.effect.four_piece']),
    }
  }

  if (id === 'set-34200') {
    const source = currentCandidateEntry(id)
    const hasReviewedEffects =
      source?.fields.twoPiece === 'defense +16%' &&
      source.fields.fourPiece ===
        'four_piece: common_damage +15%; initial_defense >=1000 => crit_rate +8%; initial_defense >=1800 => crit_rate +16%'
    return {
      twoPieceEffect: hasReviewedEffects ? '防御力提升16%。' : '2件套效果资料待补齐。',
      fourPieceEffect: hasReviewedEffects
        ? '造成的伤害提升15%；初始防御力达到1000/1800时，暴击率提升8%/16%。'
        : '4件套效果资料待补齐。',
      source: sourceForCandidate(id),
    }
  }

  return {
    twoPieceEffect: '2件套效果资料待补齐。',
    fourPieceEffect: '4件套效果资料待补齐。',
    source: sourceForCandidate(id),
  }
}

const candidateEntries: CurrentDriveDiscRecommendationEntry[] = scannerDriveDiscCatalog31
  .filter((set): set is typeof set & { id: string } => Boolean(set.id))
  .filter((set) => !formalEntries.some((formal) => formal.id === set.id))
  .flatMap((set) => {
    const source = currentCandidateEntry(set.id)
    if (!source) return []
    return [
      {
        id: set.id,
        name: String(set.name),
        aliases: set.aliases,
        version: set.version,
        evidence: 'candidate' as const,
        ...candidateEffects(set.id),
      },
    ]
  })

/**
 * The read-only recommendation directory: all released identities that may be
 * named by a candidate plan. Candidate effects stay outside the frozen formal
 * import manifest and never elevate a calculation to Formal.
 */
export const currentDriveDiscRecommendationCatalog = [...formalEntries, ...candidateEntries]

export const currentDriveDiscRecommendationCatalogIdentity = {
  contract: 'soda-current-drive-disc-recommendation-catalog/v1' as const,
  formalCount: formalEntries.length,
  candidateCount: candidateEntries.length,
  contentHash: stableContentHash(currentDriveDiscRecommendationCatalog),
}

const byId = new Map(currentDriveDiscRecommendationCatalog.map((entry) => [entry.id, entry]))

export function getCurrentDriveDiscRecommendation(id: string) {
  return byId.get(id) ?? null
}
