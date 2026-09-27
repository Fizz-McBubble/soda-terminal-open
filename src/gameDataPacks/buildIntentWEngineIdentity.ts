import { currentWEngineDirectory } from '../assault/planningCatalog'

const stableWEngineIds = new Set(currentWEngineDirectory.map((engine) => engine.id))

/**
 * Exact source-label adoption ledger. Each entry resolves an existing sourced Build Intent label
 * to the current catalog identity; it is deliberately not a display-name or fuzzy lookup.
 */
export const adoptedBuildIntentWEngineIds: Readonly<Record<string, string>> = {
  'Angel in the Shell': 'wengine-14150',
  'Flight of Fancy': 'wengine-14133',
  'Flamemaker Shaker': 'wengine-14117',
  'Practiced Perfection': 'wengine-14140',
  'Electro-Lip Gloss': 'wengine-13009',
  'Weeping Gemini': 'wengine-13008',
  'Cordis Germina': 'wengine-14146',
  'The Brimstone': 'wengine-14104',
  'Riot Suppressor Mark VI': 'wengine-14124',
  'Marcato Desire': 'wengine-13015',
  'Elegant Vanity': 'wengine-14131',
  'Bashful Demon': 'wengine-13113',
  'Kaboom the Cannon': 'wengine-13115',
  'The Vault': 'wengine-13103',
  'Qingming Birdcage': 'wengine-14137',
  'Cauldron of Clarity': 'wengine-13019',
  'Radiowave Journey': 'wengine-13014',
  'Puzzle Sphere': 'wengine-13012',
  'Dreamlit Hearth': 'wengine-14145',
  'Weeping Cradle': 'wengine-14121',
  'Unfettered Game Ball': 'wengine-14002',
  'Yesterday Calls': 'wengine-14148',
  'Hellfire Gears': 'wengine-14110',
  'Steam Oven': 'wengine-13005',
  'Precious Fossilized Core': 'wengine-13006',
  'Half-Sugar Bunny': 'wengine-14134',
  'Tusks of Fury': 'wengine-14107',
  'Original Transmorpher': 'wengine-13007',
  Thoughtbop: 'wengine-14149',
  Metanukimorphosis: 'wengine-14141',
  'Neon Fantasies': 'wengine-14151',
  'The Simmering Pot': 'wengine-13020',
  'Roaring Fur-nace': 'wengine-14139',
  'Chief Sidekick': 'wengine-14157',
  'Blazing Laurel': 'wengine-14116',
  'Starlight Rider Faceplate': 'wengine-14153',
  'Steel Cushion': 'wengine-14102',
  "Grill O'Wisp": 'wengine-13144',
  'Serpentine Seeker': 'wengine-14152',
  'Bellicose Blaze': 'wengine-14130',
  'Wrathful Vajra': 'wengine-14147',
  "Kraken's Cradle": 'wengine-14105',
  'Heartstring Nocturne': 'wengine-14132',
  'Severed Innocence': 'wengine-14138',
  'Myriad Eclipse': 'wengine-14129',
  'Gilded Blossom': 'wengine-13013',
  'Sharpened Stinger': 'wengine-14126',
  'Fusion Compiler': 'wengine-14118',
  'Spectral Gaze': 'wengine-14136',
  'Ice-Jade Teapot': 'wengine-14125',
  'The Restrained': 'wengine-14114',
  'Hailstorm Shrine': 'wengine-14109',
  'Rainforest Gourmet': 'wengine-13003',
  'Zanshin Herb Case': 'wengine-14120',
  'Starlight Engine': 'wengine-13004',
  'Spring Embrace': 'wengine-13011',
  'Peacekeeper - Specialized': 'wengine-13127',
  Timeweaver: 'wengine-14122',
  'Slice of Time': 'wengine-13002',
  '[Reverb] Mark II': 'wengine-12005',
  'Bunny Band': 'wengine-13010',
  // Exact localized labels in historical source fields; no whitespace normalization is applied.
  '「恒等式」- 本格': 'wengine-12013',
  '「恒等式」- 变格': 'wengine-12014',
  // These labels identify a named agent's signature. The ID is adopted only for that exact label.
  'Ju Fufu 的专属音擎': 'wengine-14139',
  伊芙琳的专属音擎: 'wengine-14132',
  柳的专属音擎: 'wengine-14122',
  本的专属音擎: 'wengine-13112',
  硫磺石: 'wengine-14104',
  牺牲洁纯: 'wengine-14138',
  强音热望: 'wengine-13015',
  加农转子: 'wengine-14001',
  钢铁肉垫: 'wengine-14102',
  嵌合编译器: 'wengine-14118',
  兔能环: 'wengine-13010',
}

/** Adopted agent relation used only when the projected Build Intent has no resolvable option. */
const adoptedAgentBuildIntentWEngineIds: Readonly<Record<string, readonly string[]>> = {
  // gameData31RemielleEquipmentIntake: project stable ID + current account-ownable catalog entry.
  'agent-remielle': ['wengine-14158'],
}

export function resolveBuildIntentWEngineIds(agentId: string, values: readonly string[]) {
  const resolved = values
    .map((value) => (stableWEngineIds.has(value) ? value : adoptedBuildIntentWEngineIds[value]))
    .filter((engineId): engineId is string => Boolean(engineId && stableWEngineIds.has(engineId)))
  const fallback = adoptedAgentBuildIntentWEngineIds[agentId] ?? []
  return [
    ...new Set(resolved.length ? resolved : fallback.filter((id) => stableWEngineIds.has(id))),
  ]
}
