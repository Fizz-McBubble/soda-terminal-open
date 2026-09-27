import { resolveCurrent31BangbooVariant } from './current31TeamCoreAggregation'
import { current31LegacyTimingOracle } from './current31LegacyTimingOracle'

export const current31ReferencePerformancePilotContractId =
  'soda-current-3.1-reference-performance-pilot/v1' as const

const referenceBuild = Object.freeze({
  agentLevel: 60,
  sRankMindscape: 0,
  aRankMindscape: 6,
  coreSkillLevel: 7,
  regularSkillLevel: 12,
  wEnginePolicy: 'current_recommended_projection_p1_s_p5_a' as const,
  driveDiscPolicy: 'current_recommended_sets_main_stats_equal_substat_budget' as const,
  accountInventoryAuthority: false,
  boundary:
    'Reference Build 是版本比较假设，不读取玩家库存、已装备资产或培养投入；音擎使用推荐投影，不作为 BOX 库存事实。',
})

const referenceScenario = Object.freeze({
  durationSeconds: 30,
  enemyLevel: 70,
  resistance: 0.2,
  defense: 700,
  stunMultiplier: 1.5,
  vulnerability: 0,
  boundary: '中性单体比较场景只用于同 baseline 相对性能，不冒充 Shiyu/DA 实战分数或真实 DPS。',
})

type ReferencePerformancePilotRow = {
  caseId: string
  memberIds: readonly [string, string, string]
  status: 'partial' | 'complete'
  outputIndex: number | null
  build: typeof referenceBuild
  scenario: typeof referenceScenario
  identity: ReturnType<typeof resolveCurrent31BangbooVariant>
  bangboo: {
    status: 'selected' | 'recommendation_required'
    primaryBangbooId: string | null
    alternativeBangbooIds: readonly string[]
    inventoryAuthority: false
    missing: readonly string[]
  }
  rotation: {
    status: 'source_contract_required' | 'sequence_ready' | 'complete'
    evidenceRefs: readonly string[]
    actionSequence: readonly string[]
    sourceBackedFacts: readonly string[]
    missing: readonly string[]
  }
  legacyTimingDifferential:
    | (typeof current31LegacyTimingOracle.cases)['reference-zhu-yuan-qingyi-astra']
    | null
  explanation: string
}

function pilot(
  caseId: string,
  memberIds: readonly [string, string, string],
  rotationEvidenceRefs: readonly string[],
): ReferencePerformancePilotRow {
  const identity = resolveCurrent31BangbooVariant(memberIds, null)
  return {
    caseId,
    memberIds,
    status: 'partial' as const,
    outputIndex: null,
    build: referenceBuild,
    scenario: referenceScenario,
    identity,
    bangboo: {
      status: 'recommendation_required',
      primaryBangbooId: null,
      alternativeBangbooIds: [],
      inventoryAuthority: false,
      missing: ['source-backed current recommendation and Reference Performance binding'],
    },
    rotation: {
      status: 'source_contract_required' as const,
      evidenceRefs: rotationEvidenceRefs,
      actionSequence: [],
      sourceBackedFacts: [],
      missing: [
        'source-backed action occurrence and duration',
        'resource generation and consumption timeline',
        'conditional effect owner/recipient/snapshot window',
        'off-field/shared damage timing',
      ],
    },
    legacyTimingDifferential: null,
    explanation:
      '成员、统一构筑和场景假设已冻结；未闭合来源化 Reference Rotation 前不得生成 Output Index。',
  }
}

function sequenceReadyPilot(input: {
  caseId: string
  memberIds: readonly [string, string, string]
  rotationEvidenceRefs: readonly string[]
  actionSequence: readonly string[]
  sourceBackedFacts: readonly string[]
  missing: readonly string[]
  explanation: string
  bangbooId?: string
}): ReferencePerformancePilotRow {
  const row = pilot(input.caseId, input.memberIds, input.rotationEvidenceRefs)
  const identity = resolveCurrent31BangbooVariant(input.memberIds, input.bangbooId ?? null)
  return {
    ...row,
    identity,
    bangboo: input.bangbooId
      ? {
          status: 'selected',
          primaryBangbooId: input.bangbooId,
          alternativeBangbooIds: [],
          inventoryAuthority: false,
          missing: ['action occurrence, condition and damage timing in Reference Rotation'],
        }
      : row.bangboo,
    rotation: {
      status: 'sequence_ready',
      evidenceRefs: row.rotation.evidenceRefs,
      actionSequence: input.actionSequence,
      sourceBackedFacts: input.sourceBackedFacts,
      missing: input.missing,
    },
    explanation: input.explanation,
  }
}

