import { beforeEach, describe } from 'vitest'
import { FakeEventSource } from './runtime.testFixture'
import { registerruntimeLifecycleCases1 as registerRuntimeLifecycleCases1 } from './runtimeLifecycleCases1'
import { registerruntimeLifecycleCases2 as registerRuntimeLifecycleCases2 } from './runtimeLifecycleCases2'
import { registerRuntimeResultTests } from './runtimeResultTests'

describe('direct upstream scanner runtime', () => {
  registerRuntimeResultTests()
  beforeEach(() => {
    FakeEventSource.latest = null
    FakeEventSource.instances = []
  })

  registerRuntimeLifecycleCases1()
  registerRuntimeLifecycleCases2()
})
