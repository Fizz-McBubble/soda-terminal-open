import rawDriveDiscData from '../data/drive-disc-data.v1.json'
import { planningStaticTwoPieceModifiers } from '../calculation/planningStaticModifierAuthority'
import { currentWEnginePassiveAdapterIds } from '../calculation/currentWEnginePassiveAdapters'
import { current31TeamEngineD1Pack } from '../teamEngine/current31D1Pack'
import { currentAssetProjection, type CurrentAssetProjectionEntry } from './currentAssetProjection'
import { gameData31CatalogEntities } from './gameData31CatalogIntake'
import { getL3NoncharacterMiyousheCandidateSidecar } from './l3ProductionProjection'
import { currentPanelData } from './panel/currentPanelData'
import { knightsExtolmentCompatibilitySource } from '../upstream/genshinOptimizer/zzzWEngineKnightsExtolmentCompat'
import { getCurrentWEngineStaticData } from './currentWEngineStaticCatalog'
import { getCurrentDriveDiscFormulaData } from './currentDriveDiscFormulaCatalog'
import { getCurrentBangbooNumericData } from './currentBangbooNumericCatalog'
import { currentBangbooMechanicContractIds } from '../calculation/currentBangbooMechanicContracts'
import { currentFormulaDriveDiscFourPieceContractIds } from '../calculation/currentFormulaMechanicContracts'

export type NonAgentFieldStatus = 'ready' | 'candidate' | 'missing_after_reuse'

export type NonAgentFieldAssessment = {
  status: NonAgentFieldStatus
  authority: string
}

export type NonAgentCompletenessRow = {
  stableId: string
  playerName: string
  fields: Readonly<Record<string, NonAgentFieldAssessment>>
  complete: boolean
}

const ready = (authority: string): NonAgentFieldAssessment => ({ status: 'ready', authority })
const candidate = (authority: string): NonAgentFieldAssessment => ({
  status: 'candidate',
  authority,
})
const missing = (authority: string): NonAgentFieldAssessment => ({
  status: 'missing_after_reuse',
  authority,
})

const candidateByStableId = new Map(
  gameData31CatalogEntities.flatMap((entity) =>
    entity.identity.projectStableId ? [[entity.identity.projectStableId, entity] as const] : [],
  ),
)
const driveDiscRules = new Map(rawDriveDiscData.driveDiscSets.map((set) => [set.id, set]))
const bangbooRules = new Map(
  current31TeamEngineD1Pack.bangbooRules.map((rule) => [rule.bangbooId, rule]),
)
const wEnginePassiveAdapters = new Set<string>(currentWEnginePassiveAdapterIds)
const bangbooMechanicContracts = new Set<string>(currentBangbooMechanicContractIds)
const driveDiscFourPieceContracts = new Set<string>(currentFormulaDriveDiscFourPieceContractIds)

const promotedSourceFactFields = new Set([
  'wengine-14159:identity',
  'wengine-14159:release',
  'wengine-14159:rarityAndSpecialty',
  'wengine-14158:identity',
  'wengine-14158:release',
  'wengine-14158:rarityAndSpecialty',
  'bangboo-ariel:identity',
  'bangboo-ariel:release',
  'bangboo-ariel:rarity',
  'set-34100:identity',
  'set-34100:release',
  'set-34100:twoPieceEffect',
  'set-34100:fourPieceEffect',
  'set-34200:identity',
  'set-34200:release',
  'set-34200:twoPieceEffect',
  'set-34200:fourPieceEffect',
])

function promoted(stableId: string, fieldId: string, fallback: NonAgentFieldAssessment) {
  return promotedSourceFactFields.has(`${stableId}:${fieldId}`)
    ? ready('current-3.1-phase-ii/locked-catalog-cross-authority')
    : fallback
}

function identityField(entry: CurrentAssetProjectionEntry) {
  return entry.evidence === 'formal'
    ? ready('currentAssetProjection/formal-L3')
    : candidate('gameData31CatalogIntake/current-candidate')
}

function releaseField(entry: CurrentAssetProjectionEntry) {
  return entry.evidence === 'formal'
    ? ready('assetSourceLedger/currentAssetProjection')
    : candidate('currentScopeManifest/gameData31CatalogIntake')
}

function mediaField(entry: CurrentAssetProjectionEntry) {
  return entry.media.status === 'available_not_cached'
    ? ready('visualAssets/official-personal-cache')
    : entry.media.status === 'redistribution_license_unconfirmed'
      ? candidate('source-reference-present/license-unconfirmed')
      : missing('visualAssets/manifest-missing')
}

function complete(fields: Readonly<Record<string, NonAgentFieldAssessment>>) {
  return Object.values(fields).every((field) => field.status === 'ready')
}

