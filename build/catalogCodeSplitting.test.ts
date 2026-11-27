import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import preparedBoxStartup from '../src/gameDataPacks/generated/box-startup-prepared.v1.json'
import { packPreparedTemplates } from './boxStartupIndexAliases'
import encyclopedia from '../src/gameDataPacks/data/current-encyclopedia-display.3.3.json'
import qualification from '../src/gameDataPacks/data/reviewed-planning-event-set32.v1.json'
import { reviewedPlanningEventSetIdentity32 } from '../src/gameDataPacks/reviewedPlanningEventSetIdentity32'
import { stableContentHash } from '../src/gameDataPacks/types'
import {
  slimWorkerEncyclopediaPayload,
  slimWorkerPlanningEventSetIdentityPayload,
  slimWorkerPlanningEventSetQualificationPayload,
} from './catalogCodeSplitting'

describe('workerRuntimePayloadSlimming payload projections', () => {
  it('round-trips every prepared BOX ranking and Bangboo row in the public Worker payload', () => {
    const packed = packPreparedTemplates(preparedBoxStartup)!
    const original = JSON.stringify(preparedBoxStartup)
    expect(Buffer.byteLength(packed)).toBeLessThan(Buffer.byteLength(original) / 3)
    const restored = runInNewContext(
      packed.replace('export default', 'result ='),
      {},
    ) as typeof preparedBoxStartup
    expect(JSON.stringify(restored.templates)).toBe(JSON.stringify(preparedBoxStartup.templates))
    expect(restored).toEqual(preparedBoxStartup)
    expect(packPreparedTemplates({ templates: [{ rank: 1 }, null] })).toBeNull()
  })

  it('retains every pin field read by calculation guards while shrinking encyclopedia >99%', () => {
    const rawBytes = Buffer.byteLength(JSON.stringify(encyclopedia))
    const slim = slimWorkerEncyclopediaPayload(encyclopedia as unknown as Record<string, unknown>)
    const slimBytes = Buffer.byteLength(JSON.stringify(slim))
    expect(slimBytes).toBeLessThan(10_000)
    expect(slimBytes / rawBytes).toBeLessThan(0.01)

    for (const id of ['agent-lycaon', 'agent-cissia', 'agent-astra', 'agent-rina', 'agent-seed']) {
      const fullRow = encyclopedia.agents.find((row) => row.stableId === id)
      const slimRow = slim.agents.find((row) => row.stableId === id)
      expect(slimRow?.source.sha256).toBe(fullRow?.source.sha256)
    }
    const astra = slim.agents.find((row) => row.stableId === 'agent-astra') as
      | {
          core?: { level: number; effects: { description: string }[] }[]
          skills?: { effects: { name: string; description: string }[] }[]
        }
      | undefined
    const coreDesc = astra?.core?.find((row) => row.level === 7)?.effects[0]?.description ?? ''
    const chordDesc =
      astra?.skills?.flatMap((row) => row.effects).find((row) => row.name === '和弦')
        ?.description ?? ''
    const finaleDesc =
      astra?.skills?.flatMap((row) => row.effects).find((row) => row.name === '普通攻击：终曲')
        ?.description ?? ''
    expect(coreDesc).toContain('耀嘉音和入场角色的攻击力提升')
    expect(coreDesc).toContain('持续20秒')
    expect(chordDesc).toContain('消耗25点能量')
    expect(finaleDesc).toContain('对自身施加')
  })

  it('produces byte-identical reviewedPlanningEventSetIdentity32 hashes while shrinking >95%', () => {
    const rawBytes = Buffer.byteLength(JSON.stringify(qualification))
    const slim = slimWorkerPlanningEventSetIdentityPayload(
      qualification as unknown as Record<string, unknown>,
    )
    const slimBytes = Buffer.byteLength(JSON.stringify(slim))
    expect(slimBytes).toBeLessThan(rawBytes * 0.05)
    expect({
      contract: 'soda-reviewed-planning-event-set32/v1',
      qualificationId: slim.qualificationId,
      gameVersion: slim.gameVersion,
      semanticIdentityHash: slim.semanticIdentityHash,
      scopeHash: stableContentHash(slim.scope),
      regressionHash: stableContentHash(slim.regression),
    }).toEqual(reviewedPlanningEventSetIdentity32)
  })

  it('retains every capsuleSchema field for reviewedPlanningEventSet32 while shrinking >99%', () => {
    const rawBytes = Buffer.byteLength(JSON.stringify(qualification))
    const slim = slimWorkerPlanningEventSetQualificationPayload(
      qualification as unknown as Record<string, unknown>,
    )
    const slimBytes = Buffer.byteLength(JSON.stringify(slim))
    expect(slimBytes).toBeLessThan(12_000)
    expect(slimBytes / rawBytes).toBeLessThan(0.01)
    expect(slim.schema).toBe(qualification.schema)
    expect(slim.qualificationId).toBe(qualification.qualificationId)
    expect(slim.semanticIdentityHash).toBe(qualification.semanticIdentityHash)
    expect(slim.ready).toBe(true)
    expect(slim.scope).toEqual(qualification.scope)
    expect(slim.records).toHaveLength(qualification.records.length)
    for (let i = 0; i < qualification.records.length; i += 1) {
      expect(slim.records[i]).toEqual({
        record: {
          entity_id: qualification.records[i].record.entity_id,
          event_id: qualification.records[i].record.event_id,
          formula_family: qualification.records[i].record.formula_family,
          capability: qualification.records[i].record.capability,
        },
        verification: {
          ready: qualification.records[i].verification.ready,
        },
      })
    }
  })
})
