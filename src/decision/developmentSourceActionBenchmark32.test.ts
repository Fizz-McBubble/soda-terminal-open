import { describe } from 'vitest'
import { registerDevelopmentSourceWindowTests32 } from './developmentSourceActionBenchmark32.windows.testCases'
import { registerDevelopmentPreparedActionTests32 } from './developmentSourceActionBenchmark32.prepared.testCases'
describe('3.2 existing development comparison source actions', () => {
  registerDevelopmentSourceWindowTests32()
  registerDevelopmentPreparedActionTests32()
})