const wEngines: NonAgentCompletenessRow[] = currentAssetProjection.wEngines.map((entry) => {
  const panel = currentPanelData.wEngines[entry.stableId]
  const isKnightsExtolment = entry.stableId === knightsExtolmentCompatibilitySource.stableId
  const hasLocalPassiveAdapter = wEnginePassiveAdapters.has(entry.stableId)
  const staticData = getCurrentWEngineStaticData(entry.stableId)
  const intake = candidateByStableId.get(entry.stableId)
  const sidecarFacts = getL3NoncharacterMiyousheCandidateSidecar(entry.stableId)
  const sidecarPassiveFacts = sidecarFacts.filter((fact) => fact.fieldPath.startsWith('passive.'))
  const hasCandidateStaticStats =
    typeof intake?.fields.baseAtkLv60 === 'number' &&
    (typeof intake.fields.critDamagePercentLv60 === 'number' ||
      typeof intake.fields.secondaryStat === 'string')
  const hasCandidatePassive =
    typeof intake?.fields.passiveP1 === 'string' &&
    (typeof intake.fields.passiveRefinementCritDamagePercent === 'string' ||
      typeof intake.fields.passiveP2ToP4 === 'string')
  const passiveCandidateAuthority = hasCandidatePassive
    ? 'gameData31CatalogIntake/upstream-cross-check'
    : 'l3NoncharacterMiyousheSidecar/passive-facts'
  const fields = {
    identity: promoted(entry.stableId, 'identity', identityField(entry)),
    release: promoted(entry.stableId, 'release', releaseField(entry)),
    rarityAndSpecialty:
      entry.rarity && entry.specialty
        ? promoted(entry.stableId, 'rarityAndSpecialty', identityField(entry))
        : missing('rarity-or-specialty-not-resolved'),
    level60StaticStats: staticData
      ? ready('currentWEngineStaticCatalog/locked-upstream')
      : panel
        ? ready('panel/currentPanelData')
        : hasCandidateStaticStats
          ? candidate('gameData31CatalogIntake/upstream-cross-check')
          : missing('no-current-static-stat-authority'),
    passiveP1ToP5: staticData
      ? ready('currentWEngineStaticCatalog/P1-P5-parameter-table')
      : hasCandidatePassive || sidecarPassiveFacts.length > 0
        ? candidate(passiveCandidateAuthority)
        : missing('no-current-passive-authority'),
    triggerContract: isKnightsExtolment
      ? ready('upstream/genshinOptimizer/zzzWEngineKnightsExtolmentCompat')
      : hasLocalPassiveAdapter
        ? ready('calculation/currentWEnginePassiveAdapters')
        : staticData?.formulaAdoption.status === 'wrap_or_adapt'
          ? candidate('locked-upstream-formula-sheet/local-adapter-pending')
          : hasCandidatePassive || sidecarPassiveFacts.length > 0
            ? candidate(passiveCandidateAuthority)
            : missing('no-executable-trigger-contract'),
    media: mediaField(entry),
    calculationAdapter: isKnightsExtolment
      ? ready('upstream/genshinOptimizer/zzzWEngineKnightsExtolmentCompat')
      : hasLocalPassiveAdapter
        ? ready('calculation/currentWEnginePassiveAdapters')
        : staticData?.formulaAdoption.status === 'wrap_or_adapt'
          ? candidate('locked-upstream-formula-sheet/local-adapter-pending')
          : missing('no-full-wengine-passive-adapter-registry'),
  }
  return {
    stableId: entry.stableId,
    playerName: entry.playerName,
    fields,
    complete: complete(fields),
  }
})

const bangboos: NonAgentCompletenessRow[] = currentAssetProjection.bangboos.map((entry) => {
  const rule = bangbooRules.get(entry.stableId)
  const isAmillion = entry.stableId === 'bangboo-amillion'
  const hasMechanicContract = bangbooMechanicContracts.has(entry.stableId)
  const numericData = getCurrentBangbooNumericData(entry.stableId)
  const sidecarFacts = getL3NoncharacterMiyousheCandidateSidecar(entry.stableId)
  const hasCandidateSuitability = sidecarFacts.some(
    (fact) => fact.fieldPath === 'recommendation.context',
  )
  const fields = {
    identity: promoted(entry.stableId, 'identity', identityField(entry)),
    release: promoted(entry.stableId, 'release', releaseField(entry)),
    rarity: entry.rarity
      ? promoted(entry.stableId, 'rarity', identityField(entry))
      : missing('rarity-not-resolved'),
    level60StatCurve: isAmillion
      ? ready('upstream/genshinOptimizer/zzzBangbooAmillionCompat')
      : numericData
        ? ready('gameDataPacks/currentBangbooNumericCatalog/stat-curve')
        : missing('no-current-bangboo-stat-curve'),
    activeAndChainMultipliers: isAmillion
      ? ready('upstream/genshinOptimizer/zzzBangbooAmillionCompat')
      : numericData
        ? ready('gameDataPacks/currentBangbooNumericCatalog/skill-properties')
        : missing('no-current-bangboo-skill-multipliers'),
    activation: hasMechanicContract
      ? ready('calculation/currentBangbooMechanicContracts/composition-gates')
      : rule?.activation.status === 'modeled'
        ? ready('teamEngine/current31D1Pack')
        : rule
          ? candidate('teamEngine/current31D1Pack/unknown-activation')
          : missing('no-current-bangboo-rule'),
    suitability: hasMechanicContract
      ? ready('calculation/currentBangbooMechanicContracts/composition-requirements')
      : rule?.suitability.status === 'modeled'
        ? ready('teamEngine/current31D1Pack')
        : rule
          ? candidate('teamEngine/current31D1Pack/unknown-suitability')
          : hasCandidateSuitability
            ? candidate('l3NoncharacterMiyousheSidecar/recommendation-context')
            : missing('no-current-bangboo-suitability'),
    media: mediaField(entry),
    calculationAdapter: hasMechanicContract
      ? ready('calculation/currentBangbooMechanicContracts')
      : isAmillion
        ? ready('calculation/planningCunningHaresP0')
        : numericData
          ? candidate('numeric-resolver-ready/semantic-effect-adapter-pending')
          : missing('no-current-bangboo-calculation-adapter'),
  }
  return {
    stableId: entry.stableId,
    playerName: entry.playerName,
    fields,
    complete: complete(fields),
  }
})

