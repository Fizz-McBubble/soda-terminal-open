/**
 * The asset editor uses the accepted account progression rules directly. This module stays as the
 * asset-side entry name only: keeping a second copy of the M3/M5 bonus, the A-rank M6 baseline or
 * the skill cap is exactly how the two rules drift apart.
 */
export {
  applyMindscapeSkillLevelChange as applyPublicMindscapeSkillLevelChange,
  getAgentSkillMaxFor as getPublicAgentSkillMaxFor,
  getDefaultAgentSkillLevels as getPublicDefaultAgentSkillLevels,
} from '../accounts/agentProgressionRules'
