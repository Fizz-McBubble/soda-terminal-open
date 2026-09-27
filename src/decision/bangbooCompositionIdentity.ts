/** The adopted agent catalog and Bangboo contracts use different names for the
 * same factions. These are identity aliases, not inferred faction membership. */
const factionAliases: Readonly<Record<string, string>> = {
  BelebogHeavyIndustries: 'belobog_heavy_industries',
  VictoriaHousekeepingCo: 'victoria_housekeeping',
  CriminalInvestigationSpecialResponseTeam: 'new_eridu_public_security',
  HollowSpecialOoperationsSection6: 'hollow_special_operations_6',
  NewEriduDefenseForce: 'defense_force',
  RoscaeliferExternalStrategyDepartment: 'roscaelifer',
}

export function bangbooFactionCompositionKey(faction: string) {
  return `faction:${
    factionAliases[faction] ??
    faction
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([a-zA-Z])(\d)/g, '$1_$2')
      .toLowerCase()
  }`
}
