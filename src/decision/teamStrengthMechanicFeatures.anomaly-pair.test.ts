import { describe, expect, it } from 'vitest'
import { memberFacts } from './teamStrengthMemberFacts'
import { extractTeamStrengthMechanicFeatures } from './teamStrengthMechanicFeatures'
import { value } from './teamStrengthMechanicFeatures.testFixture'

describe('source-backed anomaly pair capacity', () => {
  it('preserves special output without inventing a second disorder buildup channel', () => {
    const special = memberFacts('agent-remielle')!
    expect(special.attribute).toBe('lumiflux')
    expect(special.actionFacts.anomaly).toBeNull()
    const physicalPair = ['agent-jane', 'agent-piper', 'agent-remielle']
    expect(value(physicalPair, 'different_attribute_anomaly_pair')).toBe(0)
    expect(extractTeamStrengthMechanicFeatures(physicalPair).eligibility.eligible).toBe(true)
    expect(
      value(['agent-jane', 'agent-burnice', 'agent-remielle'], 'different_attribute_anomaly_pair'),
    ).toBe(1)
    expect(
      value(['agent-miyabi', 'agent-yanagi', 'agent-astra'], 'different_attribute_anomaly_pair'),
    ).toBe(1)
  })
})
