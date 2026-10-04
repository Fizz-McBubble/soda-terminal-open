/** Candidate matching premiums only; this does not grant a trigger or merge
 * unknown-effect protection between different wearers. */
export const candidateNonStackingFourPieceIdentity = Object.freeze({
  revision: 'source-bound-nonstacking-four-piece-qualified-wearer-r1',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  sources: {
    'set-proto-punk': {
      formulaSha256: '8047673EA54F6D980D324EF42244F912E267BD881B4547C47FC364C9BB2BC36C',
      requiredSpecialty: null,
    },
    'set-astral-voice': {
      formulaSha256: 'A9635DECE4C2AD19F261D5A9BDB02189639AAED105B814ADDB131DAE5C2E5286',
      requiredSpecialty: null,
    },
    'set-moonlight-lullaby': {
      formulaSha256: '249A6269415F09861BAF88CBDE2EC99B7BF2B4FBC8EFFC1CC35EAD8BA72369C5',
      requiredSpecialty: 'support',
    },
  },
} as const)
