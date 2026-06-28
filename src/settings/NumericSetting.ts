export interface NumericSettingSpec {
  min: number;
  max: number;
  step: number;
  recommended: number;
  precision?: number;
  unit?: string;
}

export const NUMERIC_SETTING_SPECS = {
  maxTokens: { min: 1024, max: 64_000, step: 1024, recommended: 8192, unit: "tokens" },
  temperature: { min: 0, max: 2, step: 0.05, recommended: 0.7, precision: 2 },
  maxAgentLoops: { min: 1, max: 40, step: 1, recommended: 12, unit: "loops" },
} as const satisfies Record<string, NumericSettingSpec>;

export function normalizeNumericSetting(raw: string | number, spec: NumericSettingSpec): number {
  const parsed = typeof raw === "number" ? raw : Number(raw.trim());
  if (!Number.isFinite(parsed)) return spec.recommended;
  const clamped = Math.min(spec.max, Math.max(spec.min, parsed));
  const stepped = Math.round((clamped - spec.min) / spec.step) * spec.step + spec.min;
  return formatNumber(Math.min(spec.max, Math.max(spec.min, stepped)), spec);
}

export function formatNumericSetting(value: number, spec: NumericSettingSpec): string {
  const normalized = formatNumber(value, spec);
  return spec.precision === undefined ? String(normalized) : normalized.toFixed(spec.precision).replace(/0+$/, "").replace(/\.$/, "");
}

export function recommendedNumericText(spec: NumericSettingSpec): string {
  const value = formatNumericSetting(spec.recommended, spec);
  return spec.unit ? `Recommended: ${value} ${spec.unit}` : `Recommended: ${value}`;
}

function formatNumber(value: number, spec: NumericSettingSpec): number {
  const precision = spec.precision ?? decimalPlaces(spec.step);
  return Number(value.toFixed(precision));
}

function decimalPlaces(value: number): number {
  const text = String(value);
  return text.includes(".") ? text.split(".")[1]?.length ?? 0 : 0;
}
