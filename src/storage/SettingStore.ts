import type DeepSeekPlugin from "../main";
import type { DeepSeekSettings } from "../types";

/** Thin wrapper around Plugin.loadData/saveData for the settings object. */
export class SettingStore {
  constructor(private plugin: DeepSeekPlugin) {}

  async load(): Promise<DeepSeekSettings> {
    return { ...(this.plugin.settings), ...((await this.plugin.loadData()) as DeepSeekSettings) };
  }

  async save(settings: DeepSeekSettings): Promise<void> {
    this.plugin.settings = settings;
    await this.plugin.saveData(settings);
  }
}