const playerLabels = {
  ready_now: '现在可用',
  short_upgrade: '短期补强',
  strategic_build: '中期培养',
  experimental: '还需验证',
  ready: '可以使用',
  near_ready: '稍作调整即可使用',
  development: '仍需培养',
  blocked: '还缺必要条件',
  low: '低',
  medium: '中',
  high: '高',
  unknown: '待确认',
  none: '无',
  resolvable: '需要换装',
  blocking: '装备无法同时配齐',
  transformative: '关键补位',
  new_required_team: '补齐必需队伍',
  new_scenario: '新增适用场景',
  redundancy: '与现有队伍用途相近',
  mechanic_synergy: '队员配合',
  cycle_stability: '技能衔接',
  output_potential: '输出潜力',
  field_time_efficiency: '站场安排',
  team_effect_quality: '队友加成',
  flexibility_robustness: '应对不同战斗',
  evidence_confidence: '判断把握',
  excellent: '优秀',
  good: '良好',
  mixed: '有取舍',
  weak: '偏弱',
} as const

export function playerDecisionLabel(value: string) {
  return playerLabels[value as keyof typeof playerLabels] ?? '待确认'
}

export function playerSourceDirectionLabel(version: string | null | undefined) {
  return version?.trim() ? `版本 ${version.trim()}` : '版本未标注'
}

export function playerDecisionText(value: string) {
  if (value === '异常角色较少时，可在3.1自选简作为主输出。')
    return '异常角色较少时，可选择简作为主输出。'
  if (value.includes('该精确三人命中') && value.includes('邦布独立评价'))
    return '评级基于这三名代理人的搭配；更换邦布不会改变评级。'
  if (value.includes('精确三人已有多源粗档')) {
    if (value.includes('缺少邦布')) return '这组成员可尝试；邦布仍待确认。'
    if (value.includes('未通过独立适配')) return '这组成员可尝试；邦布适配仍待确认。'
    return '这组成员和邦布可尝试；暂不能与其他队伍直接比较。'
  }
  if (value.includes('Band/Partial Order'))
    return '这组成员可以尝试，目前还不能与其他队伍直接比较。'
  return value
    .replaceAll(
      '该精确三人只确认当前来源收录与条件，不据此输出强度档位',
      '按所列条件可尝试，暂不判断强弱',
    )
    .replaceAll('缺口保持结构化，不补默认值', '缺项单列；未记录条件不按已满足处理')
    .replaceAll('把已核对的增益交给', '把增益交给')
    .replaceAll('并以来源动作积累失衡，交接输出窗口', '积累失衡后交接输出窗口')
    .replace(
      /Team Rating ([SAB+]+|Experimental) \/ (high|medium|low|experimental)/g,
      (_, band, confidence) =>
        band === 'Experimental' || confidence === 'experimental'
          ? '暂时无法判断这队强弱'
          : `评级 ${band} 档`,
    )
    .replace(
      /账户完成度 (ready|near_ready|development|blocked)，投入 (low|medium|high|unknown)/g,
      (_, readiness, cost) =>
        `按当前养成情况：${playerDecisionLabel(readiness)}；后续培养投入${cost === 'unknown' ? '待确认' : `${playerDecisionLabel(cost) === '低' ? '较少' : playerDecisionLabel(cost) === '高' ? '较多' : '适中'}`}`,
    )
    .replace(
      /覆盖增益 (new_required_team|new_scenario|redundancy|none|unknown)，边际收益 (transformative|high|medium|low|unknown)/g,
      (_, coverage, gain) =>
        `${coverage === 'none' ? '没有新增适用场景' : playerDecisionLabel(coverage)}；${gain === 'unknown' ? '是否值得培养还需确认' : gain === 'transformative' ? '能补上现有阵容的关键缺口' : `对现有阵容的帮助${gain === 'high' ? '较大' : gain === 'medium' ? '适中' : '较小'}`}`,
    )
    .replace(/实体资产冲突 (none|resolvable|blocking)/g, (_, conflict) =>
      conflict === 'none'
        ? '与其他队伍没有装备冲突'
        : conflict === 'resolvable'
          ? '需要与其他队伍换装后使用'
          : '与其他队伍争用装备，暂时无法同时配齐',
    )
    .replace(
      /替换既有养成\/配装的成本 (low|medium|high|unknown)/g,
      (_, cost) =>
        `改用这套培养与配装建议，${cost === 'unknown' ? '需要多少调整还不确定' : `需要的调整${cost === 'low' ? '较少' : cost === 'high' ? '较多' : '适中'}`}`,
    )
    .replace(
      /^(mechanic_synergy|cycle_stability|output_potential|field_time_efficiency|team_effect_quality|flexibility_robustness|evidence_confidence):/,
      (_, dimension) => `${playerDecisionLabel(dimension)}：`,
    )
    .replace(/\s*hard prune/g, '排除这套搭配')
    .replace(/\s*mechanic-critical/g, '关键机制')
    .replace(/\s*Team Rating/g, '队伍评级')
    .replace(/\s*Output Potential\s*/g, '输出潜力')
    .replace(/\s*baseline/g, '基准条件')
    .replace(/\s*categorical/g, '分档')
    .replace(/\b(Confidence|confidence)\b/g, '判断把握')
    .replaceAll('证据置信度', '判断把握')
    .replace(/\bband\b/g, '档位')
    .replace(/Reality Check/g, '多方资料核对')
    .replace(/Team Strength/g, '队伍强度')
    .replace(/Bangboo Variant|Variant/g, '邦布搭配')
    .replaceAll(
      '优先推荐有搭配资料支持的队伍，选定后可继续搭配装备。',
      '先看符合当前成员条件、可以尝试的队伍；选定后继续核对装备。',
    )
    .replaceAll('精确攻略与具名机制', '成员机制与当前场景')
    .replaceAll('精确攻略', '成员机制与当前场景')
    .replaceAll('攻略优先推荐', '优先尝试')
    .replaceAll('攻略替代关系', '可替补关系')
    .replaceAll('既有攻略记录', '较早版本的搭配方向')
    .replaceAll('攻略软参考', '可尝试方向')
    .replaceAll('来源方向', '搭配方向')
    .replaceAll('来源收录只说明搭配有据', '列出的队伍具备可尝试的成员条件')
    .replaceAll('需要满足来源的配装条件', '需要满足这套搭配的配装条件')
    .replace(/攻略的(.+?)参考/g, '建议$1目标')
    .replace(/攻略将(.+?)列为缺少(.+?)时的过渡选择/g, '缺少$2时，可尝试$1作为过渡选择')
    .replace(/攻略将(.+?)列为(.+?)(?=[。；;]|$)/g, '可尝试$1作为$2')
    .replaceAll('是原文明确的A级替代', '是可尝试的A级替代')
    .replaceAll('原文明确的稳定A级替代', '稳定A级替代')
    .replaceAll('原文明确为稳定A级替代', '稳定A级替代')
    .replace(/unknown/g, '未知')
    .replace(/weak/g, '弱队')
    .replace(
      /采用同一具名\s*基准条件\s*下的宽输出潜力档位/g,
      '按相同参考配置分档，不能直接换算实战伤害',
    )
    .replace(/([：:])\s+/gu, '$1')
    .replace(/\s+([，；。])/gu, '$1')
}
