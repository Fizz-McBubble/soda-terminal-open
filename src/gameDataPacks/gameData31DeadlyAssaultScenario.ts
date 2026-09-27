import {
  evaluateDamageCalculationGate,
  type DamageCalculationContext,
} from '../calculation/damageGate'
import { stableContentHash } from './types'

type ScenarioFieldStatus = 'candidate' | 'missing' | 'conflict'

export type GameData31ScenarioField = {
  field: 'enemy' | 'difficulty' | 'defense' | 'resistance' | 'stun' | 'phase' | 'rotation' | 'buff'
  status: ScenarioFieldStatus
  value: string | number | string[] | null
  source: {
    id: string
    url: string
    sourceVersion: '3.1'
    checkedAt: string
    contentHash: string
    licenseBoundary: string
  }
  locator: string
  note: string
}

export type GameData31DeadlyAssaultScenario = {
  id: string
  displayName: string
  status: 'candidate' | 'missing'
  fields: GameData31ScenarioField[]
  calculationContext: {
    status: 'unavailable'
    requiredMissing: string[]
    reason: string
  }
}

const checkedAt = '2026-07-29T00:00:00.000Z'
const officialSystemUrl = 'https://zenless.hoyoverse.com/en-us/news/165369?catchSpider=1'
const publicUpdateMirrorUrl =
  'https://changelog.gg/games/zenless-zone-zero-4162040/updates/2026-07-28-version-3-1-the-long-goodbye-update-announcement-8ec78d9254e02e55'

function source(
  id: string,
  url: string,
  contentHash: string,
  licenseBoundary: string,
): GameData31ScenarioField['source'] {
  return { id, url, sourceVersion: '3.1', checkedAt, contentHash, licenseBoundary }
}

const officialScopeSource = source(
  'official-3.1-deadly-assault-system-update',
  officialSystemUrl,
  'official-news-165369-2026-07-27-deadly-assault-scope',
  '官方系统公告仅作为 3.1 玩法范围与解锁机制来源；未保存图片、视频或未公开的敌人数值。',
)
const publicRosterSource = source(
  'public-3.1-update-deadly-assault-roster',
  publicUpdateMirrorUrl,
  'changeloggg-3.1-update-2026-07-28-deadly-assault-phase-roster',
  '公开更新公告镜像仅作候选敌人名单交叉定位；许可未登记，不复制原文、不作为 formal 数值来源。',
)

const contextMissing = [
  'enemy.defense',
  'enemy.resistance',
  'enemy.stun_multiplier',
  'cycle.duration',
  'cycle.buff_coverage',
]

const core = {
  id: 'deadly-assault-3.1-adversity-phase-i',
  displayName: '危局强袭战：绝境模式（3.1）',
  status: 'candidate' as const,
  fields: [
    {
      field: 'difficulty' as const,
      status: 'candidate' as const,
      value: '当期危局强袭战获得 9 星后解锁绝境模式；单一首领挑战，敌人生命值降低时攻击更危险。',
      source: officialScopeSource,
      locator: 'Ridu Renovation Talk Vol. 13 > Version 3.1 Deadly Assault updates',
      note: '仅确认模式范围与解锁条件，不能推出敌人或数值。',
    },
    {
      field: 'rotation' as const,
      status: 'candidate' as const,
      value: [
        'Girtablullu - Stagnant Aberrant',
        'Notorious - Dead End Butcher',
        'Unknown Corruption Complex',
      ],
      source: publicRosterSource,
      locator: 'Version 3.1 update announcement mirror > Deadly Assault > Phase I enemies',
      note: '候选名单交叉定位；并非 DEF/RES/失衡或场景计算证据。',
    },
    {
      field: 'enemy' as const,
      status: 'missing' as const,
      value: null,
      source: officialScopeSource,
      locator: '官方系统公告未指定绝境模式固定首领的可计算身份与等级字段',
      note: '名单不能代替单一可计算敌人快照。',
    },
    {
      field: 'defense' as const,
      status: 'missing' as const,
      value: null,
      source: officialScopeSource,
      locator: '官方系统公告未公开敌人 DEF',
      note: '缺少 D0 enemySnapshot.defense。',
    },
    {
      field: 'resistance' as const,
      status: 'missing' as const,
      value: null,
      source: officialScopeSource,
      locator: '官方系统公告未公开属性 RES',
      note: '缺少 D0 enemySnapshot.resistance。',
    },
    {
      field: 'stun' as const,
      status: 'missing' as const,
      value: null,
      source: officialScopeSource,
      locator: '官方系统公告未公开失衡倍率/阈值',
      note: '缺少 D0 enemySnapshot.stunMultiplier。',
    },
    {
      field: 'phase' as const,
      status: 'missing' as const,
      value: null,
      source: officialScopeSource,
      locator: '官方系统公告仅描述随生命值变化的挑战强度，未提供可计算阶段阈值',
      note: '不能从难度描述推断阶段。',
    },
    {
      field: 'buff' as const,
      status: 'missing' as const,
      value: null,
      source: officialScopeSource,
      locator: '官方系统公告未公开固定增益/惩罚及持续时间',
      note: '缺少循环 Buff 覆盖，候选也不能输出 DPS。',
    },
  ],
  calculationContext: {
    status: 'unavailable' as const,
    requiredMissing: contextMissing,
    reason:
      '3.1 绝境模式缺少同版本固定敌人、DEF/RES/失衡、阶段与循环增益字段；不创建 DamageCalculationContext。',
  },
}

export const gameData31DeadlyAssaultScenario = {
  ...core,
  contentHash: stableContentHash(core),
} as const

/** A 3.1 candidate scenario is intentionally unusable by the formal D0 gate. */
export function evaluateGameData31DeadlyAssaultGate() {
  const incompleteContext: DamageCalculationContext = {
    contextId: gameData31DeadlyAssaultScenario.id,
    calculationModelVersion: 'damage-direct-v1',
    gameVersion: '3.1',
    gameBase: {
      id: 'game-base-3.1-candidate',
      packageVersion: '3.1-candidate',
      contentHash: gameData31DeadlyAssaultScenario.contentHash,
      gameVersion: '3.1',
      status: 'candidate',
    },
    buildKnowledge: {
      id: 'build-knowledge-3.1-candidate',
      packageVersion: '3.1-candidate',
      contentHash: gameData31DeadlyAssaultScenario.contentHash,
      gameVersion: '3.1',
      status: 'candidate',
      profileId: 'missing',
      profileHash: 'missing',
    },
    rotation: {
      id: 'rotation-3.1-deadly-assault-missing',
      packageVersion: '3.1-candidate',
      contentHash: gameData31DeadlyAssaultScenario.contentHash,
      gameVersion: '3.1',
      status: 'candidate',
      scenarioId: gameData31DeadlyAssaultScenario.id,
      scenarioHash: gameData31DeadlyAssaultScenario.contentHash,
    },
    playerSnapshot: {
      accountId: 'isolated-no-player-data',
      rosterHash: 'not-read',
      discWarehouseHash: 'not-read',
      capturedAt: checkedAt,
    },
    combatSnapshot: null,
    enemySnapshot: null,
    cycleSnapshot: null,
    directDamage: false,
  }
  return evaluateDamageCalculationGate(incompleteContext)
}
