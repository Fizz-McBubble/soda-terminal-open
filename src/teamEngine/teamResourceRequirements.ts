/** A stun window is a combat condition, not an exclusive resource produced by
 * the Stun specialty. Any team can accumulate daze. Dedicated stunners affect
 * access/frequency, which must be evaluated separately from resource validity.
 * Keep explicit kernel prerequisites intact: a specific rotation can still
 * require a dedicated producer, unlike an agent's general consumption tags. */
export function requiredAgentResources(tags: readonly string[]): string[] {
  return tags.filter((tag) => tag !== 'stun_window')
}
