/** Locked guide images, independently read at original resolution. ON / STR 6/6
 * is the principal agent's reference configuration, not the author's account or
 * a minimum activation gate. Do not inherit it for other agents in the image. */
export const teamStrengthGuidePotentialReferences = [
  {
    agentId: 'agent-soldier-0-anby',
    sourceUrl: 'https://www.miyoushe.com/zzz/article/69505810',
    imageName: '69505810-245822005.png',
    imageSha256: '2930266FD3670F302FDFB298E8B76C0291E6CA9FC147249DAC6ECCC249CD98DA',
  },
  {
    agentId: 'agent-lycaon',
    sourceUrl: 'https://www.miyoushe.com/zzz/article/73045858',
    imageName: '73045858-247890415.png',
    imageSha256: 'DB528DCB0CB0CC49ACA1D2CD76003BB91AFA94E89E427B2009CBBA5810EA5A5E',
  },
  {
    agentId: 'agent-jane',
    sourceUrl: 'https://www.miyoushe.com/zzz/article/76957755',
    imageName: '76957755-257313116.png',
    imageSha256: '82C40EB31C721142682A09AAE53E943172DD31A0F2F868A47A9A65B9D39CF249',
  },
  {
    agentId: 'agent-rina',
    sourceUrl: 'https://www.miyoushe.com/zzz/article/76974843',
    imageName: '76974843-257073674.png',
    imageSha256: '57C31B40434102B93C81E9C807988E94307898D0EFC0197719D613A3666FC261',
  },
  {
    agentId: 'agent-nekomata',
    sourceUrl: 'https://www.miyoushe.com/zzz/article/76994144',
    imageName: '76994144-257080860.png',
    imageSha256: '1E42BDEF351CDCBE704E211CB8AA217A332FE1D89F4EBB12F5DE419EA89DA6F8',
  },
].map((reference) => ({
  ...reference,
  level: 6,
  numericLevelBasis: 'source_reference_configuration' as const,
  locator: '技能升级建议 / ON / STR 6/6',
}))

export function resolveTeamStrengthGuidePotentialReference(
  agentId: string,
  evidenceRefs: readonly string[],
) {
  return teamStrengthGuidePotentialReferences.find(
    (reference) => reference.agentId === agentId && evidenceRefs.includes(reference.sourceUrl),
  )
}
