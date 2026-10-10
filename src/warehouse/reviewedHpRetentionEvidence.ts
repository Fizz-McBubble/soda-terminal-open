import { getCurrentAgentEventContract } from "../calculation/currentAgentMechanicContracts";
import { reviewedFunctionalStatInputsCommit } from "./reviewedFunctionalStatInputs";

/** Source facts justify a named secondary input, not a universal investment threshold or DPS. */
const hpEvidence = {
  "agent-zhao": {
    formulaSha256:
      "D371D769E3EFA7F079DE26EE86762F7001B1025655CAF767D596F79FEF434B15",
    localizationSha256:
      "422023A95ACBBDD953967757BFA0650061F89A0EBE15602CF959F88AE67F7734",
    guideId: "miyoushe-71895611",
    guideBodySha256:
      "22eed6cfa13cb785b411b376782b155783519cbd632c649477d94c8a4696fa3c",
    detail:
      "核对初始生命与队伍、帷幕条件；团队增伤在27000生命达到上限，战斗增益不计入。上限后治疗仍有收益。",
  },
  "agent-lucia": {
    formulaSha256:
      "BB1DEBD0A64DF8367D347CE0511907891B08A0E98FA025726C5D6D28BE94B555",
    localizationSha256:
      "28F2EEDF29329FD7D47C31B92880F782FF97B0D3F6AF6E0BFBDA330E2C4F1E3A",
    guideId: "miyoushe-69626706",
    guideBodySha256:
      "1b1adfacb2ca8726b97514eb8fec49d57b18608790d2f0ebdabe448cb881a969",
    detail:
      "特殊技12级、破暗生效时，初始生命24000达到900贯穿力上限；合唱与治疗仍有额外生命收益。",
  },
} as const;

export function reviewedHpRetentionEvidence(agentId: string) {
  const row = hpEvidence[agentId as keyof typeof hpEvidence];
  const contract = getCurrentAgentEventContract(agentId);
  if (
    !row ||
    contract?.source.commit !== reviewedFunctionalStatInputsCommit ||
    contract.source.formulaSha256 !== row.formulaSha256
  )
    return null;
  return {
    ...row,
    sourceIds: [
      `reviewed-hp-functional-investment-3.2-r1:${agentId}`,
      `reviewed-localization:${reviewedFunctionalStatInputsCommit}:${row.localizationSha256}`,
      `${row.guideId}:${row.guideBodySha256}`,
    ],
  };
}
