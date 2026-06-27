import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type DeepSeekSettings } from "./types";
import { DeepSeekSettingsTab } from "./settings/SettingsTab";
import { ChatView, VIEW_TYPE_CHAT } from "./ui/ChatView";
import { translate } from "./i18n";
import { DeepSeekProvider } from "./llm/DeepSeekProvider";
import { SessionManager } from "./engine/SessionManager";
import { ContextBuilder } from "./engine/ContextBuilder";
import { AgentLoop } from "./engine/AgentLoop";
import { ConversationStore } from "./storage/ConversationStore";
import { ToolRegistry } from "./tools/ToolRegistry";
import { ReadFile } from "./tools/vault/ReadFile";
import { WriteFile } from "./tools/vault/WriteFile";
import { EditFile } from "./tools/vault/EditFile";
import { SearchVault } from "./tools/vault/SearchVault";
import { ListDir } from "./tools/vault/ListDir";
import { GetSelection } from "./tools/editor/GetSelection";
import { ReplaceSelection } from "./tools/editor/ReplaceSelection";
import { InsertAtCursor } from "./tools/editor/InsertAtCursor";
import { GetActiveNote } from "./tools/editor/GetActiveNote";
import { WebFetch } from "./tools/external/WebFetch";
import { InlineEditModal } from "./ui/InlineEditModal";
import { SkillLoader } from "./skills/SkillLoader";
import { MCPManager } from "./mcp/MCPManager";
import { logger } from "./utils/logger";

interface PluginData {
  settings?: Partial<DeepSeekSettings>;
  sessions?: unknown[];
}

export default class DeepSeekPlugin extends Plugin {
  settings: DeepSeekSettings = { ...DEFAULT_SETTINGS };
  provider!: DeepSeekProvider;
  sessions!: SessionManager;
  store!: ConversationStore;
  tools!: ToolRegistry;
  agent!: AgentLoop;
  contextBuilder!: ContextBuilder;
  skillLoader!: SkillLoader;
  mcpManager!: MCPManager;
  /** Set by ChatPanel to receive language-switch notifications. */
  _onLangChange: (() => void) | undefined;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.provider = new DeepSeekProvider(this.settings.apiKey);
    this.sessions = new SessionManager();
    this.store = new ConversationStore(this);

    // Tool registry — read-only + editor + dangerous writes + external
    this.tools = new ToolRegistry();
    this.tools.register(ReadFile);
    this.tools.register(WriteFile);
    this.tools.register(EditFile);
    this.tools.register(SearchVault);
    this.tools.register(ListDir);
    this.tools.register(GetSelection);
    this.tools.register(ReplaceSelection);
    this.tools.register(InsertAtCursor);
    this.tools.register(GetActiveNote);
    this.tools.register(WebFetch);

    this.contextBuilder = new ContextBuilder(this.settings, this.tools.all());
    this.agent = new AgentLoop(this.provider, this.contextBuilder, this.settings, this.tools, this.app);
    this.skillLoader = new SkillLoader(this.app);
    this.mcpManager = new MCPManager(this.tools);

    // Seed a couple of built-in skills if the skills dir is empty.
    await this.seedBuiltinSkills();

    const saved = await this.store.loadAll();
    if (saved.length) {
      for (const s of saved) this.sessions.restore(s);
    } else {
      this.sessions.create();
    }
    logger.info("loaded", saved.length, "sessions");

    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

    this.addRibbonIcon("sparkles", translate(this.settings.language, "command.openChat"), () => {
      void this.activateChatView();
    });

    this.addCommand({
      id: "open-chat",
      name: translate(this.settings.language, "command.openChat"),
      callback: () => void this.activateChatView(),
    });

    this.addCommand({
      id: "inline-edit",
      name: translate(this.settings.language, "command.inlineEdit"),
      editorCallback: (editor, ctx) => {
        new InlineEditModal(this.app, this, editor, ctx.file).open();
      },
    });

    this.addSettingTab(new DeepSeekSettingsTab(this.app, this));
  }

  onunload(): void {
    void this.store.saveAll(this.sessions.list()).catch((err: unknown) => {
      logger.warn("failed to persist sessions on unload", err);
    });
  }

  async activateChatView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0] ?? null;
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) {
        new Notice(translate(this.settings.language, "errors.cannotOpenView"));
        return;
      }
      await right.setViewState({ type: VIEW_TYPE_CHAT, active: true });
      leaf = right;
    }
    await workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    const data = ((await this.loadData()) as PluginData | null) ?? {};
    const merged = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
    // Clamp any persisted max_tokens that was set by an older version
    // when the upper limit was 1,000,000 (DeepSeek now caps at 393,216).
    if (merged.maxTokens > 393216) merged.maxTokens = 393216;
    if (merged.maxTokens < 1) merged.maxTokens = 1;
    this.settings = merged;
  }

  async saveSettings(): Promise<void> {
    const prevLang = this.settings.language;
    const data = ((await this.loadData()) as PluginData | null) ?? {};
    data.settings = this.settings;
    await this.saveData(data);
    this.provider?.setApiKey(this.settings.apiKey);
    if (this.settings.language !== prevLang) {
      this._onLangChange?.();
    }
  }

  /** One-time seed of built-in Skill templates if the user has none yet. */
  private async seedBuiltinSkills(): Promise<void> {
    const existing = await this.skillLoader.list();
    if (existing.length) return;
    const builtin = [
      { name: "summarize", body: summarizeSkill() },
      { name: "translate", body: translateSkill() },
      { name: "outline",   body: outlineSkill()   },
      { name: "brainstorm", body: brainstormSkill() },
      { name: "review",    body: reviewSkill()    },
    ];
    for (const s of builtin) {
      try {
        await this.skillLoader.save(s.name, s.body);
      } catch (err: unknown) {
        logger.warn("failed to seed skill", s.name, err);
      }
    }
  }
}

function summarizeSkill(): string {
  return "Summarize the note concisely in 5 bullet points, focusing on the key ideas.";
}
function translateSkill(): string {
  return "Translate the selection to English, preserving markdown formatting and inline code.";
}
function outlineSkill(): string {
  return "Generate a hierarchical outline of the note using H1/H2/H3 markdown headings.";
}
function brainstormSkill(): string {
  return "Brainstorm 10 follow-up ideas related to the note; each idea one short line.";
}
function reviewSkill(): string {
  return "Review the note for clarity, structure and gaps. List issues + suggested fixes.";
}
