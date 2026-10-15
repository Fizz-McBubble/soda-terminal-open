export type TeamStrengthNumericIssue =
  | 'model_invalid'
  | 'vector_invalid'
  | 'arithmetic_overflow'
  | 'score_nonfinite'

/** Expected numeric rejection, distinct from cancellation and programming errors. */
export class TeamStrengthNumericError extends Error {
  readonly code: TeamStrengthNumericIssue

  constructor(code: TeamStrengthNumericIssue, message: string) {
    super(message)
    this.name = 'TeamStrengthNumericError'
    this.code = code
  }
}
