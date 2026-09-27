/**
 * The smallest executable boundary for the three confirmed R3 golden pages.
 * It records what production must preserve; it is not a second design source.
 */
export const agentDevelopmentGoldenContract = {
  version: 'M7-F5-R3',
  motionContract: 'SODA-MOTION-R1',
  evidenceRoot: "soda-source-ref:6667299889398095f116f90daf04e0b9",
  viewports: [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ],
  pages: {
    overview: {
      path: '/development',
      evidence: '1440x900-overview.png',
      requiredControls: [
        'agent-search',
        'recommendation-filter',
        'saved-plan-filter',
        'continue-development',
      ],
      assetSlots: {
        compactAgent: 'agent.factual-card',
        recommendationIdentity: 'agent.square-avatar',
      },
    },
    workbench: {
      path: '/development/:agentId',
      evidence: '1440x900-workbench.png',
      requiredControls: [
        'return-to-directory',
        'edit-account-record',
        'plan-tabs',
        'compare-loadouts',
      ],
      assetSlots: {
        heroAgent: 'agent.hero',
        engine: 'wengine.equipment-icon',
        driveDisc: 'drive-disc-set.icon',
      },
    },
    comparison: {
      path: '/development/:agentId/loadouts',
      evidence: '1440x900-top10.png',
      requiredControls: ['return-to-workbench', 'comparison-sort', 'plan-slot-save'],
      assetSlots: { driveDisc: 'drive-disc-set.icon' },
    },
  },
  migrationInvariants: {
    sharedApplicationShell: true,
    productionFixtureImports: false,
    noAvatarCropping: true,
    coldStartJourney: true,
    assetSlotRegistry: 'SODA-GRAPHIC-ASSET-LIBRARY-R1',
  },
} as const

export type AgentDevelopmentGoldenContract = typeof agentDevelopmentGoldenContract
