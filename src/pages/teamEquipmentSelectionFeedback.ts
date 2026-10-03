/** Preserve the existing private workspace confirmation feedback. */
export function teamEquipmentSelectionErrorMessage(error: unknown) {
  return error instanceof Error && error.message === '这只邦布暂不能用于当前队伍，请重新选择。'
    ? '所选邦布或星级不满足队伍条件，已保留原方案。'
    : '方案参数未应用，请重试。'
}