function yeDialynZhaoPilot(): ReferencePerformancePilotRow {
  return sequenceReadyPilot({
    caseId: 'reference-ye-dialyn-zhao',
    memberIds: ['agent-ye-shunguang', 'agent-dialyn', 'agent-zhao'],
    rotationEvidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/ye-shunguang',
      'https://www.prydwen.gg/zenless/characters/dialyn',
      'https://www.prydwen.gg/zenless/characters/zhao',
      'https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-teams',
    ],
    actionSequence: [
      'Zhao cycle Frostbite Points and activate Ether Veil: Wellspring before the critical burst window',
      'Dialyn use EX Special Rock, Scissors and Paper to maintain Overwhelmingly Positive and apply Malicious Complaint',
      'Ye Shunguang build 6 Qingming Sword Force with Basics, Dodge Counters and normal EX Special as available',
      'Dialyn reach at least 90 Positive Reviews before Stun',
      'Dialyn hold Basic for EX Special: Get Lost! to open the Chain window',
      'Switch to Ye Shunguang so the converted Chain Attack becomes Ultimate: Chasing Storms',
      'Ye Shunguang use Sunderlight Annihilation, Sunderlight Maximum and Soaring Light',
      'Repeat Sunderlight Annihilation, Sunderlight Maximum and Soaring Light',
      'Ye Shunguang finish with Return to Dust or Cleaving Heavens',
    ],
    sourceBackedFacts: [
      'Ye Shunguang short Enlightened Mind combo and six-point entry requirement',
      'Dialyn Rock/Scissors/Paper setup, 90 Positive Reviews threshold and Ultimate conversion route',
      'Zhao Ether Veil maintenance, low field-time role and Ye Shunguang best-in-slot synergy',
    ],
    missing: [
      'current 3.1 action duration for all three agents',
      'conditional effect owner/recipient/snapshot window at action boundaries',
      'Zhao Final Verdict and other off-field/shared damage timing',
    ],
    explanation:
      '当前来源已闭合资源准备、Dialyn 转换链与叶瞬光短爆发顺序；缺少动作时长和场外伤害落点，仍不得生成 Output Index。',
    bangbooId: 'bangboo-sprout',
  })
}

function yeSunnaZhaoPilot(): ReferencePerformancePilotRow {
  return sequenceReadyPilot({
    caseId: 'reference-ye-sunna-zhao',
    memberIds: ['agent-ye-shunguang', 'agent-sunna', 'agent-zhao'],
    rotationEvidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/ye-shunguang',
      'https://www.prydwen.gg/zenless/characters/sunna',
      'https://www.prydwen.gg/zenless/characters/zhao',
      'https://www.icy-veins.com/zenless-zone-zero/ye-shunguang-teams',
    ],
    actionSequence: [
      'Sunna use Bubblegum Barrage to apply Angelic Chord-ination',
      'Sunna use Special Photography Technique to activate Ether Veil: Delusion Reprise',
      'Swap to Ye Shunguang to trigger Cat’s Gaze and receive Ether Veil Sword Force generation',
      'Zhao cycle Frostbite Points and activate Ether Veil: Wellspring before the critical burst window',
      'Ye Shunguang build or receive 6 Qingming Sword Force and enter Enlightened Mind',
      'Ye Shunguang use Sunderlight Annihilation, Sunderlight Maximum and Soaring Light',
      'Repeat Sunderlight Annihilation, Sunderlight Maximum and Soaring Light',
      'Ye Shunguang finish with Return to Dust or Cleaving Heavens',
      'Sunna refresh Moonlight Lullaby with EX Special within 25 seconds',
    ],
    sourceBackedFacts: [
      'Ye Shunguang short Enlightened Mind combo and six-point entry requirement',
      'Sunna two-step Ether Veil activation, attacker swap and 25-second refresh cadence',
      'Sunna and Zhao each activate Ether Veils that supply Ye Shunguang Sword Force',
      'Zhao maintains Ether Veil with low field-time commitment',
    ],
    missing: [
      'current 3.1 action duration for all three agents',
      'conditional effect owner/recipient/snapshot window at action boundaries',
      'Sunna Cat’s Gaze, Bubblegum and Zhao Final Verdict shared damage timing',
    ],
    explanation:
      '当前来源已闭合双 Ether Veil 维护、叶瞬光资源进入与短爆发顺序；缺少动作时长和共享伤害落点，仍不得生成 Output Index。',
    bangbooId: 'bangboo-sprout',
  })
}

