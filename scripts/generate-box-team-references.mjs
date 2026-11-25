import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generated = resolve(root, 'src/gameDataPacks/generated/team-bangboo-overview.3.3.json')
const ranksPath = resolve(root, 'src/gameDataPacks/generated/box-default-formation-ranks.3.3.json')
const admissionPath = 'src/gameDataPacks/generated/default-team-admission.3.3.json'
const hash = (data) => createHash('sha256').update(data).digest('hex')
const sourceHash = async (path) =>
  hash((await readFile(resolve(root, path), 'utf8')).replaceAll('\r\n', '\n'))

// Check the actual transitive mechanic/data inputs without reevaluating formations at release time.
export async function verifyBoxTeamReferences() {
  const { sources, contentHash, ...content } = JSON.parse(await readFile(generated, 'utf8'))
  if (hash(JSON.stringify({ sources, ...content })) !== contentHash)
    throw new Error('队伍邦布预计算内容不一致。')
  if (hash(await readFile(ranksPath)) !== content.rankFileHash)
    throw new Error('队伍默认打法排序与生成记录不一致。')
  for (const [path, expected] of Object.entries(sources)) {
    if ((await sourceHash(path)) !== expected) throw new Error(`请重新生成队伍邦布候选：${path}`)
  }
}

async function generate() {
  const catalogPath = 'src/gameDataPacks/generated/generic-team-ranking.v1.json'
  const sources = new Set([admissionPath, catalogPath, 'scripts/generate-box-team-references.mjs'])
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [
      {
        name: 'record-bangboo-inputs',
        transform(_, id) {
          const path = relative(root, id.split('?')[0]).replaceAll('\\', '/')
          if (path.startsWith('src/') && /\.(?:ts|json)$/.test(path)) sources.add(path)
        },
      },
    ],
  })
  try {
    const { admittedTeamBangbooOptions } = await server.ssrLoadModule(
      '/src/decision/admittedTeamBangbooOptions.ts',
    )
    const { describeBangbooConditions } = await server.ssrLoadModule(
      '/src/decision/bangbooConditionPresentation.ts',
    )
    const { targetTeamBangbooOptions } = await server.ssrLoadModule(
      '/src/decision/targetTeamSourceBangbooOptions.ts',
    )
    const { lookupCurrent31TeamIntrinsicDetails } = await server.ssrLoadModule(
      '/src/decision/current31TeamIntrinsicIndex.ts',
    )
    const { selectSavedDefaultTeamAdmissionPlay } = await server.ssrLoadModule(
      '/src/decision/defaultTeamAdmissionPlay.ts',
    )
    const ranking = await server.ssrLoadModule('/src/decision/teamGenericRanking.ts')
    const admission = JSON.parse(await readFile(resolve(root, admissionPath), 'utf8'))
    const catalog = JSON.parse(await readFile(resolve(root, catalogPath), 'utf8'))
    if (
      ranking.currentGenericTeamRankingStatus.contentHash !== catalog.contentHash ||
      catalog.contentHash !== admission.catalog
    )
      throw new Error('队伍榜单与玩法准入版本不一致。')
    const templates = [],
      templateIds = new Map(),
      formations = [],
      bangbooShortlists = [],
      shortlistIds = new Map(),
      count = catalog.agentIds.length
    const admitted = new Set(admission.rows.map(([team]) => team))
    for (const [a, b, c] of catalog.rows) {
      const members = [a, b, c].map((i) => catalog.agentIds[i])
      const direction = lookupCurrent31TeamIntrinsicDetails(
        members,
        'default-ranking',
      )?.mechanismDirection
      const play =
        direction && selectSavedDefaultTeamAdmissionPlay(members, direction, catalog.contentHash)
      const result =
        (play && ranking.lookupCurrentGenericTeamRankingForPlay(members, play)) ||
        ranking.lookupCurrentGenericTeamRanking(members)
      const displayOrder = result?.genericOrder?.displayOrder ?? null
      const template = result?.genericOrder
        ? { ...result, genericOrder: { ...result.genericOrder, displayOrder: 0 } }
        : result
      const encoded = JSON.stringify(template)
      if (!templateIds.has(encoded)) {
        templateIds.set(encoded, templates.length)
        templates.push(template)
      }
      const positions = [a, b, c].sort((l, r) => l - r)
      const formation = [
        positions[0] * count * count + positions[1] * count + positions[2],
        templateIds.get(encoded),
        displayOrder,
      ]
      if (admitted.has([...members].sort().join('|'))) {
        const ids = targetTeamBangbooOptions({ memberIds: members }).map(({ bangbooId }) => bangbooId)
        const key = JSON.stringify(ids)
        if (!shortlistIds.has(key)) {
          shortlistIds.set(key, bangbooShortlists.length)
          bangbooShortlists.push(ids)
        }
        formation.push(shortlistIds.get(key))
      }
      formations.push(formation)
    }
    const rankBytes =
      JSON.stringify({
        catalog: catalog.contentHash,
        agentIds: catalog.agentIds,
        templates,
        formations,
        bangbooShortlists,
      }) + '\n'
    const options = [],
      interned = new Map(),
      rows = {}
    for (const [trio] of admission.rows) {
      const memberIds = trio.split('|')
      const choices = admittedTeamBangbooOptions({ memberIds })
      if (choices.length !== 3 || new Set(choices.map((option) => option.bangbooId)).size !== 3)
        throw new Error(`队伍缺少三个不同的邦布方案：${trio}`)
      rows[trio] = choices.map((option, position) => {
        const { activationStatus, sourceUrl } = describeBangbooConditions({
          memberIds,
          bangbooId: option.bangbooId,
          stars: option.defaultStars,
        })
        const baseSkill =
          position === 2 &&
          (option.bangbooId === 'bangboo-butler' ||
            (option.bangbooId === 'bangboo-snap' &&
              option.recommendationReason.startsWith('同队实战'))) &&
          option.recipientFit === 'base_only' &&
          activationStatus === 'inactive'
        if (
          !sourceUrl ||
          activationStatus !== option.activationStatus ||
          (!baseSkill &&
            (activationStatus !== 'active' ||
              ['unknown', 'not_applicable'].includes(option.recipientFit)))
        )
          throw new Error(`邦布条件或接受者未经核对：${trio} / ${option.bangbooId}`)
        const value = [
          option.bangbooId,
          option.defaultStars,
          option.primaryPurpose,
          option.recommendationReason,
          activationStatus,
        ]
        const key = JSON.stringify(value)
        if (!interned.has(key)) {
          interned.set(key, options.length)
          options.push(value)
        }
        return interned.get(key)
      })
    }
    const digests = {}
    sources.delete('src/gameDataPacks/generated/box-default-formation-ranks.3.3.json')
    for (const path of [...sources].sort()) digests[path] = await sourceHash(path)
    const content = {
      sources: digests,
      gameVersion: admission.gameVersion,
      catalog: admission.catalog,
      rankFileHash: hash(rankBytes),
      options,
      rows,
    }
    const overviewBytes =
      JSON.stringify({ ...content, contentHash: hash(JSON.stringify(content)) }) + '\n'
    const suffix = `.${process.pid}.tmp`
    await Promise.all([
      writeFile(ranksPath + suffix, rankBytes),
      writeFile(generated + suffix, overviewBytes),
    ])
    await rename(ranksPath + suffix, ranksPath)
    await rename(generated + suffix, generated)
    console.log(
      `${formations.length} formations, ${Object.keys(rows).length} teams, ${options.length} distinct Bangboo options`,
    )
  } finally {
    await server.close()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) await verifyBoxTeamReferences()
  else await generate()
}
