import { teamRatingLabelTitle } from './teamRatingPresentation'

export function TeamRatingLine({ label }: { label?: string | null }) {
  return label ? <p title={teamRatingLabelTitle()}>{label}</p> : null
}
