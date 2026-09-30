import type { CurrentAgentEventContract } from '../calculation/currentAgentMechanicContracts'
import type { CandidateWarehouseConstraint } from '../gameDataPacks/candidateWarehouseConstraints'
import { stableContentHash } from '../gameDataPacks/types'
import { getL3AgentDevelopmentEvidence } from '../gameDataPacks/l3ProductionProjection'

export type RetentionActionTag = 'basic' | 'dash' | 'aftershock'
export type RetentionActionFact = {
  actorAgentId: string
  actionTag: RetentionActionTag
  presence: 'present' | 'absent' | 'unresolved'
  condition: {
    kind: 'source_rotation'
    predicateId: string
    binding: 'reviewed_build' | 'unresolved'
  } | null
  currentBuildBenefit: 'primary' | 'incidental' | 'unresolved'
  sourceIds: string[]
  sourceEvents: readonly string[]
}

/**
 * Reviewed emitted-action classification, frozen to the adopted upstream sheets.
 * Review included registerAllDmgDazeAndAnom's default classification and every
 * override/custom damage call, not the runtime catalog's unclassified action names.
 * char/util.ts:223-294 sha256=6278397afa6c5b5f65a15bdadd16037b67b997dffb2bf66289d63634bec49a3d.
 * Stub sheets (TODO: Add conditionals) are deliberately absent: unknown is a gap.
 * These facts support Candidate use only; they are not a Formal event compiler.
 */
