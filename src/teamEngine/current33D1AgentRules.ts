import type { AgentRule } from './contracts'
import { currentGameDataSelection } from '../gameDataPacks/currentGameDataSelection'
import { resolveFieldTimeDemand } from './fieldTimeDemandOperator'

export const current33D1AgentRules: AgentRule[] =
  currentGameDataSelection.gameVersion === '3.3'
    ? [
        {
          agentId: 'agent-phoenix',
          name: '菲欧妮',
          releaseState: 'released',
          specialty: 'anomaly',
          faction: '坎卜斯黑枝',
          attribute: 'fire',
          fieldTimeDemand: resolveFieldTimeDemand('primary_field'),
          produces: ['fire_anomaly', 'anomaly_driver'],
          consumes: [],
          effects: [],
          additionalAbility: {
            status: 'modeled',
            predicate: {
              kind: 'category_sum_minimum',
              agentId: 'agent-phoenix',
              terms: [
                { kind: 'specialty', value: 'anomaly' },
                { kind: 'faction', value: '坎卜斯黑枝' },
              ],
              minimum: 1,
              dynamicTerms: [],
            },
            description: '需要另一名异常或同阵营代理人激活黑枝王牌。',
          },
          evidence: [
            {
              sourceId: 'nanoka-phoenix-3.3-event-overlay',
              gameVersion: '3.3',
              status: 'limited',
              locator:
                'https://static.nanoka.cc/zzz/3.3/zh/character/1641.json; rawSha256=237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe; passive.level.1641501.desc[1]; reviewed action aggregates do not establish complete rotation or exact DPS',
            },
          ],
        } satisfies AgentRule,
        {
          agentId: 'agent-severian',
          name: '赛维里安',
          releaseState: 'released',
          specialty: 'damage',
          faction: '新艾利都治安局',
          attribute: 'wind',
          fieldTimeDemand: resolveFieldTimeDemand('primary_field'),
          produces: ['wind_damage'],
          consumes: ['stun_window'],
          effects: [],
          additionalAbility: {
            status: 'modeled',
            predicate: {
              kind: 'category_sum_minimum',
              agentId: 'agent-severian',
              terms: [
                { kind: 'specialty', value: 'support' },
                { kind: 'specialty', value: 'stun' },
                { kind: 'faction', value: '新艾利都治安局' },
              ],
              minimum: 1,
              dynamicTerms: [],
            },
            description: '需要另一名支援、击破或同阵营代理人激活治安铁腕。',
          },
          evidence: [
            {
              sourceId: 'nanoka-severian-3.3-event-overlay',
              gameVersion: '3.3',
              status: 'limited',
              locator:
                'https://static.nanoka.cc/zzz/3.3/zh/character/1631.json; rawSha256=89f3a03b90fca880851352d6d686e6bbe658411d7b4cdf6b78d2a14a97ff5974; passive.level.1631501.desc[1]; reviewed action aggregates do not establish complete rotation or exact DPS',
            },
          ],
        } satisfies AgentRule,
      ]
    : []
