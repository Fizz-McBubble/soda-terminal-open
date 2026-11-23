export type CalculationProcessingDisclosure = {
  mode: 'local' | 'online'
  storage: string
  processing: string
  retention: string | null
  consentRequired: boolean
}

export const calculationProcessingDisclosures = {
  local: {
    mode: 'local',
    storage: '账户、资产、标记和已保存方案存于当前浏览器。',
    processing: '计算在本机完成，不上传账户或资产资料。',
    retention: null,
    consentRequired: false,
  },
  online: {
    mode: 'online',
    storage: '完整账户和方案仍保存在当前浏览器。',
    processing:
      '经你允许后，计算会发送必要的代理人培养、音擎和驱动盘数值，以及用于关联结果的本地账户标识和方案盘引用。昵称、游戏 UID、备注、扫描截图和完整备份不会发送。',
    retention: '任务与结果只在服务端短期内存中保留。',
    consentRequired: true,
  },
} as const satisfies Record<'local' | 'online', CalculationProcessingDisclosure>

export function getCalculationProcessingDisclosure(publicBuild: boolean) {
  return publicBuild
    ? calculationProcessingDisclosures.online
    : calculationProcessingDisclosures.local
}
