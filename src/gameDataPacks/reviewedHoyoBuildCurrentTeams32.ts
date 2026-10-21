import type { ReviewedTeamSourceDirection } from './reviewedTeamSourceDirections'
import { stableContentHash } from './types'

type PageIdentity = {
  slug: string
  updatedAt: string
}

function teamSource(input: {
  page: PageIdentity
  locator: string
  sourceText: string
  id: string
}) {
  const url = `https://hoyobuild.com/en/zzz/characters/${input.page.slug}`
  return {
    id: input.id,
    url,
    sourceVersion: '3.2',
    checkedAt: '2026-10-20',
    sourceUpdatedAt: input.page.updatedAt,
    contentHash: stableContentHash({
      url,
      sourceVersion: '3.2',
      sourceUpdatedAt: input.page.updatedAt,
      locator: input.locator,
      sourceText: input.sourceText,
    }),
    hashDefinition: 'Web text projection extraction sha256; not raw HTML',
    locator: input.locator,
    verificationStatus: 'reviewed_exact_team_current_32',
  }
}

const promeia: PageIdentity = { slug: 'promeia', updatedAt: '2026-09-24' }
const aria: PageIdentity = { slug: 'aria', updatedAt: '2026-09-26' }
const alice: PageIdentity = { slug: 'alice', updatedAt: '2026-09-26' }
const jane: PageIdentity = { slug: 'jane', updatedAt: '2026-09-26' }
const piper: PageIdentity = { slug: 'piper', updatedAt: '2026-09-26' }
const yanagi: PageIdentity = { slug: 'yanagi', updatedAt: '2026-09-26' }
const grace: PageIdentity = { slug: 'grace', updatedAt: '2026-09-26' }
const anton: PageIdentity = { slug: 'anton', updatedAt: '2026-09-26' }
const ben: PageIdentity = { slug: 'ben', updatedAt: '2026-09-26' }

const commonConditions = [
  'HoyoBuild页面标记Version 3.2；本条只投影页面直接列出的精确三人成员与明确邦布选项。',
  '不继承页面Tier、DPS、使用率或最佳队伍结论，不将社区页面升级为独立强度标签。',
]

