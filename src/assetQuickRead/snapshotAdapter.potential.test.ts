import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { convertAssetSnapshot } from './snapshotAdapter'
import { potentialDetailSourceContract, observePotentialDetail } from './potentialDetailObservation'
import { omitted, present, syntheticAssetSnapshot } from './syntheticAssetSnapshotTestFixture'
import projection from './potentialDetailProjection.json'

const context = { snapshotSha256: 'a'.repeat(64) }
function withPotential(
  gameId: number,
  observation?: ReturnType<typeof present> | ReturnType<typeof omitted>,
) {
  const input = syntheticAssetSnapshot()
  input.assets.agents[0].catalog_id = present(gameId)
  if (observation) Object.assign(input.assets.agents[0], { potential_detail_id: observation })
  return convertAssetSnapshot(input, context)
}

describe('source-bound observed potential detail IDs', () => {
  it.each([
    [1191, 119105, 6],
    [1101, 110105, 6],
    [1211, 121104, 5],
  ])('adopts public definition %s/%s as potential %s', (gameId, detailId, level) => {
    const result = withPotential(gameId, present(detailId))
    expect(result.importable).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.agents[0].fields.potentialImage).toBe(level)
    expect(result.agents[0].observedFields).toContain('potentialImage')
  })
  it.each([undefined, omitted()])(
    'keeps old or omitted snapshots unobserved: %s',
    (observation) => {
      const result = withPotential(1101, observation)
      expect(result.importable).toBe(true)
      expect(result.agents[0].fields).not.toHaveProperty('potentialImage')
      expect(result.agents[0].observedFields).not.toContain('potentialImage')
    },
  )
  it.each([0, 110106, 999999, 121104])(
    'retains the S subset and warns rather than inventing potential for unrecognized/mismatched ID %s',
    (id) => {
      const result = withPotential(1101, present(id))
      expect(result.importable).toBe(true)
      expect(result.issues).toEqual([])
      expect(result.discs.discs).toHaveLength(1)
      expect(result.agents[0].fields).not.toHaveProperty('potentialImage')
      expect(result.agents[0].observedFields).not.toContain('potentialImage')
      expect(result.warnings?.some((warning) => warning.includes('潜能细节ID'))).toBe(true)
    },
  )
  it('binds exact public rows and decoder-stage protocol without deriving unknown IDs', () => {
    expect(potentialDetailSourceContract).toMatchObject({
      commit: 'c91eb0933bbb76333d52ffe57d8376ead61f9253',
      protocolVersion: '3.2',
      commandId: 2470,
      containerField: 2,
      agentSchema: 'OCNCGOBPHLA',
      fieldNumber: 665,
      schemaType: 'uint32',
      repeated: false,
      xorValue: 1715,
      observationStage: 'after_locked_protocol_xor',
    })
    expect(projection.rows).toHaveLength(66)
    expect(new Set(projection.rows.map((row) => row.id)).size).toBe(66)
    expect(projection.sources).toHaveLength(11)
    for (const row of projection.rows) {
      expect(row.level).toBeGreaterThanOrEqual(0)
      expect(row.level).toBeLessThanOrEqual(6)
      expect(projection.sources.find((source) => source.gameId === row.gameId)?.sha256).toMatch(
        /^[a-f0-9]{64}$/,
      )
      expect(observePotentialDetail(present(row.id), row.gameId)).toEqual({ level: row.level })
    }
  })
  it.skipIf(!process.env.SODA_PUBLIC_POTENTIAL_CACHE)(
    'matches every projected row to hash-locked public PotentialDetail data',
    () => {
      for (const source of projection.sources) {
        const bytes = readFileSync(
          join(process.env.SODA_PUBLIC_POTENTIAL_CACHE!, `${source.gameId}.json`),
        )
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256)
        const data = JSON.parse(bytes.toString('utf8'))
        expect(data.Id).toBe(source.gameId)
        const expected = Object.values(data.PotentialDetail).map((row) => {
          const definition = row as { Id: number; Level: number }
          return { id: definition.Id, gameId: data.Id, level: definition.Level }
        })
        expect(projection.rows.filter((row) => row.gameId === data.Id)).toEqual(expected)
      }
    },
  )
})
