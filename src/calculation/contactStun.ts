type DazeState = { daze: number; stunEnd: number }
type DazeTarget = { dazeCap: number; stunSeconds: number }

/** A full bar can wait for a finishing hit. Resolve that hit against the incoming state. */
export function advanceDaze(
  previous: DazeState,
  at: number,
  amount: number,
  heavy: boolean,
  target: DazeTarget,
) {
  if (!Number.isFinite(amount) || amount < 0 || typeof heavy !== 'boolean')
    throw new Error('invalid_daze_contact')
  const stunned = at < previous.stunEnd
  const value = stunned ? previous.daze : Math.min(target.dazeCap, previous.daze + amount)
  const entered = !stunned && value >= target.dazeCap && heavy
  return {
    daze: entered ? 0 : value,
    stunEnd: entered ? at + target.stunSeconds : previous.stunEnd,
    stunned,
    entered,
  }
}

/** A declared initial window applies on entry. A contact-triggered window starts after its trigger. */
export function isStunnedOnContact(
  event: { at: number; contactOrder?: number },
  window: { start: number; end: number; activationEventId?: string },
  contactOrders: ReadonlyMap<string, number | undefined>,
) {
  if (event.at < window.start || event.at >= window.end) return false
  if (event.at > window.start || !window.activationEventId) return true
  const triggerOrder = contactOrders.get(window.activationEventId)
  return (
    triggerOrder !== undefined &&
    event.contactOrder !== undefined &&
    event.contactOrder > triggerOrder
  )
}
