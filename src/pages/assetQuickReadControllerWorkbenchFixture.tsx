import type { AssetQuickReadWorkbenchView } from './AssetQuickReadController'
export function workbenchHarness() {
  let latest!: AssetQuickReadWorkbenchView
  return {
    read: () => latest,
    render: (view: AssetQuickReadWorkbenchView) => {
      latest = view
      return (
        <>
          <div data-testid="preparation">{view.preparation}</div>
          <div data-testid="task">{view.task}</div>
          <div data-testid="recovery">{view.recovery}</div>
        </>
      )
    },
  }
}
export function syntheticFile() {
  const file = new File(['{}'], 'synthetic.json', { type: 'application/json' })
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: async () => new TextEncoder().encode('{}').buffer,
  })
  return file
}
