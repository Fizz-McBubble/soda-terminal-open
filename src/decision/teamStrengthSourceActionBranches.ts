import { currentVersionProjection } from '../gameDataPacks/currentVersionProjection'

export type SourceActionBranch = {
  branchId: string
  indices: number[]
  sourceSequence: { mode: 'minimum_declared_sequence'; condition: string; boundary: string }
  requirements: string[]
  /** Rates and multipliers require an actual declared quantity, never an inferred 1. */
  quantityRequirements?: Array<{ index: number; unit: 'seconds' | 'occurrences'; reason: string }>
  execution?: 'background_trigger'
}
type Row = {
  upstreamKey: string
  agentId: string
  actionId: string
  formulaSha256: string
  sourceSha256: string
  sourceUrl: string
  count: number
}
const commit = '3456cd0f6f5bea10e168074502460dac2fcd6df4'
const rows: readonly Row[] = [
  {
    upstreamKey: 'Koleda',
    agentId: 'agent-koleda',
    actionId: 'BasicAttackSmashNBash',
    formulaSha256: '632180C58A583A7024641799AF82A21906D78973C2046A48C2DFB88E21E59C8C',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1101.json',
    sourceSha256: '6fb2fb183d9e2136f93147b0bc6543820504a288b08f6c7f5882a90f9950d373',
    count: 7,
  },
  {
    upstreamKey: 'Koleda',
    agentId: 'agent-koleda',
    actionId: 'SpecialAttackHammerTime',
    formulaSha256: '632180C58A583A7024641799AF82A21906D78973C2046A48C2DFB88E21E59C8C',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1101.json',
    sourceSha256: '6fb2fb183d9e2136f93147b0bc6543820504a288b08f6c7f5882a90f9950d373',
    count: 3,
  },
  {
    upstreamKey: 'Koleda',
    agentId: 'agent-koleda',
    actionId: 'EXSpecialAttackBoilingFurnace',
    formulaSha256: '632180C58A583A7024641799AF82A21906D78973C2046A48C2DFB88E21E59C8C',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1101.json',
    sourceSha256: '6fb2fb183d9e2136f93147b0bc6543820504a288b08f6c7f5882a90f9950d373',
    count: 3,
  },
  {
    upstreamKey: 'Lucia',
    agentId: 'agent-lucia',
    actionId: 'BasicAttackOrbitalCombo',
    formulaSha256: 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1451.json',
    sourceSha256: '2c2e33642a6df189a72df0c916c07871da1fa6ea1996ac37ef3c066ba1ed5545',
    count: 7,
  },
  {
    upstreamKey: 'Lucia',
    agentId: 'agent-lucia',
    actionId: 'SpecialAttackSymphonyOfTheReaperStorm',
    formulaSha256: 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1451.json',
    sourceSha256: '2c2e33642a6df189a72df0c916c07871da1fa6ea1996ac37ef3c066ba1ed5545',
    count: 3,
  },
  {
    upstreamKey: 'Lucia',
    agentId: 'agent-lucia',
    actionId: 'DodgeCounterStardustEcho',
    formulaSha256: 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1451.json',
    sourceSha256: '2c2e33642a6df189a72df0c916c07871da1fa6ea1996ac37ef3c066ba1ed5545',
    count: 2,
  },
  {
    upstreamKey: 'Lucia',
    agentId: 'agent-lucia',
    actionId: 'QuickAssistCrushingMist',
    formulaSha256: 'BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1451.json',
    sourceSha256: '2c2e33642a6df189a72df0c916c07871da1fa6ea1996ac37ef3c066ba1ed5545',
    count: 3,
  },
  {
    upstreamKey: 'Alice',
    agentId: 'agent-alice',
    actionId: 'BasicAttackStarshineWaltz',
    formulaSha256: '8387F008FE972025AC5FAE619EBD40F8971119568C4DEA0048D798E0241F82E5',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1401.json',
    sourceSha256: '100f9790d61741fbabeb640e84f9fef29c631c692e9e9094f975984d2810fff3',
    count: 3,
  },
  {
    upstreamKey: 'Miyabi',
    agentId: 'agent-miyabi',
    actionId: 'BasicAttackShimotsuki',
    formulaSha256: '7C7E1F1AEDA1D38976D4C0B47C111EB0B4FC76DFE0E6554B567D8260DF8127F3',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1091.json',
    sourceSha256: '348636c36dec650aa1b3d794f09f48e10cc37201b09ca2c124808c2f0fcc4241',
    count: 3,
  },
  {
    upstreamKey: 'Aria',
    agentId: 'agent-aria',
    actionId: 'BasicAttackPerfectPitch',
    formulaSha256: '3164FA902E16366CCDBBBF2F41660D77DA72168F95E618157B51CE2A28E3A7F3',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1501.json',
    sourceSha256: '348f786a04bb180718d47c0792896754fb113ee1ea5884b621ac0e036a6f8486',
    count: 5,
  },
  {
    upstreamKey: 'Lucy',
    agentId: 'agent-lucy',
    actionId: 'EXSpecialAttackHomeRun',
    formulaSha256: '7B7964B69D7D18A4EAD0914B2DA83915EC4DE5BB795098F078EA9A381DE5B903',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1151.json',
    sourceSha256: 'e190a637fb802fdc0a90e7cac9879b4c2ffb6f48df3b57eb1e10c45fe3a751d6',
    count: 2,
  },
  {
    upstreamKey: 'Seth',
    agentId: 'agent-seth',
    actionId: 'EXSpecialAttackThunderShieldRushHighVoltage',
    formulaSha256: '499F9B3BE93358AE03618096258CC6FCB1E95E3AEEAE4052F27C3DEF436FDCD6',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1271.json',
    sourceSha256: 'e7a4fc988fd1163191d862c6c9d435c6695b6cbde76d5955b48f0335c127836c',
    count: 2,
  },
  {
    upstreamKey: 'Ben',
    agentId: 'agent-ben',
    actionId: 'EXSpecialAttackCashflowCounter',
    formulaSha256: '395B208714B28F4B9FCDDCC6FD328424443E8AC42147D1E4DD68569E0E3A7FDF',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1121.json',
    sourceSha256: 'b513965893a33ff48b845297f4c4b9d202cba5d9af7d8555a2762f052ceee9b0',
    count: 4,
  },
  {
    upstreamKey: 'Lighter',
    agentId: 'agent-lighter',
    actionId: 'BasicAttackLFormThunderingFist',
    formulaSha256: '4AE8698C1FF65B9A4B56CF89024DF3CA9D3D9061912455A4FDBB6F977938182A',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1161.json',
    sourceSha256: '3aa139a8788f2d68e28b0f68d71bb16f36c9aa87ffecd5011cc2d8ff3c8e9fa6',
    count: 16,
  },
  {
    upstreamKey: 'ZhuYuan',
    agentId: 'agent-zhu-yuan',
    actionId: 'BasicAttackPleaseDoNotResist',
    formulaSha256: 'A85922CD98A29243BE040AC16D0F359A6D24147968BF9BAD8EF5391FE74DB640',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1241.json',
    sourceSha256: 'aef42ff3686f0724978b5a9e26295c1316336d9ee16972e0bd0f6dd79f0f964b',
    count: 6,
  },
  {
    upstreamKey: 'Yidhari',
    agentId: 'agent-yidhari',
    actionId: 'ChainAttackFrostboundOath',
    formulaSha256: 'B5DD737E76A5D0363C89206EF32CF138AE1371451E82625F218909A563EBE301',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1051.json',
    sourceSha256: 'c539b3c8814d1b76beb5788d3d05fed28dad1e2c4f91cb6dcc4744b9a0f850ea',
    count: 2,
  },
  {
    upstreamKey: 'Norma',
    agentId: 'agent-norma',
    actionId: 'EXSpecialAttackEnNahBarrage',
    formulaSha256: '604F9C881524A683CFDCF824573F5333A8A144DC103C8CBC7B2C7628B0BD6F46',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1571.json',
    sourceSha256: '101b39e7a62fd6b080c49978d69f038798394d57e25b58223bde51db3c23c388',
    count: 6,
  },
  {
    upstreamKey: 'Soldier11',
    agentId: 'agent-soldier-11',
    actionId: 'BasicAttackFireSuppression',
    formulaSha256: '9A8250B8F3803FF3E2BE223353663A5FD0FC8A2E1022EEFD09D49A8966509313',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1041.json',
    sourceSha256: '60a967133f2bf8d31667dabadba03ec106348f1e573ee3d394bd6b62b229366b',
    count: 7,
  },
  {
    upstreamKey: 'Yixuan',
    agentId: 'agent-yixuan',
    actionId: 'EXSpecialAttackInkManifestation',
    formulaSha256: '43F11850985726682A1076704F9B0E9ACF3172F18AE4B76DE2AF4B16E3F28E80',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1371.json',
    sourceSha256: '681227bf50f86772db8771d89a88fdf8ae268404b6b5d376abd89201ff26e8ea',
    count: 4,
  },
  {
    upstreamKey: 'Corin',
    agentId: 'agent-corin',
    actionId: 'EXSpecialAttackSkirtAlert',
    formulaSha256: '92F8EB727836FD7769F645BEBC1F52A71D11753F955770C5B40A06A7E96D51AD',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1061.json',
    sourceSha256: '96ffd8bb866aa93f6e676b7f2796f034e29ef981ea1b8f5c1d88955d1f263c6b',
    count: 3,
  },
  {
    upstreamKey: 'Burnice',
    agentId: 'agent-burnice',
    actionId: 'EXSpecialAttackIntenseHeatStirringMethodDoubleShot',
    formulaSha256: '8A46BA0B3E268C6C2E67C2029E0FA293D3C7C97718BC2063D43FB29EB81D2B3C',
    sourceUrl: 'https://static.nanoka.cc/zzz/3.3/zh/character/1171.json',
    sourceSha256: '2f0fa44e1a4e782048ff81e3128f0f9c21467164ec2fb23454e5c7fae9ff2ef8',
    count: 2,
  },
]
const boundary =
  'Source-bound finite action branch; prerequisites and quantities remain explicit, not an observed rotation, uptime, or DPS.'
