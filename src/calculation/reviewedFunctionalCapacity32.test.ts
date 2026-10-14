import { afterEach, describe, vi } from 'vitest'
import { registerCoreFunctionalCapacityTests32 } from './reviewedFunctionalCapacity32.core.testCases'
import { registerLycaonFunctionalCapacityTests32 } from './reviewedFunctionalCapacity32.lycaon.testCases'
import { registerBurniceFunctionalCapacityTests32 } from './reviewedFunctionalCapacity32.burnice.testCases'
import { registerSourceDazeGuardTests32 } from './reviewedFunctionalCapacity32.guards.testCases'
afterEach(() => vi.restoreAllMocks())

describe('source generation capacity and event daze basis consumed as functional constraints', () => {
  registerCoreFunctionalCapacityTests32()
  registerLycaonFunctionalCapacityTests32()
  registerBurniceFunctionalCapacityTests32()
  registerSourceDazeGuardTests32()
})
