import { formalDamageUnsupportedReason } from '../calculation/damageGate'
import { FormalDamageWhitebox } from '../components/FormalDamageWhitebox'

export { InvalidPlan } from './InvalidPlan'

export function FormalDamageGateNotice() {
  const gate = formalDamageUnsupportedReason()
  return (
    <FormalDamageWhitebox
      result={{
        status: 'unsupported',
        gate,
        reason: gate.missing.map((item) => item.reason).join('；'),
      }}
    />
  )
}
