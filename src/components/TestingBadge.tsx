import { ExplanationPopover } from "./ExplanationPopover";
import "./TestingBadge.css";

const testingScopes = {
  box: {
    label: "说明",
    triggerAriaLabel: "队伍建议使用说明",
    title: "队伍建议使用说明",
    tone: "help",
    scope:
      "用已拥有的代理人找队伍。在同核心队伍卡右侧换人，可查看对应的评级、邦布和手法。",
    usage:
      "选「搭配装备」后，用仓库里的驱动盘比较三人的实装、建议配装和毕业目标。",
  },
  discs: {
    label: "说明",
    triggerAriaLabel: "驱动盘建议使用说明",
    title: "驱动盘建议使用说明",
    tone: "help",
    scope: "分析 S 级驱动盘的套装、位置和词条，查看适用角色与保留建议。",
    usage:
      "在盘的详情中查看装备者和关联方案。要判断换装收益，可前往代理人养成或队伍配装比较面板。",
  },
  quickRead: {
    label: "测试版",
    triggerAriaLabel: "资产快读测试版说明",
    title: "资产快读测试版说明",
    tone: "test",
    scope:
      "每次读取都会列出可导入的资产。先核对目标账户、资产范围和数量，再确认导入。",
    usage:
      "重开暂存结果会恢复当时的导入范围。旧结果若缺少范围记录，可找回原始结果，重新读取后再导入。",
  },
} as const;

export function TestingBadge({ scope }: { scope: keyof typeof testingScopes }) {
  const content = testingScopes[scope];
  return (
    <ExplanationPopover
      label={content.label}
      triggerAriaLabel={content.triggerAriaLabel}
      title={content.title}
      className={`testing-badge testing-badge--${content.tone}`}
      showIndicator={false}
    >
      <p>{content.scope}</p>
      <p>{content.usage}</p>
    </ExplanationPopover>
  );
}
