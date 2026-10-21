import type { ReviewedTeamOutputModuleEvidence } from './reviewedTeamOutputModuleEvidence'
import { reviewedHoyoBuildCurrentTeams32 } from './reviewedHoyoBuildCurrentTeams32'
import { teamOutputModules, type TeamOutputModuleSourceEvidence } from './teamOutputModuleContract'

function sourceEvidence(id: string, text: string): TeamOutputModuleSourceEvidence {
  const source = reviewedHoyoBuildCurrentTeams32.entries
    .flatMap((entry) => entry.sourceRefs)
    .find((candidate) => candidate.id === id)
  if (!source) throw new Error(`Missing reviewed HoyoBuild source ${id}.`)
  return {
    sourceId: source.id,
    sourceVersion: source.sourceVersion,
    contentHash: source.contentHash,
    locator: `${source.url}#${source.locator}`,
    text,
  }
}

export const reviewedHoyoBuildCurrentOutputModules32 = [
  {
    memberIds: ['agent-promeia', 'agent-nicole', 'agent-soukaku'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyAbloom,
      id: 'module-promeia-nicole-soukaku-abloom-support',
      reactionMechanisms: ['abloom'],
      executionChannels: ['quick_swap'],
      teamFunctions: ['support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-promeia-32-budget-nicole-soukaku',
        "Nicole's DEF Shred is easy to line up with Promeia's quick Abloom bursts, and Soukaku buffs ATK and Ice DMG.",
      ),
    ],
  },
  {
    memberIds: ['agent-aria', 'agent-nangong', 'agent-sunna'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyAbloom,
      id: 'module-aria-nangong-sunna-abloom-stun-ether-veil',
      executionChannels: ['stun_window', 'quick_swap'],
      teamFunctions: ['stun', 'support', 'ether_veil'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-aria-32-angels-nangong-sunna',
        'Sunna refreshes Ether Veils, buffs her with Cat’s Gaze and raises the Stun DMG Multiplier, and Nangong brings Daze and buffs.',
      ),
    ],
  },
  {
    memberIds: ['agent-aria', 'agent-anby', 'agent-nicole'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyAbloom,
      id: 'module-aria-anby-nicole-abloom-stun',
      executionChannels: ['stun_window', 'quick_swap'],
      teamFunctions: ['stun', 'support', 'ether_veil'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-aria-32-f2p-anby-nicole',
        'Anby provides the Stuns she needs and Nicole shares her Ether attribute and shreds DEF.',
      ),
    ],
  },
  {
    memberIds: ['agent-alice', 'agent-corin', 'agent-nicole'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyPolarity,
      id: 'module-alice-corin-nicole-polarity',
      executionChannels: ['quick_swap'],
      teamFunctions: ['support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-alice-32-f2p-corin-nicole',
        'Corin adds Physical damage for more frequent Assaults, and Nicole shreds DEF.',
      ),
    ],
  },
  {
    memberIds: ['agent-jane', 'agent-seth', 'agent-yuzuha'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyDisorder,
      id: 'module-jane-seth-yuzuha-assault',
      reactionMechanisms: [],
      executionChannels: ['quick_swap'],
      teamFunctions: ['stun', 'support'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-jane-32-accessible-seth-yuzuha',
        'Game8’s Assault team. Seth shares Jane’s faction, shields her and gives her +100 Anomaly Proficiency, and his Additional Ability cuts Anomaly Buildup RES.',
      ),
    ],
  },
  {
    memberIds: ['agent-piper', 'agent-vivian', 'agent-yuzuha'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyAbloom,
      id: 'module-piper-vivian-yuzuha-abloom',
      reactionMechanisms: ['abloom', 'disorder'],
      executionChannels: ['quick_swap'],
      teamFunctions: ['support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-piper-32-vivian-yuzuha',
        'Piper triggers two of Vivian’s Ablooms per EX, and Yuzuha is Physical, the ideal Anomaly buffer.',
      ),
    ],
  },
  {
    memberIds: ['agent-burnice', 'agent-lucy', 'agent-piper'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyDisorder,
      id: 'module-burnice-lucy-piper-disorder',
      executionChannels: ['off_field', 'quick_swap'],
      teamFunctions: ['support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-piper-32-sons-burnice-lucy',
        'Burnice’s off-field Burn pairs with Piper’s Assault for Disorders, and Lucy’s M6 keeps extending Cheer On! off Piper’s EX Specials.',
      ),
    ],
  },
  {
    memberIds: ['agent-miyabi', 'agent-yanagi', 'agent-yuzuha'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyPolarity,
      id: 'module-miyabi-yanagi-yuzuha-polarity-disorder',
      executionChannels: ['quick_swap'],
      teamFunctions: ['support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-yanagi-32-section6-miyabi-yuzuha',
        'Frost and Shock bounce Disorders back and forth, and every Disorder gives Miyabi Fallen Frost.',
      ),
    ],
  },
  {
    memberIds: ['agent-grace', 'agent-remielle', 'agent-velina'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyDisorder,
      id: 'module-grace-remielle-velina-disorder',
      teamFunctions: ['support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-grace-32-disorder-remielle-velina',
        "Velina's Vortex counts as Shock damage, so Grace's bonuses apply to it, and Remielle adds huge buffs and damage of her own.",
      ),
    ],
  },
  {
    memberIds: ['agent-grace', 'agent-nangong', 'agent-yuzuha'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.anomalyAbloom,
      id: 'module-grace-nangong-yuzuha-abloom-stun',
      executionChannels: ['stun_window', 'quick_swap'],
      teamFunctions: ['stun', 'support', 'anomaly_amplification'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-grace-32-stun-burst-nangong-yuzuha',
        "Nangong's reliable Stuns let Grace line up her Ultimate and Ablooms with each burst, and Yuzuha keeps Disorders going.",
      ),
    ],
  },
  {
    memberIds: ['agent-anton', 'agent-grace', 'agent-qingyi'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.directStun,
      id: 'module-anton-grace-qingyi-shock-burst',
      executionChannels: ['stun_window', 'quick_swap'],
      teamFunctions: ['stun', 'support'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-anton-32-shock-grace-qingyi',
        'Grace keeps enemies Shocked for his Additional Ability and shares both his attribute and his faction; Qingyi brings fast Stuns and a Stun DMG multiplier.',
      ),
    ],
  },
  {
    memberIds: ['agent-anton', 'agent-grace', 'agent-rina'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.directStun,
      id: 'module-anton-grace-rina-shock',
      executionChannels: ['stun_window', 'quick_swap'],
      teamFunctions: ['support'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-anton-32-shock-grace-rina',
        "An all-Electric squad where Rina's PEN Ratio and Shock duration boost both Grace and Anton.",
      ),
    ],
  },
  {
    memberIds: ['agent-anton', 'agent-anby', 'agent-nicole'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.directStun,
      id: 'module-anton-anby-nicole-budget-shock',
      executionChannels: ['stun_window', 'quick_swap'],
      teamFunctions: ['stun', 'support', 'defense_reduction'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-anton-32-budget-anby-nicole',
        'Anby is Electric (Additional Ability) and applies some Shock, Nicole shreds DEF.',
      ),
    ],
  },
  {
    memberIds: ['agent-ben', 'agent-orphie-magus', 'agent-dialyn'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.directStun,
      id: 'module-ben-orphie-dialyn-ultimate-fire',
      reactionMechanisms: [],
      executionChannels: ['stun_window', 'ultimate', 'quick_swap'],
      teamFunctions: ['support', 'defense'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-ben-32-orphie-dialyn',
        "Orphie is Fire (Additional Ability) and deals as much damage as Ben, while Dialyn's Ultimate conversion suits his Ultimate-heavy damage.",
      ),
    ],
  },
  {
    memberIds: ['agent-ben', 'agent-lighter', 'agent-lucy'],
    classification: 'current_exact_team_review',
    module: {
      ...teamOutputModules.directStun,
      id: 'module-ben-lighter-lucy-fire-dps',
      teamFunctions: ['stun', 'support', 'defense'],
    },
    sourceEvidence: [
      sourceEvidence(
        'hoyobuild-ben-32-fire-lighter-lucy',
        "An all-Fire team with Ben as DPS: Lighter's long Stun extension and buffs give him time to spend two EX Specials, Lucy's ATK buff and Chain tricks do the rest.",
      ),
    ],
  },
] as const satisfies readonly ReviewedTeamOutputModuleEvidence[]
