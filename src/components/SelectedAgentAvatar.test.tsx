import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectedAgentAvatar, preloadSelectedAgentAvatar } from './SelectedAgentAvatar'

const sources = vi.hoisted(() => ({
  preferred: vi.fn(),
  fallback: vi.fn(),
  sessions: new Map<string, string>(),
}))
vi.mock('../assets/visualAssets', () => ({
  getVisualAsset: (_type: string, id: string) => ({ entityId: id }),
}))
vi.mock('../assets/visualEntityImageSource', () => ({
  resolveSessionVisualSource: sources.preferred,
  preloadVisualEntityImage: sources.fallback,
  sessionVisualSources: sources.sessions,
  visualSourceKey: (asset: { entityId: string }) => asset.entityId,
}))
vi.mock('./VisualEntityImage', () => ({
  VisualEntityImage: (props: { name: string; slotId: string }) => (
    <span aria-label={props.name} data-slot={props.slotId} />
  ),
}))
describe('selected agent avatar personal-cache preference', () => {
  beforeEach(() => {
    sources.sessions.clear()
    sources.preferred.mockReset().mockResolvedValue(null)
    sources.fallback.mockReset().mockResolvedValue('existing-portrait')
  })
  it('keeps the old portrait available and switches when the personal cache is updated', async () => {
    render(
      <SelectedAgentAvatar agentId="agent-remielle" name="蕾米埃尔·丹" consumer="assets.editor" />,
    )
    expect(screen.getByLabelText('蕾米埃尔·丹')).toHaveAttribute('data-slot', 'agent.square-avatar')
    await waitFor(() => expect(sources.preferred).toHaveBeenCalled())
    sources.preferred.mockResolvedValue('cached-interknot')
    window.dispatchEvent(new Event('soda-visual-assets-ready'))
    await waitFor(() =>
      expect(screen.getByLabelText('蕾米埃尔·丹')).toHaveAttribute(
        'data-slot',
        'agent.selected-summary',
      ),
    )
  })
  it('ignores a late avatar from the previous selection', async () => {
    let finish!: (source: string) => void
    sources.preferred.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const view = render(
      <SelectedAgentAvatar
        agentId="agent-remielle"
        name="蕾米埃尔·丹"
        consumer="agent-development.overview"
      />,
    )
    view.rerender(
      <SelectedAgentAvatar
        agentId="agent-roxy"
        name="洛克茜"
        consumer="agent-development.overview"
      />,
    )
    finish('old-interknot')
    await waitFor(() => expect(sources.preferred).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('洛克茜')).toHaveAttribute('data-slot', 'agent.square-avatar')
  })
  it('preloads the existing portrait when the new personal cache entry is absent', async () => {
    await expect(preloadSelectedAgentAvatar('agent-roxy', 'assets.editor')).resolves.toBe(
      'existing-portrait',
    )
    expect(sources.fallback).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: 'agent.square-avatar', entityId: 'agent-roxy' }),
    )
  })
})
