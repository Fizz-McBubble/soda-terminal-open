type Conditional = {
  sheet: string
  name: string
  type: string
  int_only?: boolean
  min?: number
  max?: number
  list?: readonly (string | number)[]
}
export type SourceSeed = {
  kind: string
  key: string
  externalId?: string
  engineId?: string
  specialty?: string
  formulaPath: string
  formulaHash: string
  metaPath: string
  metaHash: string
  dataPath?: string
  dataHash?: string
  mappedHash?: string
  conditionals: Record<string, Conditional>
}
export const sourceSeeds: readonly SourceSeed[] = [
  {
    kind: 'char',
    key: 'Claret',
    externalId: '1611',
    formulaPath: 'libs/zzz/formula/src/data/char/sheets/Claret.ts',
    formulaHash: 'BDF57EEC001BFA499D2C08BDB8E5004469EAE22E411D9EAFE4F614E3C55F5AF3',
    metaPath: 'libs/zzz/formula/src/meta/char/Claret/conditionals.ts',
    metaHash: '64AAF5A39998B053C124E91A975DB8F7B5B8D0DF560B1F0D52CAC0627D3B6278',
    dataPath: 'libs/zzz/stats/Data/Characters/Claret.json',
    dataHash: '49BDB5A6D64AC3CA2727F376765BF97F884C7DDF03F9B954017532757C85388C',
    mappedHash: 'B21E558E07ACF10F99D5C989A9EAB8B55AB37796FD23E0E7FEA5384A578FED6F',
    conditionals: {
      crimsonInscription: {
        sheet: 'Claret',
        name: 'crimsonInscription',
        type: 'bool',
      },
      perfectDodge: {
        sheet: 'Claret',
        name: 'perfectDodge',
        type: 'bool',
      },
      remnantEdge: {
        sheet: 'Claret',
        name: 'remnantEdge',
        type: 'bool',
      },
    },
  },
  {
    kind: 'char',
    key: 'Roxy',
    externalId: '1621',
    formulaPath: 'libs/zzz/formula/src/data/char/sheets/Roxy.ts',
    formulaHash: 'DFB173A363EFD3D9384AB3D53C543824B2B420ED14C67FD3039DC5F3C022D27D',
    metaPath: 'libs/zzz/formula/src/meta/char/Roxy/conditionals.ts',
    metaHash: 'CD07C34D82CB7756BD2832CCB1A99FE2E8A2EC2DFFF577A3AE6793777B1D2090',
    dataPath: 'libs/zzz/stats/Data/Characters/Roxy.json',
    dataHash: '764769EFD09AAD9D9651B8BD77D3B936AE6760515546333753104890F56587EF',
    mappedHash: '3C5421A9551DCCC40FCEA20984646CABC8ED6F6DC2BCE1A392DC3347DD929267',
    conditionals: {
      chillHits: {
        sheet: 'Roxy',
        name: 'chillHits',
        type: 'bool',
      },
      contamination: {
        sheet: 'Roxy',
        name: 'contamination',
        type: 'bool',
      },
      enemyHit: {
        sheet: 'Roxy',
        name: 'enemyHit',
        type: 'bool',
      },
      exSpecialUsed: {
        sheet: 'Roxy',
        name: 'exSpecialUsed',
        type: 'bool',
      },
      kindlyHits: {
        sheet: 'Roxy',
        name: 'kindlyHits',
        type: 'bool',
      },
    },
  },
  {
    kind: 'char',
    key: 'Koleda',
    externalId: '1101',
    formulaPath: 'libs/zzz/formula/src/data/char/sheets/Koleda.ts',
    formulaHash: '632180C58A583A7024641799AF82A21906D78973C2046A48C2DFB88E21E59C8C',
    metaPath: 'libs/zzz/formula/src/meta/char/Koleda/conditionals.ts',
    metaHash: 'FA0A5F0D08ECBBB23BC3508B105830EA70D0306AAB12E483D69DB3331276F8BB',
    dataPath: 'libs/zzz/stats/Data/Characters/Koleda.json',
    dataHash: '08D32A1E6A628AD342DC4F4EA6391AF15B6F8890CE47FD3884CC6BB60A49958D',
    mappedHash: 'DDB345F0D7A2296E756B48C7DF9F1A9A486EBEC032D47CB8904341C4BF0F0478',
    conditionals: {
      charge: {
        sheet: 'Koleda',
        name: 'charge',
        type: 'num',
        int_only: true,
        min: 0,
        max: 2,
      },
      exSpecial_debuff: {
        sheet: 'Koleda',
        name: 'exSpecial_debuff',
        type: 'num',
        int_only: true,
        min: 0,
        max: 2,
      },
      furnaceFire: {
        sheet: 'Koleda',
        name: 'furnaceFire',
        type: 'num',
        int_only: true,
        min: 0,
        max: 2,
      },
      quick_use: {
        sheet: 'Koleda',
        name: 'quick_use',
        type: 'bool',
      },
    },
  },
  {
    kind: 'char',
    key: 'Norma',
    externalId: '1571',
    formulaPath: 'libs/zzz/formula/src/data/char/sheets/Norma.ts',
    formulaHash: '604F9C881524A683CFDCF824573F5333A8A144DC103C8CBC7B2C7628B0BD6F46',
    metaPath: 'libs/zzz/formula/src/meta/char/Norma/conditionals.ts',
    metaHash: '707432B29047259899C291CA857EA3F2BDE06018007B1322FE13A1A6595E1A2F',
    dataPath: 'libs/zzz/stats/Data/Characters/Norma.json',
    dataHash: 'CBBBAEF46BF461B100E179753E5EF2F24A8461FAD4B2C679935E84033A494FDC',
    mappedHash: '0FAF9A7714D6558BC31F94E18E5EFD93D58B94D90E305101C54793E2179E1A89',
    conditionals: {
      boolConditional: {
        sheet: 'Norma',
        name: 'boolConditional',
        type: 'bool',
      },
      listConditional: {
        sheet: 'Norma',
        name: 'listConditional',
        type: 'list',
        list: ['val1', 'val2'],
      },
      numConditional: {
        sheet: 'Norma',
        name: 'numConditional',
        type: 'num',
        int_only: true,
        min: 0,
        max: 2,
      },
    },
  },
  {
    kind: 'char',
    key: 'Rina',
    externalId: '1211',
    formulaPath: 'libs/zzz/formula/src/data/char/sheets/Rina.ts',
    formulaHash: '25E6A6BCB84531FF113484E1C16C2262B60D05A49D97FC51A6AA5158D98A4225',
    metaPath: 'libs/zzz/formula/src/meta/char/Rina/conditionals.ts',
    metaHash: '83405B93933E28161DB7100BD2C4A5E13BD30EF922E3C00E5063953761AAAC44',
    dataPath: 'libs/zzz/stats/Data/Characters/Rina.json',
    dataHash: 'F2FA41601FDFC18FDDF07E960E375D0BDE2294339421460054A4116A4AB9586C',
    mappedHash: 'D312803BD3761753DEA22D774D814474F87B2687C4D00626C7FD8FEC8F45B34D',
    conditionals: {
      active_char: {
        sheet: 'Rina',
        name: 'active_char',
        type: 'bool',
      },
      exSpecial_chain_ult_hit: {
        sheet: 'Rina',
        name: 'exSpecial_chain_ult_hit',
        type: 'bool',
      },
      minions_onField: {
        sheet: 'Rina',
        name: 'minions_onField',
        type: 'bool',
      },
      shocked_enemy: {
        sheet: 'Rina',
        name: 'shocked_enemy',
        type: 'bool',
      },
      within_10m: {
        sheet: 'Rina',
        name: 'within_10m',
        type: 'bool',
      },
    },
  },
  {
    kind: 'wengine',
    key: 'CrimsonThirst',
    engineId: 'wengine-14161',
    specialty: 'armorer',
    formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/CrimsonThirst.ts',
    formulaHash: 'A9BDC57B4F326DA377771A8EBEECB24A4829D7B79BD9C34E88FEBAC3E9B95F9C',
    metaPath: 'libs/zzz/formula/src/meta/wengine/CrimsonThirst/conditionals.ts',
    metaHash: '7512ACA8AE46A9419632038EE0997BE161B25274D88D46BE65A82E2C6D66135B',
    dataPath: 'libs/zzz/stats/Data/Wengine/CrimsonThirst.json',
    dataHash: 'BD793DAC8D8E9231ECA7B526B9A1DCF1EEA4992F186B18C42E01B7D6A0E7E741',
    conditionals: {
      exSpecialMaim: {
        sheet: 'CrimsonThirst',
        name: 'exSpecialMaim',
        type: 'bool',
      },
    },
  },
  {
    kind: 'wengine',
    key: 'CrimsonMoonCasket',
    engineId: 'wengine-14162',
    specialty: 'stun',
    formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/CrimsonMoonCasket.ts',
    formulaHash: 'D8AF60C4F8BFA0685FE6364D00C443ED216912A0714EA3D16E8CBE87D9068B6A',
    metaPath: 'libs/zzz/formula/src/meta/wengine/CrimsonMoonCasket/conditionals.ts',
    metaHash: '9782955BEE785AED96793EFD67265E43F6C2B088C1D656EBBE49D333E7F93583',
    dataPath: 'libs/zzz/stats/Data/Wengine/CrimsonMoonCasket.json',
    dataHash: '3402C4B09D9D093695813FB8D02330FD05F5D7A69FFB0B2C4EA6C8DB45B1D9EE',
    conditionals: {
      windExSpecialUsed: {
        sheet: 'CrimsonMoonCasket',
        name: 'windExSpecialUsed',
        type: 'bool',
      },
    },
  },
  {
    kind: 'wengine',
    key: 'BloodmarrowCoffer',
    engineId: 'wengine-13021',
    specialty: 'armorer',
    formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/BloodmarrowCoffer.ts',
    formulaHash: 'CCB1FFA144F24E231C18E993B8FEB5F3CCE872B11770235EE1CF4699BA9E9D26',
    metaPath: 'libs/zzz/formula/src/meta/wengine/BloodmarrowCoffer/conditionals.ts',
    metaHash: '34667B53898E8D721354AA360C7AABE19C78B0F19539F4B368756F8197A9914C',
    dataPath: 'libs/zzz/stats/Data/Wengine/BloodmarrowCoffer.json',
    dataHash: '4D099F5B010EB10E03CEC006CBCC1E338F3FC7534DBC409CA2505DFAA2574375',
    conditionals: {},
  },
  {
    kind: 'wengine',
    key: 'CattyLuck',
    engineId: 'wengine-13017',
    specialty: 'armorer',
    formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/CattyLuck.ts',
    formulaHash: 'BBD2215C8616C384B9A508387B1CBBC0D6B6D5A281935BF56D19EBE711A70835',
    metaPath: 'libs/zzz/formula/src/meta/wengine/CattyLuck/conditionals.ts',
    metaHash: 'CB05E5412A938715067D57A402D770F357C93176791A54B5FAC2FAA2BF0FCC31',
    dataPath: 'libs/zzz/stats/Data/Wengine/CattyLuck.json',
    dataHash: '87A23B15BD008F8A00F1F480DDF2C3CAEDAB5E331370A73E06516CFF10ABDAFB',
    conditionals: {
      exSpecialUsed: {
        sheet: 'CattyLuck',
        name: 'exSpecialUsed',
        type: 'bool',
      },
    },
  },
  {
    kind: 'wengine',
    key: 'LunarSemiluna',
    engineId: 'wengine-12016',
    specialty: 'armorer',
    formulaPath: 'libs/zzz/formula/src/data/wengine/sheets/LunarSemiluna.ts',
    formulaHash: '4BD3763349D5C7545E355A593EFB039FA164578F406054101278A32CC735DCD3',
    metaPath: 'libs/zzz/formula/src/meta/wengine/LunarSemiluna/conditionals.ts',
    metaHash: 'CF18148A1F36C82E6D569A7C5C706563535CE0C7A2460B424C2924DC9489F0D5',
    dataPath: 'libs/zzz/stats/Data/Wengine/LunarSemiluna.json',
    dataHash: '872CF94BB95D5F4DE6A1DD36214E51AAE21BC4DB4B3645DC578F86952236D3B9',
    conditionals: {
      exSpecialUsed: {
        sheet: 'LunarSemiluna',
        name: 'exSpecialUsed',
        type: 'bool',
      },
    },
  },
  {
    kind: 'common',
    key: 'anomaly',
    formulaPath: 'libs/zzz/formula/src/data/common/anomaly.ts',
    formulaHash: 'B4FD12623C89A981F1BE1EA3134C01DB0C56FF5A4063CD82EAB0B5B2E6BC2ED8',
    metaPath: 'libs/zzz/formula/src/meta/common/anomaly/conditionals.ts',
    metaHash: 'C6AC92B745BEB3645A53C0E0A880469E8D0D6771CD79401D7FBAAA1BAC5B0AE3',
    conditionals: {
      anomTimePassed: {
        sheet: 'anomaly',
        name: 'anomTimePassed',
        type: 'num',
        int_only: true,
        min: 0,
        max: 30,
      },
      frostbite: {
        sheet: 'anomaly',
        name: 'frostbite',
        type: 'bool',
      },
      windswept: {
        sheet: 'anomaly',
        name: 'windswept',
        type: 'bool',
      },
    },
  },
  {
    kind: 'common',
    key: 'enemy',
    formulaPath: 'libs/zzz/formula/src/data/common/enemy.ts',
    formulaHash: '0E355C45DE5511408A16CC712A33A035829E477D207C23BAE7C8F1E400764855',
    metaPath: 'libs/zzz/formula/src/meta/common/enemy/conditionals.ts',
    metaHash: 'F1F954C50866357084366162FC43EB6C8EFE222679B82BE41640BA68B7FBDA34',
    conditionals: {
      isStunned: {
        sheet: 'enemy',
        name: 'isStunned',
        type: 'bool',
      },
    },
  },
]
