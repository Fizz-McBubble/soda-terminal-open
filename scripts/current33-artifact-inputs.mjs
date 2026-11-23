import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Independent reviewed/Nanoka inputs; never mixed into the GO generatedFrom claim.
export const current33ArtifactInputs = Object.freeze([
  {
    path: 'src/gameDataPacks/data/phoenix-event-contract.3.3.json',
    kind: 'nanoka_events',
    sha256: '01CB308658C552827183F88CB6E0D49929F44243C0BDA13F689751705F9EF804',
    producer: {
      path: 'scripts/data-upstream/project-phoenix-event-contract33.mjs',
      sha256: 'B75D106BBD385420850F6BFB8D29CC9AC72160A745092B37C3A1867B242026F9',
    },
  },
  {
    path: 'src/gameDataPacks/data/reviewed-phoenix-numeric.3.3.json',
    kind: 'nanoka_numeric',
    sha256: '06E0A9B54764C31FAE26F1F5CCCDC5B3C2B0936F90BEC3CA5B31B644F01B963D',
    producer: {
      path: 'scripts/data-upstream/project-reviewed-phoenix-numeric.mjs',
      sha256: '5632FF16F5A8F1C254343607609131C25A19378CDB49D781C21433B8FE52E277',
    },
  },
  {
    path: 'src/calculation/phoenixAscensionMaterials33.data.json',
    kind: 'nanoka_materials',
    sha256: '7767F113DD3A22BBC858BBB16AE8E6BBE419328AF4AAE189803CB53A08EA1721',
    producer: {
      path: 'scripts/data-upstream/project-phoenix-ascension-materials33.mjs',
      sha256: 'CABDC2453ADB110A0327C38B4AA3666603817AE693ACE2CC4F403384AE939E29',
    },
  },
  {
    path: 'src/gameDataPacks/data/reviewed-wengine.3.3.json',
    kind: 'nanoka_wengine',
    sha256: 'E0BD3B2141F25A44D03372FE7CB6332785EC2F8656330D5D957F9FB58AAFEC7E',
    producer: {
      path: 'scripts/data-upstream/nanoka-wengine-projection.mjs',
      sha256: '03F99748291AD64C173C7877607A7C01AD5ABF8333959F91DEDBE5335C41FC14',
    },
  },
  {
    path: 'src/calculation/skillInvestmentMaterials33.phoenix.json',
    kind: 'nanoka_skill_materials',
    sha256: 'DD6AD10CE3C7990F03175DE985FB4C35146AF212FBA887ABEC8E7A1398104FBB',
    producer: {
      path: 'scripts/data-upstream/project-phoenix-skill-materials33.mjs',
      sha256: '0897C0FDBBC4FF5BFF9081CCEE2D16AA815C25DDA82B801007A95E2AE3A6D310',
    },
  },
  {
    path: 'src/gameDataPacks/data/severian-event-contract.3.3.json',
    kind: 'nanoka_events',
    sha256: '3DDABA5DB135673D811501F1AA6DF95B31306123B2F9BA07D8B472B94121CDB1',
    producer: {
      path: 'scripts/data-upstream/project-severian-event-contract33.mjs',
      sha256: '0C0AC43A31DF18E0FCDACA032B289DB50D4A186CB4F55B61DCB6F8B451144C3E',
    },
  },
  {
    path: 'src/gameDataPacks/data/reviewed-severian-numeric.3.3.json',
    kind: 'nanoka_numeric',
    sha256: '1E30F3065F725505378F8F1ACF441B02CFA2F93219A3B7EC9FFDC3729CAD21F5',
    producer: {
      path: 'scripts/data-upstream/project-reviewed-severian-numeric.mjs',
      sha256: '10E93A85234125113A74A110ADFFD51B02E8BFD3D10CADDB250061B4C2D0E1FB',
    },
  },
  {
    path: 'src/calculation/severianAscensionMaterials33.data.json',
    kind: 'nanoka_materials',
    sha256: 'E7AB02BDB27FC2334488417C47DC50BEA2DD3FE06A127C1CEEFF77A0CF79EC35',
    producer: {
      path: 'scripts/data-upstream/project-severian-ascension-materials33.mjs',
      sha256: '2AA4F65B2616D8849D6593C54EF083A4756AC56BF3970FD71E7BD0F7C936D2BA',
    },
  },
  {
    path: 'src/calculation/skillInvestmentMaterials33.severian.json',
    kind: 'nanoka_skill_materials',
    sha256: '3BAF1DD04DFDCD03803A61F2A5E641E234E14E9903FC9A1B87EDD4AB843C62B9',
    producer: {
      path: 'scripts/data-upstream/project-severian-skill-materials33.mjs',
      sha256: 'DC1DFABFFA886E8CD8E0E9AD3BC57B21BABF38935174E80C71CC8D7B76A965FE',
    },
  },
  {
    path: 'src/gameDataPacks/data/reviewed-severian-build-guidance.3.3.json',
    kind: 'reviewed_guidance',
    sha256: '5AE5466A4A8267AA2C3041D0C1CBED226F42DBE21A21560B18075F7F8F8ECCE0',
  },
  {
    path: 'src/gameDataPacks/data/reviewed-build-field-continuity.3.3.json',
    kind: 'guidance_continuity',
    sha256: '07B9A831B044158CEA274C22AB276E35A11814E5179377CB5C67EEE028E91788',
    producer: {
      path: 'scripts/project-reviewed-build-field-continuity33.mjs',
      sha256: 'BF6D17AFE3A4B23DB2CDB08E6FDB7EBD48122F2EC5E41EF1B06BB2AAA0883A52',
    },
  },
  {
    path: 'src/gameDataPacks/data/reviewed-contextual-target-panel-continuity.3.3.json',
    kind: 'target_panel_continuity',
    sha256: 'DAB0BB99ACB25FAAFA649D3615991B6BA74B63A3C0B58CA53714960610079576',
    producer: {
      path: 'scripts/project-reviewed-contextual-target-panel-continuity33.mjs',
      sha256: '7762E82BA66C17CC6E9F73EF54796A69AFABCC8F6A46D80D78322CFDD650CA73',
    },
  },
  {
    path: 'src/gameDataPacks/data/reviewed-phoenix-build-guidance.3.3.json',
    kind: 'reviewed_guidance',
    sha256: '7C8E8EDDE5D612B3FDBA9598655A89AC64819F173A9F57054C28B4AB54F48CC0',
  },
  {
    path: 'src/gameDataPacks/data/reviewed-phoenix-anomaly-crit.3.3.json',
    kind: 'reviewed_mechanic',
    sha256: '97C3A9CBBAF7D632E704DC825AB4F9B808B5C6ADB5C6BBDD7F5F9BA9AC6C46BF',
  },
  {
    path: 'src/gameDataPacks/data/reviewed-version-applicability.3.3.json',
    kind: 'reviewed_applicability',
    sha256: 'EA30152E23A367FCDA5B3A0697A9F207999DE22E23DF08A1901911F218D1FBD8',
  },
])

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase()
const providerPin = '4d30f529d6e0568a130ebe4d79557b30d9c65d2219e77461763df1c4b42cb029'
const phoenixPin = '237c5b060657db1fd8ababe6cd26fb275c325d74a67eda481bde6732c7d93dfe'
const severianPin = '89f3a03b90fca880851352d6d686e6bbe658411d7b4cdf6b78d2a14a97ff5974'
const agentPins = {
  'agent-phoenix': { gameId: '1641', sha256: phoenixPin },
  'agent-severian': { gameId: '1631', sha256: severianPin },
}
export function validateCurrent33SourceShape(data, kind) {
  const fail = () => {
    throw Error(`3.3 independent source binding mismatch: ${kind}`)
  }
  if (kind === 'nanoka_events') {
    const pin = agentPins[data.stableId]?.sha256
    if (
      !pin ||
      data.gameVersion !== '3.3' ||
      data.source?.provider !== 'nanoka' ||
      data.source.rawSha256?.toLowerCase() !== pin ||
      data.source.providerManifestSha256?.toLowerCase() !== providerPin ||
      data.source.commit !== `sha256:${pin}` ||
      data.source.licenseStatus !== 'redistribution_not_confirmed' ||
      data.eventContract?.events.length !== 20 ||
      data.eventContract.events.some(
        (event) =>
          event.formulaBinding?.formalEligible !== false ||
          event.eventGranularity !== 'source_skill_parameter_aggregate_not_individual_hit',
      )
    )
      fail()
  }
  if (kind === 'nanoka_numeric' || kind === 'nanoka_materials') {
    const source = data.source
    const agentId = data.stableId ?? data.agentId
    const pin = agentPins[agentId]
    if (
      !pin ||
      source?.provider !== 'nanoka' ||
      source.providerManifestSha256 !== providerPin ||
      (source.rawSha256 ?? source.sha256) !== pin.sha256 ||
      source.url !== `https://static.nanoka.cc/zzz/3.3/zh/character/${pin.gameId}.json`
    )
      fail()
    if (
      kind === 'nanoka_numeric' &&
      (data.eventContract ||
        data.events ||
        data.coreStats?.length !== 6 ||
        data.promotionStats?.length !== 6 ||
        data.potentialAbsence?.potentialEmpty !== true ||
        data.potentialAbsence?.potentialDetailEmpty !== true)
    )
      fail()
  }
  if (kind === 'nanoka_wengine') {
    const releaseStatusById = new Map(
      (data.items ?? []).map((row) => [row.stableId, row.releaseStatus]),
    )
    if (
      data.gameVersion !== '3.3' ||
      data.items?.length !== 3 ||
      releaseStatusById.get('wengine-14164') !== 'released_first_half' ||
      releaseStatusById.get('wengine-13022') !== 'released_event' ||
      releaseStatusById.get('wengine-14163') !== 'released_second_half' ||
      data.items.some(
        (row) =>
          row.source?.provider !== 'nanoka' ||
          row.source.providerManifestSha256 !== providerPin ||
          !/^[a-f0-9]{64}$/.test(row.source.rawSha256) ||
          row.source.commit ||
          row.source.formulaPath,
      )
    )
      fail()
  }
  if (kind === 'nanoka_skill_materials') {
    const pin = agentPins[data.agentId]
    if (
      !pin ||
      data.gameId !== pin.gameId ||
      data.status !== 'supported' ||
      data.source?.sourceVersion !== '3.3' ||
      data.source?.url !== `https://static.nanoka.cc/zzz/3.3/zh/character/${pin.gameId}.json` ||
      data.source?.sha256?.toLowerCase() !== pin.sha256 ||
      Object.keys(data.coreCosts ?? {}).join(',') !== '1,2,3,4,5,6' ||
      Object.keys(data.combatTables ?? {}).length !== 5 ||
      Object.entries({
        basic: 'table0',
        dodge: 'table1',
        special: 'table2',
        chain: 'table3',
        assist: 'table4',
      }).some(([skill, table]) => data.combatTableBySkill?.[skill] !== table)
    )
      fail()
  }
  if (
    kind === 'guidance_continuity' &&
    (data.entries?.length !== 551 ||
      data.formulaBindings?.length !== 60 ||
      data.scope !== 'formed_generic_guidance_reference' ||
      data.boundary?.runtimePromotion !== false ||
      data.boundary?.formalPromotion !== false ||
      data.boundary?.importPromotion !== false)
  )
    fail()
  if (
    kind === 'target_panel_continuity' &&
    (data.entries?.length !== 2 || data.scope !== 'generic_target_panel_reference33')
  )
    fail()
  return true
}
export async function verifyCurrent33ArtifactInputs(options = {}) {
  const root = options.appRoot ?? appRoot
  const read = options.readFile ?? readFile
  const results = []
  for (const entry of current33ArtifactInputs) {
    for (const item of [entry, ...(entry.producer ? [entry.producer] : [])]) {
      if (path.isAbsolute(item.path) || item.path.split(/[\/]/).includes('..'))
        throw Error('3.3 artifact path must be project-relative')
      const bytes = await read(path.resolve(root, item.path))
      if (hash(bytes) !== item.sha256) throw Error(`3.3 artifact input hash mismatch: ${item.path}`)
      if (item === entry)
        validateCurrent33SourceShape(JSON.parse(bytes.toString('utf8')), entry.kind)
    }
    results.push({
      path: entry.path,
      kind: entry.kind,
      sha256: entry.sha256,
      producer: entry.producer?.path ?? null,
    })
  }
  // These sources retain their own unmodified generation/schema/hash checks.
  for (const [file, count] of [
    ['current-agent-mechanic-catalog.v1.json', 60],
    ['current-wengine-static-catalog.v1.json', 100],
  ]) {
    const data = JSON.parse(
      (await read(path.resolve(root, 'src/gameDataPacks/generated', file))).toString('utf8'),
    )
    if (data.items.length !== count) throw Error(`GO frozen population changed: ${file}`)
  }
  return {
    pass: true,
    artifactCount: results.length,
    producerCount: new Set(results.map((row) => row.producer).filter(Boolean)).size,
    inputs: results,
  }
}
