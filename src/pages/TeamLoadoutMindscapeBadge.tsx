import type { MemberMindscapeDisplay } from './teamMemberMindscapePresentation'

/** The badge is an account fact. Reference targets stay beside the member, outside the portrait. */
export function TeamLoadoutMindscapeBadge({ display }: { display: MemberMindscapeDisplay }) {
  const actual = display.actualMindscape
  const label =
    actual === 'unknown' ? display.accessibleLabel : `${display.accessibleLabel}，影画${actual}`
  return (
    <span
      className={`f5v-box-team-mindscape-badge is-${display.status}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {actual === 'unknown' ? '?' : actual}
    </span>
  )
}

/** Show the formation target directly beside the member; account state stays on the portrait. */
export function TeamLoadoutMindscapeSuggestion({ display }: { display: MemberMindscapeDisplay }) {
  if (display.referenceMindscape === undefined) return null
  return (
    <span className="team-execution__member-mindscape-suggestion">
      建议影画 <b>{display.referenceMindscape}</b>
    </span>
  )
}
