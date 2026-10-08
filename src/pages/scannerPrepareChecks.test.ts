import { describe, expect, it } from 'vitest'
import type { ScannerAssistantSnapshot } from '../scanner/runtime'
import { baseScannerSnapshot } from './scannerAssistantTestFixture'
import { createPrepareChecks } from './scannerPrepareChecks'

function warehouseStatus(width: number, height: number, errors: string[] = []) {
  const snapshot: ScannerAssistantSnapshot = {
    ...(baseScannerSnapshot as ScannerAssistantSnapshot),
    state: 'ready',
    prepare: {
      ...baseScannerSnapshot.prepare,
      geometry: { client: { width, height } },
      errors,
    },
  }
  return createPrepareChecks(snapshot).find((check) => check.id === 'warehouse-ready')?.status
}

describe('scanner preparation client geometry', () => {
  it.each([
    [1920, 1080],
    [1920, 1081],
    [1280, 720],
    [1600, 900],
    [3840, 2160],
    [3840, 2161],
  ])('does not misreport an accepted local client size %s × %s', (width, height) =>
    expect(warehouseStatus(width, height)).toBe('ready'),
  )

  it.each([
    [1278, 719],
    [3842, 2161],
    [1920, 1200],
    [1920, 1082],
  ])('blocks an out-of-contract client size %s × %s', (width, height) =>
    expect(warehouseStatus(width, height)).toBe('blocked'),
  )

  it.each([
    'client_size_changed',
    'ppocrv6_detail_geometry_incompatible',
    'game_window_not_foreground',
    'window_geometry_changed',
    'game_window_not_visible',
  ])('keeps native rejection %s blocked even at the reference size', (code) => {
    expect(warehouseStatus(1920, 1080, [code])).toBe('blocked')
  })
})