function yixuanJuFufuLuciaPilot(): ReferencePerformancePilotRow {
  const row = pilot(
    'reference-yixuan-ju-fufu-lucia',
    ['agent-yixuan', 'agent-ju-fufu', 'agent-lucia'],
    [
      'https://www.prydwen.gg/zenless/characters/yixuan',
      'https://www.prydwen.gg/zenless/characters/ju-fufu',
      'https://www.prydwen.gg/zenless/characters/lucia',
      'https://www.icy-veins.com/zenless-zone-zero/yixuan-teams',
      'https://github.com/ZSim-Dev/ZSim/tree/e248e9f149a6b889290579d8e673e132be9bde31',
    ],
  )
  return {
    ...row,
    rotation: {
      status: 'sequence_ready',
      evidenceRefs: row.rotation.evidenceRefs,
      actionSequence: [
        'Lucia maintain Dream state and Ether Veil; refresh EX within 25 seconds',
        'Ju Fufu use EX or Ultimate out of Stun at the documented Might breakpoint, then swap cancel',
        'Yixuan enter Stun with at least 90–100 Adrenaline',
        'Yixuan Cloud-Shaper',
        'Yixuan Ultimate: Endless Talisman Suppression with Chain Trigger Tech',
        'Ju Fufu Chain Attack for King of the Summit',
        'Yixuan Chain Attack',
        'Yixuan Ultimate: Qingming Skyshade',
        'Yixuan Cloud-Shaper',
        'Yixuan Cloud-Shaper',
      ],
      sourceBackedFacts: [
        'Yixuan burst ordering and 90–100 Adrenaline pre-Stun threshold',
        'Ju Fufu off-field Daze role and EX/Ultimate Might breakpoints outside Stun',
        'Lucia Dream/Ether Veil maintenance and EX refresh within 25 seconds',
        'ZSim provides legacy 60 tick/s Yixuan action timing for differential checks only',
      ],
      missing: [
        'current 3.1 action duration for Ju Fufu and Lucia and cross-version validation for Yixuan',
        'conditional effect owner/recipient/snapshot window at action boundaries',
        'Hu Wei and other off-field/shared damage timing',
      ],
    },
    explanation:
      '来源已闭合爆发顺序、资源阈值与维护职责；缺少可比较持续时间和场外伤害落点，仍不得生成 Output Index。',
  }
}

