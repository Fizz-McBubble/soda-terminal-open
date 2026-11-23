import type { z } from 'zod'
import { assetSnapshotProtocols, type assetSnapshotSchema } from './snapshotProtocolSchema'

type SnapshotResponses = Pick<
  z.infer<typeof assetSnapshotSchema>,
  'source' | 'response_observations'
>

/** Validate observed response identity and status without changing its authority. */
export function validateSnapshotResponses(
  snapshot: SnapshotResponses,
  issue: (code: string, message: string) => void,
) {
  const expectedResponses = assetSnapshotProtocols[snapshot.source.protocol_version].responses
  const responseKinds = new Set<string>()
  for (const response of snapshot.response_observations) {
    const expected = expectedResponses[response.kind]
    if (
      responseKinds.has(response.kind) ||
      response.command_id !== expected[0] ||
      response.status_field !== expected[1] ||
      (response.status_presence === 'omitted'
        ? response.status_value !== null || response.assessment !== 'omitted_semantics_unverified'
        : response.status_value !== 0 || response.assessment !== 'zero_semantics_unverified')
    )
      issue('invalid_response_observation', '三类读取响应身份或状态不符合当前观察范围。')
    responseKinds.add(response.kind)
  }
}