const make = (
  branchId: string,
  indices: number[],
  condition: string,
  requirements: string[] = [],
  quantityRequirements?: SourceActionBranch['quantityRequirements'],
): SourceActionBranch => ({
  branchId,
  indices,
  sourceSequence: { mode: 'minimum_declared_sequence', condition, boundary },
  requirements,
  ...(quantityRequirements ? { quantityRequirements } : {}),
})
const rate = (index: number, reason: string) => ({ index, unit: 'seconds' as const, reason })
const uses = (index: number, reason: string) => ({ index, unit: 'occurrences' as const, reason })

/** Applied before resolving row quantities: mixed rate rows must not block a valid non-rate branch. */
export function resolveTeamStrengthSourceActionBranches(input: {
  upstreamKey: string
  actionId: string
  source: { commit: string; formulaSha256: string }
  hitIndices: readonly number[]
  memberIds?: readonly string[]
  potential?: number | null
}) {
  const row = rows.find(
    (item) => item.upstreamKey === input.upstreamKey && item.actionId === input.actionId,
  )
  if (!row) return { status: 'not_applicable' as const }
  if (
    input.source.commit !== commit ||
    input.source.formulaSha256 !== row.formulaSha256 ||
    currentVersionProjection.gameVersion !== '3.3' ||
    input.hitIndices.length !== row.count ||
    new Set(input.hitIndices).size !== row.count ||
    input.hitIndices.some((i) => !Number.isInteger(i) || i < 0 || i >= row.count)
  )
    return {
      status: 'unsupported' as const,
      blockers: ['unreviewed_source_action_branch_identity_or_layout'],
    }
  let branches: SourceActionBranch[] = []
  let unresolvedIndices: number[] = []
  switch (row.upstreamKey) {
    case 'Koleda': {
      const completeTeam =
        input.memberIds?.length === 3 &&
        new Set(input.memberIds).size === 3 &&
        input.memberIds.includes('agent-koleda')
      const ben = completeTeam && input.memberIds!.includes('agent-ben')
      if (row.actionId === 'BasicAttackSmashNBash') {
        branches = [
          make('ordinary_basic', [0, 1, 2, 3], 'Complete ordinary basic 1 through 4.', [
            'ordinary continuation after basic 2',
          ]),
        ]
        if (!completeTeam) unresolvedIndices = [4, 5, 6]
        else if (ben)
          branches.push(
            make(
              'furnace_cooperative',
              [0, 1, 4, 6],
              'Basic 1/2 then enhanced basic 1 and cooperative enhanced 2.',
              [
                'Furnace Fire prepared and consumed',
                'Ben in team',
                'no switch during enhanced basic 1',
              ],
            ),
          )
        else
          branches.push(
            make(
              'furnace_basic',
              [0, 1, 4, 5],
              'Basic 1/2 then enhanced basic 1 and enhanced basic 2.',
              ['Furnace Fire prepared and consumed', 'Ben absent'],
            ),
          )
      } else {
        branches = [
          make('strike_explosion', [0, 1], 'Opening strike followed by ordinary explosion.', []),
          make(
            'followup_explosion',
            [1],
            'After basic 2 or 4, skip opening strike and execute ordinary explosion.',
            ['qualifying prior basic 2 or 4'],
          ),
        ]
        if (row.actionId === 'EXSpecialAttackBoilingFurnace')
          branches.forEach((b) => b.requirements.push('sufficient EX energy'))
        if (!completeTeam) unresolvedIndices = [2]
        else if (ben)
          branches.push(
            make(
              'cooperative_explosion',
              [2],
              'After enhanced basic, use cooperative explosion instead of ordinary explosion.',
              [
                'Ben in team',
                'qualifying prior enhanced basic',
                ...(row.actionId === 'EXSpecialAttackBoilingFurnace'
                  ? ['sufficient EX energy']
                  : []),
              ],
            ),
          )
      }
      break
    }
    case 'Lucia': {
      const basic = row.actionId === 'BasicAttackOrbitalCombo'
      const aftershock = make(
        'dream_aftershock',
        [basic ? 6 : 2],
        'Another active agent hits and triggers one Harmony Aftershock.',
        [
          'Dream active',
          'at least 25 dream points',
          'eight-second trigger cooldown ready',
          'qualifying contact by another active agent',
        ],
      )
      aftershock.execution = 'background_trigger'
      branches = [
        make('whim', basic ? [0, 1, 2, 3, 4] : [0], 'Outside Dream; execute Whim.', [
          'outside Dream',
        ]),
        make('harmony', basic ? [0, 1, 2, 3, 5] : [1], 'In Dream, Harmony replaces Whim.', [
          'Dream active',
          'at least 25 dream points',
          'consume 25 dream points',
        ]),
      ]
      if (basic || row.count === 3) branches.push(aftershock)
      const entry =
        row.actionId === 'DodgeCounterStardustEcho'
          ? 'successful perfect dodge before the counter'
          : row.actionId === 'QuickAssistCrushingMist'
            ? 'available Quick Assist entry'
            : null
      if (entry)
        for (const branch of branches.filter((branch) => branch.execution !== 'background_trigger'))
          branch.requirements.push(entry)
      break
    }
    case 'Alice':
    case 'Miyabi':
    case 'Aria':
      branches = [0, 1, 2].map((i) =>
        make(`charge_${i + 1}`, [i], `Release at charge level ${i + 1}.`, [
          row.upstreamKey === 'Alice'
            ? `consume ${i + 1} Sword Intent`
            : row.upstreamKey === 'Miyabi'
              ? `consume ${2 * (i + 1)} Fallen Frost`
              : 'declare charge route and any consumed Cheer energy',
        ]),
      )
      if (row.upstreamKey === 'Aria') {
        branches.push(
          make(
            'enhanced_charge',
            [4],
            'Enhanced charged release during Delusional Dream from the Ultimate.',
            [
              'Ultimate has opened Delusional Dream',
              'release occurs within the source enhancement window',
            ],
          ),
        )
        // The current UI source explicitly adds 1501022 to 1501007/1501008.
        // The pinned formula sheet leaves its owner/trigger TODO; it cannot
        // be silently settled as another ordinary Aria hit.
        unresolvedIndices = [3]
      }
      break
    case 'Lucy':
      branches = [
        make('line_drive', [0], 'Tap EX special: line drive.', ['sufficient EX energy']),
        make('fly_ball', [1], 'Hold EX special: fly ball.', ['sufficient EX energy']),
      ]
      break
    case 'Seth':
      branches = [
        make('tap', [0], 'Tap EX special.', ['sufficient EX energy']),
        make('charged', [1], 'Complete charged EX special.', [
          'sufficient EX energy',
          'complete charge',
        ]),
      ]
      break
    case 'Ben':
      branches = [
        make('active', [0], 'EX strike without a successful block.', ['sufficient EX energy']),
        make('active_followup', [0, 1], 'EX strike then separately trigger follow-up.', [
          'sufficient initial and follow-up EX energy',
        ]),
        make('counter', [2], 'Successfully block an attack before counter.', [
          'sufficient EX energy',
          'enemy contact during block',
        ]),
        make('counter_followup', [2, 3], 'Successful block then separately trigger follow-up.', [
          'sufficient initial and follow-up EX energy',
          'enemy contact during block',
        ]),
      ]
      break
    case 'Lighter': {
      const choices = [
        {
          id: 'ordinary',
          start: 9,
          combo: 10,
          finish: 11,
          requirements: ['declare no Morale Burst'],
        },
        {
          id: 'burst',
          start: 12,
          combo: 13,
          finish: 14,
          requirements: ['at least 80 Morale at fifth basic', 'declare Morale Burst active'],
        },
        {
          id: 'burst_exhausted',
          start: 12,
          combo: 13,
          finish: 15,
          requirements: [
            'at least 80 Morale at fifth basic',
            'declare Morale Burst active',
            'Morale exhausts during fifth basic',
          ],
        },
      ]
      branches = choices.flatMap((c) =>
        [false, true].map((follow) =>
          make(
            `${c.id}_${follow ? 'with_followup' : 'direct'}`,
            [0, 1, 2, ...(follow ? [3, 4, 5, 6, 7] : []), 8, c.start, c.combo, c.finish],
            'Basic 1/2/3, optional source follow-up, fourth basic, then one selected fifth-basic version.',
            c.requirements,
            [uses(c.combo, 'combo contact count is not established by the coefficient row')],
          ),
        ),
      )
      break
    }
    case 'ZhuYuan':
      branches = Array.from({ length: 8 }, (_, mask) => {
        const indices = [0, 1, 2].map((i) => i + (mask & (1 << i) ? 3 : 0))
        const ammo = indices.filter((i) => i >= 3).length
        return make(
          `suppression_${indices.join('_')}`,
          indices,
          'Three suppression shots; each shot uses either physical or enhanced ether coefficient.',
          [`declare and consume ${ammo} enhanced shells across the three shots`],
        )
      })
      break
    case 'Yidhari':
      branches = [
        make('outside_veil', [0], 'Chain attack outside Wellspring.', [
          'declare Wellspring inactive',
        ]),
        make('inside_veil', [1], 'Chain attack inside Wellspring.', [
          'declare Wellspring active and source opening cost/window',
        ]),
      ]
      break
    case 'Norma':
      branches = [
        make('armour_piercing', [0, 1], 'EX shot and armour-piercing missile.', [
          'target not stunned',
          'sufficient energy',
        ]),
        make('high_explosive', [0, 2], 'EX shot and high-explosive missile.', [
          'target stunned',
          'sufficient energy',
        ]),
        make(
          'held_armour_piercing',
          [0, 1, 3, 4],
          'EX and held extension against non-stunned target.',
          ['target not stunned', 'continuous hold energy'],
          [rate(3, 'held shooting exposure'), rate(4, 'held missile exposure')],
        ),
        make(
          'held_high_explosive',
          [0, 2, 3, 5],
          'EX and held extension against stunned target.',
          ['target stunned', 'continuous hold energy'],
          [rate(3, 'held shooting exposure'), rate(5, 'held missile exposure')],
        ),
      ]
      break
    case 'Soldier11':
      branches = [
        make('four_basic', [0, 1, 2, 3], 'Fire Suppression basic 1 through 4.', [
          'declare Fire Suppression timing',
        ]),
      ]
      if (input.potential == null) unresolvedIndices = [4, 5, 6]
      else if (!Number.isInteger(input.potential) || input.potential < 0 || input.potential > 6)
        return { status: 'unsupported' as const, blockers: ['invalid_soldier11_potential'] }
      else if (input.potential >= 1)
        branches.push(
          make('normal_fifth', [0, 1, 2, 3, 4], 'Normal fifth hit following four basics.', [
            'potential at least 1',
            'guaranteed Fire Suppression',
          ]),
          make(
            'enhanced_fifth',
            [0, 1, 2, 3, 5, 6],
            'Enhanced fifth after chain or ultimate.',
            [
              'potential at least 1',
              'chain or ultimate prepared enhancement',
              'declare number of guaranteed Fire Suppression uses consumed',
            ],
            [uses(6, 'additional hit coefficient applies per use consumed')],
          ),
        )
      break
    case 'Yixuan':
      branches = [
        make('uppercut', [0], 'EX wing uppercut.', ['sufficient Adrenaline']),
        make('uppercut_talisman', [0, 1], 'EX wing uppercut and talisman.', [
          'sufficient Adrenaline',
          'full charge or perfect block',
        ]),
        make(
          'uppercut_break',
          [0, 2],
          'EX uppercut then separately trigger Celestial Cloud Blitz - Break.',
          ['sufficient Adrenaline', 'trigger subsequent special'],
        ),
        make(
          'uppercut_talisman_break',
          [0, 1, 2],
          'Full-charge EX then separately trigger Celestial Cloud Blitz - Break.',
          ['sufficient Adrenaline', 'full charge or perfect block', 'trigger subsequent special'],
        ),
        make(
          'uppercut_break_final',
          [0, 2, 3],
          'Uppercut, Celestial Cloud Blitz - Break, then separately trigger final EX.',
          ['sufficient Adrenaline', 'trigger subsequent special', 'spend additional 20 Adrenaline'],
        ),
        make(
          'full_chain',
          [0, 1, 2, 3],
          'Full-charge uppercut and both explicitly triggered follow-ups.',
          [
            'sufficient Adrenaline',
            'full charge or perfect block',
            'trigger subsequent special',
            'spend additional 20 Adrenaline',
          ],
        ),
      ]
      break
    case 'Corin':
      branches = [
        make('release', [0, 2], 'Spinning slash then explosion.', ['sufficient EX energy']),
        make('full_hold', [0, 1, 2], 'Spinning slash, maximum extended slash, explosion.', [
          'complete maximum hold',
          'energy spent by successful held hits',
        ]),
      ]
      break
    case 'Burnice':
      branches = [
        make('double_spray', [0, 1], 'Enter double spray from EX, then fire blast.', [
          'preceding single-spray EX',
          'sufficient EX and hold energy',
          'declare spray duration and independently establish coefficient quantity',
        ]),
      ]
      unresolvedIndices = [0]
      break
  }
  return {
    status: 'supported' as const,
    branches,
    unresolvedIndices,
    sourceRefs: [
      `libs/zzz/formula/src/data/char/sheets/${row.upstreamKey}.ts#sha256=${row.formulaSha256}`,
      `${row.sourceUrl}#sha256=${row.sourceSha256}`,
    ],
    boundary,
  }
}
