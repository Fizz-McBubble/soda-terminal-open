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

export function playerDecisionText(value: string) {
  if (value.includes('该精确三人命中') && value.includes('邦布独立评价'))
    return '评级基于这三名代理人的搭配；更换邦布不会改变评级。'
  if (value.includes('精确三人已有多源粗档')) {
    if (value.includes('缺少邦布')) return '成员搭配已有资料支持；尚未确认邦布。'
    if (value.includes('未通过独立适配')) return '成员搭配已有资料支持；该邦布的适配仍待验证。'
    return '成员与邦布搭配已有资料支持；同档队伍不区分先后。'
  }
  if (value.includes('Band/Partial Order')) return '这组成员已有参考资料，具体强度尚未验证。'
  return value
    .replace(
      /Team Rating ([SAB+]+|Experimental) \/ (high|medium|low|experimental)/g,
      (_, band, confidence) =>
        band === 'Experimental' || confidence === 'experimental'
          ? '暂时无法判断这队强弱'
          : `评级 ${band} 档${confidence === 'high' ? '' : confidence === 'medium' ? '，部分表现仍需验证' : '，可参考的资料较少，仅供参考'}`,
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
    .replace(/unknown/g, '资料不足')
    .replace(/weak/g, '弱队')
}
