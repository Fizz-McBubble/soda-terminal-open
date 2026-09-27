import type { PlanEditorProps } from './PlanEditorProps'

const implementation =
  import.meta.env.VITE_SODA_PUBLIC_BUILD === 'true'
    ? await import('./PlanEditorPublic')
    : await import('./PlanEditorLocal')

/** Each build uses one plan editor; the public route never loads the local solver UI. */
export function PlanEditor(props: PlanEditorProps) {
  return <implementation.PlanEditor {...props} />
}
