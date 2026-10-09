import { describe, expect, it } from 'vitest'
import { fitFloatingLayer, getEffectiveZoom } from './floatingLayerGeometry'

describe('floating layers in a zoomed page', () => {
  it.each([1, 4 / 3, 1.5])('keeps screen-space anchoring at zoom %s', (scale) => {
    const style = fitFloatingLayer({
      anchor: { left: 500, right: 860, top: 300, bottom: 356 },
      width: 360 * scale,
      height: 360 * scale,
      scale,
      viewportWidth: 2560,
      viewportHeight: 1305,
    })
    expect(style.left * scale).toBeCloseTo(500)
    expect(style.top * scale).toBeCloseTo(362)
    expect(style.width).toBeCloseTo(360)
    expect(style.maxHeight).toBeCloseTo(360)
  })

  it.each([1, 4 / 3, 1.5])('fits an overflowing panel in a short viewport at zoom %s', (scale) => {
    const style = fitFloatingLayer({
      anchor: { left: 780, right: 800, top: 80, bottom: 104 },
      width: 480 * scale,
      height: 540 * scale,
      scale,
      viewportWidth: 800,
      viewportHeight: 180,
      align: 'end',
    })
    expect(style.top * scale).toBeCloseTo(12)
    expect(style.maxHeight * scale).toBeCloseTo(62)
    expect(style.left * scale).toBeGreaterThanOrEqual(12)
    expect((style.left + style.width) * scale).toBeLessThanOrEqual(788)
    expect((style.top + style.maxHeight) * scale).toBeLessThanOrEqual(168)
  })

  it('fits a narrow screen instead of enforcing a menu minimum wider than the viewport', () => {
    const style = fitFloatingLayer({
      anchor: { left: 16, right: 180, top: 30, bottom: 72 },
      width: 480,
      height: 360,
      scale: 1,
      viewportWidth: 320,
      viewportHeight: 480,
    })
    expect(style.width).toBe(296)
    expect(style.left).toBe(12)
    expect(style.top).toBe(78)
  })

  it('reads inherited and nested zoom, including a portal inside an already scaled dialog', () => {
    const shell = document.createElement('div')
    const dialog = document.createElement('dialog')
    const menu = document.createElement('div')
    shell.style.zoom = '150%'
    menu.style.zoom = '2'
    shell.append(dialog)
    dialog.append(menu)
    document.body.append(shell)
    expect(getEffectiveZoom(dialog)).toBe(1.5)
    expect(getEffectiveZoom(menu)).toBe(3)
    expect(getEffectiveZoom(document.body)).toBe(1)
    shell.remove()
  })
})
