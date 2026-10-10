const present = (value: number) => ({ presence: 'present' as const, value })
const omitted = () => ({ presence: 'omitted' as const, value: null })
const stat = (key: number, base: number, add = 1) => ({
  key: present(key),
  base_value: present(base),
  add_value: present(add),
})

export function syntheticWorkbenchQuickSnapshot() {
  return {
    schema: 'soda-asset-snapshot-probe/v1',
    status: 'response_semantics_unverified',
    source: {
      upstream_commit: '4853f07c8fb5322c12b9b580d6364b577c2ac96a',
      protocol_version: '3.2',
      requested_game_region: 'CN',
      mode: 'live_copy_only_client_cn_configuration_candidate',
      capture_started_unix_seconds: 1791564061,
    },
    coverage: { disc_load_received: true, engine_load_received: true, agent_load_received: true },
    counts: {
      discs: 1,
      s_discs: 1,
      a_discs: 0,
      b_discs: 0,
      unknown_rarity_discs: 0,
      engines: 1,
      agents: 1,
    },
    counters: { decoded_messages: 3 },
    response_observations: (['discs', 'engines', 'agents'] as const).map((kind) => ({
      kind,
      command_id: { discs: 3933, engines: 1382, agents: 2470 }[kind],
      status_field: kind === 'agents' ? 8 : 12,
      status_value: null as number | null,
      status_presence: 'omitted',
      assessment: 'omitted_semantics_unverified',
      status_semantics_verified: false,
    })),
    issues: [] as { code: string; asset: string; field: string }[],
    independent_inventory_total_verified: false,
    full_inventory_verified: false,
    ready_for_account_import: false,
    account_write_enabled: false,
    raw_traffic_saved: false,
    response_status_semantics_verified: false,
    assets: {
      discs: [
        {
          uid: present(990001),
          catalog_id: present(31041),
          level: present(15),
          main_stat: stat(11103, 550),
          substats: [stat(13102, 480, 3), stat(20103, 240), stat(12102, 300), stat(21103, 480, 3)],
        },
      ],
      engines: [
        {
          uid: present(990101),
          catalog_id: present(14110),
          level: present(60),
          phase: present(1),
          modification: present(5),
        },
      ],
      agents: [
        {
          catalog_id: present(1101),
          level: present(60),
          promotion: present(6),
          mindscape: omitted() as ReturnType<typeof present> | ReturnType<typeof omitted>,
          weapon_uid: present(990101) as ReturnType<typeof present> | ReturnType<typeof omitted>,
          skills: [6, 5, 3, 2, 1, 0].map((type) => ({
            skill_type: type === 0 ? omitted() : present(type),
            level: present(type === 5 ? 7 : 11),
          })),
          dressed_equips: [{ uid: present(990001), slot: present(1) }],
        },
      ],
    },
  }
}