function zhuYuanQingyiAstraPilot(): ReferencePerformancePilotRow {
  const row = sequenceReadyPilot({
    caseId: 'reference-zhu-yuan-qingyi-astra',
    memberIds: ['agent-zhu-yuan', 'agent-qingyi', 'agent-astra'],
    rotationEvidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/zhu-yuan',
      'https://www.prydwen.gg/zenless/characters/qingyi',
      'https://www.prydwen.gg/zenless/characters/astra-yao',
      'https://www.icy-veins.com/zenless-zone-zero/zhu-yuan-teams',
      'https://github.com/ZSim-Dev/ZSim/tree/e248e9f149a6b889290579d8e673e132be9bde31',
    ],
    actionSequence: [
      'Astra Yao use Special Attack to enter Idyllic Cadenza, then Quick Assist to Qingyi',
      'Qingyi build Voltage with EX Special and Basic Attack: Penultimate P3/P4',
      'Qingyi consume at least 75 Voltage with the full Enchanted Moonlit Blossoms sequence to apply Subjugation and open Stun',
      'Use Astra Yao Chain Attack or Ultimate when available and preserve Idyllic Cadenza through the burst window',
      'Zhu Yuan enter Stun with 5–9 Enhanced Shotshells and enough Decibels for the planned Ultimate route',
      'Zhu Yuan use Chain Attack or Ultimate to enter Suppressive Mode without the preparation flip',
      'Zhu Yuan spend shells with Suppressive B1, B2, B3 and side Dash Attack loops',
      'Use EX Special, Chain Attack or Ultimate to replenish three shells before the next Suppressive sequence',
    ],
    sourceBackedFacts: [
      'Qingyi full enhanced charged Basic requires at least 75 Voltage and is the primary Subjugation/Stun setup',
      'Astra Yao enters Idyllic Cadenza with Special, supplies Quick Assists and can convert two post-Ultimate assists into Chain Attacks',
      'Zhu Yuan should enter Stun with stored Shotshells and unload them through Suppressive Basics and Dash loops',
      'Icy Veins 3.1 review identifies Qingyi as a valid Stunner, Astra as a valid Support and Resonaboo as the Zhu Yuan Ether Bangboo',
      'ZSim has specialized implementations for all three agents, but no exact Zhu Yuan–Qingyi–Astra APL',
    ],
    missing: [
      'current 3.1 cross-version validation for ZSim action durations and skill semantics',
      'source-backed exact three-agent APL and resource timeline for the 30-second baseline',
      'Astra Yao buff and double-Chain action-boundary snapshot windows',
      'Resonaboo action occurrence, activation and damage timing in the Reference Rotation',
    ],
    explanation:
      '公开攻略已闭合三人的职责、入失衡资源、青衣击破顺序、耀嘉音维持和朱鸢爆发顺序；ZSim 提供三名成员的旧版本 differential capability，但没有精确三人 APL、3.1 时长复验或邦布事件，因此仍不得生成 Output Index。',
    bangbooId: 'bangboo-resonaboo',
  })
  return {
    ...row,
    legacyTimingDifferential: current31LegacyTimingOracle.cases['reference-zhu-yuan-qingyi-astra'],
  }
}

function miyabiNangongYuzuhaPilot(): ReferencePerformancePilotRow {
  return sequenceReadyPilot({
    caseId: 'reference-miyabi-nangong-yuzuha',
    memberIds: ['agent-miyabi', 'agent-nangong', 'agent-yuzuha'],
    rotationEvidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/miyabi',
      'https://www.prydwen.gg/zenless/characters/nangong-yu',
      'https://www.prydwen.gg/zenless/characters/ukinami-yuzuha',
      'https://www.icy-veins.com/zenless-zone-zero/hoshimi-miyabi-teams',
    ],
    actionSequence: [
      'Yuzuha use Defensive Assist or Tanuki Cloak Parry, then Stuffed Hard Candy Shot',
      'Yuzuha use EX Special or Ultimate to apply Sweet Scare, then Quick Assist to Miyabi',
      'Miyabi use EX Special into Kazahana P3, P4 and P5 to build Frost Anomaly and Fallen Frost',
      'Use Miyabi fully charged Shimotsuki when 6 Fallen Frost are available',
      'Nangong Yu use EX Special or Adorable Explosive Impact to maintain the team DMG buff and build Daze',
      'Nangong Yu apply Misstep with the third charged Basic hit before opening Stun',
      'After Stun, use Nangong Yu free EX or precise charged heavy hit against the Anomaly-afflicted enemy to trigger Polarity Disorder',
      'Quick Assist back to Miyabi and spend 6 Fallen Frost on fully charged Shimotsuki during Stun',
      'Use Miyabi Ultimate during Stun, then convert its 3 Fallen Frost with EX and Frost Basics into the next fully charged Shimotsuki',
      'Refresh Yuzuha through Defensive Assist or Parry into EX or Ultimate before her 40-second buff boundary',
    ],
    sourceBackedFacts: [
      'Miyabi needs 6 Fallen Frost for fully charged Shimotsuki and gains resources from EX, Frostburn and squad Disorder',
      'Yuzuha refreshes her off-field support through Assist or Parry into EX or Ultimate and Quick Assist, with a 40-second maintenance boundary',
      'Nangong Yu builds Downbeats, applies Misstep, opens Stun and can trigger Polarity Disorder without clearing the existing Anomaly',
      'Icy Veins identifies Miyabi, Nangong Yu and Yuzuha as the premiere Miyabi team and attributes the fit to extra Disorder, Fallen Frost and team buffs',
    ],
    missing: [
      'source-backed exact 30-second three-agent resource timeline and action durations',
      'Miyabi Frostburn, Nangong Yu Polarity Disorder and Yuzuha buff snapshot windows at action boundaries',
      'Yuzuha Flavor Match off-field attack occurrence and shared damage timing',
      'Biggest Fan action occurrence, activation and damage timing in the Reference Rotation',
    ],
    explanation:
      '当前来源已闭合三人的资源职责、Yuzuha 维护、Nangong Yu 失衡与 Polarity Disorder、Miyabi 满层爆发顺序；缺少统一 30 秒时间线、效果快照、场外伤害和邦布事件，因此仍不得生成 Output Index。',
    bangbooId: 'bangboo-biggest-fan',
  })
}

