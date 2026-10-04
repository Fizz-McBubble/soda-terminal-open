import { describe, expect, it, vi } from 'vitest'
import { createEmptyRoster } from '../assault/catalog'
import { sampleDiscs } from '../evaluation/fixtures'
import type { DriveDisc } from '../domain/schemas'
import { compileTeamBuildIntent } from './buildIntent'
import { calculateTargetTeamWarehouseFit } from './targetTeamWarehouseFit'
import {
  candidateTeamSetScore,
  type CandidateTeamSetScoreLoadout,
} from '../optimizer/candidateTeamSetScore'
import * as discFormulaCatalog from '../gameDataPacks/currentDriveDiscFormulaCatalog'
import { candidateNonStackingFourPieceIdentity } from '../optimizer/candidateNonStackingFourPiece'

const memberIds = ['agent-nangong', 'agent-yuzuha', 'agent-promeia'] as const
function discs(prefix: string, primary: string, secondary: string, level = 15): DriveDisc[] {
  return [1, 2, 3, 4, 5, 6].map((slot) => ({
    ...sampleDiscs.treasureCandidate,
    id: `${prefix}-${slot}`,
    slot: slot as DriveDisc['slot'],
    setId: slot <= 4 ? primary : secondary,
    level,
    rarity: 'S',
    locked: false,
    favorite: false,
    mainStat:
      slot === 1
        ? 'hp_flat'
        : slot === 2
          ? 'atk_flat'
          : slot === 3
            ? 'def_flat'
            : slot === 4
              ? prefix === 'yuzuha'
                ? 'atk_percent'
                : 'anomaly_proficiency'
              : slot === 5
                ? 'atk_percent'
                : 'anomaly_mastery',
    subStats: [{ stat: 'anomaly_proficiency', value: 27, upgrades: 2 }],
  }))
}
function solve(includeMelody: boolean, extraOptions = {}) {
  const inventory = [
    ...discs('nangong-astral', 'set-astral-voice', 'set-phaethons-melody', 0),
    ...discs('yuzuha', 'set-astral-voice', 'set-phaethons-melody'),
    ...discs('promeia', 'set-notes-from-the-chained', 'set-chaos-jazz'),
    ...(includeMelody ? discs('nangong-melody', 'set-phaethons-melody', 'set-freedom-blues') : []),
  ]
  const original = structuredClone(inventory)
  const result = calculateTargetTeamWarehouseFit({
    warehouse: {
      accountId: 'shared-set-fixture',
      account: null,
      roster: createEmptyRoster('2026-10-04T00:00:00.000Z'),
      discs: inventory,
    },
    buildIntent: compileTeamBuildIntent({
      candidateId: 'promeia-nangong-yuzuha',
      memberIds,
      bangbooId: 'bangboo-amillion',
      optimizerOptions: {
        fixedDiscByAgent: { 'agent-yuzuha': 'yuzuha-1', 'agent-promeia': 'promeia-1' },
        ...extraOptions,
      },
    }),
    bangbooSelection: { status: 'selected', bangbooId: 'bangboo-amillion' },
  })
  expect(inventory).toEqual(original)
  const ids = result.loadouts.flatMap((loadout) => loadout.discIds)
  expect(new Set(ids).size).toBe(ids.length)
  return result
}

