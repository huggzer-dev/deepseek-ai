import type { DeepSeekModelId, Effort } from "../types";

const MODEL_LABELS: Record<DeepSeekModelId, string> = {
  "deepseek-v4-flash": "V4 Flash",
  "deepseek-v4-pro": "V4 Pro",
};

const EFFORT_LABELS: Record<Effort, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

export const EFFORT_OPTIONS: Effort[] = ["low", "medium", "high"];

export function modelLabel(model: DeepSeekModelId): string {
  return MODEL_LABELS[model] ?? model;
}

export function effortLabel(effort: Effort): string {
  return EFFORT_LABELS[effort] ?? "High";
}

export function chatControlLabel(model: DeepSeekModelId, effort: Effort): string {
  return `${modelLabel(model)} · ${effortLabel(effort)}`;
}

export function nextEffort(effort: Effort): Effort {
  const i = EFFORT_OPTIONS.indexOf(effort);
  return EFFORT_OPTIONS[(i + 1) % EFFORT_OPTIONS.length] ?? "high";
}