function ariaNangongSunnaPilot(): ReferencePerformancePilotRow {
  return sequenceReadyPilot({
    caseId: 'reference-aria-nangong-sunna',
    memberIds: ['agent-aria', 'agent-nangong', 'agent-sunna'],
    rotationEvidenceRefs: [
      'https://www.prydwen.gg/zenless/characters/aria',
      'https://www.prydwen.gg/zenless/characters/nangong-yu',
      'https://www.prydwen.gg/zenless/characters/sunna',
      'https://www.icy-veins.com/zenless-zone-zero/aria-teams',
    ],
    actionSequence: [
      'Sunna use EX Special to apply Angelic Chord-ination, activate Ether Veil and set up Cat’s Gaze, then Quick Assist to Aria',
      'Aria use Basic Attack P4, alternate Special or EX Special to build at least 4 Fandom Power before Stun',
      'Aria maintain Ether Anomaly on the target while using Level 3 Perfect Pitch only when an existing Anomaly can trigger Abloom',
      'Nangong Yu use EX Special or Adorable Explosive Impact to maintain the team DMG buff and build Daze',
      'Nangong Yu apply Misstep with the third charged Basic hit and open Stun on the Anomaly-afflicted target',
      'Use Nangong Yu free EX or precise charged heavy hit to consume Dance Prowess, trigger Polarity Disorder and Quick Assist to Aria',
      'Use Aria Chain Attack when offered to gain 4 Fandom Power and reinforce Ether Anomaly buildup',
      'Aria use Ultimate during Stun to activate Ether Veil, enter the 15-second Moment of Delusion and gain 3 All-Out Cheering stacks',
      'Aria spend All-Out Cheering on repeated Level 3 Perfect Pitch attacks to trigger stun-amplified Abloom',
      'Use Aria EX or Chain to restore Fandom Power as needed and refresh Sunna before the next burst window',
    ],
    sourceBackedFacts: [
      'Aria should hold at least 4 Fandom Power before Stun, then use Ultimate and repeated enhanced Basics during the burst window',
      'Level 3 Perfect Pitch triggers Abloom only against an existing Attribute Anomaly and gains a higher ratio while the target is Stunned',
      'Sunna supplies ATK, Ether Veil and Cat’s Gaze while Aria remains the primary on-field agent',
      'Nangong Yu supplies Anomaly-focused buffs, Misstep, Stun and Polarity Disorder without clearing the existing Anomaly',
      'Icy Veins lists Aria, Nangong Yu and Sunna together and recommends Biggest Fan for Angels of Delusion teams',
    ],
    missing: [
      'source-backed exact 30-second three-agent resource timeline and action durations',
      'Aria Corruption, Moment of Delusion, Abloom and Nangong Yu Polarity Disorder snapshot windows at action boundaries',
      'Sunna Cat’s Gaze and Bubblegum off-field occurrence, owner attribution and shared damage timing',
      'Biggest Fan ATK, healing and Ether Anomaly event timing in the Reference Rotation',
    ],
    explanation:
      '当前来源已闭合 Aria 失衡前资源、失衡期 Ultimate/Perfect Pitch、Sunna 支援与南宫羽击破/Polarity Disorder 职责；缺少统一 30 秒时间线、效果快照、场外伤害和邦布事件，因此仍不得生成 Output Index。',
    bangbooId: 'bangboo-biggest-fan',
  })
}

