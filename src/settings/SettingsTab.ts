import { App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type DeepSeekPlugin from "../main";
import { DEEPSEEK_MODELS, RiskLevel, type DeepSeekModelId, type DeepSeekSettings, type Language } from "../types";
import { translate } from "../i18n";

const RISK_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.READ_ONLY]: "READ_ONLY",
  [RiskLevel.EDIT_SAFE]: "EDIT_SAFE",
  [RiskLevel.EDIT_DANGER]: "EDIT_DANGER",
  [RiskLevel.EXTERNAL]: "EXTERNAL",
};

type SettingKey = keyof Pick<
  DeepSeekSettings,
  "apiKey" | "model" | "maxTokens" | "temperature" | "language" | "autoApproveRisk" | "maxAgentLoops"
>;

export class DeepSeekSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: DeepSeekPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);
    return [
      {
        name: t("settings.apiKey"),
        desc: t("settings.apiKeyDesc"),
        control: { type: "text", key: "apiKey", placeholder: "sk-..." },
      },
      {
        name: t("settings.model"),
        desc: t("settings.modelDesc"),
        control: { type: "dropdown", key: "model", options: modelOptions() },
      },
      {
        name: t("settings.maxTokens"),
        desc: t("settings.maxTokensDesc"),
        control: { type: "slider", key: "maxTokens", min: 1024, max: 64_000, step: 1024 },
      },
      {
        name: t("settings.temperature"),
        desc: t("settings.temperatureDesc"),
        control: { type: "slider", key: "temperature", min: 0, max: 2, step: 0.05 },
      },
      {
        name: t("settings.language"),
        desc: t("settings.languageDesc"),
        control: { type: "dropdown", key: "language", options: { "zh-CN": "简体中文", en: "English" } },
      },
      {
        name: t("settings.autoApproveRisk"),
        desc: t("settings.autoApproveRiskDesc"),
        control: { type: "dropdown", key: "autoApproveRisk", options: riskOptions() },
      },
      {
        name: t("settings.maxAgentLoops"),
        desc: t("settings.maxAgentLoopsDesc"),
        control: { type: "slider", key: "maxAgentLoops", min: 1, max: 40, step: 1 },
      },
    ];
  }

  getControlValue(key: SettingKey): unknown {
    if (key === "autoApproveRisk") return String(this.plugin.settings.autoApproveRisk);
    return this.plugin.settings[key];
  }

  async setControlValue(key: SettingKey, value: unknown): Promise<void> {
    switch (key) {
      case "apiKey":
        this.plugin.settings.apiKey = String(value).trim();
        break;
      case "model":
        this.plugin.settings.model = value as DeepSeekModelId;
        break;
      case "maxTokens":
        this.plugin.settings.maxTokens = Number(value);
        break;
      case "temperature":
        this.plugin.settings.temperature = Number(value);
        break;
      case "language":
        this.plugin.settings.language = value as Language;
        break;
      case "autoApproveRisk":
        this.plugin.settings.autoApproveRisk = Number(value) as RiskLevel;
        break;
      case "maxAgentLoops":
        this.plugin.settings.maxAgentLoops = Number(value);
        break;
    }
    await this.plugin.saveSettings();
    if (key === "language") this.update();
  }
}

function modelOptions(): Record<string, string> {
  return Object.fromEntries(DEEPSEEK_MODELS.map((model) => [model.id, model.label]));
}

function riskOptions(): Record<string, string> {
  return Object.fromEntries(
    [RiskLevel.READ_ONLY, RiskLevel.EDIT_SAFE, RiskLevel.EDIT_DANGER, RiskLevel.EXTERNAL].map((risk) => [String(risk), RISK_LABELS[risk]]),
  );
}
