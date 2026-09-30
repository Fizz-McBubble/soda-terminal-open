import type { PlayerBuildSource } from './playerBuildSources'
import { pageCandidateDirectionsPart01 } from './pageCandidateDirectionsPart01'
import { pageCandidateDirectionsPart02 } from './pageCandidateDirectionsPart02'
import { pageCandidateDirectionsPart03 } from './pageCandidateDirectionsPart03'
import { pageCandidateDirectionsPart04 } from './pageCandidateDirectionsPart04'
import { pageCandidateDirectionsPart05 } from './pageCandidateDirectionsPart05'
import { pageCandidateDirectionsPart06 } from './pageCandidateDirectionsPart06'
import { pageCandidateDirectionsPart07 } from './pageCandidateDirectionsPart07'
import { pageCandidateDirectionsPart08 } from './pageCandidateDirectionsPart08'
import { pageCandidateDirectionsPart09 } from './pageCandidateDirectionsPart09'
import { pageCandidateDirectionsPart10 } from './pageCandidateDirectionsPart10'
import { pageCandidateDirectionsPart11 } from './pageCandidateDirectionsPart11'
import { pageCandidateDirectionsPart12 } from './pageCandidateDirectionsPart12'
import { pageCandidateDirectionsPart13 } from './pageCandidateDirectionsPart13'
export type PageCandidateDirection = {
  source: PlayerBuildSource
  wengines: string[]
  sets: string[]
  stats: { main: string[]; sub: string[] }
  progression: string[]
  team: string[]
}
export const pageCandidateDirections: Partial<Record<string, PageCandidateDirection>> = {
  ...pageCandidateDirectionsPart01,
  ...pageCandidateDirectionsPart02,
  ...pageCandidateDirectionsPart03,
  ...pageCandidateDirectionsPart04,
  ...pageCandidateDirectionsPart05,
  ...pageCandidateDirectionsPart06,
  ...pageCandidateDirectionsPart07,
  ...pageCandidateDirectionsPart08,
  ...pageCandidateDirectionsPart09,
  ...pageCandidateDirectionsPart10,
  ...pageCandidateDirectionsPart11,
  ...pageCandidateDirectionsPart12,
  ...pageCandidateDirectionsPart13,
}