describe('team set alternatives and shared four-piece effects', () => {
  it('compares available complete Melody with low-level Astral while Yuzuha retains Astral', () => {
    const result = solve(true)
    expect(result.status).toBe('ready')
    expect(result.uniqueDiscCount).toBe(18)
    const nangong = result.warehousePlan.loadouts.find((row) => row.agentId === 'agent-nangong')!
    expect(nangong.setCounts['set-phaethons-melody']).toBe(4)
    expect(nangong.setCounts['set-freedom-blues']).toBe(2)
    expect(nangong.discs.every((choice) => choice.disc.level === 15)).toBe(true)
    expect(
      result.warehousePlan.loadouts.find((row) => row.agentId === 'agent-yuzuha')!.setCounts[
        'set-astral-voice'
      ],
    ).toBe(4)
  })

  it('keeps two Astral wearers legal when inventory cannot form the alternative', () => {
    const result = solve(false)
    expect(result.status).toBe('ready')
    expect(
      result.warehousePlan.loadouts.filter((row) => row.setCounts['set-astral-voice'] === 4),
    ).toHaveLength(2)
    expect(result.totalScore).toBeCloseTo(result.warehousePlan.totalScore - 18, 6)
  })

  it('honors excluded inventory rather than assuming a visible set is available', () => {
    const result = solve(true, { excludedDiscIds: ['nangong-melody-6'] })
    expect(result.status).toBe('ready')
    expect(result.loadouts.flatMap((row) => row.discIds)).not.toContain('nangong-melody-6')
  })

  it('counts shared 4pc fit once, leaves 2pc and wearer-specific sets intact, and allows better stats', () => {
    const row = (setId: string, count: number, totalScore = 200): CandidateTeamSetScoreLoadout => ({
      agentId: 'agent-astra',
      setCounts: { [setId]: count },
      totalScore,
    })
    expect(candidateTeamSetScore([row('set-astral-voice', 4), row('set-astral-voice', 4)])).toBe(
      382,
    )
    expect(candidateTeamSetScore([row('set-astral-voice', 4), row('set-astral-voice', 2)])).toBe(
      400,
    )
    expect(candidateTeamSetScore([row('set-swing-jazz', 4), row('set-swing-jazz', 4)])).toBe(400)
    expect(
      candidateTeamSetScore([row('set-astral-voice', 4), row('set-astral-voice', 4, 230)]),
    ).toBeGreaterThan(
      candidateTeamSetScore([row('set-astral-voice', 4), row('set-phaethons-melody', 4)]),
    )
  })

  it('counts one Moonlight premium for qualified supports while preserving every wearer stat score', () => {
    const row = (agentId: string, count = 4, totalScore = 200): CandidateTeamSetScoreLoadout => ({
      agentId,
      setCounts: { 'set-moonlight-lullaby': count },
      totalScore,
    })
    const supports = [row('agent-astra'), row('agent-yuzuha', 4, 230)]
    expect(candidateTeamSetScore(supports)).toBe(412)
    expect(candidateTeamSetScore([...supports].reverse())).toBe(412)
    expect(candidateTeamSetScore([row('agent-astra'), row('agent-yuzuha', 2)])).toBe(400)
    // A non-support or unknown identity cannot consume the real support's premium.
    for (const agentId of ['agent-ellen', 'agent-unknown']) {
      expect(candidateTeamSetScore([row(agentId), row('agent-astra')])).toBe(382)
      expect(candidateTeamSetScore([row('agent-astra'), row(agentId)])).toBe(382)
      expect(candidateTeamSetScore([row(agentId)])).toBe(182)
    }
  })

  it('preserves different same-name effect groups when Astral and Moonlight coexist', () => {
    const row = (agentId: string, setId: string): CandidateTeamSetScoreLoadout => ({
      agentId,
      setCounts: { [setId]: 4 },
      totalScore: 200,
    })
    expect(
      candidateTeamSetScore([
        row('agent-astra', 'set-astral-voice'),
        row('agent-yuzuha', 'set-moonlight-lullaby'),
      ]),
    ).toBe(400)
    expect(
      candidateTeamSetScore([
        row('agent-astra', 'set-astral-voice'),
        row('agent-nangong', 'set-astral-voice'),
        row('agent-yuzuha', 'set-moonlight-lullaby'),
      ]),
    ).toBe(582)
    expect(candidateNonStackingFourPieceIdentity.commit).toBe(
      discFormulaCatalog.currentDriveDiscFormulaCatalog.generatedFrom.commit,
    )
  })

  it('does not apply stale nonstacking or wearer-qualification rules after formula identity changes', () => {
    const original = discFormulaCatalog.getCurrentDriveDiscFormulaData
    const source = original('set-moonlight-lullaby')!
    const spy = vi
      .spyOn(discFormulaCatalog, 'getCurrentDriveDiscFormulaData')
      .mockImplementation((setId) =>
        setId === 'set-moonlight-lullaby'
          ? { ...source, fourPieceFormula: { ...source.fourPieceFormula, sha256: '0'.repeat(64) } }
          : original(setId),
      )
    try {
      const row = (agentId: string): CandidateTeamSetScoreLoadout => ({
        agentId,
        setCounts: { 'set-moonlight-lullaby': 4 },
        totalScore: 200,
      })
      expect(candidateTeamSetScore([row('agent-astra'), row('agent-yuzuha')])).toBe(400)
      expect(candidateTeamSetScore([row('agent-ellen'), row('agent-astra')])).toBe(400)
    } finally {
      spy.mockRestore()
    }
  })
})
