/** The pinned formula and its localization disagree on the provider's eligibility. */
export const reviewedWEngineReceiverSemantics32Identity = Object.freeze({
  id: 'crimson-moon-casket-receiver-overlay-3.2-v3',
  gameVersion: '3.2',
  sourceVersions: ['3.2', '3.2-phase-ii'] as readonly string[],
  sourceCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaSha256: 'd8af60c4f8bfa0685fe6364d00c443ed216912a0714ea3d16e8cbe87d9068b6a',
  descriptionSha256: '014e3052ae751ba952576d57cf1684d091e0fdfd75b2fd38bd8fc6e36dcba446',
  sourcePath: 'libs/zzz/dm-localization/assets/locales/en/wengine_CrimsonMoonCasket_gen.json',
  rule: 'other_squad_members_only; one_active_instance; repeated_trigger_refreshes',
  boundary:
    'An event observation must establish activation. This adapter creates no trigger or duration.',
})

/** Fire qualifies the trigger, while the resulting damage bonus has no attribute restriction. */
export const reviewedRoaringFurnaceReceiverSemantics32Identity = Object.freeze({
  id: 'roaring-furnace-all-attribute-receiver-overlay-3.3-v1',
  gameVersion: '3.3',
  sourceVersions: ['3.2', '3.2-phase-ii'] as readonly string[],
  sourceCommit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  formulaSha256: 'e4865e7b560db8298c7ec92032e39a778139e5784122c72c7217b0283fa1faa9',
  dataSha256: '8229b2845d3daf28f89abedb3a6275664579409a77136b595dcc280a4e00336b',
  descriptionSha256: '9ff6f6af6f165b82fac3268ff18ab925f2a918bc4f5ce0c11f25016fe1d81880',
  sourcePath: 'libs/zzz/formula/src/data/wengine/sheets/RoaringFurnace.ts',
  descriptionUrl: 'https://static.nanoka.cc/zzz/3.3/zh/weapon/14139.json',
  rule: 'fire_chain_or_ultimate_hit_trigger; all_squad_members_all_attributes; max_two_stacks; one_active_instance',
  boundary:
    'Requires observed active stacks from qualifying hits within their individual 30s windows; no trigger, stack or duration is created by receiver reconciliation.',
})