export const reviewedHoyoBuildCurrentTeams32 = {
  gameVersion: '3.2',
  reviewedAt: '2026-10-20',
  entries: [
    {
      memberIds: ['agent-promeia', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        teamSource({
          page: promeia,
          id: 'hoyobuild-promeia-32-lumiflux-remielle-velina',
          locator: 'Teams > Recommended teams > Lumiflux: Remielle & Velina',
          sourceText:
            'Promeia Remielle Velina. Her most popular team by far: the third most used team in the current Shiyu Defense.',
        }),
      ],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-promeia', 'agent-nangong', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: promeia,
          id: 'hoyobuild-promeia-32-stun-abloom-nangong-yuzuha',
          locator: 'Teams > Recommended teams > Stun Abloom: Nangong Yu & Yuzuha',
          sourceText:
            'Promeia Nangong Yu Yuzuha. Outstanding synergy: Nangong extends Stuns and feeds Promeia’s gauge with Disorders and Ablooms.',
        }),
      ],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-promeia', 'agent-nicole', 'agent-soukaku'],
      sourceRefs: [
        teamSource({
          page: promeia,
          id: 'hoyobuild-promeia-32-budget-nicole-soukaku',
          locator: 'Teams > Recommended teams > Budget: Nicole & Soukaku',
          sourceText:
            'Promeia Nicole Soukaku. Game8’s F2P team. Nicole’s DEF Shred is easy to line up with Promeia’s quick Abloom bursts, and Soukaku buffs ATK and Ice DMG.',
        }),
      ],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-aria', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        teamSource({
          page: aria,
          id: 'hoyobuild-aria-32-lumiflux-remielle-velina',
          locator: 'Teams > Recommended teams > Lumiflux: Remielle & Velina',
          sourceText:
            'Aria Remielle Velina. Her most used team: the fifth most used in the current Deadly Assault. Recommended Bangboo: Biggest Fan.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-biggest-fan'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-aria', 'agent-nangong', 'agent-sunna'],
      sourceRefs: [
        teamSource({
          page: aria,
          id: 'hoyobuild-aria-32-angels-nangong-sunna',
          locator: 'Teams > Recommended teams > Angels of Delusion: Nangong Yu & Sunna',
          sourceText: 'Aria Nangong Yu Sunna. The faction team. Recommended Bangboo: Biggest Fan.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-biggest-fan'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-aria', 'agent-anby', 'agent-nicole'],
      sourceRefs: [
        teamSource({
          page: aria,
          id: 'hoyobuild-aria-32-f2p-anby-nicole',
          locator: 'Teams > Recommended teams > F2P: Anby & Nicole',
          sourceText:
            'Aria Anby Nicole. Game8’s free team: Anby provides the Stuns she needs and Nicole shares her Ether attribute and shreds DEF. Recommended Bangboo: Booressure.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-booressure'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-alice', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        teamSource({
          page: alice,
          id: 'hoyobuild-alice-32-lumiflux-remielle-velina',
          locator: 'Teams > Recommended teams > Lumiflux: Remielle & Velina',
          sourceText:
            'Alice Remielle Velina. Alice’s most used team by far in both Shiyu Defense and Deadly Assault. Recommended Bangboo: Ariel.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-ariel'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-alice', 'agent-vivian', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: alice,
          id: 'hoyobuild-alice-32-anomaly-vivian-yuzuha',
          locator: 'Teams > Recommended teams > Anomaly: Vivian & Yuzuha',
          sourceText:
            'Alice Vivian Yuzuha. Vivian’s off-field Ether Anomalies set up constant Disorders, which feed Alice’s Blade Etiquette, and Yuzuha shares Alice’s faction. Recommended Bangboo: Robin.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-robin'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-alice', 'agent-corin', 'agent-nicole'],
      sourceRefs: [
        teamSource({
          page: alice,
          id: 'hoyobuild-alice-32-f2p-corin-nicole',
          locator: 'Teams > Recommended teams > F2P: Corin & Nicole',
          sourceText:
            'Alice Corin Nicole. Game8’s free-to-play team. Corin adds Physical damage for more frequent Assaults, and Nicole shreds DEF. Recommended Bangboo: Luckyboo.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-luckyboo'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-jane', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        teamSource({
          page: jane,
          id: 'hoyobuild-jane-32-meta-remielle-velina',
          locator: 'Teams > Recommended teams > Meta: Remielle & Velina',
          sourceText:
            'Jane Remielle Velina. One of the most used teams in the game. Velina’s Vortexes count as Assault DMG, so they crit thanks to Jane. Bangboo: Ariel.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-ariel'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-alice', 'agent-jane', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: jane,
          id: 'hoyobuild-jane-32-physical-alice-yuzuha',
          locator: 'Teams > Recommended teams > Physical: Alice & Yuzuha',
          sourceText:
            'Alice Jane Yuzuha. Jane steps back into a supportive role: Alice’s Polarity Assaults crit too, and back-to-back Assaults loop Disorders even in a mono-Physical team. Bangboo: Bangvolver.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-bangvolver'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-jane', 'agent-seth', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: jane,
          id: 'hoyobuild-jane-32-accessible-seth-yuzuha',
          locator: 'Teams > Recommended teams > Accessible: Seth & Yuzuha',
          sourceText:
            'Jane Seth Yuzuha. Game8’s Assault team. Seth shares Jane’s faction, shields her and gives her +100 Anomaly Proficiency, and his Additional Ability cuts Anomaly Buildup RES. Bangboo: Bangvolver.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-bangvolver'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-piper', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        teamSource({
          page: piper,
          id: 'hoyobuild-piper-32-velina-remielle',
          locator: 'Teams > Recommended teams > Velina & Remielle',
          sourceText:
            'Piper Remielle Velina. Piper’s most used team in both Shiyu Defense and Deadly Assault. Velina has no trouble with Disorder management, and Remielle adds huge buffs. Bangboo: Magnetiboo.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-magnetiboo'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-piper', 'agent-vivian', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: piper,
          id: 'hoyobuild-piper-32-vivian-yuzuha',
          locator: 'Teams > Recommended teams > Vivian & Yuzuha',
          sourceText:
            'Piper Vivian Yuzuha. Piper triggers two of Vivian’s Ablooms per EX, and Yuzuha is Physical, the ideal Anomaly buffer. Bangboo: Robin.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-robin'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-burnice', 'agent-lucy', 'agent-piper'],
      sourceRefs: [
        teamSource({
          page: piper,
          id: 'hoyobuild-piper-32-sons-burnice-lucy',
          locator: 'Teams > Recommended teams > Sons of Calydon',
          sourceText:
            'Piper Burnice Lucy. Burnice’s off-field Burn pairs with Piper’s Assault for Disorders, and Lucy’s M6 keeps extending Cheer On! off Piper’s EX Specials. Bangboo: Red Moccus.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-red-moccus'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-miyabi', 'agent-yanagi', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: yanagi,
          id: 'hoyobuild-yanagi-32-section6-miyabi-yuzuha',
          locator: 'Teams > Recommended teams > Section 6: Miyabi & Yuzuha',
          sourceText:
            'Miyabi Yanagi Yuzuha. Frost and Shock bounce Disorders back and forth, and every Disorder gives Miyabi Fallen Frost. Bangboo: Agent Gulliver.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-agent-gulliver'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-remielle', 'agent-velina', 'agent-yanagi'],
      sourceRefs: [
        teamSource({
          page: yanagi,
          id: 'hoyobuild-yanagi-32-lumiflux-remielle-velina',
          locator: 'Teams > Recommended teams > Lumiflux: Remielle & Velina',
          sourceText:
            'Remielle Velina Yanagi. Her highest-scoring team in both Shiyu Defense and Deadly Assault. Velina triggers Vortexes, and Remielle refracts Yanagi’s Shocks. Bangboo: Ariel.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-ariel'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-nangong', 'agent-yanagi', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: yanagi,
          id: 'hoyobuild-yanagi-32-nangong-yuzuha',
          locator: 'Teams > Recommended teams > Nangong Yu & Yuzuha',
          sourceText:
            'Yanagi Nangong Yu Yuzuha. Nangong’s Stuns let Yanagi save her EXs for Stun windows, and her high Anomaly Buildup keeps Disorders going. Bangboo: Magnetiboo.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-magnetiboo'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-grace', 'agent-remielle', 'agent-velina'],
      sourceRefs: [
        teamSource({
          page: grace,
          id: 'hoyobuild-grace-32-disorder-remielle-velina',
          locator: 'Teams > Recommended teams > Disorder: Remielle & Velina',
          sourceText:
            "Grace Remielle Velina. Grace's most used team in both Shiyu Defense and Deadly Assault. Velina's Vortex counts as Shock damage, so Grace's bonuses apply to it, and Remielle adds huge buffs and damage of her own. Bangboo: Ultra Jake (Velina is from Roscaelifer).",
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-ultra-jake'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-grace', 'agent-velina', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: grace,
          id: 'hoyobuild-grace-32-disorder-velina-yuzuha',
          locator: 'Teams > Recommended teams > Disorder: Velina & Yuzuha',
          sourceText:
            'Grace Velina Yuzuha. Yuzuha keeps Disorders flowing and has great general buffs. Bangboo: Ultra Jake.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-ultra-jake'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-grace', 'agent-nangong', 'agent-yuzuha'],
      sourceRefs: [
        teamSource({
          page: grace,
          id: 'hoyobuild-grace-32-stun-burst-nangong-yuzuha',
          locator: 'Teams > Recommended teams > Stun burst: Nangong Yu & Yuzuha',
          sourceText:
            "Grace Nangong Yu Yuzuha. Recommended by Prydwen: Nangong's reliable Stuns let Grace line up her Ultimate and Ablooms with each burst, and Yuzuha keeps Disorders going. Grace's Additional Ability is inactive here (neither teammate is Electric, from Belobog or an Anomaly Agent), but it only boosts Shock DMG, so the loss is small. For a free version, play Anby instead of Nangong: she shares Grace's attribute and activates it. Bangboo: Knightboo, or Plugboo with Anby (two Electric Agents).",
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-knightboo'],
      conditions: [
        ...commonConditions,
        'Plugboo仅对应将南宫羽替换为安比的替代方向，不附到本条精确三人。',
      ],
    },
    {
      memberIds: ['agent-anton', 'agent-grace', 'agent-qingyi'],
      sourceRefs: [
        teamSource({
          page: anton,
          id: 'hoyobuild-anton-32-shock-grace-qingyi',
          locator: 'Teams > Recommended teams > Shock: Grace & Qingyi',
          sourceText:
            'Anton Grace Qingyi. Grace keeps enemies Shocked for his Additional Ability and shares both his attribute and his faction; Qingyi brings fast Stuns and a Stun DMG multiplier. Bangboo: Safety (2+ Belobog Agents, extra bonus on Shocked targets) or Plugboo.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-safety', 'bangboo-plugboo'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-anton', 'agent-grace', 'agent-rina'],
      sourceRefs: [
        teamSource({
          page: anton,
          id: 'hoyobuild-anton-32-shock-grace-rina',
          locator: 'Teams > Recommended teams > Shock: Grace & Rina',
          sourceText:
            "Anton Grace Rina. Game8's premium team: an all-Electric squad where Rina's PEN Ratio and Shock duration boost both Grace and Anton. Bangboo: Plugboo (2+ Electric Agents) or Safety.",
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-plugboo', 'bangboo-safety'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-anton', 'agent-anby', 'agent-nicole'],
      sourceRefs: [
        teamSource({
          page: anton,
          id: 'hoyobuild-anton-32-budget-anby-nicole',
          locator: 'Teams > Recommended teams > Budget: Anby & Nicole',
          sourceText:
            'Anton Anby Nicole. A free team: Anby is Electric (Additional Ability) and applies some Shock, Nicole shreds DEF. Bangboo: Electroboo or Plugboo.',
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-electroboo', 'bangboo-plugboo'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-ben', 'agent-orphie-magus', 'agent-dialyn'],
      sourceRefs: [
        teamSource({
          page: ben,
          id: 'hoyobuild-ben-32-orphie-dialyn',
          locator: 'Teams > Recommended teams > Orphie & Dialyn',
          sourceText:
            "Ben Orphie & Magus Dialyn. Prydwen's best Ben team: Orphie is Fire (Additional Ability) and deals as much damage as Ben, while Dialyn's Ultimate conversion suits his Ultimate-heavy damage. Bangboo: Rocketboo (2+ Fire Agents).",
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-rocketboo'],
      conditions: commonConditions,
    },
    {
      memberIds: ['agent-ben', 'agent-lighter', 'agent-lucy'],
      sourceRefs: [
        teamSource({
          page: ben,
          id: 'hoyobuild-ben-32-fire-lighter-lucy',
          locator: 'Teams > Recommended teams > Fire: Lighter & Lucy',
          sourceText:
            "Ben Lighter Lucy. An all-Fire team with Ben as DPS: Lighter's long Stun extension and buffs give him time to spend two EX Specials, Lucy's ATK buff and Chain tricks do the rest. Bangboo: Rocketboo.",
        }),
      ],
      sourceBangbooOptionIds: ['bangboo-rocketboo'],
      conditions: commonConditions,
    },
  ] satisfies readonly ReviewedTeamSourceDirection[],
} as const

export const reviewedHoyoBuildCurrentTeams32Identity = stableContentHash(
  reviewedHoyoBuildCurrentTeams32,
)
