import { getAgentEncyclopedia } from '../gameDataPacks/currentEncyclopedia'

/**
 * Player-facing search aliases (English names, mainstream CN nicknames, and
 * full-name variants) per SODA-DESIGN-FOUNDATION.md §11.1:
 * search recognizes English or colloquial aliases while display remains unified Chinese.
 */
const AGENT_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'agent-ellen': ['ellen', 'ellen joe', '鲨鱼妹', '艾莲乔'],
  'agent-lycaon': ['lycaon', 'von lycaon', '狼叔', '狼哥', '莱卡恩'],
  'agent-rina': ['rina', 'alexandrina', '丽娜', '女仆长'],
  'agent-corin': ['corin', 'corin wickes', '可琳', '锯妹'],
  'agent-anby': ['anby', 'anby demara', '安比', '小安比'],
  'agent-billy': ['billy', 'billy kid', '比利', '比利奇德'],
  'agent-nicole': ['nicole', 'nicole demara', '妮可'],
  'agent-nekomata': ['nekomata', 'nekomiya', 'nekomiya mana', '猫又', '猫宫又奈'],
  'agent-soldier-11': ['soldier 11', 's11', '11', '11号', '十一号'],
  'agent-grace': ['grace', 'grace howard', '格莉丝'],
  'agent-koleda': ['koleda', 'koleda belobog', '珂蕾妲', '社长'],
  'agent-anton': ['anton', 'anton ivanov', '安东', '钻头哥'],
  'agent-ben': ['ben', 'ben bigger', '本', '本比格', '熊哥'],
  'agent-zhu-yuan': ['zhu yuan', 'zhuyuan', '朱鸢', '朱姐'],
  'agent-qingyi': ['qingyi', '青衣'],
  'agent-jane': ['jane', 'jane doe', '简', '简杜', '鼠姐', '老鼠'],
  'agent-seth': ['seth', 'seth lowell', '赛斯'],
  'agent-caesar': ['caesar', 'caesar king', '凯撒'],
  'agent-burnice': ['burnice', 'burnice white', '柏妮思'],
  'agent-lucy': ['lucy', 'luciana', '露西'],
  'agent-piper': ['piper', 'piper wheel', '派派'],
  'agent-lighter': ['lighter', '莱特'],
  'agent-yanagi': ['yanagi', 'tsukishiro yanagi', '柳', '月城柳'],
  'agent-harumasa': ['harumasa', 'asaba harumasa', '悠真', '浅羽悠真'],
  'agent-miyabi': ['miyabi', 'hoshimi miyabi', '星见雅', '雅', '烈霜', '虚狩'],
  'agent-soukaku': ['soukaku', '苍角'],
  'agent-astra': ['astra', 'astra yao', '耀嘉音', '嘉音', '耀姐'],
  'agent-evelyn': ['evelyn', 'evelyn chevalier', '伊芙琳'],
  'agent-soldier-0-anby': [
    'soldier 0 anby',
    's0 anby',
    'sanby',
    'silver anby',
    '大安比',
    '零号安比',
  ],
  'agent-trigger': ['trigger', '扳机'],
  'agent-pulchra': ['pulchra', '波可娜'],
  'agent-vivian': ['vivian', '薇薇安'],
  'agent-hugo': ['hugo', 'hugo vlad', '雨果'],
  'agent-yixuan': ['yixuan', 'yi xuan', '仪玄', '玄墨', '师父'],
  'agent-ju-fufu': ['ju fufu', 'jufufu', 'fufu', '橘福福', '福福'],
  'agent-pan-yinhu': ['pan yinhu', 'panyinhu', '潘引壶', '熊猫'],
  'agent-yuzuha': ['yuzuha', 'ukiha yuzuha', '柚叶', '浮波柚叶'],
  'agent-alice': ['alice', 'alice thymefield', '爱丽丝'],
  'agent-seed': ['seed', '席德'],
  'agent-orphie-magus': ['orphie', 'magus', 'orphie & magus', '奥菲丝', '鬼火'],
  'agent-lucia': ['lucia', '卢西娅'],
  'agent-manato': ['manato', 'komano manato', '狛野真斗', '真斗'],
  'agent-yidhari': ['yidhari', '伊德海莉'],
  'agent-dialyn': ['dialyn', '琉音'],
  'agent-banyue': ['banyue', '般岳'],
  'agent-ye-shunguang': ['ye shunguang', 'yeshunguang', 'shunguang', '叶瞬光', '瞬光', '凛刃'],
  'agent-zhao': ['zhao', '照', '小照'],
  'agent-sunna': ['sunna', '千夏'],
  'agent-aria': ['aria', '爱芮'],
  'agent-nangong': ['nangong', 'nangong yu', '南宫羽', '南宫'],
  'agent-cissia': ['cissia', '希希芙'],
  'agent-promeia': ['promeia', '普罗米娅'],
  'agent-starlight-billy': ['starlight billy', '星徽比利', '大比利'],
  'agent-pyrois': ['pyrois', '佩洛伊斯'],
  'agent-velina': ['velina', '维琳娜'],
  'agent-norma': ['norma', '诺姆'],
  'agent-remielle': ['remielle', 'remielle dan', '蕾米埃尔', '蕾米埃尔丹', '丹'],
  'agent-sigrid': ['sigrid', 'sigrid de la serre', '希格莉德', '希格莉德德拉叙尔'],
  'agent-claret': ['claret', '克拉蕾'],
  'agent-roxy': ['roxy', '洛克茜'],
  'agent-phoenix': ['phoenix', '菲欧妮', '菲欧妮蕾法爱菈', '凰'],
  'agent-severian': ['severian', '赛维里安'],
}

function normalizeSearchToken(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[·•・\u300c\u300d「」&＆\s_-]+/g, '')
}

export function getAgentSearchTerms(agentId: string, displayName: string): string[] {
  const terms = [displayName]
  const encyclopedia = getAgentEncyclopedia(agentId)
  if (encyclopedia?.fullName) terms.push(encyclopedia.fullName)
  const aliases = AGENT_SEARCH_ALIASES[agentId]
  if (aliases) terms.push(...aliases)
  return terms
}

export function matchesAgentSearchQuery(
  agentId: string,
  displayName: string,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLocaleLowerCase()
  if (!query) return true
  const compactQuery = normalizeSearchToken(query)
  for (const term of getAgentSearchTerms(agentId, displayName)) {
    const lower = term.toLocaleLowerCase()
    if (lower.includes(query)) return true
    if (compactQuery && normalizeSearchToken(term).includes(compactQuery)) return true
  }
  return false
}
