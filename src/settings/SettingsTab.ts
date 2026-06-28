import { App, PluginSettingTab, Setting } from "obsidian";
import type DeepSeekPlugin from "../main";
import { DEEPSEEK_MODELS, RiskLevel, type Language } from "../types";
import { translate } from "../i18n";

const RISK_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.READ_ONLY]: "READ_ONLY",
  [RiskLevel.EDIT_SAFE]: "EDIT_SAFE",
  [RiskLevel.EDIT_DANGER]: "EDIT_DANGER",
  [RiskLevel.EXTERNAL]: "EXTERNAL",
};

export class DeepSeekSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: DeepSeekPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const { containerEl } = this;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);
    containerEl.empty();

    new Setting(containerEl).setName(t("settings.apiKey")).setDesc(t("settings.apiKeyDesc")).addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.model")).setDesc(t("settings.modelDesc")).addDropdown((dropdown) => {
      for (const model of DEEPSEEK_MODELS) dropdown.addOption(model.id, model.label);
      dropdown.setValue(this.plugin.settings.model).onChange(async (value) => {
        this.plugin.settings.model = value as (typeof DEEPSEEK_MODELS)[number]["id"];
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.maxTokens")).setDesc(t("settings.maxTokensDesc")).addSlider((slider) => {
      slider.setLimits(1024, 64_000, 1024).setValue(this.plugin.settings.maxTokens).onChange(async (value) => {
        this.plugin.settings.maxTokens = value;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.temperature")).setDesc(t("settings.temperatureDesc")).addSlider((slider) => {
      slider.setLimits(0, 2, 0.05).setValue(this.plugin.settings.temperature).onChange(async (value) => {
        this.plugin.settings.temperature = value;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.language")).setDesc(t("settings.languageDesc")).addDropdown((dropdown) => {
      dropdown.addOption("zh-CN", "简体中文").addOption("en", "English");
      dropdown.setValue(this.plugin.settings.language).onChange(async (value) => {
        this.plugin.settings.language = value as Language;
        await this.plugin.saveSettings();
        this.renderSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.autoApproveRisk")).setDesc(t("settings.autoApproveRiskDesc")).addDropdown((dropdown) => {
      for (const risk of [RiskLevel.READ_ONLY, RiskLevel.EDIT_SAFE, RiskLevel.EDIT_DANGER, RiskLevel.EXTERNAL]) {
        dropdown.addOption(String(risk), RISK_LABELS[risk]);
      }
      dropdown.setValue(String(this.plugin.settings.autoApproveRisk)).onChange(async (value) => {
        this.plugin.settings.autoApproveRisk = Number(value) as RiskLevel;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.maxAgentLoops")).setDesc(t("settings.maxAgentLoopsDesc")).addSlider((slider) => {
      slider.setLimits(1, 40, 1).setValue(this.plugin.settings.maxAgentLoops).onChange(async (value) => {
        this.plugin.settings.maxAgentLoops = value;
        await this.plugin.saveSettings();
      });
    });
  }
}
