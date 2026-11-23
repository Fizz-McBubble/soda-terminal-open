import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesDir = resolve(__dirname)
const readStyle = (name: string) => readFileSync(resolve(stylesDir, name), 'utf8')

function keyframeBlocks(css: string) {
  return [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\n)\}/g)].map(([, name, body]) => ({
    name,
    body,
  }))
}

describe('F5 musical workstation polish and style boundary', () => {
  it('loads the color, shell and selection cues through the shipped stylesheet', () => {
    const entry = readStyle('f5-golden.css')
    for (const file of [
      'workspace-color-field.css',
      'f5-golden-shell-motion.css',
      'f5-workstation-cadence.css',
    ]) {
      expect(entry).toContain(`@import './${file}'`)
    }
  })

  it('keeps every shell and workstation keyframe compositor-only (transform / opacity)', () => {
    const files = [
      'workspace-color-field.css',
      'f5-golden-shell-motion.css',
      'f5-workstation-cadence.css',
    ]
    const allKeyframes = files.flatMap((file) =>
      keyframeBlocks(readStyle(file)).map((block) => ({ file, ...block })),
    )
    expect(allKeyframes.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        'soda-workspace-color',
        'soda-workspace-harmonic',
        'soda-rail-color',
        'soda-terminal-beat',
        'soda-rail-seam-glide',
        'soda-cadence-settle',
        'soda-cadence-bar-lock',
        'soda-cadence-underline-lock',
        'soda-cadence-busy-pulse',
      ]),
    )
    for (const { file, name, body } of allKeyframes) {
      const properties = [...body.matchAll(/^\s*([a-z-]+)\s*:/gm)].map((match) => match[1])
      expect(properties.length, `${file}:${name}`).toBeGreaterThan(0)
      for (const prop of properties) {
        expect(['transform', 'opacity'], `${file}:${name}:${prop}`).toContain(prop)
      }
    }
  })

  it('gates looping animations to reduced-motion opt-in and background pause state', () => {
    const fieldCss = readStyle('workspace-color-field.css')
    const shellMotionCss = readStyle('f5-golden-shell-motion.css')
    const cadenceCss = readStyle('f5-workstation-cadence.css')

    for (const css of [fieldCss, shellMotionCss, cadenceCss]) {
      expect(css).toContain('@media (prefers-reduced-motion: no-preference)')
      expect(css).toContain('animation-play-state: var(--signal-play-state, running)')
    }
    expect(fieldCss).toContain('.f5v-workspace-color-field::after')
    expect(fieldCss).toMatch(
      /\.f5v-rail:not\(\[inert\]\)::before\s*\{\s*animation: soda-rail-color\b/,
    )
    expect(shellMotionCss).toMatch(/\.f5v-terminal-wave i\s*\{\s*animation: soda-terminal-beat\b/)
    expect(shellMotionCss).toMatch(
      /\.f5v-rail:not\(\[inert\]\)::after\s*\{\s*animation: soda-rail-seam-glide\b/,
    )
    expect(cadenceCss).toContain('@media (hover: none)')
  })

  it('anchors the waveform to a separate strip in the shared header', () => {
    const workspace = readStyle('f5-golden-shell-workspace.css')
    expect(workspace).toMatch(/\.f5v-terminal-signal\s*\{\s*position: absolute;\s*inset:/)
    expect(workspace).toContain('padding-block-end: 13px')
  })

  it('covers tactile cadence and tabular numerals across all four workstation sections', () => {
    const cadenceCss = readStyle('f5-workstation-cadence.css')
    expect(cadenceCss).toContain(".r6-golden .object-card[aria-selected='true']")
    expect(cadenceCss).toContain('.f5v-shell .agent-tile-link')
    expect(cadenceCss).toContain('.f5v-shell .top10 .comparison-candidate')
    expect(cadenceCss).toContain('.f5v-shell .f5v-box-team-row.is-selected::before')
    expect(cadenceCss).toContain(
      ".f5v-shell .team-execution__member-slot > button[role='tab'][aria-selected='true']::after",
    )
    expect(cadenceCss).toContain(
      '.f5v-shell .team-execution__disc-card:is(.is-expanded, .is-selected)::before',
    )
    expect(cadenceCss).toContain(
      ".f5v-shell .warehouse-action-row:is(.is-selected, [aria-pressed='true'])::before",
    )
    expect(cadenceCss).toContain('font-variant-numeric: tabular-nums')
  })
})
