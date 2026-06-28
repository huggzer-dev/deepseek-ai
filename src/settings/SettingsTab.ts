import { App, PluginSettingTab, Setting, type SliderComponent, type TextComponent } from "obsidian";
import type DeepSeekPlugin from "../main";
import { DEEPSEEK_MODELS, RiskLevel, type Language } from "../types";
import { translate } from "../i18n";
import { formatNumericSetting, normalizeNumericSetting, NUMERIC_SETTING_SPECS, recommendedNumericText, type NumericSettingSpec } from "./NumericSetting";

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

    this.addNumericSetting(containerEl, t("settings.maxTokens"), t("settings.maxTokensDesc"), this.plugin.settings.maxTokens, NUMERIC_SETTING_SPECS.maxTokens, async (value) => {
      this.plugin.settings.maxTokens = value;
      await this.plugin.saveSettings();
    });

    this.addNumericSetting(containerEl, t("settings.temperature"), t("settings.temperatureDesc"), this.plugin.settings.temperature, NUMERIC_SETTING_SPECS.temperature, async (value) => {
      this.plugin.settings.temperature = value;
      await this.plugin.saveSettings();
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

    this.addNumericSetting(containerEl, t("settings.maxAgentLoops"), t("settings.maxAgentLoopsDesc"), this.plugin.settings.maxAgentLoops, NUMERIC_SETTING_SPECS.maxAgentLoops, async (value) => {
      this.plugin.settings.maxAgentLoops = value;
      await this.plugin.saveSettings();
    });
  }

  private addNumericSetting(
    containerEl: HTMLElement,
    name: string,
    description: string,
    value: number,
    spec: NumericSettingSpec,
    saveValue: (value: number) => Promise<void>,
  ): void {
    let sliderComponent: SliderComponent;
    let textComponent: TextComponent;
    let currentValue = normalizeNumericSetting(value, spec);

    const setting = new Setting(containerEl).setName(name).setDesc(`${description} · ${recommendedNumericText(spec)}`);
    setting.controlEl.addClass("deepseek-setting-number-control");

    const persist = async (nextValue: number): Promise<void> => {
      currentValue = normalizeNumericSetting(nextValue, spec);
      sliderComponent.setValue(currentValue);
      textComponent.setValue(formatNumericSetting(currentValue, spec));
      await saveValue(currentValue);
    };

    setting.addText((text) => {
      textComponent = text;
      text.inputEl.type = "number";
      text.inputEl.addClass("deepseek-setting-number-input");
      text.inputEl.min = String(spec.min);
      text.inputEl.max = String(spec.max);
      text.inputEl.step = String(spec.step);
      text.setPlaceholder(formatNumericSetting(spec.recommended, spec));
      text.setValue(formatNumericSetting(currentValue, spec));
      text.inputEl.addEventListener("blur", () => {
        void persist(Number(text.inputEl.value));
      });
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          text.inputEl.blur();
        }
      });
    });

    setting.addSlider((slider) => {
      sliderComponent = slider;
      slider
        .setLimits(spec.min, spec.max, spec.step)
        .setInstant(true)
        .setValue(currentValue)
        .onChange((nextValue) => {
          currentValue = normalizeNumericSetting(nextValue, spec);
          textComponent.setValue(formatNumericSetting(currentValue, spec));
          void saveValue(currentValue);
        });
    });
  }
}
