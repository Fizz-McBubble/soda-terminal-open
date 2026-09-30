/* Generated from docs\audits\M7-GRADUATION-PROFILE-PUBLISH-PREP-R1\graduation-profiles.production-shaped.ndjson; do not edit manually. */
import { graduationCandidateProfilesPart01 } from './graduationCandidateProfilesPart01'
import { graduationCandidateProfilesPart02 } from './graduationCandidateProfilesPart02'
import { graduationCandidateProfilesPart03 } from './graduationCandidateProfilesPart03'
import { graduationCandidateProfilesPart04 } from './graduationCandidateProfilesPart04'
import { graduationCandidateProfilesPart05 } from './graduationCandidateProfilesPart05'
import { graduationCandidateProfilesPart06 } from './graduationCandidateProfilesPart06'
import { graduationCandidateProfilesPart07 } from './graduationCandidateProfilesPart07'
import { graduationCandidateProfilesPart08 } from './graduationCandidateProfilesPart08'
import { graduationCandidateProfilesPart09 } from './graduationCandidateProfilesPart09'
import { graduationCandidateProfilesPart10 } from './graduationCandidateProfilesPart10'
import { graduationCandidateProfilesPart11 } from './graduationCandidateProfilesPart11'
import { graduationCandidateProfilesPart12 } from './graduationCandidateProfilesPart12'
import { graduationCandidateProfilesPart13 } from './graduationCandidateProfilesPart13'
import { graduationCandidateProfilesPart14 } from './graduationCandidateProfilesPart14'
import { graduationCandidateProfilesPart15 } from './graduationCandidateProfilesPart15'
import { graduationCandidateProfilesPart16 } from './graduationCandidateProfilesPart16'
import { graduationCandidateProfilesPart17 } from './graduationCandidateProfilesPart17'
import { graduationCandidateProfilesPart18 } from './graduationCandidateProfilesPart18'
import { graduationCandidateProfilesPart19 } from './graduationCandidateProfilesPart19'

export const graduationCandidateProfileProjectionIdentity = {
  profileSchema: 'soda-graduation-profile/v1',
  profileVersion: '1.0.0',
  generatorVersion: 'soda-graduation-profile-generator-r1.0',
  generationVersion: 'production-profile-prep-r1',
  sourcePackageId: 'l3-b323989c00330f284329',
  profileFileSha256: '4a8cdec1b87aa23ceae558a918debb896cdeab6f7279fef8ae41d81872912f5e',
  population: 57,
  authority: 'candidate_graduation_profile_only',
  formalSupported: false,
  adoption: 'runtime_adopted_candidate_sidecar',
  rollback:
    'remove the Candidate Profile projection binding; legacy target_panel and account plans are unchanged',
} as const

export const graduationCandidateProfiles = [
  ...graduationCandidateProfilesPart01,
  ...graduationCandidateProfilesPart02,
  ...graduationCandidateProfilesPart03,
  ...graduationCandidateProfilesPart04,
  ...graduationCandidateProfilesPart05,
  ...graduationCandidateProfilesPart06,
  ...graduationCandidateProfilesPart07,
  ...graduationCandidateProfilesPart08,
  ...graduationCandidateProfilesPart09,
  ...graduationCandidateProfilesPart10,
  ...graduationCandidateProfilesPart11,
  ...graduationCandidateProfilesPart12,
  ...graduationCandidateProfilesPart13,
  ...graduationCandidateProfilesPart14,
  ...graduationCandidateProfilesPart15,
  ...graduationCandidateProfilesPart16,
  ...graduationCandidateProfilesPart17,
  ...graduationCandidateProfilesPart18,
  ...graduationCandidateProfilesPart19,
] as const
