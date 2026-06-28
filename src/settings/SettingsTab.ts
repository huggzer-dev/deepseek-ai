import { App, PluginSettingTab, Setting } from "obsidian";
import type DeepSeekPlugin from "../main";
import { DEEPSEEK_MODELS } from "../types";
import { RiskLevel, type Language } from "../types";
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
    const { containerEl } = this;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);
    containerEl.empty();

    new Setting(containerEl).setName(t("settings.apiKey")).setDesc(t("settings.apiKeyDesc")).addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (v) => {
        this.plugin.settings.apiKey = v.trim();
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.model")).setDesc(t("settings.modelDesc")).addDropdown((dd) => {
      for (const m of DEEPSEEK_MODELS) dd.addOption(m.id, m.label);
      dd.setValue(this.plugin.settings.model).onChange(async (v) => {
        this.plugin.settings.model = v as (typeof DEEPSEEK_MODELS)[number]["id"];
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.maxTokens")).setDesc(t("settings.maxTokensDesc")).addSlider((s) => {
      s.setLimits(1024, 64_000, 1024).setValue(this.plugin.settings.maxTokens).onChange(async (v) => {
        this.plugin.settings.maxTokens = v;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.temperature")).setDesc(t("settings.temperatureDesc")).addSlider((s) => {
      s.setLimits(0, 2, 0.05).setValue(this.plugin.settings.temperature).onChange(async (v) => {
        this.plugin.settings.temperature = v;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.language")).setDesc(t("settings.languageDesc")).addDropdown((dd) => {
      dd.addOption("zh-CN", "简体中文").addOption("en", "English");
      dd.setValue(this.plugin.settings.language).onChange(async (v) => {
        this.plugin.settings.language = v as Language;
        await this.plugin.saveSettings();
        this.display();
      });
    });

    new Setting(containerEl).setName(t("settings.autoApproveRisk")).setDesc(t("settings.autoApproveRiskDesc")).addDropdown((dd) => {
      for (const r of [RiskLevel.READ_ONLY, RiskLevel.EDIT_SAFE, RiskLevel.EDIT_DANGER, RiskLevel.EXTERNAL]) {
        dd.addOption(String(r), RISK_LABELS[r]);
      }
      dd.setValue(String(this.plugin.settings.autoApproveRisk)).onChange(async (v) => {
        this.plugin.settings.autoApproveRisk = Number(v) as RiskLevel;
        await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName(t("settings.maxAgentLoops")).setDesc(t("settings.maxAgentLoopsDesc")).addSlider((s) => {
      s.setLimits(1, 40, 1).setValue(this.plugin.settings.maxAgentLoops).onChange(async (v) => {
        this.plugin.settings.maxAgentLoops = v;
        await this.plugin.saveSettings();
      });
    });
  }
}