const rows = [
  yeDialynZhaoPilot(),
  yeSunnaZhaoPilot(),
  pilot(
    'reference-yixuan-dialyn-lucia',
    ['agent-yixuan', 'agent-dialyn', 'agent-lucia'],
    [
      'https://www.prydwen.gg/zenless/characters/yixuan',
      'https://www.icy-veins.com/zenless-zone-zero/yixuan-teams',
    ],
  ),
  yixuanJuFufuLuciaPilot(),
  pilot(
    'reference-remielle-aria-velina',
    ['agent-remielle', 'agent-aria', 'agent-velina'],
    [
      'https://www.prydwen.gg/zenless/characters/remielle',
      'https://www.icy-veins.com/zenless-zone-zero/velina-teams',
    ],
  ),
  pilot(
    'reference-remielle-promeia-velina',
    ['agent-remielle', 'agent-promeia', 'agent-velina'],
    [
      'https://www.prydwen.gg/zenless/characters/remielle',
      'https://www.icy-veins.com/zenless-zone-zero/velina-teams',
    ],
  ),
  ariaNangongSunnaPilot(),
  miyabiNangongYuzuhaPilot(),
  pilot(
    'reference-sigrid-norma-sunna',
    ['agent-sigrid', 'agent-norma', 'agent-sunna'],
    [
      'https://www.prydwen.gg/zenless/characters/sigrid',
      'https://www.icy-veins.com/zenless-zone-zero/sigrid-teams',
    ],
  ),
  zhuYuanQingyiAstraPilot(),
] as const

const inputCoverageRows = rows.map((row) => {
  const checks = Object.freeze({
    exactAgentVariant: row.identity.exactAgentVariantId !== null,
    referenceBuildFrozen: true,
    referenceScenarioFrozen: true,
    actionSequenceSourceBacked: row.rotation.status !== 'source_contract_required',
    resourceTimelineComplete: false,
    actionDurationComplete: false,
    effectWindowComplete: false,
    offFieldAndSharedDamageTimingComplete: false,
  })
  const completedInputCount = Object.values(checks).filter(Boolean).length
  const requiredInputCount = Object.keys(checks).length
  return Object.freeze({
    caseId: row.caseId,
    exactAgentVariantId: row.identity.exactAgentVariantId,
    bangbooVariantId: row.identity.bangbooVariantId,
    checks,
    completedInputCount,
    requiredInputCount,
    coverageRatio: completedInputCount / requiredInputCount,
    referencePerformanceEligible: completedInputCount === requiredInputCount,
  })
})

const inputCoverageTotals = Object.freeze({
  exactAgentVariant: inputCoverageRows.filter((row) => row.checks.exactAgentVariant).length,
  referenceBuildFrozen: inputCoverageRows.filter((row) => row.checks.referenceBuildFrozen).length,
  referenceScenarioFrozen: inputCoverageRows.filter((row) => row.checks.referenceScenarioFrozen)
    .length,
  actionSequenceSourceBacked: inputCoverageRows.filter(
    (row) => row.checks.actionSequenceSourceBacked,
  ).length,
  resourceTimelineComplete: inputCoverageRows.filter((row) => row.checks.resourceTimelineComplete)
    .length,
  actionDurationComplete: inputCoverageRows.filter((row) => row.checks.actionDurationComplete)
    .length,
  effectWindowComplete: inputCoverageRows.filter((row) => row.checks.effectWindowComplete).length,
  offFieldAndSharedDamageTimingComplete: inputCoverageRows.filter(
    (row) => row.checks.offFieldAndSharedDamageTimingComplete,
  ).length,
})

export const current31ReferencePerformancePilot = Object.freeze({
  contract: current31ReferencePerformancePilotContractId,
  gameVersion: '3.1',
  referenceBuild,
  referenceScenario,
  rows,
  pilotCaseCount: rows.length,
  completeCaseCount: rows.filter((row) => row.status === 'complete').length,
  sequenceReadyCaseCount: rows.filter((row) => row.rotation.status === 'sequence_ready').length,
  bangbooBoundCaseCount: rows.filter((row) => row.bangboo.status === 'selected').length,
  inputCoverage: Object.freeze({
    requiredInputsPerCase: 8,
    rows: Object.freeze(inputCoverageRows),
    totals: inputCoverageTotals,
  }),
  boundary:
    '三人参考表现只检查构筑、场景、资源、动作和效果窗口；邦布选择与事件不参与三人完成度或评级。来源化轮转未闭合时保持数值为空。',
})
