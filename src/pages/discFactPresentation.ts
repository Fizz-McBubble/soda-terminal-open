/**
 * Shared player-facing disc facts for Agent Development and Team Execution. Each build binds its own
 * allowed sources; the desktop keeps the internal manifest/constraint inputs, the public build uses
 * the published display projection. See `discFactPresentation.parity.test.ts`.
 */
export {
  discGradeFor,
  displayDriveDiscSet,
  formatDiscStatValue,
  presentDiscFactFromChoice,
} from '@soda/disc-fact-presentation'
