import { z } from 'zod'

const uint = z.number().int().min(0).max(0xffffffff)
const observation = z.discriminatedUnion('presence', [
  z.object({ presence: z.literal('present'), value: uint }),
  z.object({ presence: z.literal('omitted'), value: z.null() }),
])
export type SnapshotObservation = z.infer<typeof observation>

const stat = z.object({ key: observation, base_value: observation, add_value: observation })
const discRecord = z.object({
  uid: observation,
  catalog_id: observation,
  level: observation,
  main_stat: stat.nullable(),
  substats: z.array(stat).max(4),
})
const engineRecord = z.object({
  uid: observation,
  catalog_id: observation,
  level: observation,
  phase: observation,
  modification: observation,
})
const agentRecord = z.object({
  catalog_id: observation,
  level: observation,
  promotion: observation,
  weapon_uid: observation,
  mindscape: observation,
  potential_detail_id: observation.optional(),
  skills: z.array(z.object({ skill_type: observation, level: observation })).max(6),
  dressed_equips: z.array(z.object({ uid: observation, slot: observation })).max(6),
})
export type SnapshotAgentRecord = z.infer<typeof agentRecord>
/** Unknown transport/security fields are stripped and never copied into account candidates. */
export const assetSnapshotSchema = z.object({
  schema: z.literal('soda-asset-snapshot-probe/v1'),
  status: z.enum(['staged_for_field_review', 'response_semantics_unverified']),
  source: z.object({
    upstream_commit: z.literal('4853f07c8fb5322c12b9b580d6364b577c2ac96a'),
    protocol_version: z.literal('3.2'),
    requested_game_region: z.literal('CN'),
    mode: z.literal('live_copy_only_client_cn_configuration_candidate'),
    capture_started_unix_seconds: z.number().int().positive().max(253402300799),
  }),
  coverage: z.object({
    disc_load_received: z.literal(true),
    engine_load_received: z.literal(true),
    agent_load_received: z.literal(true),
  }),
  counts: z.object({
    discs: uint.max(3000),
    s_discs: uint.max(3000),
    a_discs: uint.max(3000),
    b_discs: uint.max(3000),
    unknown_rarity_discs: uint.max(3000),
    engines: uint.max(10000),
    agents: uint.max(1000),
  }),
  counters: z.object({ decoded_messages: uint.min(3) }),
  response_observations: z
    .array(
      z.object({
        kind: z.enum(['discs', 'engines', 'agents']),
        command_id: uint,
        status_field: uint,
        status_value: z.number().int().nullable(),
        status_presence: z.enum(['present', 'omitted']),
        assessment: z.enum(['zero_semantics_unverified', 'omitted_semantics_unverified']),
        status_semantics_verified: z.boolean(),
      }),
    )
    .length(3),
  issues: z.array(z.object({ code: z.string(), asset: z.string(), field: z.string() })).max(100),
  assets: z.object({
    discs: z.array(discRecord).max(3000),
    engines: z.array(engineRecord).max(10000),
    agents: z.array(agentRecord).max(1000),
  }),
  independent_inventory_total_verified: z.boolean(),
  full_inventory_verified: z.boolean(),
  ready_for_account_import: z.boolean(),
  account_write_enabled: z.literal(false),
  raw_traffic_saved: z.literal(false),
  response_status_semantics_verified: z.boolean(),
})
