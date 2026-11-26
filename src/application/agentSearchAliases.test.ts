import { describe, expect, it } from 'vitest'
import { matchesAgentSearchQuery } from './agentSearchAliases'

describe('agent search aliases', () => {
  it('matches unified Chinese names, full names, dotless names, English names and CN nicknames', () => {
    expect(matchesAgentSearchQuery('agent-miyabi', '星见雅', 'Miyabi')).toBe(true)
    expect(matchesAgentSearchQuery('agent-miyabi', '星见雅', '烈霜')).toBe(true)
    expect(matchesAgentSearchQuery('agent-soldier-0-anby', '零号·安比', '大安比')).toBe(true)
    expect(matchesAgentSearchQuery('agent-soldier-0-anby', '零号·安比', '零号安比')).toBe(true)
    expect(matchesAgentSearchQuery('agent-lycaon', '莱卡恩', '狼叔')).toBe(true)
    expect(matchesAgentSearchQuery('agent-ellen', '艾莲', '鲨鱼妹')).toBe(true)
    expect(matchesAgentSearchQuery('agent-ellen', '艾莲', '艾莲·乔')).toBe(true)
    expect(matchesAgentSearchQuery('agent-soldier-11', '「11号」', '11')).toBe(true)
    expect(matchesAgentSearchQuery('agent-astra', '耀嘉音', 'Astra')).toBe(true)
    expect(matchesAgentSearchQuery('agent-seed', '「席德」', 'Seed')).toBe(true)
    expect(matchesAgentSearchQuery('agent-remielle', '蕾米埃尔·丹', '蕾米埃尔丹')).toBe(true)
    expect(matchesAgentSearchQuery('agent-sigrid', '希格莉德·德拉叙尔', 'Sigrid')).toBe(true)
    expect(matchesAgentSearchQuery('agent-billy', '比利', '比利·奇德')).toBe(true)
    expect(matchesAgentSearchQuery('agent-billy', '比利', 'Miyabi')).toBe(false)
  })
})