const driveDiscSets: NonAgentCompletenessRow[] = currentAssetProjection.driveDiscSets.map(
  (entry) => {
    const legacyRule = driveDiscRules.get(entry.stableId)
    const intake = candidateByStableId.get(entry.stableId)
    const hasCandidateEffects =
      typeof intake?.fields.twoPiece === 'string' && typeof intake.fields.fourPiece === 'string'
    const formulaData = getCurrentDriveDiscFormulaData(entry.stableId)
    const twoPieceAdapter =
      Boolean(formulaData) || entry.stableId in planningStaticTwoPieceModifiers
    const fourPieceAdapter = driveDiscFourPieceContracts.has(entry.stableId)
    const fields = {
      identity: promoted(entry.stableId, 'identity', identityField(entry)),
      release: promoted(entry.stableId, 'release', releaseField(entry)),
      twoPieceEffect: legacyRule?.twoPieceEffect
        ? ready('data/drive-disc-data.v1.json')
        : hasCandidateEffects
          ? promoted(
              entry.stableId,
              'twoPieceEffect',
              candidate('gameData31CatalogIntake/current-candidate'),
            )
          : missing('no-current-two-piece-effect'),
      fourPieceEffect: legacyRule?.fourPieceEffect
        ? ready('data/drive-disc-data.v1.json')
        : hasCandidateEffects
          ? promoted(
              entry.stableId,
              'fourPieceEffect',
              candidate('gameData31CatalogIntake/current-candidate'),
            )
          : missing('no-current-four-piece-effect'),
      twoPieceCalculationAdapter: twoPieceAdapter
        ? ready('gameDataPacks/currentDriveDiscFormulaCatalog/two-piece-resolver')
        : missing('no-current-two-piece-calculation-adapter'),
      fourPieceTriggerContract: fourPieceAdapter
        ? ready('calculation/currentFormulaMechanicContracts/four-piece')
        : formulaData
          ? candidate('locked-upstream-formula-sheet/local-four-piece-adapter-pending')
          : missing('no-current-four-piece-trigger-contract'),
      media: mediaField(entry),
    }
    return {
      stableId: entry.stableId,
      playerName: entry.playerName,
      fields,
      complete: complete(fields),
    }
  },
)

function summarize(rows: readonly NonAgentCompletenessRow[]) {
  const fields = rows.flatMap((row) => Object.values(row.fields))
  return {
    entities: rows.length,
    requiredFields: fields.length,
    readyFields: fields.filter((field) => field.status === 'ready').length,
    candidateFields: fields.filter((field) => field.status === 'candidate').length,
    missingAfterReuseFields: fields.filter((field) => field.status === 'missing_after_reuse')
      .length,
    completeEntities: rows.filter((row) => row.complete).length,
  }
}

export const currentNonAgentFieldCompletenessMatrix = {
  contract: 'soda-n4-non-agent-field-completeness/v1',
  gameVersion: currentAssetProjection.gameVersion,
  rows: { wEngines, bangboos, driveDiscSets },
  summary: {
    wEngines: summarize(wEngines),
    bangboos: summarize(bangboos),
    driveDiscSets: summarize(driveDiscSets),
  },
  complete: [...wEngines, ...bangboos, ...driveDiscSets].every((row) => row.complete),
  boundary:
    '这是字段级历史审计分母，不是单一 data completeness。candidate 必须按 source authority、mechanic、formula/operator、entity calculation 或 production governance 重新归属；missing_after_reuse 也只有在 Source Fact 层复核后才能称 Source Gap。N4 现行解释见 currentN4LayeredCoverage。',
} as const
