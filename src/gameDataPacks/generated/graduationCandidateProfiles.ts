/* Generated from docs\audits\M7-GRADUATION-PROFILE-PUBLISH-PREP-R1\graduation-profiles.production-shaped.ndjson; do not edit manually. */
export const graduationCandidateProfileProjectionIdentity = {
  "profileSchema": "soda-graduation-profile/v1",
  "profileVersion": "1.0.0",
  "generatorVersion": "soda-graduation-profile-generator-r1.0",
  "generationVersion": "production-profile-prep-r1",
  "sourcePackageId": "l3-b323989c00330f284329",
  "profileFileSha256": "4a8cdec1b87aa23ceae558a918debb896cdeab6f7279fef8ae41d81872912f5e",
  "population": 57,
  "authority": "candidate_graduation_profile_only",
  "formalSupported": false,
  "adoption": "runtime_adopted_candidate_sidecar",
  "rollback": "remove the Candidate Profile projection binding; legacy target_panel and account plans are unchanged"
} as const

export const graduationCandidateProfiles = [
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:candidate-3.1-agent-remielle",
    "agentId": "candidate-3.1-agent-remielle",
    "playerName": "蕾米埃尔·丹",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "3.1",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F4+F5+F7",
    "objectiveTopology": "O6",
    "configHash": "5cd30b0dedce2c93910dd7496113c0f8b4ef894fdd9c3169b6e3eb00e3e5f466",
    "inputHash": "9b6c79bc6acbd89c0c057280582660687c7c53e9163d9a397d286917d566995e",
    "inputReferences": [
      {
        "record_id": "fixture:candidate-3.1-agent-remielle:0:Lv60 raw stats and Core-F +75 ATK/+54 AP",
        "source_revision": "https://zzz.gachabase.net/agents/1581/remielle/release",
        "value": "Lv60 raw stats and Core-F +75 ATK/+54 AP"
      },
      {
        "record_id": "fixture:candidate-3.1-agent-remielle:1:Lv60 base ATK, ATK%, P1 conditional AP",
        "source_revision": "https://zzz.gachabase.net/w-engines/14158/ode-of-resurrected-wings/creator/3.1.12/17599459",
        "value": "Lv60 base ATK, ATK%, P1 conditional AP"
      },
      {
        "record_id": "fixture:candidate-3.1-agent-remielle:2:4pc/2pc and S-rank disc stat table",
        "source_revision": "https://zzz.gachabase.net/drive-discs/34100/feathered-fate/creator/3.1.12/17732047?lang=en",
        "value": "4pc/2pc and S-rank disc stat table"
      },
      {
        "record_id": "fixture:candidate-3.1-agent-remielle:3:canonical main/substat projection rules, dataVersion zzz-drive-disc-3.0-s4.1",
        "source_revision": "app/src/data/drive-disc-data.v1.json",
        "value": "canonical main/substat projection rules, dataVersion zzz-drive-disc-3.0-s4.1"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "41b3382b3c315dbecc898a8bd7bf09c83a6040a3baa8b8283d22258b81e8e8eb",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0ba005baa6661e1316e5d5b498d0701da6419cdaa3075686639b8a931a94292d",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fd68a67c38f82fdf3b69502c83e2c5732da5c163eca1f1d1ed7b112eddbf0ef0",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c69daf1ed9deb0b09bfb9642067e113192aa07835366aea9db8659d480e8f8e9",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c69daf1ed9deb0b09bfb9642067e113192aa07835366aea9db8659d480e8f8e9",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d7a4d1f3e2cf873e34f799e9019cfb05900632658bd2ae4906a8e52a064a03b5",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4195eb85929b39650f93b01355c21ccfe4f17b5afc7b99de4bde3b4647f91f2e",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "4747caade78532b81cb3eb7f18d059102cfcc09feee144dc19831d07f0780b55"
    },
    "profileHash": "ba6518f40d97553963d18a2079a45231be0159c15e693a2f9f2fc676233beaa5"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-norma",
    "agentId": "agent-norma",
    "playerName": "诺姆",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "3.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "6127eb423a273b78079aa78657d7a0bfaf5db1aff544e5497e52ce3803d6304f",
    "inputHash": "746cc3dae8f43f13ba6a319077ff6d7caf70dee7ae59ae7698a886ff50cf1f73",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-norma-core-levels:core.levels:batch-agent-norma-r2d",
        "source_revision": "eabba1f092b282cccb3f028b7253a1db3dac5208;libs/zzz/stats/Data/Characters/Norma.json;sha256:CBBBAEF46BF461B100E179753E5EF2F24A8461FAD4B2C679935E84033A494FDC",
        "value": "{\"source_core_index_range\":[0,6],\"levels\":[{\"core_index\":0,\"crit_damage_per_excess_crit\":0.86,\"crit_damage_cap_percent\":43,\"daze_per_excess_crit\":0.44,\"daze_cap_percent\":22,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200},{\"core_index\":1,\"crit_damage_per_excess_crit\":1,\"crit_damage_cap_percent\":50,\"daze_per_excess_crit\":0.5,\"daze_cap_percent\":25,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200},{\"core_index\":2,\"crit_damage_per_excess_crit\":1.14,\"crit_damage_cap_percent\":57,\"daze_per_excess_crit\":0.56,\"daze_cap_percent\":28,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200},{\"core_index\":3,\"crit_damage_per_excess_crit\":1.28,\"crit_damage_cap_percent\":64,\"daze_per_excess_crit\":0.62,\"daze_cap_percent\":31,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200},{\"core_index\":4,\"crit_damage_per_excess_crit\":1.42,\"crit_damage_cap_percent\":71,\"daze_per_excess_crit\":0.68,\"daze_cap_percent\":34,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200},{\"core_index\":5,\"crit_damage_per_excess_crit\":1.56,\"crit_damage_cap_percent\":78,\"daze_per_excess_crit\":0.74,\"daze_cap_percent\":37,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200},{\"core_index\":6,\"crit_damage_per_excess_crit\":1.7,\"crit_damage_cap_percent\":85,\"daze_per_excess_crit\":0.8,\"daze_cap_percent\":40,\"sheer_force_to_atk\":1.25,\"sheer_force_atk_cap\":1200}],\"nodes\":{\"sequence\":[{\"node\":1,\"base_atk\":0,\"crit_rate\":0.048},{\"node\":2,\"base_atk\":25,\"crit_rate\":0.048},{\"node\":3,\"base_atk\":25,\"crit_rate\":0.096},{\"node\":4,\"base_atk\":50,\"crit_rate\":0.096},{\"node\":5,\"base_atk\":50,\"crit_rate\":0.144},{\"node\":6,\"base_atk\":75,\"crit_rate\":0.144}],\"crit_rate_total\":0.144,\"base_atk_total\":75}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-norma-drive-discs:relation.drive_disc.recommended_set_ids:batch-agent-norma-r2d",
        "source_revision": "page-current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-swing-jazz\",\"set-moonlight-lullaby\",\"set-woodpecker-electro\",\"set-shockstar-disco\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-norma-formula-family:mechanics.formula_family:batch-agent-norma-r2d",
        "source_revision": "page-current@2026-08-05",
        "value": "direct_stun_window"
      },
      {
        "record_id": "ENTITY_FACTS:fact-norma-lv60-impact:stats.lv60.raw.impact:batch-agent-norma-r2d",
        "source_revision": "page-current@2026-08-05",
        "value": 106
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1e1d1103ba18249a6d24060d85a07e317b69505dd27e44da4813f5ce94d33221",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1ee16b38646a231a9830aa01c2cebdf14578fc6b2903d291ff3702c25f7e54b4",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "85353b5b31b35caa6b480d6cf642e302dbe8fb56a9a65ba7ac7bb181d5d12158",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "26f4701b6a657a19681a139070017bcf34c65cf4950707776b88ffe9d1a3dfe9",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "26f4701b6a657a19681a139070017bcf34c65cf4950707776b88ffe9d1a3dfe9",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "72be04bc00b2e3e5da86124d5e1e1d8cdca774e323a1bf0d3d8b5e9d77b184e4",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "bf68a25a7333ef449edbd247d9e8cc2a70ebeed87b0df8301d15e296e62ae169",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "98209ec7407b2f3d5ab9c17855240169a8278b79670f0949220ce364a963dff3"
    },
    "profileHash": "f760ce2384038a9b4fb9f45704e1efae2b2a6e2b0a9afaa5f9223fda7667a104"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-pyrois",
    "agentId": "agent-pyrois",
    "playerName": "佩洛伊斯",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "3.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F1",
    "objectiveTopology": "O5",
    "configHash": "2a4657b9b1bcbea0c7185c9ff115a600864284307cbe6653a4d1143ee67f6cd3",
    "inputHash": "78c1831a05d4b8db0c6be16fea07a1aad8e3eb1084d9bbbcdcaa2adc77e55f6a",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-pyrois-core-levels:core.levels:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": "{\"nodes\":{\"crit_rate_total\":0.144,\"base_atk_total\":75},\"levels\":[1,2,3,4,5,6]}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pyrois-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-the-sky-ablaze\",\"set-branch-blade-song\",\"set-woodpecker-electro\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pyrois-formula-family:mechanics.formula_family:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": "direct_crit_stun_window"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pyrois-lv60-atk:stats.lv60.raw.atk:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": 849
      },
      {
        "record_id": "ENTITY_FACTS:fact-pyrois-lv60-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-pyrois-lv60-crit-rate:stats.lv60.raw.crit_rate:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b96c078c7f91d1546c8a4f7c4146fb54e75694fb8bb77348096a9cfc364452b3",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e42706b64f6231dc7fbec3ba1b252fd9ab3710afa1c69605b6d2c46a00ad46d5",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d08697be17c23a25d49af98550213c06f751ba566caba2f13c75c90bcb8b2f90",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "67263cb473595d5f74c89070ba4e9fd5bce224a153ccd02b60277ee13c0e4d27",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "67263cb473595d5f74c89070ba4e9fd5bce224a153ccd02b60277ee13c0e4d27",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "006187c61ab861edc5a6f7c52021d2ba29aa5e5787e2512ab167e8277ae1869c",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3044451857293186d62f889ef744081288c56af049ab1f585f1d44c591a3241d",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "50eceb0026d0af73bbea5d1780ff2f278a7240d83ca14c1058f922428f5977de"
    },
    "profileHash": "9872ef4eaa14eefbcb5c63647415b7e1596daad36f62f9caa404be62d0a9566e"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-velina",
    "agentId": "agent-velina",
    "playerName": "维琳娜",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "3.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "b93f7e33cdeaa80f36d879d5fe711ad17b383534f6e87b680347c98d71e41de0",
    "inputHash": "5745f10308ee6f8db540b848b58be6348c064c3c9d8e0f2bada7fc8b8dd20319",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-velina-core-levels:core.levels:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": "{\"levels\":[{\"level\":1,\"vortex_bonus_percent\":100,\"condensed_abloom_percent\":95,\"sweeping_abloom_percent\":155},{\"level\":2,\"vortex_bonus_percent\":110,\"condensed_abloom_percent\":105,\"sweeping_abloom_percent\":175},{\"level\":3,\"vortex_bonus_percent\":120,\"condensed_abloom_percent\":115,\"sweeping_abloom_percent\":195},{\"level\":4,\"vortex_bonus_percent\":130,\"condensed_abloom_percent\":125,\"sweeping_abloom_percent\":215},{\"level\":5,\"vortex_bonus_percent\":140,\"condensed_abloom_percent\":135,\"sweeping_abloom_percent\":235},{\"level\":6,\"vortex_bonus_percent\":150,\"condensed_abloom_percent\":145,\"sweeping_abloom_percent\":255}],\"nodes\":{\"anomaly_proficiency_total\":54,\"base_atk_total\":75}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-velina-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-wuthering-salon\",\"set-moonlight-lullaby\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-velina-formula-family:mechanics.formula_family:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": "wind_anomaly_vortex_abloom"
      },
      {
        "record_id": "ENTITY_FACTS:fact-velina-lv60-atk:stats.lv60.raw.atk:batch-agents-3.0-remainder-r3a",
        "source_revision": "current@2026-08-05",
        "value": 797.57
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b41e245d9b575f849e21977e144509bb5fa929b5ce9d631f3d21a81ea1cb535f",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "aed34d5c5c441ba4a33b2844f3899c13db6c6028dcdc3c3b820c2402ee770174",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "67d69e96aaa07d0b67e68688715e6adbe6285c50b250ca2ebeb477fb1e5dd865",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f5d6f445597e1d1f83d904ce1831e5dbdaf339fbc71c784e95db5cf7dbd74e12",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f5d6f445597e1d1f83d904ce1831e5dbdaf339fbc71c784e95db5cf7dbd74e12",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "88d0e477d584e0de478c1711a2d66ec2fa9b4d45722fca57b3e0553ebc0b4111",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b5e52d01ceb1737c6f2485aac50a49b8787c8352371c40dd758c2c3c142bf1a3",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "ab5a5e4c4283e6bc9cd5bc30021657f17966841ba5b4d672b1d74770cba124e1"
    },
    "profileHash": "973cb6a37e04a8e036485d2a700ab0b522c18ed0ec77f381017dc4a15eff96d6"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-starlight-billy",
    "agentId": "agent-starlight-billy",
    "playerName": "星徽·比利",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.8",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F6",
    "objectiveTopology": "O3",
    "configHash": "c42a8bf84122db2277009e2b6ec75f17023f5dddf8e8e99e46168cd7188da70d",
    "inputHash": "1994286cdbb92d867cf98c0d9cb7fa0b1467123f03e24ec50c8e80f34b75a268",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-starlight-billy-core-levels:core.levels:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_rate_bonus\":0.144},\"passive\":{\"max_hp_to_sheer_force\":0.1,\"determination_cap\":120,\"full_throttle_cost\":100}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-starlight-billy-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-yunkui-tales\",\"set-woodpecker-electro\",\"set-branch-and-blade-song\",\"set-fanged-metal\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-starlight-billy-formula-family:mechanics.formula_family:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": "physical_sheer_hp_resource_direct_crit"
      },
      {
        "record_id": "ENTITY_FACTS:fact-starlight-billy-hp:stats.lv60.raw.hp:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": 8497
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2068baf55bd1b41fbd5d6708019fcf6aad845b7d1651126c4953ca89cb05a101",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "163a734b1385c4d032a9607fc20d5e20b4393b07f2e4c61d3de72c4fd0a5d7a0",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "edb918ef9f63fad49b211b6d89b2a70a3cbc4d2eba34ae962fc158fa9a69238b",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8210c42b385b1d75804c4f2e05cbb0eca253eab7c57f8b5aa2631f472e4d79d4",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8210c42b385b1d75804c4f2e05cbb0eca253eab7c57f8b5aa2631f472e4d79d4",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1d7ebc98d9b900ab7bccb1bfc0bc5ce6f76a108ba3d78b6262dfcad3d3a1d5c0",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "55544772cf075c87585963b5deaa8d76f8b139ea170ffaa937a68b5b1cbcccac",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "08def3898bf4f908c00f5b9665edd772b5c52e64fc309816d4836a72222b7c92"
    },
    "profileHash": "a4cd10e552fae8aed315be6f9a09987a9498d59facbbd68645252b2ec32f1a70"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-promeia",
    "agentId": "agent-promeia",
    "playerName": "普罗米娅",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.8",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F4",
    "objectiveTopology": "O5",
    "configHash": "6e1ceca423a1a88f740b1dadf807b095e61d8413b648b2f85f891a53c5d2d368",
    "inputHash": "32f8d66d56d16d561308f89567febea234c046147b4d6328eb506ee917af620d",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-promeia-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": 114
      },
      {
        "record_id": "ENTITY_FACTS:fact-promeia-atk:stats.lv60.raw.atk:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": 797.57
      },
      {
        "record_id": "ENTITY_FACTS:fact-promeia-core-levels:core.levels:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"anomaly_mastery_bonus\":36},\"abloom_multiplier_by_tier\":[3.85,4.35,4.85,5.35,5.85,6.35]}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-promeia-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-notes-from-the-chained\",\"set-phaethons-melody\",\"set-freedom-blues\",\"set-chaos-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-promeia-formula-family:mechanics.formula_family:batch-agents-2.8-r3b",
        "source_revision": "current@2026-08-05",
        "value": "ice_anomaly_abloom_snapshot_resource"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f3d807222d6e672893eb462b3e701f4e0be9185c0fcc7fca6484f94202ded713",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9d71a75078c0962060b68d5fcf33318f3cf5618e31f0630ff6a0df1607be83e5",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5244d51892b518f7940c4aaab30360c7fa9318e1713691311b0917f54ce34784",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "04c674619d312a3b2c6f78189884f2d5c8d6455341f87ede634a5ecd40f886d7",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "04c674619d312a3b2c6f78189884f2d5c8d6455341f87ede634a5ecd40f886d7",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "294bc4e227cf6bc6e1c8a50afdef60cbd9efafbbee2a7fac9897e411c3aaaa84",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e44079a6c29f76a22386deafc5d2a127a6367aeb9cccd227d90f69ed9cee5db6",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "1a1daca0ee80ea446cb421a4a2311735734af39932f78ed9e35a18a7f5ecd887"
    },
    "profileHash": "854dad61bb10d9f4a1ca9c06c465cf35ab1f077d6b086ba6d80e6b00e118b39f"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-cissia",
    "agentId": "agent-cissia",
    "playerName": "希希芙",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.7",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "9ad39f0c79b6a71429df0162bb4978e4fc943f48704e6e33f81597421bc5a693",
    "inputHash": "8797b4b059a781117aee72e98ce4964f7229b99a0aeb8dc05fc00ffd7b3c96f6",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-cissia-atk:stats.lv60.raw.atk:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": 863.21
      },
      {
        "record_id": "ENTITY_FACTS:fact-cissia-core-levels:core.levels:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"venom_cap\":6,\"initial_venom\":3,\"consume_interval_seconds\":5,\"def_ignore_base\":0.06,\"def_ignore_cap\":0.25}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-cissia-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-cissia-crit-rate:stats.lv60.raw.crit_rate:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-cissia-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-thunder-metal\",\"set-swing-jazz\",\"set-moonlight-lullaby\",\"set-branch-and-blade-song\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-cissia-formula-family:mechanics.formula_family:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": "electric_direct_crit_venom_corrode_bone"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4e2e7bde95747e93ebf852c44dd968675a584eb9f39808b6743836a801b4f847",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "108afd24cfea654c28eac156753b46d9e5e7f18a88f45cd79e72e4af1a2682ab",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f734f4db6be2c0e162fc030a35dacd30a8059af75b6fe03cb97ecd96080c7140",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "09a96e37575b13cada2653a413b69b78509733959040d609605aefcbce756e21",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "09a96e37575b13cada2653a413b69b78509733959040d609605aefcbce756e21",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6ffcd194f10d32b61bfd7c838d77acd28df844dff5914aac9ad5a287b13f2504",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0890cbc08f0fbcb3a06962ed5986d83f672a604295cb72dcbbe185c9ed2ce835",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "5de6318521edafb80165c18c900162ce405b2da4fbdf03a742410664be896f38"
    },
    "profileHash": "ab240048c68498bd2cbeaf686dc646d25f37fc2ab16bed685f6aa2fef0aa0088"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-nangong",
    "agentId": "agent-nangong",
    "playerName": "南宫羽",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.7",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F9",
    "objectiveTopology": "O5",
    "configHash": "c7a760079dfb3114617392879892f925a89f26d2154edea321fc8e05a09ac3ca",
    "inputHash": "cf17a53d56d022475138bc14d569b9a3988d47dd2cc857d719ddb0fef4b3dc7a",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-nangong-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": 93
      },
      {
        "record_id": "ENTITY_FACTS:fact-nangong-atk:stats.lv60.raw.atk:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": 671.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-nangong-core-levels:core.levels:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"anomaly_mastery_bonus\":36},\"passive\":{\"anomaly_proficiency_bonus\":120,\"impact_per_initial_am_above_110\":1,\"downbeats_cap\":100,\"downbeats_initial\":30,\"vibrato_cap\":4}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-nangong-def:stats.lv60.raw.def:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": 622.62
      },
      {
        "record_id": "ENTITY_FACTS:fact-nangong-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-phaethons-melody\",\"set-freedom-blues\",\"set-chaos-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-nangong-formula-family:mechanics.formula_family:batch-agents-2.7-r3c",
        "source_revision": "current@2026-08-05",
        "value": "ether_stun_anomaly_vibrato_polarity_disorder"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1e3df1fa70fb058164891f71cd71c5bbb334e7aa80490fd8fdfbaf8c181435ee",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0ac0e50c5fa0fd98351d196c457661a462c89d6f9e160f8db33cca062fb143a4",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e92cceb93bddea3fba8660dd80f8548db8af7a8c4b49a1b7801fb6ae1c1ee331",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "27738b996bad84427d4a2b0ca8aabece67dadc539319ed612a827591636e2bcd",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "27738b996bad84427d4a2b0ca8aabece67dadc539319ed612a827591636e2bcd",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a6ab11dbb2553700cdc1b78d18fcd612fc9591735e86085ec9b09872fd5db452",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "17de9d036b74aac69997ac41c9f6210b8401d8cada74b2518f5ec35706c6099e",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "ddab8fc2f05e640e15af80ef57019f271ddce51e1991bf3cbb97f0e9a5ac8a60"
    },
    "profileHash": "a339ed8f1a8a3bf999821f101558fd3fcd8b35fe26229169b113a9dfaef51427"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-aria",
    "agentId": "agent-aria",
    "playerName": "爱芮",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.6",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F4",
    "objectiveTopology": "O5",
    "configHash": "52d6539b994fa28090b858534efaaa2a2d42db205fb421d63a8d716d8e692ca3",
    "inputHash": "f22ea3a4067a2ef8842ea182045e3b53f6004990be2ad2e6ceaa9f41c81799a5",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-aria-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": 116
      },
      {
        "record_id": "ENTITY_FACTS:fact-aria-atk:stats.lv60.raw.atk:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": 788.45
      },
      {
        "record_id": "ENTITY_FACTS:fact-aria-core-levels:core.levels:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"anomaly_mastery_bonus\":36},\"passive\":{\"fandom_power_cap\":8,\"perfect_pitch_charge_levels\":3,\"abloom_requires_attribute_anomaly\":true,\"stun_amplifies_abloom\":true}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-aria-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-phaethons-melody\",\"set-freedom-blues\",\"set-chaos-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-aria-formula-family:mechanics.formula_family:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": "ether_anomaly_abloom_charge_stun"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f709b9f051dce2d3f0057e83dd61ecf459f9c8208f9b86cfaaf5ecf54a58d4a1",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7595dd44b58c0196e8e8f4b6653580b13e119cb62c8d62dbfd8dfa46ad35669a",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ad7c3a85e41ae9a65951d1b290f614ae896e7ade08f8de749623dc135cd5612d",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "60dd05f107f05431b17d98105d26746cae1f5bfbc837839802412c6872830666",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "60dd05f107f05431b17d98105d26746cae1f5bfbc837839802412c6872830666",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "88b3829dcdaff1d5266f324dbd64652df89a10084ac1f908fbdfd4a2dddeb1ff",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "471411a6275849f7e0e648da1b535f7cfc7ad24a3bec08033ed29b9a731b5892",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "bcfcf232208a92b3d812b74748de9caeb4c42e2ebbc821848fe5ddaafec51fc3"
    },
    "profileHash": "2d8b7e67d4d2943e0d28f4ea45bd7aaeacc6b800ab5186155f2adde78cde9e3d"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-sunna",
    "agentId": "agent-sunna",
    "playerName": "千夏",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.6",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "25f67ec36b2fdc3f44edfa2c0273553d6e5b4d62877e25f133582b4a48c02c3d",
    "inputHash": "a6084e0b764e3efe43081bf43b8b9b6eac23228c3741c47225ffeec364cf5b0d",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-sunna-atk:stats.lv60.raw.atk:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": 675.75
      },
      {
        "record_id": "ENTITY_FACTS:fact-sunna-core-levels:core.levels:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"percent_atk_bonus\":0.21},\"passive\":{\"claw_sharpener_cap\":6,\"cat_gaze_duration_seconds\":12,\"team_atk_ratio\":0.3,\"team_atk_cap\":1050}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-sunna-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-moonlight-lullaby\",\"set-swing-jazz\",\"set-astral-voice\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-sunna-formula-family:mechanics.formula_family:batch-agents-2.6-r3d",
        "source_revision": "current@2026-08-05",
        "value": "physical_support_cat_gaze_trigger_owner"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6926f285e446391ca0f9ce7f09fb2f0862b0e86b7a2976c4bcc018c5a58a4298",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3d9deee8f680e8d84a6931b43248295bcd2680458a53f8aef73b788a139dd9a7",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5496eaf9037edc9540750207f8ee957cea7202ccc1573fa4d695f313068cdd26",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f55e84f06a120e68f14b5d09119abe6ee8fd1debcb67371f7f7cbc2a209b6fa9",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f55e84f06a120e68f14b5d09119abe6ee8fd1debcb67371f7f7cbc2a209b6fa9",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "620a74e3a03dd29dddf1c77efaa722eb011a372081b865e41aac5bd3d8c476e7",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "236ed4d6ee66cae889b64034f1b11cd08c3334eb8ff1914c4cf60d296f4008c8",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "09a56fd956bb9f55cd6814bbf244b81f1ce64677d72628b84b704b654a7d9b0f"
    },
    "profileHash": "3ea382e77bdc65a38400ea0bef23c243b6663e4dc23e7741113d223b7e13b6cf"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-zhao",
    "agentId": "agent-zhao",
    "playerName": "照",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.5",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F8",
    "objectiveTopology": "O4",
    "configHash": "82a53b3ba43146be4d3eb4b235c7ac97a8e77c7f4b42c23f90bf4f9a61985471",
    "inputHash": "a646d01506272b7e9ff7b1747b8156177088d2419103d1ff35dfb41cd56c8891",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-zhao-atk:stats.lv60.raw.atk:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": 690.66
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhao-core-levels:core.levels:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"max_hp_bonus\":0.18},\"passive\":{\"frostbite_cap\":100,\"active_hit_gain\":6,\"active_hit_cooldown_seconds\":3,\"ether_veil_seconds\":40,\"team_atk_bonus\":1000,\"team_atk_seconds\":50}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhao-def:stats.lv60.raw.def:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": 701.89
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhao-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-bunny-in-wonderland\",\"set-yunkui-tales\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhao-formula-family:mechanics.formula_family:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": "initial_hp_frostbite_wellspring_team_support"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "26648cf87e9ef60dd5a86fb98265049aca26060d33b4fa541593c50c4a004a92",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "759380a09d222c409c3b36f0af8980a8b0e8c776bfa9dac9107cc124ae73ca72",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5eea8c4a2c3b33754493c0ae88c7b8568921d2f96ddd8b3e2481bf95e7a2c583",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a1301ad6a5c6370a05d22cae15a7a5711da42b99654e08800a4b5dedf938fac5",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a1301ad6a5c6370a05d22cae15a7a5711da42b99654e08800a4b5dedf938fac5",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4020090345a3749f1cfa9bdc9884b5c3121291537f1769d27192aba5aa15805b",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e8f3691c799c41a21cfb2ef93b717ae282ada77ef543b9554bb611404bb48cff",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "b89322de26ab4320b85d8b7cee36ae000c2af399e64529df4df6c42602911d50"
    },
    "profileHash": "62a461b0281e0ae709e9144b6ae2752a7156ba918ed338b5347956d129200fa4"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-ye-shunguang",
    "agentId": "agent-ye-shunguang",
    "playerName": "叶瞬光",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.5",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "aa7ff8730dda81b54b8c832c24fbadcb019eb8cbb773b914fbfca335a7ab0a8c",
    "inputHash": "074c0a4851f445dba2ac16f140f267d7f58945f68ff791e7945e332d3614ed5b",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-ye-shunguang-atk:stats.lv60.raw.atk:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": 863.21
      },
      {
        "record_id": "ENTITY_FACTS:fact-ye-shunguang-core-levels:core.levels:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_rate_bonus\":0.144},\"passive\":{\"qingming_sword_force_cap\":6,\"bearer_cap\":3,\"enlightened_mind_seconds\":16,\"veil_vulnerability_cap\":1.1}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ye-shunguang-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-ye-shunguang-crit-rate:stats.lv60.raw.crit_rate:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-ye-shunguang-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-white-water-ballad\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ye-shunguang-formula-family:mechanics.formula_family:batch-agents-2.5-r3e",
        "source_revision": "current@2026-08-05",
        "value": "honed_edge_enlightened_mind_veil_vulnerability"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a608f44c5c7a544b267a9490d141c4a2c7c2d3c41b388188b290d3a2e21b76ee",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "79b60b5f5a62acd3c1bdaaf71b7a6d1f31d49d1ffae99eb3437a237738ddf818",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c22e6d50974e740e83c13783c89b6ef49e80ee69fe584d2a86953339a444d188",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "481427a7f96c7179c4ccd89683ca3dbd68b0f2d70cd794d4e61c2f2d386178db",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "481427a7f96c7179c4ccd89683ca3dbd68b0f2d70cd794d4e61c2f2d386178db",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "dbd1dc7f274ed3358648f840c5fa9228a8bb679b1ad67033e7f1b75d1ee52d52",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fb0826e0ff5a205318f208387aecf3a47098be66d8f00c596cab11c09ed0f651",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "688543f5de9d196564fe27d77fb1d109236b2f9b69b50b4d35dd39fe848c1782"
    },
    "profileHash": "c54eaa59b78438dc44d2b4eb26ef4774dc3603916588f350f8f85cf7482d04a2"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-banyue",
    "agentId": "agent-banyue",
    "playerName": "般岳",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.4",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F6",
    "objectiveTopology": "O3",
    "configHash": "a2de6c908b6a747eb53fc813449d19ac0c8b0dff4b761ba8f1c718b989f7e3ac",
    "inputHash": "c149a9d6eb4a93ab1bb5aa3954d45525200f7378c935e02b70492dc55658a7d5",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-banyue-core-levels:core.levels:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_rate_bonus\":0.144},\"passive\":{\"max_hp_to_sheer_force\":0.1,\"wrathful_fires_cap\":150,\"visage_threshold\":120,\"mountains_might\":4}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-banyue-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-yunkui-tales\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-banyue-formula-family:mechanics.formula_family:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": "max_hp_sheer_force_visage_resource_cycle"
      },
      {
        "record_id": "ENTITY_FACTS:fact-banyue-hp:stats.lv60.raw.hp:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": 8497
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "caefb0712fdf3349a40ca687e82f0af189a308f47db6f59463b1469fe2b702c0",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d7be8a86fb5e63cbcf69d6fba5d523f86c5ff3ef4330676143cc79a61252f554",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4920251575d3900ecd1173867478fe8c8fb972069a7e43c00bdcc936a393c57d",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6cc588e7b338de00d2a183836ac3c0cc474a7690f5a290318a2f1cdfb14e3c3f",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6cc588e7b338de00d2a183836ac3c0cc474a7690f5a290318a2f1cdfb14e3c3f",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5af5bb541dd0765e70c052f0f9735d95109cb8a909bbaffc8aaefd2f7522466f",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ed4ce15c8eb9b4510c9e6490fa7ffe701421be7db6e4bce6689eeac04b7ce4a8",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "d1e4dc29425416d56feb7b2d278a62fc626c4def30cd318d555059ec47d50c7a"
    },
    "profileHash": "69d38ba7309aed2e3c8db4fd4c3211fff79348d6a3bb2c69e21a8c9794eef046"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-dialyn",
    "agentId": "agent-dialyn",
    "playerName": "琉音",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.4",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "57b288130855bcd7552e47ef46ed94cccc0b6ee2eca39c5e064a453d1aa0e936",
    "inputHash": "8d7cdc5cf2fc154ee2d4582435f6aef8444660a92efd792d9137af8460e7c3b1",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-dialyn-core-levels:core.levels:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_rate_bonus\":0.144},\"passive\":{\"positive_reviews_initial\":60,\"positive_reviews_cap\":120,\"ultimate_conversion_threshold\":90,\"customer_complaint_cap\":1,\"stun_extension_seconds\":2}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-dialyn-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-dialyn-formula-family:mechanics.formula_family:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": "positive_reviews_ultimate_conversion_stun_window"
      },
      {
        "record_id": "ENTITY_FACTS:fact-dialyn-impact:stats.lv60.raw.impact:batch-agents-2.4-r3f",
        "source_revision": "current@2026-08-05",
        "value": 110
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0746ffcf60ab91a7fb539796eb378b84693bedbd1e40bf14cf94cf997ed628a3",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c141f4948d529c70222340c7b26905702635eaf9fae3ce59f36098581a204b30",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "eb2712cf4e9e08f52c8714535d9a99433bf5a955b4f1a4d810727801bc2b592b",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9bd72df4e8c1ce871889b72da53efccced0ee836dd22ebe611c5c0fe32141c99",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9bd72df4e8c1ce871889b72da53efccced0ee836dd22ebe611c5c0fe32141c99",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "06e415143adf3ae8ec8cfc3f123c2c239fb2f1d2a4f954fc5c968c0b38b09f56",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c8d3a103673456002df13f36e459f8683f623c7bdf707f284c2c898ecae93cc2",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "8bcb6a4479aceaabe037d78012f131e7a2d70840027a1e530ec0eaa48c5dda5b"
    },
    "profileHash": "278db041d8764673ddc14a219b47b1f3f55ee5e5afd2bd27f8be391565498a48"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-yidhari",
    "agentId": "agent-yidhari",
    "playerName": "伊德海莉",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.3",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F6",
    "objectiveTopology": "O3",
    "configHash": "d24ea6e0232c55afc4f4ebcbc1f4876fd252de8f37eb85a83796b15641f77932",
    "inputHash": "d2e98294a0f4c3dabc8be2b133a0c051167e7bf8713151af01e0869958963f46",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-yidhari-core-levels:core.levels:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_rate_bonus\":0.144},\"passive\":{\"max_hp_to_sheer_force\":0.1,\"max_low_hp_damage_bonus\":1,\"decibels_per_hp_percent_lost\":10}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yidhari-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-yunkui-tales\",\"set-woodpecker-electro\",\"set-branch-and-blade-song\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yidhari-formula-family:mechanics.formula_family:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "hp_loss_sheer_force_ether_veil"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yidhari-hp:stats.lv60.raw.hp:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": 8497
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cf08d10afb4a18565331e276d56356d6c807630d0e8b320c07f9f044e5fe12b1",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "08ed16f796a1e15cf63f8f0711bf76fdbb068e387130e5034a4b9c90df9c836f",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "08542a407f04ff92f96cc0f8b15a42d026e3151f159db08715ba2c08348ef339",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "de65e16ee4d473b6b6280e931a57f3f40e638d1e520f031c3567394d299b5c9a",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "de65e16ee4d473b6b6280e931a57f3f40e638d1e520f031c3567394d299b5c9a",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "00fb89486fdbe9e927e4eaf19952e416bfc974101a79479060dd1dc60b7747f3",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "62da7f2785f6486051c63f6f27fe8938f9f30a0d6a2324ab95b81d6dfaaeb848",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "ce9e4e6574d440101c4cbff1d37acedb26b751ba104c7b7756330dd06f493a46"
    },
    "profileHash": "d3de4ee0289184dd73a202bdb51835d6b305f288ac3ecd983311629d78c71d06"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-lucia",
    "agentId": "agent-lucia",
    "playerName": "卢西娅",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.3",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "fa2633734a02221af717e5b4c599f2c6bf1d988e1cae0b397de40820a18b0d82",
    "inputHash": "87bed82f42208710ded6fa33b3bc3994e23438f062eff77b8a47ff88cd727896",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-lucia-atk:stats.lv60.raw.atk:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": 683.2
      },
      {
        "record_id": "ENTITY_FACTS:fact-lucia-core-levels:core.levels:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"initial_dream_points\":60,\"dream_threshold\":100,\"dream_point_cost\":25,\"ether_veil_max_hp_bonus\":0.05,\"ether_veil_seconds\":40,\"max_extension_seconds\":300}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-lucia-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-moonlight-lullaby\",\"set-yunkui-tales\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-lucia-formula-family:mechanics.formula_family:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "dream_points_harmony_darkbreaker_ether_veil"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "12480386bfbe81bcb2cfe038dc2773e081e07ea3a0221444cad7132283478aae",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7cd13d46d953e7f0e8354b67b4a89bb1d86c366ffce4c413a99aa6f110544911",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5f1531268ecae1434e92a19fe66d6c809eccc54b4735351fb341578d359f45d2",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "43766b7159b506f7f3ad4fc6d91c57db355d8361e0adbe85249efef09c5a4bcf",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "43766b7159b506f7f3ad4fc6d91c57db355d8361e0adbe85249efef09c5a4bcf",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1c69b2c96faf2f47e992b9b06fdf89286927063af8977e2e250015af0202c89e",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1b28a0143509baad71ba36f5f876529e820fb831126b398dd33d149f00b8b790",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "68ad264d756e82b1b7d3c241d55011db2a13deb9f77da36a42bc0a2e307ab2c1"
    },
    "profileHash": "e6d1dadc7cad8d312b2258cc73d857a6d699a2de1f8f69f433fe503297fd0c05"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-orphie-magus",
    "agentId": "agent-orphie-magus",
    "playerName": "奥菲丝&「鬼火」",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.2",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "407fe2a800561fd14db76853feac5544565484ca60276a73cb1750334bdb092a",
    "inputHash": "3d080661831e5f97b52072a0aca0745ff3ad64552174e3f32f3571c5eae6b53f",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-orphie-magus-atk:stats.lv60.raw.atk:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": 854.76
      },
      {
        "record_id": "ENTITY_FACTS:fact-orphie-magus-core-levels:core.levels:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_rate_bonus\":0.25,\"base_energy_regen_bonus\":0.36},\"passive\":{\"aftershock_damage_bonus\":0.85,\"bottled_heat_initial\":100,\"bottled_heat_cap\":125,\"off_field_auto_ex_energy_threshold\":60,\"off_field_auto_ex_energy_cost\":30,\"zeroed_in_base_atk_bonus\":280,\"zeroed_in_seconds\":12,\"zeroed_in_extension_seconds\":4,\"zeroed_in_max_extension_seconds\":20}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-orphie-magus-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-orphie-magus-crit-rate:stats.lv60.raw.crit_rate:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-orphie-magus-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-shadow-harmony\",\"set-swing-jazz\",\"set-moonlight-lullaby\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-orphie-magus-formula-family:mechanics.formula_family:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": "aftershock_bottled_heat_zeroed_in"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e27e33b9ba41944e638b61ab692baae0326863a09882b92120b3ca3dc1af001c",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5e3608c198cd3d12eaf7fcf87634c18c0e11b61d6e7147fac9f7c513b4dc4bd1",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2cf78299ad9e68ed138bfc110017887d165c1507d8ddfc9090963fc99d0ba021",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0a10eba3ce9f6e33b9fd019fa41b9e0628c8fd0ea3f7748688ac43b0ec74e2ab",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0a10eba3ce9f6e33b9fd019fa41b9e0628c8fd0ea3f7748688ac43b0ec74e2ab",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1a02cdd400746c4be948e7aa81cf401b7b6cc88fc9cfeb94c717e259f09fe048",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d445b77ed9c419388b26f46a14c3e6f41292d3a232dbe13adb48115f35f634e5",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "8cd2aac535ec2aa0e80423304680595292b802e235219d71a6d63422620b9a33"
    },
    "profileHash": "fb075c4f9ff0854028366c5e7eb597a60e0d2b794e97fa0148262186ba3453e2"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-seed",
    "agentId": "agent-seed",
    "playerName": "「席德」",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.2",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "f3853c1ba729993292f4d0bad1c321af8896491675d92464990e8962060459ed",
    "inputHash": "b60fa10a6a7408f7e22143a089483927cb654a81fbf79aaa2c51415d58996e65",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-seed-atk:stats.lv60.raw.atk:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": 854.76
      },
      {
        "record_id": "ENTITY_FACTS:fact-seed-core-levels:core.levels:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"crit_dmg_bonus\":0.288},\"passive\":{\"vanguard_initial_atk_selection\":true,\"onslaught_atk_bonus\":1000,\"onslaught_crit_dmg_bonus\":0.3,\"besiege_damage_bonus\":0.25,\"buff_seconds\":40,\"steel_charge_per_energy\":0.5,\"steel_charge_initial\":60,\"steel_charge_cap\":150,\"downfall_threshold\":120,\"downfall_cost_per_form\":60}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-seed-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-seed-crit-rate:stats.lv60.raw.crit_rate:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-seed-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-dawns-bloom\",\"set-woodpecker-electro\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-seed-formula-family:mechanics.formula_family:batch-agents-2.2-r3h",
        "source_revision": "current@2026-08-05",
        "value": "vanguard_mutual_buffs_steel_charge_downfall"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "69f1839e55e6a5f4cd2777b1edbdd185ae4915ed49adb73ff6f8e981b0c35051",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1002b397ce68910a4c47d2f40c1365921b29e7a80ca3984d1854ca2a72b10173",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ca4cfa5a9ff4b75a317bbe844b54e3e228e268b2bf6981efad6f9702cbcc17f2",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0c925c1d5fb9a19acee772af27cf675e59f0fcdd9a357b82dfad4413d752d2c7",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0c925c1d5fb9a19acee772af27cf675e59f0fcdd9a357b82dfad4413d752d2c7",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1f6c5875e45e7a547ef07ced0a93e349d1b3add3175e605528b4ea097096f365",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1c4a5b41d46779ac9218963dc19a951e1e9622b814248af4973c4868338aedf9",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "71f59c9d9f86c483f825a7078a17eb4f2128b0b2158d3f706a8c8ba028eb2e03"
    },
    "profileHash": "fb08385f65520a9e5415ab0cc193de580ecae0a3a33983dd959821b0b11c7792"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-alice",
    "agentId": "agent-alice",
    "playerName": "爱丽丝",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.1",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F5",
    "objectiveTopology": "O6",
    "configHash": "711cd45d1ff5267de9b71e723e8340370039f23e165d809cd657586350ef1ccf",
    "inputHash": "6cf5cd3cefd2f510d8c65256ff06418dc1bc049cae5ad57cd6db79fef74721f5",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-alice-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": 118
      },
      {
        "record_id": "ENTITY_FACTS:fact-alice-atk:stats.lv60.raw.atk:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": 805.7
      },
      {
        "record_id": "ENTITY_FACTS:fact-alice-core-levels:core.levels:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_mastery_bonus\":36},\"passive\":{\"physical_anomaly_extra_tick_seconds\":0.95,\"physical_anomaly_extra_tick_ratio\":0.025,\"blade_etiquette_cap\":300,\"blade_etiquette_per_bar\":100,\"assault_restore\":10,\"polarized_assault_ratio\":1.0,\"disorder_remaining_second_bonus\":0.18,\"disorder_remaining_second_bonus_cap\":1.8,\"assault_buildup_efficiency_bonus\":0.25,\"assault_buildup_buff_seconds\":30},\"additional_ability\":{\"activation\":\"another_squad_member_specialty_is_anomaly_or_support\",\"disorder_blade_etiquette_gain\":30,\"anomaly_mastery_threshold\":140,\"anomaly_proficiency_per_excess_am\":1.6,\"entry_blade_etiquette\":300,\"investigation_zone_entry_cooldown_seconds\":180}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-alice-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-fanged-metal\",\"set-phaethons-melody\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-alice-formula-family:mechanics.formula_family:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": "blade_etiquette_polarized_assault_disorder"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0ee43b67dbc30723437fae638188bb0299db5a97d6ace1894eb7bd1ae106c47c",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9e1bb1d3018d2ef2c0bada8301b28ac4988f1189f0f8d827d46af31dd6135029",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6ed9561d1785af29f9dfd3422f7e14bae36b49ea84f208d530a01c0a9d9d627b",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5cbf5c914b7dc2d1d59fbdf419e9ec1bba87ca04793e4218233fd4b86d60b5e8",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5cbf5c914b7dc2d1d59fbdf419e9ec1bba87ca04793e4218233fd4b86d60b5e8",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "777f01154f5b79f84e3bcf8a2a7351b8ad9003bbcc523682d5232b5b6763bfe5",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6f6d4b4ed7287495da52eb221e485e3ceed779cd96b863721fc4a94c3e1ef752",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "0a92d8d94311bb4905f5fb9bd1ddb804f455295bba1232818a48fdbbf3ebcc2c"
    },
    "profileHash": "2e122ce254f662bb19535f596713e721a212ca9d160722228a23e93e7eb5f937"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-yuzuha",
    "agentId": "agent-yuzuha",
    "playerName": "柚叶",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.1",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F9",
    "objectiveTopology": "O5",
    "configHash": "0453360255a7adabe4e2f260bff508b860f49de9283403ed4b47ce79004a4103",
    "inputHash": "fcc2f3d9335932e23478492ab9ea491c4deb24dadc2711fcc5f59343a42af380",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-yuzuha-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": 93
      },
      {
        "record_id": "ENTITY_FACTS:fact-yuzuha-atk:stats.lv60.raw.atk:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": 683.2
      },
      {
        "record_id": "ENTITY_FACTS:fact-yuzuha-core-levels:core.levels:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_mastery_bonus\":36},\"passive\":{\"sugar_points_initial\":3,\"sugar_points_cap\":6,\"sweet_scare_initial_atk_coefficient\":0.4,\"sweet_scare_atk_cap\":1200,\"sweet_scare_damage_bonus\":0.15,\"buff_seconds\":40,\"additional_ability_anomaly_mastery_floor\":100,\"additional_ability_anomaly_buildup_per_point\":0.002,\"additional_ability_anomaly_damage_per_point\":0.002,\"additional_ability_cap\":0.2,\"hard_candy_cooldown_seconds\":8}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yuzuha-def:stats.lv60.raw.def:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": 612.6
      },
      {
        "record_id": "ENTITY_FACTS:fact-yuzuha-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-moonlight-lullaby\",\"set-phaethons-melody\",\"set-astral-voice\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yuzuha-formula-family:mechanics.formula_family:batch-agents-2.1-r3i",
        "source_revision": "current@2026-08-05",
        "value": "sugar_points_sweet_scare_tanuki_wish_anomaly_support"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6638d733da8d69af0667a94d84e65f61a9f5ef8433d8935b0f724265f04c0bf9",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f058b2fb09f2949bd3820a79108a4adc04fd4f335a6c0adfad38a79c1add8f81",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b61cca43ab16f26665249a0c6d8a993e0933bdb3d222c704776c07e839fa34c6",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6ff9479052a03f302053aaee2096225da117bdb371e08b9fad6982962b94f5f6",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6ff9479052a03f302053aaee2096225da117bdb371e08b9fad6982962b94f5f6",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e21e254ca508b16f384a1c37087adbb575698573c3f2757ddbb01fd84a91a991",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6d844d4b86e005ceb5794a0264712537808ebe4b6e785b319367339af42275f9",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "08d70c739e374b6c30d66ea897f5fdfdd263c41ede3f61a37f30ef61d06a02af"
    },
    "profileHash": "15687fdb4044d1e3397ea5e748b9a729d9b05869e3d0ae3bd53262fbf382358a"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-ju-fufu",
    "agentId": "agent-ju-fufu",
    "playerName": "橘福福",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "ccc81abec462794f6bb15aa3a8b8367fd8089862406cba736c175cd7b073f151",
    "inputHash": "9962422512723b0d61b2fa5762bc2196cb0ee6238a82edacf32bebe848edd6b3",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-ju-fufu-core-levels:core.levels:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"might_cap\":200,\"might_on_hu_wei\":20,\"might_threshold\":100,\"momentum_cap\":15,\"momentum_ex_special\":3,\"momentum_ultimate\":6,\"momentum_assist_followup\":1,\"momentum_assist_cooldown_seconds\":10,\"momentum_to_might\":25,\"tigers_roar_crit_dmg_base\":0.2,\"tigers_roar_crit_dmg_per_100_atk_above_2800\":0.05,\"tigers_roar_crit_dmg_cap\":0.3,\"tigers_roar_seconds\":30}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ju-fufu-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-shockstar-disco\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ju-fufu-formula-family:mechanics.formula_family:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "hu_wei_might_momentum_tigers_roar_aftershock"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ju-fufu-impact:stats.lv60.raw.impact:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": 118
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c418ca45c03eed009aaa852ecfac97201c4d2952c46ff5b71c370b310eb645ff",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "510fcde497fbd04ff1cebf20c8f26e28063407ea9d25946bfe482ec0f361e570",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7adb5e23bd7484387dac1ca2e5a6a7967a1f18334d80958be83d64de44c872a2",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fa001f68aa7df0f6625fa5ee913d4113216f639128a32e0e0febc55deec43c73",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fa001f68aa7df0f6625fa5ee913d4113216f639128a32e0e0febc55deec43c73",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "607ab68edf04079201f4d1c14af9cd03adc20bdfbb6396037a9a3cadccfc452e",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7c1e09a9e21debd30f4f782434f2af96196883e4cd23d2746b42efa779281652",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "1fb9f0bede7b0372e42b52bdf0caf16dc9d863d75dd30dc4e8ff24bef27a22c1"
    },
    "profileHash": "ec4ce00632bcf5b63ae2a8987e60a2a6e2713224aa65b5d8f101c6990b0bf6a6"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-yixuan",
    "agentId": "agent-yixuan",
    "playerName": "仪玄",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F6",
    "objectiveTopology": "O3",
    "configHash": "c67e40552d992b4faa8f755ae3df73c9ead3cf39d1cdfbdd6b9d54410c95038e",
    "inputHash": "a5fddbafb2e8b182ca52160ebc5587ed1873a8289cc40aafe5e8fa8ae35fb97c",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-yixuan-core-levels:core.levels:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_hp_bonus\":420,\"base_crit_rate_bonus\":0.144},\"passive\":{\"sheer_force_hp_ratio\":0.1,\"adrenaline_on_anomaly\":10,\"adrenaline_anomaly_cooldown_seconds\":10,\"adrenaline_on_perfect_dodge\":5,\"adrenaline_dodge_cooldown_seconds\":1,\"technique_points_per_adrenaline\":0.667,\"technique_points_cap\":120,\"max_core_skill_damage_bonus\":0.6}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yixuan-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-yunkui-tales\",\"set-woodpecker-electro\",\"set-branch-blade-song\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yixuan-formula-family:mechanics.formula_family:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "sheer_force_auric_ink_adrenaline_technique_points"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yixuan-hp:stats.lv60.raw.hp:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": 7954
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1951584569ccb158b2ab637855cea3b518d8d7561af386e77ef220794bea727f",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "39b530fc98a0dcf55b8cd4da9d782062b772eb430b98485ad7dbc4d56299c1c0",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c9e8620310a9a664dbee6bc9325454e863909476aa4e3765c7709461a15a21b5",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ee2f964ac7cb25034d808c4b5c6224fa03ff21372076293e00a5205ed144974c",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ee2f964ac7cb25034d808c4b5c6224fa03ff21372076293e00a5205ed144974c",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7298c655bb3d3d5798995bc02aaac0ccbd71a95745c512787b6539bfc031756e",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7a67ba011d63431ca3a5d1015b65af4bcd0eb1108858cf4ffbd8df19ce9318ea",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "f9afb8f690dcadff562d947a3567e38d44f06208eaab5554eb1b8a5963f809b4"
    },
    "profileHash": "6b33da2129f7394c1855873287975e719b748c16476c35d869dc20a018c38c89"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-hugo",
    "agentId": "agent-hugo",
    "playerName": "雨果",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.7",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F9",
    "objectiveTopology": "O5",
    "configHash": "428cc7f788f316650356210aafb3bf96e16b63f81112c21b5faa86e5160250dd",
    "inputHash": "45dac7eab5405aafd6708f4a61d0e1eff946936b6289b14c97395b5bf6267c2d",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-hugo-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": 90
      },
      {
        "record_id": "ENTITY_FACTS:fact-hugo-atk:stats.lv60.raw.atk:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": 844.3
      },
      {
        "record_id": "ENTITY_FACTS:fact-hugo-core-levels:core.levels:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"dark_abyss_reverb_seconds\":6,\"dark_abyss_reverb_crit_rate\":0.12,\"dark_abyss_reverb_crit_dmg\":0.25,\"other_stun_one_atk\":300,\"other_stun_two_atk\":900,\"totalize_base_multiplier_bonus\":10,\"totalize_first_five_seconds_per_second\":2.8,\"totalize_next_ten_seconds_per_second\":1,\"totalize_multiplier_bonus_cap\":34,\"daze_recovery_per_remaining_second\":0.05,\"daze_recovery_cap\":0.25,\"non_stunned_ex_daze_bonus\":0.2}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-hugo-def:stats.lv60.raw.def:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": 616.61
      },
      {
        "record_id": "ENTITY_FACTS:fact-hugo-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-hormone-punk\",\"set-polar-metal\",\"set-woodpecker-electro\",\"set-puffer-electro\",\"set-astral-voice\",\"set-branch-blade-song\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-hugo-formula-family:mechanics.formula_family:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": "dark_abyss_reverb_totalize_stun_remaining_time"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4c2e0dce34a19e2844702dd7bba55fd668e5d6d1068beb240e530edd41230b0c",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5c132bc9ddd5fcd4a036718bd3a741304efd2e9abeca720e81d582f535262582",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e87b6a87b8592247a9c4ebee3423948a31d426ccb5276ce8a4325fa8e5c7980e",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2e14abe8edd3e49f92a21a4b4ac3c6bc6921672342640a5e345f3a80e06572dc",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2e14abe8edd3e49f92a21a4b4ac3c6bc6921672342640a5e345f3a80e06572dc",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4f0380c267eb4cbecca9a356aacd2edf8ce81cc82c1dc74c3e5c14b0f7478cac",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "321a819d31a822e1756d79f549559622ca4ac4793489691d8e9c94cf77d82726",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "16f94f49d1a1abc6aec43ece8eca8926e5402873961cc9103ee7c74ec7c31156"
    },
    "profileHash": "c84da520d8c4e737946430224636d7d9fdc9360ad42f80475394b4d277259b8f"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-vivian",
    "agentId": "agent-vivian",
    "playerName": "薇薇安",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.7",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F5",
    "objectiveTopology": "O6",
    "configHash": "c54de19adea6ffb4422649cba0a8cd257f3db42aceea415fc4a77775e0c21bbb",
    "inputHash": "c12ae5829d43ffafbb307829a2f88b149136529f15f90193b273129690349ade",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-vivian-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": 118
      },
      {
        "record_id": "ENTITY_FACTS:fact-vivian-atk:stats.lv60.raw.atk:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": 805.7
      },
      {
        "record_id": "ENTITY_FACTS:fact-vivian-core-levels:core.levels:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_mastery_bonus\":36},\"passive\":{\"abloom_ratio_per_10_ap\":{\"ether\":0.0615,\"electric\":0.032,\"fire\":0.08,\"physical\":0.0075,\"ice\":0.0108},\"prophecy_atk_ratio\":0.55,\"prophecy_interval_seconds\":0.55,\"initial_flight_feathers\":2,\"guard_feather_cap\":5,\"additional_trigger_cooldown_seconds\":0.5,\"corruption_and_disorder_bonus\":0.12}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-vivian-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-phaethons-melody\",\"set-chaos-jazz\",\"set-freedom-blues\",\"set-chaotic-metal\",\"set-astral-voice\",\"set-hormone-punk\",\"set-puffer-electro\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-vivian-formula-family:mechanics.formula_family:batch-agents-1.7-r3k",
        "source_revision": "current@2026-08-05",
        "value": "flight_guard_feather_abloom_prophecy"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "df221eb65bc663ad59fcbd4f53154215b1b6611d6639e2c3500bdffb5ba5f225",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cd15fe5f8c3f32467c82d8f78d84fbac5a216fad2776435ebf25ae7ba177a467",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d5c56ee27bc0f1c5629e617b7433479f5b101ab1899620aa647b98668bd78fad",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7302e695ede2b34b75b4900912711805704167f1d04eac8c97bf885f7834fab0",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7302e695ede2b34b75b4900912711805704167f1d04eac8c97bf885f7834fab0",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e02aeba7bff36b14b849092ebc650f752d515ba012f79e812f7111b9b92224a1",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "12c1330cbc8686a0c7300c00207005327c207d000dff58e032fd09f989501ee9",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "cb2903bab37a426c493a2769ed20861c53c89a457241a610fdedd2abd1fa1896"
    },
    "profileHash": "d1c5a63a2a2bdddbeac1fd70a05a6c1333955aa615b3d3f1f62351fe20ed9690"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-trigger",
    "agentId": "agent-trigger",
    "playerName": "「扳机」",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.6",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "32d8f8a5a4d3f81aede5c96a2f04190730be6b0b6c858aa7aa0ac32c6a248352",
    "inputHash": "5664d03834c570ccc19c3bb84a6ca5cddbfdc6c9680526f5d461509a0325712f",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-trigger-core-levels:core.levels:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"aftershock_stun_damage_multiplier_bonus\":0.35,\"aftershock_debuff_seconds\":5,\"crit_rate_threshold\":0.4,\"daze_bonus_per_crit_rate_above_threshold\":1.5,\"daze_bonus_cap\":0.75}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-trigger-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-proto-punk\",\"set-shockstar-disco\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-trigger-formula-family:mechanics.formula_family:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "purge_harmonizing_shot_coordinated_support"
      },
      {
        "record_id": "ENTITY_FACTS:fact-trigger-impact:stats.lv60.raw.impact:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": 113
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "dbea566165b1453bdb9c1957f15a5a80073de6bd2508725abd5d3efa58b4b397",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8b6cc1bf3edfe5f9cb61dd47a6e0930160fccb3b1ba046b88998ec037bab7216",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5e4504cd0084a1e542d4ec6fe20154fef5169ef0e555fe455b811fad85118c66",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3585fd5b1141a96b878e1949bcaaf84d8a31084b47def4fe8783ad3d9672668e",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3585fd5b1141a96b878e1949bcaaf84d8a31084b47def4fe8783ad3d9672668e",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d3fb598c0ffe332d3609b49abd59bea8b68eff672f8037c3c9fb5c819b369bf9",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b697b3ff9414dcb5cf9e4119cb5e148fe58ec36a9a9b0325e0c3c48815d54eea",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "d5670b9a57e0513cbfd0ee2aca289df79b6f3c04548ccb129bf03b7dd2c82bc2"
    },
    "profileHash": "7fbdd86d50043e06d73d1b4fd42d7174d936a9fd682e8dfbf5388b8e25a3d764"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-soldier-0-anby",
    "agentId": "agent-soldier-0-anby",
    "playerName": "零号·安比",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.6",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "7f0a6ce389cfdfdafcd9c3be781a7559cbfdcbf2eacaaf6d273d649e1c11200b",
    "inputHash": "75ababfaf4e925e87fd30c42e3ebf8ed8b9769e88a34ab63bdb51e700d7c0735",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-soldier-0-anby-atk:stats.lv60.raw.atk:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": 854.7586
      },
      {
        "record_id": "ENTITY_FACTS:fact-soldier-0-anby-core-levels:core.levels:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"silver_star_damage_bonus\":0.25,\"aftershock_crit_damage_received_ratio\":0.3,\"additional_crit_rate_bonus\":0.1,\"team_aftershock_damage_bonus\":0.25}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-soldier-0-anby-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-soldier-0-anby-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-soldier-0-anby-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-shadow-harmony\",\"set-woodpecker-electro\",\"set-dawns-bloom\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-soldier-0-anby-formula-family:mechanics.formula_family:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "silver_star_white_thunder_aftershock"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "460411e10eb9f9e9fedbaa472e20be0abcbefef25bfbb7442db1933b1ed0bafc",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "02eb8753b1303da179f106a80cfebab28df0e45180ca202d626829b8c8b6f748",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4d0fe7f7fdebd1aa3e1f2a762ec538b8108c5e8b241b36e52e162d42c0053f31",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "04ed0eeedb1c594725067fa7cfd6d61d20ee36fde617333d711df7573879d8e2",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "04ed0eeedb1c594725067fa7cfd6d61d20ee36fde617333d711df7573879d8e2",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3f77ebdf0afd7b0918679be7cd50a791bd22071db002f26febc96e3e31f52b05",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4f580f03884771a52b0d8f5b4676ef902b75fa176550f370972731f40302931d",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "b5da82ea63c07d3724c1650f1f04a28fe2d395499806a916889d624475c73f83"
    },
    "profileHash": "5d8da81b4c77d1b5325411b550c1c3c031ed90092357613c6cd90235e96dbdc3"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-evelyn",
    "agentId": "agent-evelyn",
    "playerName": "伊芙琳",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.5",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "013fa2e8bf1cdb81d5bbfd2dbae2b9e109dbb4dfd15b59d895bec9524339e765",
    "inputHash": "122b2544e2fd8ca00455e7663e895dd022a00601a02ad1b471f5b7342bcd1e71",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-evelyn-atk:stats.lv60.raw.atk:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": 854.76
      },
      {
        "record_id": "ENTITY_FACTS:fact-evelyn-core-levels:core.levels:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"binding_seal_crit_rate_bonus\":0.25,\"binding_seal_exit_retention_seconds\":10,\"chain_and_ultimate_damage_bonus\":0.3,\"crit_threshold\":0.8,\"chain_and_ultimate_multiplier_factor\":1.25,\"burning_embers_cost_ratio\":0.5,\"tether_points_for_chain_garrote\":3}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-evelyn-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-evelyn-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-evelyn-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-inferno-metal\",\"set-woodpecker-electro\",\"set-hormone-punk\",\"set-astral-voice\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-evelyn-formula-family:mechanics.formula_family:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": "binding_seal_burning_embers_tether_chain"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7ff8bcb82b8a14428b0928e6c52c7da0c859a3a4cf5b96f029a0ded0a8605b62",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5dd14275b96b3e069f6c3b268b07d5da7f812ecf2048dffbd3f557b740d0883d",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9689fc2fbfb2818f032f317ae8b98860cf15066eb5928b23fe3c3051aa196e54",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "24793bc39374507346010681547b61f4538421de2644d631cf8684529385da6b",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "24793bc39374507346010681547b61f4538421de2644d631cf8684529385da6b",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "202d4f1111aff067261aca6d00243880c01344856c020f966bc7fd1d550c971a",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "880457dd51812e1754f4ebd93fbdac3038adf9b7351584d18ef96301fbe86791",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "b02d3cd5b1cb7d749c408a21398aebb6246ba0268736ca4f44cf4974b442ff40"
    },
    "profileHash": "7a5615f695e115e44f164b8b2b37997d4d6469d4443edfb3b18ec653070cde00"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-astra",
    "agentId": "agent-astra",
    "playerName": "耀嘉音",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.5",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "0082e2942123241b904fb21253e67d4003a7307c6b0ce72adb2665e375f33413",
    "inputHash": "e1e484c5bd9e56ca6be0433744bc45b149b0e753f4973cd5309b41fc44f6cfb3",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-astra-atk:stats.lv60.raw.atk:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": 640.77
      },
      {
        "record_id": "ENTITY_FACTS:fact-astra-core-levels:core.levels:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"idyllic_cadenza_initial_atk_ratio\":0.35,\"idyllic_cadenza_atk_cap\":1200,\"buff_duration_seconds\":20,\"buff_max_extended_seconds\":30,\"chord_energy_cost\":25,\"quick_assist_interval_seconds\":3,\"heavy_quick_assist_interval_seconds\":1,\"ultimate_quick_assists_as_chain_count\":2}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-astra-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-swing-jazz\",\"set-moonlight-lullaby\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-astra-formula-family:mechanics.formula_family:batch-agents-1.5-r3m",
        "source_revision": "current@2026-08-05",
        "value": "idyllic_cadenza_chords_quick_assist"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0325204a132951148b25424bc6b87067474150a6026c697beffe574e39b04bbd",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4b6c78ddf6da995440a1538b511a96d097dc63b4e34757384bacb594b731b232",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fa87329bc3ef0d18f9e5c6dc3d1a6ba72068b8f09a60b86b20b447e06255910c",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0836c4b971f9ed1a738b31ea67c147fdb9174d706f4af13562efb115fcf38df3",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0836c4b971f9ed1a738b31ea67c147fdb9174d706f4af13562efb115fcf38df3",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0c09d8dfbd607a9814f4ecf132bf8b232c6adeb03cbdf8433175ff3f719055fa",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3efb8f9505d95356974df6df2fa50246754952d7a105f7ce24bf1328acaea33a",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "3ab089ecacebcb821f396264cb2d01cb055e892bba384de5c4901bfa2c2afadd"
    },
    "profileHash": "35278ad0cd34fe58b6b43803bc127e2ef8c816553578bc44b1beba78373904f4"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-miyabi",
    "agentId": "agent-miyabi",
    "playerName": "星见雅",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.4",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F9",
    "objectiveTopology": "O5",
    "configHash": "fe66bf031ebbfe8dfe35f041e91fe814cd910fd97bed1200913642f23bb9cf75",
    "inputHash": "14e5651943e0455e0ebc539da6c2dbe21e314e56de7c3558af1f1ac34634e843",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-miyabi-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": 148
      },
      {
        "record_id": "ENTITY_FACTS:fact-miyabi-atk:stats.lv60.raw.atk:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": 805.6952
      },
      {
        "record_id": "ENTITY_FACTS:fact-miyabi-core-levels:core.levels:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_proficiency_bonus\":90},\"passive\":{\"fallen_frost_cap\":6,\"fallen_frost_initial\":3,\"fallen_frost_per_charge_level\":2,\"shimotsuki_max_charge_levels\":3,\"icefire_duration_seconds\":30,\"frostburn_fallen_frost_gain\":1,\"frostburn_gain_cooldown_seconds\":10,\"crit_to_frost_buildup_cap\":0.8}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-miyabi-def:stats.lv60.raw.def:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": 606.5977
      },
      {
        "record_id": "ENTITY_FACTS:fact-miyabi-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-branch-blade-song\",\"set-polar-metal\",\"set-woodpecker-electro\",\"set-astral-voice\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-miyabi-formula-family:mechanics.formula_family:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": "icefire_frostburn_fallen_frost_shimotsuki"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a012e43a00b2ce262963d611d9e037870033d07e6a71238ce9a060d60de32275",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "21a78638b8c2b26b43ad42d500e212636fdee10b2fb89bcb41dce7072e6688d6",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8691f41b66e34aa3b89cf99a7a0d024ccd746c9d985d32ac2715a4dac01811a4",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1404b109f1c8c398cfab9df4a213b9c88b72d1986c8f88a61c88f6e5f4b33ea6",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1404b109f1c8c398cfab9df4a213b9c88b72d1986c8f88a61c88f6e5f4b33ea6",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ae47b43ba18267c5e0980da160539e6e3202af2892e93041cab726ca0910c2a7",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e95f67be462b7e44d1ff2c0baba9afe9c3aa6549851975fc9477d84f925ad615",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "19e916186362d57b1412aba971663a391d3cb69f8e52deccb660b55d36420014"
    },
    "profileHash": "b7ea52a427ca8299ac79294690f6c2d25de500b13fab993f7de1b17b7ef6b082"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-harumasa",
    "agentId": "agent-harumasa",
    "playerName": "悠真",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.4",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "2a6cb5a2e3f108d59fc65e37015c9a3c808b7608903db37583c219f34b02f5c7",
    "inputHash": "7d830cb7943438a92031a47981ffa580ce05dac0c5f4edd88b2647de5362f6d8",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-harumasa-atk:stats.lv60.raw.atk:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": 840.593
      },
      {
        "record_id": "ENTITY_FACTS:fact-harumasa-core-levels:core.levels:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"quiver_cap\":6,\"electro_prison_cap\":8,\"electro_prison_duration_seconds\":10,\"x_mark_minimum_stacks\":2,\"awakened_dash_prison_cost\":2,\"anomaly_fallback_quivers\":6,\"anomaly_fallback_cooldown_seconds\":12}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-harumasa-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-harumasa-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-harumasa-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-thunder-metal\",\"set-shadow-harmony\",\"set-branch-blade-song\",\"set-woodpecker-electro\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-harumasa-formula-family:mechanics.formula_family:batch-agents-1.4-r3n",
        "source_revision": "current@2026-08-05",
        "value": "electro_quiver_prison_xmark_awakened_dash"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9b3db3f20fc0132d363f485f1639f809d5f07b1c03c918279388a87d03ce6686",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9e8484305e7207e55350d16f74714c4d9982306cbe2d1f36b9eecbd3901d2e64",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "499cf6bd34ef32933742e4e658baaab7c5acfd920971b9b6e7b7d7998d209ffc",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cd5e994501756ac1f19c59036fd0fba7b37d0f4add3919a8c4dffaa4b1821e7f",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cd5e994501756ac1f19c59036fd0fba7b37d0f4add3919a8c4dffaa4b1821e7f",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "11c3c902c46beb5aebc85758e72b1b6fb92d92aa7746b7242bbaa417371f7bed",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5ff57afb51325e4404d81d575180bc83e357c4064db8dcd56bdab4a4e8884590",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "9c9bb298a9d911676b4b8a7aeb3bea769a7ab0b48c9eb795a3e09a9762ec7a0e"
    },
    "profileHash": "19df3205f14e6da5e7c7427ef0379cb20051d9a0bf68b5f4b5cb20696b7f774d"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-lighter",
    "agentId": "agent-lighter",
    "playerName": "莱特",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.3",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "4068ff1e43f52c435dc1df01c30ead1f3ed028bf1c4ee84cca047acbbce254b4",
    "inputHash": "0af784781a45ba42e4f7ad482743368240115d891aaf6f664236df39b90dbcfa",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-lighter-core-levels:core.levels:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"morale_cap\":100,\"morale_auto_gain_per_second\":2.9,\"morale_per_squad_energy\":0.26,\"morale_burst_threshold\":80,\"impact_bonus_per_10_morale\":0.02,\"impact_bonus_max\":0.2,\"impact_bonus_duration_seconds\":6,\"ice_fire_res_reduction\":0.15,\"res_reduction_duration_seconds\":30,\"collapse_stun_duration_bonus_seconds\":3}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-lighter-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-shockstar-disco\",\"set-swing-jazz\",\"set-proto-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-lighter-formula-family:mechanics.formula_family:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": "morale_burst_impact_collapse_elation"
      },
      {
        "record_id": "ENTITY_FACTS:fact-lighter-impact:stats.lv60.raw.impact:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": 119
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5e6d34bdb32841dde867e82db41ec0ef1c4735080e131004f7b6c56a5120e46f",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c98ef5bdf219e38b57c04517f06f0dbf636c01f00456794f939fe68e3a596896",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "978530dd7fd07d5910d34fc8049b5ebc089d6472479c2c033ab26b7d3d92821d",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8e53ee58d316a103920a27db9f980c0374517c5627372c2166deb15f1e4e195e",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8e53ee58d316a103920a27db9f980c0374517c5627372c2166deb15f1e4e195e",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2226e9d5f1ef502ade19e232294f8950a2906ff116a2963b6744ac1e421a9d9a",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "390e640a66ce4f95e9745f6269f0e611338f642ed32ec93d09f78042cc347417",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "cbb120de52ff173c06eff24cacaa001d6ff2852eecbc99a955e66971c90e1776"
    },
    "profileHash": "d59bb8b61aab967826db7195f884be489623486b9b0db6c816e829f8948dacbd"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-yanagi",
    "agentId": "agent-yanagi",
    "playerName": "柳",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.3",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F5",
    "objectiveTopology": "O6",
    "configHash": "08ed71eefb77f3dad8b347664a6e24796ec660f7a5337ca7d77fb9f138c58efa",
    "inputHash": "f64e06f42f93719e7870f15754c839cc34e424390e6a34971848f2eaa593290e",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-yanagi-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": 114
      },
      {
        "record_id": "ENTITY_FACTS:fact-yanagi-atk:stats.lv60.raw.atk:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": 797.574
      },
      {
        "record_id": "ENTITY_FACTS:fact-yanagi-core-levels:core.levels:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_mastery_bonus\":36},\"passive\":{\"upper_stance_electric_damage_bonus\":0.1,\"lower_stance_pen_ratio_bonus\":0.1,\"retained_stance_bonus_seconds\":8,\"shinrabansho_duration_seconds\":15,\"polarity_disorder_original_disorder_ratio\":0.15,\"core_disorder_multiplier_bonus\":2.5,\"core_disorder_bonus_duration_seconds\":15,\"electric_damage_bonus\":0.2,\"electric_damage_bonus_duration_seconds\":15}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yanagi-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-chaos-jazz\",\"set-freedom-blues\",\"set-phaethons-melody\",\"set-thunder-metal\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-yanagi-formula-family:mechanics.formula_family:batch-agents-1.3-r3o",
        "source_revision": "current@2026-08-05",
        "value": "stance_shinrabansho_polarity_disorder"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "73ddddf4d8db7787cde3eb4f5e13732e26bf1148501e08b0aadb6b1460b7216d",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d8af37c47529da85b6e5de3706682c17d1a691652f468144b40c3cc07666ca8b",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f893f3edac385dcf8a719f2ae4bf62ba02577bed36b4ce7cbabf4832c6596366",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4ec31490586df89e2c9b80b74ad28f946444eb30992e3499b816c98896fc76e4",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4ec31490586df89e2c9b80b74ad28f946444eb30992e3499b816c98896fc76e4",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "289637ebda1248c182ef6a49a4bc095624c0c249d99faebff41d403e8b90867c",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "54d559c80e387788802b0f0cfd14e343264ae2318db95a1aebaf3ad50d24ff50",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "b4cb2672cfbf882b70beeede5f2856db0e6e3179154448a2c48563fa31d3b145"
    },
    "profileHash": "bc482e0322542692bbfd12e56abf7ce4ebc1939ff6fd4952e12d0ffdbfffdc56"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-burnice",
    "agentId": "agent-burnice",
    "playerName": "柏妮思",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.2",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F4",
    "objectiveTopology": "O5",
    "configHash": "fab778120aeeccd73361b1558d2b9dd977b4442b0ccf5cdeebc9539a606227d2",
    "inputHash": "1c97d4cfd80bee3176fcc0a6f0e9a29b1ad9629d8e4033e8dcb4bc869ea2cfee",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-burnice-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": 120
      },
      {
        "record_id": "ENTITY_FACTS:fact-burnice-atk:stats.lv60.raw.atk:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": 788.4528
      },
      {
        "record_id": "ENTITY_FACTS:fact-burnice-core-levels:core.levels:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"heat_cap\":100,\"initial_heat\":100,\"heat_per_energy\":1.4,\"nitro_fuel_threshold\":50,\"afterburn_heat_cost\":8,\"afterburn_cooldown_seconds\":1.5,\"afterburn_ap_bonus_per_10\":0.01,\"afterburn_ap_bonus_cap\":0.3,\"additional_fire_buildup_bonus\":0.65,\"burn_duration_bonus_seconds\":3}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-burnice-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-chaos-jazz\",\"set-freedom-blues\",\"set-swing-jazz\",\"set-moonlight-lullaby\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-burnice-formula-family:mechanics.formula_family:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": "heat_nitro_fuel_scorched_afterburn"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "213a5f87eb32216206352549c7d84728eee32238dd1444b78583d3d7ad717fcc",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1b7f85b4d9522fd0a5387b4a1b3fba6d08bf080667a602b5e6f9bee05506f449",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ca3f30d0d8fc688d6ceb65532f498ec8ca3b5f0419df86e82b35192880345ffc",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6d34acac67e95004e02b269f0963f314314c3b5122beed35102a8c82191cfff8",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6d34acac67e95004e02b269f0963f314314c3b5122beed35102a8c82191cfff8",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9a2c8b585af71f9ca3cbd7e44959ebca181150029f857c82ed6d5037a8ce04b5",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "465c4bb6a70c3b517b5ccc7fd818d1d63f33149ad68e7236b440479949aae81d",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "60a233b87a0ffc3fa8e4cd7369aa38e68a531a307b20f43eadc7c969fc901fce"
    },
    "profileHash": "308612c7aa9171e7f0d32b7142175c97d84fbbf91c1cdf82a5562f7e0565d6cf"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-caesar",
    "agentId": "agent-caesar",
    "playerName": "凯撒",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.2",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F8",
    "objectiveTopology": "O4",
    "configHash": "cc0cca6861056f9d33e66b1a5b7829dec8a3b212941761ba7ae8b92f61278121",
    "inputHash": "354aa8988652c1cc2ef6c87f7093c261d4db56c9a580d2365d66e144ee5b946b",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-caesar-atk:stats.lv60.raw.atk:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": 636.6899
      },
      {
        "record_id": "ENTITY_FACTS:fact-caesar-core-levels:core.levels:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"radiant_aegis_duration_seconds\":60,\"shield_initial_impact_ratio\":14,\"shield_flat\":1400,\"attack_bonus\":1000,\"attack_bonus_retention_seconds\":5,\"battle_spirit_damage_bonus\":0.25,\"battle_spirit_duration_seconds\":30,\"battle_spirit_radius_meters\":7}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-caesar-def:stats.lv60.raw.def:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": 753.862
      },
      {
        "record_id": "ENTITY_FACTS:fact-caesar-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-proto-punk\",\"set-shockstar-disco\",\"set-king-of-the-summit\",\"set-freedom-blues\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-caesar-formula-family:mechanics.formula_family:batch-agents-1.2-r3p",
        "source_revision": "current@2026-08-05",
        "value": "perfect_block_radiant_aegis_battle_spirit"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "54e52809ebeee1bfad065e12a7f3e743609cc1338db00e896f277f3e45132b5d",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9d97383395f314acef63afa880b141351dd5d3451de3d3ea55c752016ec9726d",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e745a611abb96bcdffd5073453c976b3f317aa49a5403172bb6d182acd175882",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9b233d385598931c035de598d4e2085790e1cdcfcd7f60206439578020019b14",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9b233d385598931c035de598d4e2085790e1cdcfcd7f60206439578020019b14",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d53ef99d8eef433fd1fadd402a10408267088802e3421320bec89d6937af83be",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "982442546fd44015253457da38134a3be9eb70f571c22ed112af9ba77e6f70b2",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "70599fe6fa1711a109b994b5cd56ed451aafd0171ea47766b2d4d90bed5aa97a"
    },
    "profileHash": "bfed07ba8a84322f64be1d963f7b46b3886aef72b801a6ef0fc6641d858098f2"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-jane",
    "agentId": "agent-jane",
    "playerName": "简",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.1",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F5",
    "objectiveTopology": "O6",
    "configHash": "eae5ddb72aca0fc4e33b79c6f67e8b6bc0091b7d0a09a1199b217fd0e62417ea",
    "inputHash": "9f795752d69c9d9943a103c941c3c9b71724d58fed4f468e3cb1b797d9b91e5b",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-jane-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": 114
      },
      {
        "record_id": "ENTITY_FACTS:fact-jane-atk:stats.lv60.raw.atk:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": 805.6952
      },
      {
        "record_id": "ENTITY_FACTS:fact-jane-core-levels:core.levels:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_mastery_bonus\":36},\"passive\":{\"bite_duration_seconds\":10,\"flinch_duration_bonus_seconds\":5,\"assault_crit_base_rate\":0.4,\"assault_crit_damage\":0.5,\"assault_crit_rate_per_anomaly_proficiency\":0.0016,\"passion_buildup_bonus\":0.25,\"passion_attack_per_ap_over_120\":2,\"passion_attack_bonus_cap\":600}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-jane-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-fanged-metal\",\"set-phaethons-melody\",\"set-puffer-electro\",\"set-freedom-blues\",\"set-chaos-jazz\",\"set-astral-voice\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-jane-formula-family:mechanics.formula_family:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "passion_assault_crit_bite_flinch"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5f122ce0c0e61dacc880b17edc2bc180cc4854af4b572210328f7a16b74067a2",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4d948ad331e8fef3f5ee3a8bfd3c51da410d3bf9efb99c34389af4135f1f725e",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6cd98c8e0fd20ad12c3919bc29779802d68639bcc9930cadbf74392c1a3999e1",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "28029ae2f86f93bee1bc480cfddcb93002547dc1256e5ce224690e21377e2d39",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "28029ae2f86f93bee1bc480cfddcb93002547dc1256e5ce224690e21377e2d39",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "94a06dd90d6b84e0d3ef3540a3210fea9bf5b6742ae45083f4245bebb961b8dd",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "21ba6a392b4194179ed3f6f3352e0f10c048e12691c8a76dd25fb79149abc778",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "ba2e38d1c5a3f49a879898820c0c3ada413be800f0bdcacaca8c06c7874aa835"
    },
    "profileHash": "0d2207f06a76dd2b093cc81c28257d39c258235f6ad4dba2509342a6645c738c"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-qingyi",
    "agentId": "agent-qingyi",
    "playerName": "青衣",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.1",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "5b9640d484fd179d1088a4693ca6a5dd73e275b295612cc19a3d66f9ed84942e",
    "inputHash": "6a27956037e0ac67653794875a5a11e0e9bd274ddcbaa97d0b4bbea16fe18786",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-qingyi-core-levels:core.levels:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"flash_connect_threshold\":0.75,\"damage_bonus_per_voltage_over_threshold\":0.01,\"daze_bonus_per_voltage_over_threshold\":0.005,\"subjugation_initial_stacks\":5,\"subjugation_max_stacks\":20,\"subjugation_per_rush\":1,\"subjugation_stun_multiplier_per_stack\":0.04,\"additional_basic_daze_bonus\":0.2,\"additional_attack_per_impact_over_120\":6,\"additional_attack_bonus_cap\":600}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-qingyi-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-shockstar-disco\",\"set-swing-jazz\",\"set-astral-voice\",\"set-proto-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-qingyi-formula-family:mechanics.formula_family:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "flash_connect_subjugation_stun_multiplier"
      },
      {
        "record_id": "ENTITY_FACTS:fact-qingyi-impact:stats.lv60.raw.impact:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": 118
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "13a37fc77c1ae5eed100a745d737ead6956f13842eca8397deae3fe1efcdb959",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "df52bd7ac3c9c543ed368b1883a0dce97da78360941de1eb7f05346a6c04bc49",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fd0ada8ea6d55366e53820ba8dd754c14a1da28d2675d5b812221613525bcf2e",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3819b21bb4c84aa8a734c9656383bcfa46650a3077f413b31627fb2a764f24ef",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3819b21bb4c84aa8a734c9656383bcfa46650a3077f413b31627fb2a764f24ef",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "dc920720e6bc400fe873aa9cb10dfdfb09876f15bdfbfa21c7da50ceb08f346c",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "646b83f36f561e312bff2c13e8275cced2f66166d3a773358f171ce539af3b58",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "56c1648363bb67af61a35c3e61b744a631cf2faef0499e660642426d5153c27e"
    },
    "profileHash": "285162725bdbe18416c95b4c27ec4029b0a0a1d8eda0851ef4ec8afc56dbc3cc"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-zhu-yuan",
    "agentId": "agent-zhu-yuan",
    "playerName": "朱鸢",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "24d3bc562fb4dcb9ae030137ff44580d8fd11d7ec01c84b92b6bc40de46c58ef",
    "inputHash": "4ec83bca62036decb3ae8dd25f284507d92e21839f7aecca8aa9c37f260bb271",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-zhu-yuan-atk:stats.lv60.raw.atk:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 844.3011
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhu-yuan-core-levels:core.levels:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_dmg_bonus\":0.288},\"passive\":{\"enhanced_shotshell_damage_bonus\":0.2,\"stunned_target_additional_bonus\":0.2,\"starting_enhanced_shotshells\":6,\"additional_crit_rate_after_ex_chain_ultimate\":0.3,\"additional_crit_rate_duration_seconds\":10}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhu-yuan-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhu-yuan-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhu-yuan-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-chaotic-metal\",\"set-puffer-electro\",\"set-woodpecker-electro\",\"set-astral-voice\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-zhu-yuan-formula-family:mechanics.formula_family:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "enhanced_shotshell_suppression"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "da36f51216a2634aea17f2e6713ed526ec7d664106e9811c6eec5860f7731dec",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "004a98547c10f76c619ef7f4d7be4bd53d725054c8ebbb704a3e2a875e7dce99",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "112eec67c5a27dd711f892488b1e584dbde82fb96d6c831e96422296599840da",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5869584e3c60b5e682e08762a58183675582897bdb9c84b1727eaab1b9ce0f47",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5869584e3c60b5e682e08762a58183675582897bdb9c84b1727eaab1b9ce0f47",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f8d6daaa4e4e310e7a161fca98285e633642cbdf6c9674d4fcb31476195ebaf5",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0d1ecb2d8fa6d774c31de5af257cc09e17146ef0bc16c2230962c53622611e28",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "1b91c998a1a8385ed9e398f87f844e5fd3153cccc842c4ad9f88c74952b56b8b"
    },
    "profileHash": "e9376c13cf597536d8b8172d510018ef5148b92d3d6fc62598885ae75ea741c5"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-nekomata",
    "agentId": "agent-nekomata",
    "playerName": "猫又",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "02252bedf7e5d2fb6445e1c6a378fc591fd0cc9d27d11f5e79821b2be881bbef",
    "inputHash": "8bb5165fd1eef2d46adffbac1c38e674e9206123b174276a2e50ac690e8509f0",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-nekomata-atk:stats.lv60.raw.atk:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": 835.5958
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-nekomata-core-levels:core.levels:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"dodge_counter_quick_assist_damage_bonus_by_level\":[0.35,0.4,0.45,0.5,0.55,0.6],\"bonus_duration_seconds\":6,\"purr_energy_max\":60,\"purr_energy_threshold\":40,\"purr_energy_perfect_dodge_cost\":30,\"purr_energy_hold_cost\":40}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-nekomata-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-nekomata-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-nekomata-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-woodpecker-electro\",\"set-puffer-electro\",\"set-branch-blade-song\",\"set-fanged-metal\",\"set-astral-voice\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-nekomata-formula-family:mechanics.formula_family:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "stealthy_paws_purr_energy"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8d071e21fb12eddb3573307da55d9971ef83fedda043871bb69804db51b21bad",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e886eeebd21da66be86caecaa115d41b5e268a2cfcb5ed762cc638170a9c1644",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ca2764e3d4e139bbc2c3115379c3280e062aefbb94eaf0a9bd415a1b61ffdb5f",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6675ceecf8ff3e8e252e7e521b5c0cda4132d6901e8585a95be297d280f92ef9",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6675ceecf8ff3e8e252e7e521b5c0cda4132d6901e8585a95be297d280f92ef9",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "bd40a5cf58d604926bb180440b0ebc23c1b33df0c86624888ef25a70217d9317",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fdb89c70f04d8db0b0f20f2db70f7df2c2591989c3175d3f102dd94ef375f95c",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "a33cc558505ad8f2903e72df83305870c66391608aa117d81fa9c3f2e6e6a1e3"
    },
    "profileHash": "785385faa4bc3162330c596d426aebd32ed66a02c26c520cc5fe8e2abb5bcb11"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-soldier-11",
    "agentId": "agent-soldier-11",
    "playerName": "「11号」",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "940cc7eaf612fca1f825f144b793af254490d415b0653749d3873c127983bcdd",
    "inputHash": "c51f5f245091bbf1877021334fd27d98e19e31cbe50e9d52d199fabc8178f96c",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soldier-11-atk:stats.lv60.raw.atk:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 813.5686
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soldier-11-core-levels:core.levels:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"fire_suppression_damage_bonus_by_level\":[0.408,0.466,0.525,0.583,0.641,0.7],\"guaranteed_fire_suppression_stacks\":8,\"guaranteed_duration_seconds\":30,\"charge_fire_res_ignore\":0.25}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soldier-11-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soldier-11-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soldier-11-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-inferno-metal\",\"set-puffer-electro\",\"set-woodpecker-electro\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soldier-11-formula-family:mechanics.formula_family:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "fire_suppression_charge_alert_stance"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b79a1b2c8a6a39f24e1c4c826bc27eb0a1ce08cd1679e7956d7096b1773f8db1",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "eae188b74dcd5a8aaad10a5c55e0e8dd975ad5e4be0c5d62584fe8166cbc14a3",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5a329590b942e34b1c8651452aa9b08b33885357a073388da131f2397dd32f77",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "81f5ce86ab8d1c1ca906838ee00ab2556ff95950bca5330026cc7aa29a6af586",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "81f5ce86ab8d1c1ca906838ee00ab2556ff95950bca5330026cc7aa29a6af586",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2d650e3124442b4eb1151930a67759337ca0e4e976453306ed883465b1b8b4fb",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2ad235cc028e43a63e44c8eeb24e52de92898e2ea1634c3ee3f9401c10855a69",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "be0ed5128a5d008e1395a8148b5d589b87849dc6832a8157cb0c5916f106f5d3"
    },
    "profileHash": "ac1d5bfc47c4125e5b7058e5ddb2c6ef6f9a6ca2d504131850f9fde5bf78d437"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-koleda",
    "agentId": "agent-koleda",
    "playerName": "珂蕾妲",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "a914aa01dccb4f069377f7fa46a7e6d62a08e5592b82caff9c7f635f699a5d13",
    "inputHash": "574ab4ded32d0400cbdcd529d08d567b965e2c0c397364eb6432b7543d6a7c91",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-koleda-core-levels:core.levels:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"enhanced_special_daze_bonus_by_level\":[0.35,0.4,0.45,0.5,0.55,0.6],\"furnace_fire_resource\":true,\"stunned_chain_damage_bonus\":0.35,\"stunned_chain_max_stacks\":2}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-koleda-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-astral-voice\",\"set-proto-punk\",\"set-shockstar-disco\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-koleda-formula-family:mechanics.formula_family:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "furnace_fire_ex_special_stun_window"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-koleda-impact:stats.lv60.raw.impact:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": 96
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d4dd2e028d6572d79874ac6672428c9a5a9ea586afef188d80477fd0f533b797",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e3cd2df5b08dbd14608f914cf4d43596d9efc9edecdcb7d1e8bb8760c3227406",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2c511c1ff34644b404c87e3c35c1f11ddf4d296b9db074bb76b4dd7021420942",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "eaaf71f27776493c82fdfd1e6e827cf9ff1d96577a3aef9b6e00e818b795c441",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "eaaf71f27776493c82fdfd1e6e827cf9ff1d96577a3aef9b6e00e818b795c441",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e9f08c01d6d8a9246d13e938cc911605c8622aacc04c6bcaeb271429c90f2bb7",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2c7eb6e15a1dd2a4232057d4584e5be7dcdda9fc530c1f4c6e569d3922d130d8",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "5cad2f25d097b563324cfa53280b655044f492077ab85bd10e5c226937c11c1f"
    },
    "profileHash": "93293d8346ec77a7eac9fc2528134ee965ad18d454927977876467ae210b6703"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-lycaon",
    "agentId": "agent-lycaon",
    "playerName": "莱卡恩",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "4e52bf3820ee2ef2dc291b26151095390dcc374067f8b8fc41ae202e3aebffe5",
    "inputHash": "7f3dbd9d59e930baae5e9c600622790c39c7b6fa8e6ca764bc17bbaa31054102",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lycaon-core-levels:core.levels:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"charged_basic_daze_bonus_by_level\":[0.466,0.533,0.6,0.666,0.733,0.8],\"ice_res_reduction\":0.25,\"ice_res_reduction_seconds\":30}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lycaon-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-astral-voice\",\"set-proto-punk\",\"set-shockstar-disco\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lycaon-formula-family:mechanics.formula_family:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "charged_basic_ice_res_stun_window"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lycaon-impact:stats.lv60.raw.impact:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": 90
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "fb1a7060f82bc14d6eab61aca62e57aaaeafc4603f87f89a2c1e08409ff01358",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9982fdf811fe9a0af1b8d72b1ed2b67147d7a1c8a25d41e7c80f2e298a3135c9",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "51ca11864c21646d7c04f10d51f46231b5b2a14e92ea280d538b09ed073f0ec5",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2dfe338a3f3a465a380438016188e60369596a73332ba8fab23c566d3d622cbc",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2dfe338a3f3a465a380438016188e60369596a73332ba8fab23c566d3d622cbc",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "06b516136c8c9464cc73a43da809516a2ece0d7be23b4b753e7000a9eb9385d9",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a28731dd0229578ccc1941fc120eae77839856e5d7da744e5ac5ab1b96ce8d5c",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "cc0998cc2b14f9511e261a54c2e3254b9a26a8f8ee2a8867b7b8dad472723509"
    },
    "profileHash": "21fb40f50811b7669307e15760515f2c5a251bae2bcbc0e62134198c6eb26b1f"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-grace",
    "agentId": "agent-grace",
    "playerName": "格莉丝",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F4",
    "objectiveTopology": "O5",
    "configHash": "9b0b5f3086c432bd54cc8ba1087830e87198ab1f47adaeb5204966dea32d80e7",
    "inputHash": "6ae9b4c55551aa38466c45468d7cb1953a4753d4a0db33cda2c822ae2c0e7f0a",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-grace-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 116
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-grace-atk:stats.lv60.raw.atk:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 750.9679
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-grace-core-levels:core.levels:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_anomaly_mastery_bonus\":36},\"passive\":{\"zap_max_stacks\":8,\"electric_anomaly_buildup_bonus_by_level\":[0.65,0.758,0.866,0.975,1.083,1.191,1.3],\"next_shock_damage_bonus\":0.18,\"next_shock_max_stacks\":2}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-grace-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-chaos-jazz\",\"set-freedom-blues\",\"set-thunder-metal\",\"set-phaethons-melody\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-grace-formula-family:mechanics.formula_family:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "zap_electric_anomaly_shock"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0732a794eef684c564dafe744296b4084dc432119c4853afe07f934cb1f1d058",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ddcd34cc43023aa884af87ca4ed8534a05b5bbcccb07d5164b7700382ac02c32",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "96d2f55250416d791fa61d8e08740c1066aa5b73100ec42ca9a5256719d887ba",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c55ff7eab789cb682cb19acdb90433f2afda993d19cc0878ba41698a8893c428",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c55ff7eab789cb682cb19acdb90433f2afda993d19cc0878ba41698a8893c428",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d7e7357859ec8605b08b98231ad926356f650678065f910dde3a930bfa298fd4",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "59090cbea72b8ff492c418e3c6466a98cd09fefbbf3fc5f8ca659e5261976230",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "0591a8062f7f2ffe2a865db34e2968b11374eb8d65dc4ce5531a2728a96fca7c"
    },
    "profileHash": "dacc4ad6a83db4dc381b90c0c8324000ae11816c2861f2c33b476b762651f817"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-ellen",
    "agentId": "agent-ellen",
    "playerName": "艾莲",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F2",
    "objectiveTopology": "O5",
    "configHash": "2e46a436876c194a05e0f7bb40cf9da4477fefc240c5e504ce08d9161e64b7cd",
    "inputHash": "f0ade7881430695e1cd4d736e856638f1eb955e058f2568efe679de1024ed620",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-ellen-atk:stats.lv60.raw.atk:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 863.2102
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-ellen-core-levels:core.levels:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"qualifying_action_crit_dmg_bonus_by_level\":[0.5,0.583,0.666,0.75,0.833,0.916,1],\"ice_damage_bonus_per_stack\":0.03,\"ice_damage_max_stacks\":10,\"ice_damage_duration_seconds\":10,\"current_semantics\":\"post-2.0 rework\"}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-ellen-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-ellen-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-ellen-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-woodpecker-electro\",\"set-polar-metal\",\"set-branch-blade-song\",\"set-astral-voice\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-ellen-formula-family:mechanics.formula_family:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "flash_freeze_charge_ice_stack"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c98b435ed8c9ebf40c3d6df723231c8f409be69d428dd53ad14beae9a6616ac1",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "92c9dd95f11f726bdb31cee63842f967a8077bae6c0786a203344e436351c248",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b655b5a23540c14170509b351746949bae46605ac933bed9652c1cb530b032a4",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4635d3ef55a7734958ad10290e47e6232144a563f891e87041cff13402c54738",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4635d3ef55a7734958ad10290e47e6232144a563f891e87041cff13402c54738",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "230125a200cc4604aa5f1279bf05908d9032e5b414a766320ea3e27351e5ff79",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "148d1ef3d454bde86d880712eac686e69b55cd3178b950f97552ddb5d4ad8975",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "b02f05ab318ff8354120eccb2f58eb8e963c104fb2881863f89d92b0a5f9f786"
    },
    "profileHash": "fe8d3355e02f2c2c1bf9f7ce1cf22777cbbc9218ae024e1d0a1061c2f7683423"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-rina",
    "agentId": "agent-rina",
    "playerName": "丽娜",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "9a93f91136acc2d99df235319764e3ea25dcb24732d6d76123fccea6450903e4",
    "inputHash": "dd625772d699cd8b7fda0ecf014c9b9fc7d9e11ad0f19dd9809c65a6918dbeb5",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-miyoushe-3.1-0103b84af182bc3be498:core.levels:batch-miyoushe-current-3.1-candidate-r60",
        "source_revision": "sha256:0103B84AF182BC3BE4989B089E7A460782FB4CA8428C62468431A7C09158DF4A",
        "value": "潜能觉醒「完美侍奉」：穿透率提升 1.6%；「核心被动：迷你毁灭拍档」增益存在期间，基于丽娜自身穿透率每 1%，全队角色攻击力与防御力分别提升 8 点和 6.5 点，至多提升 576 点攻击力和 468 点防御力。"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-rina-atk:stats.lv60.raw.atk:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 642.1859
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-rina-core-levels:core.levels:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_pen_ratio_bonus\":0.144},\"passive\":{\"pen_ratio_coefficient\":0.25,\"pen_ratio_flat_by_level\":[0.075,0.09,0.102,0.108,0.114,0.12],\"pen_ratio_cap\":0.3,\"spotless_fright_max_stacks\":6}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-rina-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-swing-jazz\",\"set-puffer-electro\",\"set-moonlight-lullaby\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-rina-formula-family:mechanics.formula_family:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "bangboo_pen_spotless_fright"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4adab55060ed869e7f9aa468901e7530ca0a50142a119ba3d5d634b59fc652a0",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "002425c76fa66ae5b181993140c59c3e8973fd77d06b74d7e9a4b9c25dd1eb2d",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "c19af2f566e25c29c6a996f294e0eb2c4d1f2ade296fc40188335c207651af9b",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0b11c73ce5cfe2903125c2786d70ad4582856b953de10508bf368fe4e1ce065a",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0b11c73ce5cfe2903125c2786d70ad4582856b953de10508bf368fe4e1ce065a",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "05cc0baed0d0215b8a4998b651d420272fb22377d6ccbe5e75902634f83a253e",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6194be07f2dddfed997ff56ed66f7838631985ad6acb4693573a06fa18e7f178",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "66fde1f457b2b43f9082a97f9b56ba5446c866e4e47d703640b1a6ec79966c03"
    },
    "profileHash": "3d88fc91012b8a860711cd62fcdb4af5e9eb24cb16184777335cd90217730c09"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-manato",
    "agentId": "agent-manato",
    "playerName": "狛野真斗",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.3",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F6",
    "objectiveTopology": "O3",
    "configHash": "ca8bc9d3eab965daabe732c48589753dd4ad4fa2786c9998e3ece03a44f1cab9",
    "inputHash": "fbd5afce9ccb598827fc5db0322b1391eb5fbee25c2c37aab46500d1253d56a3",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-manato-core-levels:core.levels:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"max_hp_ratio_bonus\":0.18},\"passive\":{\"max_hp_to_sheer_force\":0.1,\"blazing_heart_cap\":100,\"molten_edge_threshold\":75,\"molten_edge_drain_per_second\":3.3}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-manato-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-yunkui-tales\",\"set-woodpecker-electro\",\"set-branch-and-blade-song\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-manato-formula-family:mechanics.formula_family:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": "blazing_heart_molten_edge_hp_sheer"
      },
      {
        "record_id": "ENTITY_FACTS:fact-manato-hp:stats.lv60.raw.hp:batch-agents-2.3-r3g",
        "source_revision": "current@2026-08-05",
        "value": 7725
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d115de59ac8be44b839039f322719df8b0d6ac282d29b72211f5e942dfe4bbb6",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "139e3a38f4b9224ead974c7833f9209ec18bcfe43cbf620d33660b7c5ceffcfb",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "568fb261553f5a8f0a90dbda2f9bca7905d839054774727ea5d6b4ea888b5aa7",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d48da3eca43df9e0dfee507adbab5925e643ab8d6aa435782d7b81e7a8ab6baf",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d48da3eca43df9e0dfee507adbab5925e643ab8d6aa435782d7b81e7a8ab6baf",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3971b8f35f37af094bab881dc1407d1769d8c00107470fd00e25e6ce88069e75",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "29ce4773b73deb8ad7477c7cd42d3c81427490838da42136b32672c28435a7f3",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "6ef0ac2d3dca62eae62535f51a77195651a78a742e94dc0adf26668eeaabde6c"
    },
    "profileHash": "930f69e2027fb8def1517141cec406cfa7dc8c2c1c94c535f6af833fd57f7577"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-pan-yinhu",
    "agentId": "agent-pan-yinhu",
    "playerName": "潘引壶",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "2.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F8",
    "objectiveTopology": "O4",
    "configHash": "4c8995a8804752384c0ddc9218a45c0d13520fc739b3177fe99d5e42f09e359a",
    "inputHash": "4311683a429db52a85c9b81e64dacf683e8b49031c04e7c9bd5cbbf1e50cc40d",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-pan-yinhu-atk:stats.lv60.raw.atk:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": 586.92
      },
      {
        "record_id": "ENTITY_FACTS:fact-pan-yinhu-core-levels:core.levels:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"break_force_on_ex\":3,\"meridian_flow_initial_atk_ratio\":0.18,\"meridian_flow_atk_cap\":540,\"meridian_flow_seconds\":25,\"depleted_qi_all_damage_bonus\":0.2,\"depleted_qi_seconds\":10}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pan-yinhu-def:stats.lv60.raw.def:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": 712.94
      },
      {
        "record_id": "ENTITY_FACTS:fact-pan-yinhu-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-hormone-punk\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pan-yinhu-formula-family:mechanics.formula_family:batch-agents-2.0-r3j",
        "source_revision": "current@2026-08-05",
        "value": "break_force_meridian_flow_depleted_qi_healing"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6ddb2b882afc9699c88e5e6687574a0c79566254cb8636ed64ff6964a6c76e51",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b7f228050ecc484240ce750b9869081fd798c4170e78beceb746344a116bbb40",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "59bdc1f546c1447fdd15a4b057266443eb17e64d5aa9122b42db5d2b2202ab27",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0f52e32d76ba81f5dda5e81189d6a2f8c1d5a787b114b9e255eda5cb77baabd0",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "0f52e32d76ba81f5dda5e81189d6a2f8c1d5a787b114b9e255eda5cb77baabd0",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "22b7c0a0d827eecd06ab7d02649e2b4f99d0c94ca04f26bf359c96acc2d9dedb",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7ec89121c0e2ad21841aea45d04337309c14eb10a3014ba4d285837d9c555b05",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "05b400a365320c547b62321f97c7224a58bed70055f2430931a32a74cc28a858"
    },
    "profileHash": "806270a8b2a9459a942a5c9efbeb6cee4b8cfe5d187e2a0570ae5fc7ec7a54d8"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-pulchra",
    "agentId": "agent-pulchra",
    "playerName": "波可娜",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.6",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "01ccb95442fad81ae20a17db7b5fe6ea996bdaf2c03c43b6d8bbfef8f478b542",
    "inputHash": "4dc1f21199e1c7cf639066d435d26b5d52ad32e3b8ad64cec6542c1323591611",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-pulchra-core-levels:core.levels:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"hunters_gait_daze_bonus\":0.3,\"hunters_gait_seconds\":6,\"binding_trap_seconds\":15,\"aftershock_damage_taken_bonus\":0.3}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pulchra-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-proto-punk\",\"set-shockstar-disco\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pulchra-formula-family:mechanics.formula_family:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": "hunters_gait_fangs_binding_trap"
      },
      {
        "record_id": "ENTITY_FACTS:fact-pulchra-impact:stats.lv60.raw.impact:batch-agents-1.6-r3l",
        "source_revision": "current@2026-08-05",
        "value": 118
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8bfb53f08a7a085b04f021559584768696bfc2078fb670b9146c5ec658b0c0d8",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a0aef33e131add444ca94df06af4e3da44076dcc301625f4061af00b40960cba",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "1983304938bcb7384c133af8025747d53448277e6379bc4ab633d50c55a97a1c",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "15ca850a492b2a72effb1cf5892cbe13b6129534c582286a3721751603239003",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "15ca850a492b2a72effb1cf5892cbe13b6129534c582286a3721751603239003",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "4f900e2d31bce55352644d35740a54006e1f12783a04e63522adee826126241d",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a254cba395851f5e3967ed67ec235ff9ae01498565a00c5796c06bbb29f48bb0",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "29a9ca9789da2bf5769c964cde0eedbc597b5edaadc14a13379505d2d8f1307a"
    },
    "profileHash": "9e0d1f89efb540d1f7c4b5244ac099eb7449455103058c9bbb8786a4b020b067"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-seth",
    "agentId": "agent-seth",
    "playerName": "赛斯",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.1",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F9",
    "objectiveTopology": "O5",
    "configHash": "e4d247fd7b3afff3e4bea49c27009d5e0f0c222ebb79c752857918d7cff0845d",
    "inputHash": "6bbd6310511dc5e2f186c96a7402d1d7ce0ae49da08515da67c6fd4b3e3f1857",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-seth-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": 90
      },
      {
        "record_id": "ENTITY_FACTS:fact-seth-atk:stats.lv60.raw.atk:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": 568.2987
      },
      {
        "record_id": "ENTITY_FACTS:fact-seth-core-levels:core.levels:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"resolve_threshold\":0.75,\"resolve_cost\":0.75,\"shield_initial_atk_ratio\":0.8,\"shield_cap\":3000,\"shield_duration_seconds\":25,\"shield_cooldown_seconds\":10,\"shield_anomaly_proficiency_bonus\":100,\"additional_anomaly_buildup_resistance_reduction\":0.2,\"additional_debuff_duration_seconds\":20}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-seth-def:stats.lv60.raw.def:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": 746.1361
      },
      {
        "record_id": "ENTITY_FACTS:fact-seth-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-swing-jazz\",\"set-freedom-blues\",\"set-chaos-jazz\",\"set-proto-punk\",\"set-shockstar-disco\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-seth-formula-family:mechanics.formula_family:batch-agents-1.1-r3q",
        "source_revision": "current@2026-08-05",
        "value": "resolve_firm_shield_anomaly_support"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "95a234bcfca3189bb88df37cc95c2ae3e8749b73f647e8b796fc37cd0fe86428",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "eda93aafb14680b5001d2c63f0d99ca6484146b6c7e036723c412cb2d1c4baca",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "de9f3f76cbfb4e651800b9a024d521bc0b9ef2acac2b02a534be497efb951539",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "264cb68a1f5b3dc6516c0add5023d5ab31c0965c2126db5f1c91e145930ea208",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "264cb68a1f5b3dc6516c0add5023d5ab31c0965c2126db5f1c91e145930ea208",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "92d55bce17c2e3458588616390f534264681ab204831545c0534537479b06172",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ad5c4f239c1368c44dac7d18460da470c6808a89465b85fd0c2d9cb056389e9a",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "32e5919ec6b78edad192515b718d6ecf57b6afcbf4159cc92ad97eb437ef7bd8"
    },
    "profileHash": "7d62a09ec0d10720ef457d297a7a313d64e3a57ff2d6a628bbf4d9f588ba79a5"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-anby",
    "agentId": "agent-anby",
    "playerName": "安比",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F3",
    "objectiveTopology": "O4",
    "configHash": "767725ce15639e8055bf10d159eb07f7f55a7c768de305203cb4e9a892570acd",
    "inputHash": "578896bf61152337c79fe681c419eb6b3f4bc80589be2bec9bd16d9042c0373f",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-anby-core-levels:core.levels:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_impact_bonus\":18},\"passive\":{\"thunderbolt_special_ex_daze_bonus\":0.32,\"additional_dodge_counter_energy\":7.2,\"additional_energy_cooldown_seconds\":5}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-anby-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-king-of-the-summit\",\"set-astral-voice\",\"set-proto-punk\",\"set-shockstar-disco\",\"set-swing-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-anby-formula-family:mechanics.formula_family:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "thunderbolt_daze_energy"
      },
      {
        "record_id": "ENTITY_FACTS:fact-anby-impact:stats.lv60.raw.impact:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 118
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6278182c3b22ef21370bcfc9c2d48964cf335c849a359e8e71da12457300419e",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "70182d6e8a168dfbcd77a7b25a6f38292aeb7d42eb24d06d834559e80446f847",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "bc2270c98a6b47e3e52cd6d64bdd93df760624777d39e2e83c9cbe8f325f7294",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9e4dd556125c04a9b20282846cdac3bdd0f494ee71d1896e061818fab660d69b",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9e4dd556125c04a9b20282846cdac3bdd0f494ee71d1896e061818fab660d69b",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "edec4aa883384b7c6a39d6e1c1f5297e3fa8e7039889ca64c50b157afa3fceff",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "064d5ab7d8dc1a1f267f72afd254d803391efe94d26d498b3ef1b4672a0fda24",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "ebb701787c7f922fb95544d2dd2cfaf5948f9f8a4a4ed005a7cfd5b0e70c4882"
    },
    "profileHash": "7bb0d1140cc2a916eee016e862f3b702f807ede01b9d82881fceed9adbb07b6e"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-nicole",
    "agentId": "agent-nicole",
    "playerName": "妮可",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "aa6c824c506c3e44909e6d2636f2056c7db489105709c4bff1316fe26acabc9d",
    "inputHash": "56ea1150436f71bc3ca2cc1579a8f0c3e689ba7d28a9ac71210cd74bb344df05",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-nicole-atk:stats.lv60.raw.atk:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 574.1691
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-nicole-core-levels:core.levels:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"def_reduction_by_level\":[0.25,0.3,0.34,0.36,0.38,0.4],\"debuff_duration_seconds\":3.5,\"ether_damage_bonus\":0.25}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-nicole-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-swing-jazz\",\"set-puffer-electro\",\"set-chaos-jazz\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-nicole-formula-family:mechanics.formula_family:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "energy_field_reload_def_shred"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "85662c30f4f868c3b9cabb993c77749e042a4e2d40b416197f0406b1b6118533",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "307624ca93121c831a72bc60c9b85da2fd311ac1c199e625ce06cbda0ad9bfb0",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a068d325119885d6f8a5e29a695aa425847799e7adac613cfba25b1908dbc81f",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b6c81cea2638e0bcc4e25740c25eca6e8ceb50c408d8c0457d4ac4fe088d10b1",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b6c81cea2638e0bcc4e25740c25eca6e8ceb50c408d8c0457d4ac4fe088d10b1",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cabd2381280304c69ebf239a743a3218e8726fc20ab588797a4874ba9de4721d",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7aaff8b187a849f899bbae0f4f95dadc5122d6af1f333c5055a185a60f881b77",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "f91fe7ae1bfcd6b68d7e4a446022286f48002260573ef188324d1d66f384d2b2"
    },
    "profileHash": "74970d68347f94b86c6e08d9b46acf01c1b82d410d21f4ab938b744aa55c4787"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-corin",
    "agentId": "agent-corin",
    "playerName": "可琳",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F1",
    "objectiveTopology": "O5",
    "configHash": "91c9166703e8f9b86b12700242fc31e93eb962ade4835e02ce6f1657ef1f7c83",
    "inputHash": "39dacd8e5a6151620afb94b07641da0a01a296968aeab0033fd4a9b25ac36701",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-corin-atk:stats.lv60.raw.atk:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 732.1414
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-corin-core-levels:core.levels:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_dmg_bonus\":0.288},\"passive\":{\"extended_slash_damage_bonus_by_level\":[0.187,0.218,0.25,0.281,0.312,0.343,0.375],\"stunned_target_damage_bonus\":0.35}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-corin-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-corin-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-corin-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-hormone-punk\",\"set-woodpecker-electro\",\"set-branch-blade-song\",\"set-fanged-metal\",\"set-astral-voice\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-corin-formula-family:mechanics.formula_family:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "extended_chainsaw_stun_window"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "5b339fa4fb4d070e2617f36c46324da05b9638d87f9260f4f1045bcedd3771c1",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9615bb0eebd523376c7f7521a0408291456829feafbe49ec1634e0ff224d59bb",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e48247bb11f1fc1158d66c7a6814686acb6c1ea7347d217ce5388da81effa35b",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e24a9ff00466ed8d4e4b387c192cd4b7fef44b406346b84982bb98c3d1ca7eec",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e24a9ff00466ed8d4e4b387c192cd4b7fef44b406346b84982bb98c3d1ca7eec",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cff7e6f15e2fe7a5038ea0656fc340e842417f2a2b4bc03f033c613506d27079",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b5e5aee7340beb454a74bbbb71ee70de4f996a2a97e9946449c4eef4f5ba8d7b",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "d3dcabc2e48948499c8b1ab738e5b65b51fcf487982f9ec076926cfc6c85c025"
    },
    "profileHash": "54a4a367787669931f25d137dec1170a41bda30123107d0f840a32519fe7ae9f"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-billy",
    "agentId": "agent-billy",
    "playerName": "比利",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F1",
    "objectiveTopology": "O5",
    "configHash": "198361ae7bcd843182b024da311b3afebf083bc265b313f9030e0461476356b2",
    "inputHash": "9231507d681796733a9175f48fc084f6ba9118445ee24e641046908009e7854e",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-billy-atk:stats.lv60.raw.atk:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 712.2765
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-billy-core-levels:core.levels:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"crouching_shot_damage_bonus_by_level\":[0.25,0.291,0.333,0.375,0.416,0.458,0.5],\"chain_next_ultimate_damage_bonus_per_stack\":0.5,\"chain_ultimate_max_stacks\":2}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-billy-crit-dmg:stats.lv60.raw.crit_dmg:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 0.5
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-billy-crit-rate:stats.lv60.raw.crit_rate:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": 0.05
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-billy-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-fanged-metal\",\"set-woodpecker-electro\",\"set-hormone-punk\",\"set-puffer-electro\",\"set-branch-blade-song\",\"set-astral-voice\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r2-billy-formula-family:mechanics.formula_family:batch-agents-1.0-b-r3r2",
        "source_revision": "current@2026-08-05",
        "value": "crouching_shot_chain_ultimate"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f72085db3d8099c22de2a1840c2d073f5b9222f11411b4f8219f3f65fff4db03",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "08f577e4c34e23e6b2ccdf056b190ac950a65186c4f6381c676129361b9401d7",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d6cb3663056d3e72bc524ef751599efb39961a289d6bf455e89436e8017a6cf8",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "86144007438a2b1027259317868198cb096b46bef6a407ac281556f566c8e763",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "86144007438a2b1027259317868198cb096b46bef6a407ac281556f566c8e763",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7c210aff50b0d5717960dd44ed985c5532d281aa4e4b4e92a30ed3b24a29ed65",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ffe3f6be1f92fc7bdd0e5954d0336c01ce74912dff133d8b641490dacfa9e8d8",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "a11e4a70e788e6ec2e9ec35706ddf7ef0f158fa90bb52afeb23a470d067e40e1"
    },
    "profileHash": "14d56664d26f8c8ccf7610337a3631d5183cc5a804dbd23eeb580d0f68dc967c"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-anton",
    "agentId": "agent-anton",
    "playerName": "安东",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F9",
    "objectiveTopology": "O5",
    "configHash": "8963b92d1d733b20dac2ab6801880f392943ca9dfffe625b7e8d19973d952f2b",
    "inputHash": "0da7ad70eb51e56f1649621e8529201f023110b164c715aafe56365fdaac5de6",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-anton-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 90
      },
      {
        "record_id": "ENTITY_FACTS:fact-anton-atk:stats.lv60.raw.atk:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 716.6483
      },
      {
        "record_id": "ENTITY_FACTS:fact-anton-core-levels:core.levels:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_crit_rate_bonus\":0.144},\"passive\":{\"pile_driver_damage_bonus\":0.12,\"drill_damage_bonus\":0.2,\"shock_retrigger_every_crits\":4,\"shock_retrigger_ratio\":0.45,\"shock_retrigger_cooldown_seconds\":0.5}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-anton-def:stats.lv60.raw.def:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 622.6159
      },
      {
        "record_id": "ENTITY_FACTS:fact-anton-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-thunder-metal\",\"set-puffer-electro\",\"set-woodpecker-electro\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-anton-formula-family:mechanics.formula_family:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "burst_drill_shock_retrigger"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "af979c96103b628ca346c96ad8f0c8916d529b0149263a063d8af7b2916bff10",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "022b78ed8e1256dc471325bc72cbe92a3984e56c6bb38564dae571e0cba32073",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "92032ed625e3a97f08594ce82b0cbfcc00cfd210e6e6153dcd08a6d773f0cda7",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d92fcbde1d80f18de9eeaa0b1d86c0c2630d9108f4dba95a0b6e1bd22f8b7c47",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "d92fcbde1d80f18de9eeaa0b1d86c0c2630d9108f4dba95a0b6e1bd22f8b7c47",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "469e2bd76343e04dfef6756eabf5e4cb9ce48b721a64c0e069a58d6f2496dc0a",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e78651eaaca500d5fbc734075d779276c1094ac0d334fc09ccb9273d1c6fd6b1",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "9b3745b7405bb6debacfa6efa0072852e75d401b48fbd88c96ce546efe404e76"
    },
    "profileHash": "5a31842ca06622783fe40cb62efd94f5299da4358f133ffea40bb08eba9369b9"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-ben",
    "agentId": "agent-ben",
    "playerName": "本",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F8",
    "objectiveTopology": "O4",
    "configHash": "b5f20f00917a2ffc7819d6a243f76fee83d1b7553f5a833fdb633fe428cb0109",
    "inputHash": "e7d21160d0b3d52ad3674cd0fdebb8244e2bbf28834728326001e1eadf7ad010",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-ben-atk:stats.lv60.raw.atk:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 578.0866
      },
      {
        "record_id": "ENTITY_FACTS:fact-ben-core-levels:core.levels:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"attack_from_def_ratio\":0.4,\"shield_def_ratio\":0.15,\"shield_flat\":100,\"shield_duration_seconds\":30,\"shielded_crit_rate_bonus\":0.16}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ben-def:stats.lv60.raw.def:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": 724.0351
      },
      {
        "record_id": "ENTITY_FACTS:fact-ben-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-inferno-metal\",\"set-woodpecker-electro\",\"set-puffer-electro\",\"set-branch-blade-song\",\"set-astral-voice\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-ben-formula-family:mechanics.formula_family:batch-agents-1.0-a-r3r1",
        "source_revision": "current@2026-08-05",
        "value": "defense_attack_conversion_shield"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "aefd3d49d636a662caf345f75a4f6465e091293faa8d1cbe0f7ae0e8d7ab3493",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "2b6c03c45c1a9cc42a78c77e5088168ef59d2df71a0f16332dae9031dca2222f",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "7e244435fd52ec724ca928929d79452667a47d492bbf06d8a65af71730258452",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9c0972ed2c3bddd31ca27dcc03a03b77c7dd99132a5e968436010fbee72e9064",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "9c0972ed2c3bddd31ca27dcc03a03b77c7dd99132a5e968436010fbee72e9064",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b3018f40e3e78d04fa7e35cf088daee5b2df4366769efb986a95dec5f551c165",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "28d57dec7ab8a0a9e5e8198a7d553e34fb276ce14cb8bfed0f3f8563f581c2b4",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "22dffa17c4b8d4ed1bf63d49618133c84e3ebb620c49a68459e36dc10ba9807e"
    },
    "profileHash": "158cdd115f952267d715ae29ed2a97dbb74588d58520d3dc01690f883879fd3d"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-soukaku",
    "agentId": "agent-soukaku",
    "playerName": "苍角",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "cac6b5f3a496de6a327abc77b03d56674b8f70391e185b6e87d92cb8392ab9ee",
    "inputHash": "762a1560b4b9744692b6f67ec99d7e5a429ebc70a3c873a7eedb5e27145ae108",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soukaku-atk:stats.lv60.raw.atk:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 590.8333
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soukaku-core-levels:core.levels:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"initial_atk_ratio_by_level\":[0.125,0.15,0.17,0.18,0.19,0.2],\"flat_atk_cap\":500,\"vortex_doubled_cap\":1000,\"buff_duration_seconds\":22,\"vortex_max_stacks\":3}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soukaku-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-swing-jazz\",\"set-moonlight-lullaby\",\"set-hormone-punk\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-soukaku-formula-family:mechanics.formula_family:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "vortex_fly_the_flag_blade_banner"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ef782325cd1616a6d295aac20aaaaebf43a6c9da2ea891166ecabb9b6bb01637",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cb2e958d58bb27cf5204ae61aee912f33b470b88317624f052e9a6f2d2013320",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "64a2cac04a17587f6a115c8e5d945c4908ccc31a71e436b536d45741a4147e22",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8402aac2f8a0f74a61283dd08fcc38ef01979b90ac0871e12ad227ff0f59b752",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "8402aac2f8a0f74a61283dd08fcc38ef01979b90ac0871e12ad227ff0f59b752",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "ea01e3f641d2ae40ff3f241b1dc53af299efa6038081b165e3eab401b0082d31",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "977e0580fa7073598fb65df429a310abc8adb12c03aa40bc8d4e52f8f264fb7a",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "13c715a7a7fbab856836461a9d2a9e0dc28fc3ae1fac47f10cde0790f27bf9b5"
    },
    "profileHash": "add8df9a583ac8dd420019f4ebf39a97cc9721f3c109ba83c9748575f10e1270"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-lucy",
    "agentId": "agent-lucy",
    "playerName": "露西",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F7",
    "objectiveTopology": "O4",
    "configHash": "0a70b7f0b506d3706253f1906d7fba6302ccc894be0bca0603182d4ec0b96e49",
    "inputHash": "6683d4c3748b3248b342bfb19fee9ebdd89b79757de29e71a1c2bfb3b287ae2d",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lucy-atk:stats.lv60.raw.atk:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": 583.957
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lucy-core-levels:core.levels:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"guard_boar_inherited_stats_by_level\":[1.5,1.6,1.7,1.8,1.9,2],\"cheer_on_atk_formula\":\"(13 + skill_level*0.8)% of initial ATK + (40 + skill_level*4); cap 600\",\"cheer_on_line_drive_seconds\":10,\"cheer_on_fly_ball_seconds\":15}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lucy-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-astral-voice\",\"set-swing-jazz\",\"set-puffer-electro\",\"set-hormone-punk\",\"set-phaethons-melody\",\"set-chaos-jazz\",\"set-fanged-metal\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r3-lucy-formula-family:mechanics.formula_family:batch-agents-1.0-c-r3r3",
        "source_revision": "current@2026-08-05",
        "value": "guard_boar_cheer_on"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "cbc5ee0d83f4c3c34c733c7c40340d7056b8d8a9c98c59f04230edcbdf9d6d2a",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "50c8e363215671fcdda775a19b5e6f44160e3c42ee15cafbbf73269bdd340cb4",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "e06299efa5216e295fc8539cdfe32b80807970a8d264ce83aa4788a26e8410e1",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "80526dea53dc908e668db0ccf4f354f01acac15e64a36706ef43d7907b69469c",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "80526dea53dc908e668db0ccf4f354f01acac15e64a36706ef43d7907b69469c",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "616461836a87ff650e82d30f2ae504cd7289798405c517bc60d766a4249c1d99",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "b6939e8115d2c77e6030aaf70d7a87a70dd4162c390baaf789016c95fde60b05",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "fde422165676cafae565a4d97689032e4b24a6bfc732f92415718eb87ae85d61"
    },
    "profileHash": "2def15fec820abf75f0067fd30b41cf209ce1b3bd22768a69cde71cda6e4c2ba"
  },
  {
    "schema": "soda-graduation-profile/v1",
    "profileVersion": "1.0.0",
    "generatorVersion": "soda-graduation-profile-generator-r1.0",
    "generationVersion": "production-profile-prep-r1",
    "profileId": "graduation:agent-piper",
    "agentId": "agent-piper",
    "playerName": "派派",
    "publicationState": "prepared_not_adopted",
    "sourcePackageId": "l3-b323989c00330f284329",
    "gameFactsVersion": "1.0",
    "formulaVersion": "soda-formula-adapters-r1.1-fixed-context",
    "kernelVersion": "soda-graduation-kernel-r0.1-frozen-o1-o6",
    "formulaFamily": "F4",
    "objectiveTopology": "O5",
    "configHash": "e0f2d8d56eb9464706d64a02e0ab70970bcff44570cd8545107fd401747f9121",
    "inputHash": "99279200dd37967b8fbba5b229ea81a60b074f6e057cbc8df0811030f63284f4",
    "inputReferences": [
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-piper-anomaly-proficiency:stats.lv60.raw.anomaly_proficiency:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 116
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-piper-atk:stats.lv60.raw.atk:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": 683.4172
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-piper-core-levels:core.levels:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "{\"tiers\":6,\"max_core_panel\":{\"base_atk_bonus\":75,\"base_energy_regen_bonus\":0.36},\"passive\":{\"power_buildup_rate_per_stack_by_level\":[0.023,0.026,0.03,0.033,0.036,0.04],\"power_max_stacks\":20,\"power_duration_seconds\":12}}"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-piper-drive-discs:relation.drive_disc.recommended_set_ids:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "[\"set-fanged-metal\",\"set-freedom-blues\",\"set-chaos-jazz\",\"set-branch-blade-song\"]"
      },
      {
        "record_id": "ENTITY_FACTS:fact-r3r4-piper-formula-family:mechanics.formula_family:batch-agents-1.0-d-r3r4",
        "source_revision": "current@2026-08-05",
        "value": "engine_spin_power_anomaly"
      }
    ],
    "model_candidate": true,
    "formal_supported": false,
    "guideBenchmarkIsolation": {
      "solverInputCount": 0,
      "status": "pass"
    },
    "kernel": {
      "levels": [
        {
          "level": "Baseline",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "3908b7b06cc75d9614948ab0ab202781ae4e0828ff1d854be945f79891770314",
          "inputBudget": 0
        },
        {
          "level": "B16",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "24a54cb8f985a979c21f1f32cf17d58f167adeb3aea43a7173ffe48d8fa92a10",
          "inputBudget": 12
        },
        {
          "level": "B20",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "6774e0c26ce1628e02ad3b5671903be379fa20812690998928ae302e12dc25f0",
          "inputBudget": 18
        },
        {
          "level": "B24",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "28bdbded087cec256b93047a482f8056cc401bc4812c9fd82b80f739b3c38303",
          "inputBudget": 24
        },
        {
          "level": "B28",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "28bdbded087cec256b93047a482f8056cc401bc4812c9fd82b80f739b3c38303",
          "inputBudget": 24
        },
        {
          "level": "B32",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "f2178744839cd1cad498f79bd1b9c517fe480eda223617618f1afe2dee3554fd",
          "inputBudget": 30
        },
        {
          "level": "LegalMax",
          "executable": true,
          "legality": true,
          "legalMaxWitness": true,
          "oracleAdapter": true,
          "topHash": "a3f1907e218e3cfdf9ca3356684ead102eff812b3fc0db36470c01f3aa6880be",
          "inputBudget": 36
        }
      ],
      "deterministic": true,
      "configHash": "42fd2054084813d3189b58d0979116421e3517f285e022618482f41447eaa168"
    },
    "profileHash": "031198f7b7aa5cc0281c43eda0507c855c73c7529a64223ba7298a4b30ac8725"
  }
] as const
