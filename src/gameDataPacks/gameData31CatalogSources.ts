export type GameData31CatalogEntity = {
  id: string
  domain: 'agent' | 'wengine' | 'bangboo' | 'drive_disc_set' | 'enemy_mode'
  displayName: string
  /** A source-page identity is not presented as a client/game numeric ID. */
  identity: {
    kind: 'project_catalog' | 'source_page' | 'game_evidence' | 'unresolved'
    projectStableId: string | null
    /** Never inferred from a localized name; present only when the evidence page exposes it. */
    gameStableId?: string
    sourceLocator: string
  }
  status: 'candidate' | 'missing'
  fields: Record<string, string | number | null>
  source: {
    id: string
    url: string
    sourceVersion: '3.1' | '3.2'
    checkedAt: string
    contentHash: string
    licenseBoundary: string
  }
  gaps: string[]
}

export type GameData31FieldConflict = {
  entityId: string
  fieldPath: string
  candidates: Array<{ sourceId: string; value: string }>
  status: 'unresolved'
  effect: string
}

export type GameData31CombatFieldEvidence = {
  entityId: string
  fieldPath: string
  status: 'candidate' | 'missing'
  value: string | number | null
  source: {
    id: string
    url: string
    sourceVersion: '3.1'
    checkedAt: string
    contentHash: string
    licenseBoundary: string
  }
  /** Human-auditable page location, not copied source prose. */
  locator: string
  effect: string
}

const checkedAt = '2026-07-29T00:00:00.000Z'
export const bwiki31Url =
  'https://wiki.biligame.com/zzz/%E7%BB%9D%E5%8C%BA%E9%9B%B63.1%E7%89%88%E6%9C%AC%E5%89%8D%E7%9E%BB%E7%9B%B4%E6%92%AD%E6%80%BB%E7%BB%93'
export const remielleGameEvidenceUrl =
  'https://zzz.gachabase.net/agents/1581/remielle/creator?lang=en'
export const sigridGameEvidenceUrl = 'https://zzz.gachabase.net/agents/1591/1591/beta'
export const odeGameEvidenceUrl =
  'https://zzz.gachabase.net/w-engines/14158/ode-of-resurrected-wings/creator/3.1.12/17599459'
export const knightsExtolmentGameEvidenceUrl =
  'https://zzz.gachabase.net/w-engines/14159/knights-extolment/creator/3.1.12/18172372'
export const arielGameEvidenceUrl = 'https://zzz.gachabase.net/bangboo/54023/ariel/creator'
export const featheredFateGameEvidenceUrl =
  'https://zzz.gachabase.net/drive-discs/34100/feathered-fate/beta/3.1.4/17256074'
export const thornedRoseGameEvidenceUrl =
  'https://zzz.gachabase.net/drive-discs/34200/thorned-rose/beta/3.1.2/16857772'
export const deadlyAssaultOfficialUrl =
  'https://zenless.hoyoverse.com/en-us/news/165369?catchSpider=1'

export const candidateBoundary =
  '社区资料仅作 3.1 候选仓库约束；不进入 formal、D0、精确 DPS、最高伤害或自动写入。'

export function source(
  id: string,
  url: string,
  contentHash: string,
  licenseBoundary: string,
  sourceCheckedAt = checkedAt,
) {
  return {
    id,
    url,
    sourceVersion: '3.1' as const,
    checkedAt: sourceCheckedAt,
    contentHash,
    licenseBoundary,
    verified: true,
  }
}

export const gameEvidenceBoundary =
  '公开游戏数据视图：仅保存页面直接暴露的最小结构化字段、定位与内容身份，作为 3.1 candidate/game-evidence；不是官方事实，不复制页面内容，不进入 formal。'
