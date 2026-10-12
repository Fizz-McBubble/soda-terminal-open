import projection from './potentialDetailProjection.json'
import type { SnapshotObservation } from './snapshotProtocolSchema'

/** Static definition IDs only; never derive an account level by dividing an unknown ID. */
export const potentialDetailSourceContract = Object.freeze({
  ...projection,
  protocolVersion: '3.2',
  upstreamCommit: '4853f07c8fb5322c12b9b580d6364b577c2ac96a',
  protocolSourceSha256: {
    manifest: '38006e92317cf8eba3e578d58e5b0fc9aecfec117d20dc375aa9bed2b073302e',
    datamine: '9702ab5ee0cb44a18d8d3be9ae2c5934deb4883989ada292a3bbd44654efb449',
    nap: '2dfb176209ceceab5ab53701f12fa3050ad70140004118b7a80ac32a01df982d',
  },
  commandId: 2470,
  containerField: 2,
  agentSchema: 'OCNCGOBPHLA',
  fieldNumber: 665,
  fieldName: 'ENNAMBHGLGD',
  schemaType: 'uint32',
  repeated: false,
  xorValue: 1715,
  observationStage: 'after_locked_protocol_xor',
})

const definitions = new Map(projection.rows.map((row) => [row.id, row]))

export function observePotentialDetail(
  observation: SnapshotObservation | undefined,
  gameAgentId: number,
): { level?: number; warning?: string } {
  if (!observation || observation.presence === 'omitted') return {}
  if (observation.presence === 'invalid') return { warning: '潜能字段无法解析；本次保留原值。' }
  const definition = definitions.get(observation.value)
  if (!definition) return { warning: '潜能细节ID未识别；本次不作为潜能观测，保留原值。' }
  if (definition.gameId !== gameAgentId)
    return { warning: '潜能细节ID与代理人不一致；本次不作为潜能观测，保留原值。' }
  if (!Number.isInteger(definition.level) || definition.level < 0 || definition.level > 6)
    return { warning: '潜能定义级数不合法；本次不作为潜能观测，保留原值。' }
  return { level: definition.level }
}