const reviewedSheets: readonly (readonly [string, string, readonly string[]])[] = [
  ['Alice', '8387F008FE972025AC5FAE619EBD40F8971119568C4DEA0048D798E0241F82E5', []],
  ['Anby', '881DD011DD730A4383421A8E754C0F7479A4ACE549F214BC025DF416CC8F6CE8', []],
  ['Anton', 'B121F7C2FE9C3CB57C4008FFC64C7070EC208E2614CD6A1998D0F455E8BB6221', []],
  ['AstraYao', 'C56619ADA67799562AB8E48CB15419421B1C15DB7AE49E04C9E6D302802C5846', []],
  ['Banyue', 'F559CE817A8CC1B3A7448AF42C9DBCFF17DABBBA96C6B410CFC9FA72858E92F8', []],
  ['Ben', '395B208714B28F4B9FCDDCC6FD328424443E8AC42147D1E4DD68569E0E3A7FDF', []],
  ['Billy', '91202DCC7AAE626B739B6657EA903BF83C9C9FFBE353F0442C2D01B3F1FF240E', []],
  ['Burnice', '8A46BA0B3E268C6C2E67C2029E0FA293D3C7C97718BC2063D43FB29EB81D2B3C', []],
  ['Caesar', '3F8882797C2D056CB9548B431209D6535C1B4BB3E3435D305C3C970EAF241125', []],
  ['Corin', '92F8EB727836FD7769F645BEBC1F52A71D11753F955770C5B40A06A7E96D51AD', []],
  ['Dialyn', 'AA6BA963833BFFC7B82C29A6EF227209E80FCD57E7FF98F6AAD2055ACA68982C', []],
  ['Ellen', '7A1328E91BA4A4A28C23EF3994FEAB43B171D4E2A66CF550A5929CF2ACAE93DC', []],
  ['Evelyn', '7D2BD8C861236682C919DC504875A1B7A72AD035F71BC85A5E3BCD9E396C89BB', []],
  ['Grace', '2B4F04621AD8FDCAB017BF64CC071EDCCFADEDC56F10E0DB358664A909B14461', []],
  ['Harumasa', '4C8F30B7DF979ED13A05CE49D74C896B14C90BAEA13CCC392142903318ADD616', []],
  ['Hugo', '492F1CB66EFC2725530C6DF376068D19449EFC6835DEC894865BABA5835B5EB5', []],
  ['Jane', '95F6A36CB88F44EA406EF193DE3D0CF295498F693561D717A3B270D34D5F55E8', []],
  [
    'JuFufu',
    'AD33CBC292233EA3D57921C0667CC327F368876133A7C29D76D8917E8D6C3B51',
    ['ChainAttackSuppressingTigerCauldron'],
  ],
  ['Koleda', 'F28E07A151F48A4944BBEE2972B0B481F726970D58505A543EFCE289A6BD1692', []],
  ['Lighter', '4AE8698C1FF65B9A4B56CF89024DF3CA9D3D9061912455A4FDBB6F977938182A', []],
  [
    'Lucia',
    'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
    ['BasicAttackOrbitalCombo', 'SpecialAttackSymphonyOfTheReaperStorm', 'QuickAssistCrushingMist'],
  ],
  ['Lucy', '7B7964B69D7D18A4EAD0914B2DA83915EC4DE5BB795098F078EA9A381DE5B903', []],
  ['Lycaon', '693E61F9CF5C463C1BDAE3F655052691275C8CB60AD50D5F7EB43EF09E4300D9', []],
  ['Manato', '173273745E9E88E9261C54634A71652BC760573A64F99AE0BCEFEFAF0814A3F0', []],
  ['Miyabi', 'C66845D0F933FDC24071201EB6CE6895CADF3FEEF0AFBADECE18AB4574F419C1', []],
  ['Nekomata', 'C411CB4139307402CDCC0F39C9B5E41E0A76E1BA3F88E0F1746DB454B807D5D9', []],
  ['Nicole', '0BEDD990502F54EAA094997FE1998A0B50C7B9C5924D0F4A18C433FCC93A880C', []],
  [
    'OrphieMagus',
    'A1F61932E1812E23C8E22490CFA3EEF69AEA01B6FD0136A54EA334FB57D0C1C0',
    [
      'BasicAttackHighPressureFlamethrower',
      'SpecialAttackCorrosiveFlash',
      'EXSpecialAttackWatchYourStep',
      'EXSpecialAttackCrimsonVortex',
      'EXSpecialAttackHeatCharge',
      'EXSpecialAttackFieryEruption',
      'ChainAttackOverheatedBarrel',
      'UltimateDanceWithFire',
      'm6_dmg',
    ],
  ],
  ['PanYinhu', 'CF1E27AAA6504E5C4150961E397FE93DB293FCEA2D6AE2470A600217F00228B5', []],
  ['Piper', '60DDAFBEAA464E353248940F38D6678CEF97AA0C192A3B8B287AC36642C3ECA8', []],
  [
    'Pulchra',
    '136C36B91C1E06975759E9C89F7A2D8B4B994588FF2AD607514F56A4F6B8027A',
    ['SpecialAttackRendingClawNightmareShadow'],
  ],
  ['Qingyi', 'C0BD406F2AE6972D70B4D2695CEBC7CAA16F7032AE0CBD86E8447C312EEF926D', []],
  ['Rina', '25E6A6BCB84531FF113484E1C16C2262B60D05A49D97FC51A6AA5158D98A4225', []],
  ['Seed', 'C3D0F2FDB79246956BCFED93B6B57AFA570D081B519EFBB8CAD2451A85656708', []],
  ['Seth', '499F9B3BE93358AE03618096258CC6FCB1E95E3AEEAE4052F27C3DEF436FDCD6', []],
  [
    'Soldier0Anby',
    '15E220B7933E2A50257119248DCC3F0A7F8564A708AEFB1AD826763A04979D6E',
    [
      'ChainAttackLeapingThunderstrike_aftershock0',
      'UltimateVoidstrike_aftershock0',
      'm6_additional_dmg',
    ],
  ],
  ['Soldier11', '9A8250B8F3803FF3E2BE223353663A5FD0FC8A2E1022EEFD09D49A8966509313', []],
  ['Soukaku', '2BC7C02BCB4AA77F80E173A3D11B8371198E73D8024D3D98C8A31F5814D5D2CB', []],
  [
    'Trigger',
    'C24093AAEF041B0CA582F19729665387060E64C6CDDC9DAF7B338DA37075B0A6',
    ['BasicAttackHarmonizingShot', 'BasicAttackHarmonizingShotTartarus'],
  ],
  ['Vivian', '89933DF78C2479BAEAD0CF1EC9100332815D549C7DBAB5DFC911EA896392500E', []],
  ['Yanagi', '5FFF32C390B426C1CAFF95FDD0EE6C744EF8D2FDCBD3A7F24D378C2EDEB921A2', []],
  ['Yidhari', 'B5DD737E76A5D0363C89206EF32CF138AE1371451E82625F218909A563EBE301', []],
  ['Yixuan', '43F11850985726682A1076704F9B0E9ACF3172F18AE4B76DE2AF4B16E3F28E80', []],
  [
    'Yuzuha',
    '61F637F03E82BCE0B22F1FE85D3EEB4BD9ACA00B0787C74137F3ED94737CA8F6',
    ['BasicAttackHardCandyShot'],
  ],
  ['ZhuYuan', 'A85922CD98A29243BE040AC16D0F359A6D24147968BF9BAD8EF5391FE74DB640', []],
]

