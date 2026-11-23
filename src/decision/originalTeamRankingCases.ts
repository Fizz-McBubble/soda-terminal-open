/** The original nine regressions retain their identities and both sides.
 * Preferences refer to the locked formed reference intervals, not DPS. */
export const originalTeamRankingCases = [
  {
    id: 'original-1',
    left: ['alice', 'corin', 'nicole'],
    right: ['lycaon', 'miyabi', 'soukaku'],
    referencePreference: 'right_preferred',
  },
  {
    id: 'original-2',
    left: ['alice', 'corin', 'nicole'],
    right: ['piper', 'velina', 'yuzuha'],
    referencePreference: 'right_preferred',
  },
  {
    id: 'original-3',
    left: ['aria', 'nangong', 'sunna'],
    right: ['nangong', 'promeia', 'yuzuha'],
    referencePreference: 'not_strictly_ordered',
  },
  {
    id: 'original-4',
    left: ['aria', 'sunna', 'yuzuha'],
    right: ['nangong', 'promeia', 'yuzuha'],
    referencePreference: 'not_strictly_ordered',
  },
  {
    id: 'original-5',
    left: ['astra', 'qingyi', 'zhu-yuan'],
    right: ['dialyn', 'sunna', 'ye-shunguang'],
    referencePreference: 'right_preferred',
  },
  {
    id: 'original-6',
    left: ['astra', 'qingyi', 'zhu-yuan'],
    right: ['sunna', 'ye-shunguang', 'zhao'],
    referencePreference: 'right_preferred',
  },
  {
    id: 'original-7',
    left: ['caesar', 'jane', 'seth'],
    right: ['nicole', 'promeia', 'soukaku'],
    referencePreference: 'not_strictly_ordered',
  },
  {
    id: 'original-8',
    left: ['dialyn', 'sunna', 'ye-shunguang'],
    right: ['trigger', 'ye-shunguang', 'zhao'],
    referencePreference: 'not_strictly_ordered',
  },
  {
    id: 'original-9',
    left: ['nicole', 'promeia', 'soukaku'],
    right: ['piper', 'velina', 'yuzuha'],
    referencePreference: 'right_preferred',
  },
] as const
