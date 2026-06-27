import type { DeepSeekSettings, RiskLevel } from "../types";

export function shouldRequireToolApproval(riskLevel: RiskLevel, settings: DeepSeekSettings): boolean {
  return riskLevel > settings.autoApproveRisk;
}