const reviewedCommit = 'eabba1f092b282cccb3f028b7253a1db3dac5208'

type BuildFocus = {
  action: RetentionActionTag | readonly RetentionActionTag[]
  conditionId: string
  directionHash: string
  sourceId: string
  sourceHash: string
  sourceEvents: readonly string[]
  mechanicRecord?: { id: string; value: string }
}

/** Source-specific semantic reviews. Neither set identity nor skill-order keywords
 * can create a focus. Matching the actor, immutable mechanic sheet and the exact
 * adopted direction/source is required. Reworded/new directions need a new review.
 */
const buildFocus: Readonly<Record<string, BuildFocus>> = {
  'agent-ellen': {
    action: 'basic',
    conditionId: 'flash_freeze_charge_consuming_basic',
    directionHash: 'fnv1a-f977d11a',
    sourceId: 'build-knowledge-v1a-4da5be63',
    sourceHash: 'fnv1a-82f867ff',
    sourceEvents: ['BasicAttackFlashFreezeTrimming'],
  },
  'agent-soldier-11': {
    action: 'basic',
    conditionId: 'fire_suppression_timed_basic_or_guaranteed_window',
    directionHash: 'fnv1a-f977d11a',
    sourceId: 'build-knowledge-v1a-995584ec',
    sourceHash: 'fnv1a-ad78e6bc',
    sourceEvents: ['BasicAttackFireSuppression'],
  },
  'agent-billy': {
    action: 'basic',
    conditionId: 'crouching_shot_state',
    directionHash: 'fnv1a-f977d11a',
    sourceId: 'build-knowledge-v1a-9de0377e',
    sourceHash: 'fnv1a-4afcec5',
    sourceEvents: ['BasicAttackFullFirepower'],
  },
  'agent-zhu-yuan': {
    action: 'basic',
    conditionId: 'suppression_mode_enhanced_shotshells',
    directionHash: 'fnv1a-98ada80',
    sourceId: 'miyoushe-post-55577767-structured-skill-section',
    sourceHash: 'C894052D2E92B70B444D720383828B66E294A429FC33F8537BE6AF2707822AA9',
    sourceEvents: ['BasicAttackPleaseDoNotResist'],
  },
  'agent-harumasa': {
    action: 'dash',
    conditionId: 'awakened_xmark_two_electro_prison',
    directionHash: 'fnv1a-e58cf198',
    sourceId: 'prydwen-harumasa-page-candidate',
    sourceHash: 'fnv1a-804fbde4',
    sourceEvents: ['DashAttackHitenNoTsuruSlash'],
  },
  'agent-soldier-0-anby': {
    action: 'aftershock',
    conditionId: 'silver_star_white_thunder_build_rotation',
    directionHash: 'fnv1a-da9ecb6f',
    sourceId: 'miyoushe-post-62601775-structured-skill-section',
    sourceHash: '5F6EAEDB36C6B0393CAF12B3DF3BBD16C2AF9093B71F0907BF339ECE577FE3F2',
    sourceEvents: ['SpecialAttackAzureFlash', 'SpecialAttackThunderSmite'],
    mechanicRecord: {
      id: 'ENTITY_FACTS:fact-soldier-0-anby-formula-family:mechanics.formula_family:batch-agents-1.6-r3l',
      value: 'silver_star_white_thunder_aftershock',
    },
  },
  'agent-trigger': {
    // The frozen source explicitly tags Harmonizing Shot as BOTH basic and aftershock.
    action: ['basic', 'aftershock'],
    conditionId: 'purge_off_field_harmonizing_shot',
    directionHash: 'fnv1a-ebf82d91',
    sourceId: 'prydwen-trigger-page-candidate',
    sourceHash: 'fnv1a-63235fc',
    sourceEvents: ['BasicAttackHarmonizingShot', 'BasicAttackHarmonizingShotTartarus'],
  },
  'agent-orphie-magus': {
    action: 'aftershock',
    conditionId: 'bottled_heat100_heat_charge',
    directionHash: 'fnv1a-aaff0a8f',
    sourceId: 'prydwen-orphie-magus-page-candidate',
    sourceHash: 'fnv1a-1736e0d',
    sourceEvents: ['EXSpecialAttackHeatCharge'],
  },
  'agent-seed': {
    action: 'basic',
    conditionId: 'steel_charge_downfall_rotation',
    directionHash: 'fnv1a-e3c4c44e',
    sourceId: 'miyoushe-2.7-post-74590835-skills-image-002',
    sourceHash: 'E9D56E4CC2ADB0F6FEC9C30731F5ABF52E618E6C337EFDC434F01C20B36DFCCB',
    sourceEvents: [
      'BasicAttackFallingPetalsDownfallFirstForm',
      'BasicAttackFallingPetalsDownfallSecondForm',
    ],
  },
}

