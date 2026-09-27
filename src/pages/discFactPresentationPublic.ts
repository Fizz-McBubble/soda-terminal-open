import { publicDriveDiscData } from '../application/publicDataProjection'
import { publicPreferredStatKeys } from './planningProfilePublic'
import { displayDriveDiscSet as publicDisplayDriveDiscSet } from './publicDiscFacts'
import {
  createDiscFactPresentation,
  type DiscFactPresentationSources,
} from './discFactPresentationShared'

/** Public sources: the published drive-disc data, published labels and the display projection. */
export const discFactSources: DiscFactPresentationSources = {
  rules: publicDriveDiscData?.rules,
  displayDriveDiscSet: publicDisplayDriveDiscSet,
  preferredStatKeysFor: publicPreferredStatKeys,
}

const presentation = createDiscFactPresentation(discFactSources)

export const formatDiscStatValue = presentation.formatDiscStatValue
export const discGradeFor = presentation.discGradeFor
export const displayDriveDiscSet = presentation.displayDriveDiscSet
export const presentDiscFactFromChoice = presentation.presentDiscFactFromChoice
