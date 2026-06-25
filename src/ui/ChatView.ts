import { ItemView, WorkspaceLeaf } from "obsidian";
import type DeepSeekPlugin from "../main";
import { ChatPanel } from "./ChatPanel";
import { translate } from "../i18n";

export const VIEW_TYPE_CHAT = "deepseek-ai-chat-view";

export class ChatView extends ItemView {
  private panel: ChatPanel;

  constructor(leaf: WorkspaceLeaf, private plugin: DeepSeekPlugin) {
    super(leaf);
    this.panel = new ChatPanel(this.app, this.containerEl, plugin);
  }

  getViewType(): string {
    return VIEW_TYPE_CHAT;
  }

  getDisplayText(): string {
    return translate(this.plugin.settings.language, "command.openChat");
  }

  getIcon(): string {
    return "sparkles";
  }

  async onOpen(): Promise<void> {
    this.panel.render();
  }

  async onClose(): Promise<void> {
    this.panel.destroy();
  }
}