export function resolveRetentionActionFact(
  actionTag: RetentionActionTag,
  actorAgentId: string,
  constraint: CandidateWarehouseConstraint,
  contract: CurrentAgentEventContract | null,
): RetentionActionFact {
  const fact: RetentionActionFact = {
    actorAgentId,
    actionTag,
    presence: 'unresolved',
    condition: null,
    currentBuildBenefit: 'unresolved',
    sourceIds: [],
    sourceEvents: [],
  }
  if (!contract || contract.stableId !== actorAgentId) return fact
  const sheet = reviewedSheets.find(
    ([key, hash]) =>
      contract.upstreamKey === key &&
      contract.source.formulaSha256 === hash &&
      contract.source.commit === reviewedCommit &&
      contract.source.repository === 'https://github.com/frzyc/genshin-optimizer' &&
      contract.source.formulaPath === `libs/zzz/formula/src/data/char/sheets/${key}.ts`,
  )
  // A stale reviewed sheet cannot prove incidental utility any more than it
  // can prove a primary use. Preserve the gap for every affected action family.
  if (!sheet && reviewedSheets.some(([key]) => key === contract.upstreamKey)) return fact
  if (contract.source.commit !== reviewedCommit) return fact
  const sourceId = `${contract.source.repository}:${contract.source.commit}:${contract.source.formulaPath}:${contract.source.formulaSha256}`
  fact.sourceIds = [sourceId]
  if (sheet)
    fact.sourceIds.push(
      `${contract.source.repository}:${reviewedCommit}:libs/zzz/formula/src/data/char/util.ts:6278397afa6c5b5f65a15bdadd16037b67b997dffb2bf66289d63634bec49a3d:reviewed-emitted-action-classification`,
    )
  if (actionTag === 'aftershock') {
    if (!sheet) return fact
    fact.sourceEvents = sheet[2]
    fact.presence = sheet[2].length ? 'present' : 'absent'
    if (fact.presence === 'absent') return fact
    fact.condition = {
      kind: 'source_rotation',
      predicateId: 'source_tagged_actions_used',
      binding: 'unresolved',
    }
  } else {
    const events = contract.eventContract.events.filter((event) =>
      actionTag === 'basic' ? event.skill === 'basic' : event.actionId.startsWith('DashAttack'),
    )
    if (!events.length) return fact
    fact.presence = 'present'
    fact.sourceEvents = events.map((event) => event.eventId)
    fact.currentBuildBenefit = 'incidental'
  }
  const focus = buildFocus[actorAgentId]
  const requiredRecord = focus?.mechanicRecord
  const adoption = requiredRecord ? getL3AgentDevelopmentEvidence(actorAgentId) : null
  const mechanicRecord = requiredRecord
    ? [...(adoption?.verifiedFacts ?? []), ...(adoption?.candidateFacts ?? [])].find(
        (record) => record.recordId === requiredRecord.id && record.value === requiredRecord.value,
      )
    : null
  if (
    sheet &&
    focus &&
    (Array.isArray(focus.action) ? focus.action.includes(actionTag) : focus.action === actionTag) &&
    (!focus.mechanicRecord || mechanicRecord) &&
    stableContentHash(constraint.progressionDirection) === focus.directionHash &&
    constraint.sources.some(
      (source) =>
        source.verified && source.id === focus.sourceId && source.contentHash === focus.sourceHash,
    ) &&
    focus.sourceEvents.every((actionId) =>
      contract.eventContract.events.some((event) => event.actionId === actionId),
    )
  ) {
    fact.currentBuildBenefit = 'primary'
    fact.condition = {
      kind: 'source_rotation',
      predicateId: focus.conditionId,
      binding: 'reviewed_build',
    }
    fact.sourceIds.push(`${focus.sourceId}:${focus.sourceHash}:reviewed-action-focus`)
    if (mechanicRecord && adoption)
      fact.sourceIds.push(
        `${adoption.packageId}:${mechanicRecord.recordId}`,
        ...mechanicRecord.sourceIds,
      )
  }
  return fact
}
