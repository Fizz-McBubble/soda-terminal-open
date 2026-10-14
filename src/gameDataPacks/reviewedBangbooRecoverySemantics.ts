import { getCurrentBangbooNumericData } from './currentBangbooNumericCatalog'
import { stableContentHash } from './types'

/** Normalized execution semantics; raw extracted abilities remain private review evidence. */
export const reviewedBangbooRecoveryBindings = [
  {
    stableId: 'bangboo-avocaboo',
    gameId: '53008',
    itemFingerprint: 'fnv1a-2c13e18e',
    activeAbility: 'Bangboo_Avocaboo_Cure',
    activeAbilityPath:
      'Data/JsonBytes/NewAbility/BangbooAbility/AvocabooAbility/Bangboo_Avocaboo_Cure.json',
    activeAbilitySha256: '82A0605CED3340BA061C60DB2B828ED89A72DA193DAC503A10543F6E0F645DCC',
    additionalAbilityPath:
      'Data/JsonBytes/NewAbility/BangbooAbility/AvocabooAbility/Bangboo_Avocaboo_MathSkill.json',
    additionalAbilitySha256: '0178169B4559580FAA0C57531EA07101918BDF5441407F39F3632411338EE41E',
    expressionPointer: '/DefaultModifier/OnHitOther/0/Expression',
    expression: 'property(MaxHP)*specials(AS_RecoverRatio)*(1+specials(AS_ExtraRecoverRatio))',
    applicationPointer: '/Modifiers/AvocabooCureModifier/OnAdded/0',
    recipient: 'Other',
    levelAbilityIds: [
      653008101, 653008102, 653008103, 653008104, 653008105, 653008106, 653008107, 653008108,
      653008109, 653008110,
    ],
    additionalAbilityIds: [653008301, 653008302, 653008303, 653008304, 653008305],
  },
  {
    stableId: 'bangboo-miss-esme',
    gameId: '54018',
    itemFingerprint: 'fnv1a-66ab6dab',
    activeAbility: 'Bangboo_Sailorboo_Buff',
    activeAbilityPath: 'Data/_unsorted/Bangboo_Sailorboo_Buff.json',
    activeAbilitySha256: '00594DA79028D848282C9B7C79E5942115D75EA41AE903862F64E999873E7C80',
    additionalAbilityPath: 'Data/_unsorted/Bangboo_Sailorboo_MathSkill.json',
    additionalAbilitySha256: '707769284D5B924E1040CF011E220B1BDACAB01B1CD2A646EF9893C40B78D66E',
    expressionPointer: '/DefaultModifier/OnCustomEventReceived/2/Expression',
    expression: 'property(MaxHP)*specials(AS_HPRecoverRatio)*(1+specials(AS_ExtraRecoverRatio))',
    applicationPointer: '/Modifiers/HpRecoverModifier/OnAdded/0',
    recipient: 'LocalAvatar',
    levelAbilityIds: [
      654018101, 654018102, 654018103, 654018104, 654018105, 654018106, 654018107, 654018108,
      654018109, 654018110,
    ],
    additionalAbilityIds: [654018301, 654018302, 654018303, 654018304, 654018305],
  },
] as const

export function resolveReviewedBangbooRecoveryBinding(
  stableId: string,
  item = getCurrentBangbooNumericData(stableId),
) {
  const binding = reviewedBangbooRecoveryBindings.find((row) => row.stableId === stableId)
  if (
    !binding ||
    !item ||
    item.stableId !== stableId ||
    item.gameId !== binding.gameId ||
    stableContentHash(item) !== binding.itemFingerprint
  )
    return null
  return {
    ...binding,
    hpBasis: 'bangboo_max_hp' as const,
    expressionOwner: 'bangboo' as const,
    amountUnit: 'hp_point' as const,
    source: {
      url: 'https://git.mero.moe/dimbreath/ZenlessData',
      commit: '1277ebca4b8a7a6c3bcbaac6d5708dc9f4a55f23',
      releaseLabel: 'CNPRODWin3.2.0_R19329161_S19159270_D19329161',
      levelTablePath: 'FileCfg/BuddySkillLevelUpTemplateTb.json',
      levelTableSha256: 'CE96D17F148BB3CC773A1914EFC324222E7A5978BAECBBB5FF7B655187AF4649',
      abilityConfigPath: 'FileCfg/AbilityConfigTemplateTb.json',
      abilityConfigSha256: '0D620AD57A9286FD335A7301FA9E0E947F0E2BA886A163A3A765136304A9DFD8',
      statsTablePath: 'FileCfg/BuddyBattleTemplateTb.json',
      statsTableSha256: '7721D502C6ED112AEDF856AF7B68CDA936B4DBC8DCA22BA3E91E666A1F99126C',
      ascensionTablePath: 'FileCfg/BuddyLevelAdvanceTemplateTb.json',
      ascensionTableSha256: '229467E5FD1DEB2DCB3BDC247E82662D62D490FAE592FA2AE32C1A817A12939A',
    },
  }
}

export type ReviewedBangbooRecoveryBinding = NonNullable<
  ReturnType<typeof resolveReviewedBangbooRecoveryBinding>
>
