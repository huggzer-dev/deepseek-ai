import { App, Notice, TFile, TFolder } from "obsidian";
import { logger } from "../utils/logger";

export interface Skill {
  name: string;
  body: string;
  path: string;
}

const SKILL_DIR = ".deepseek/skills";

/** Loads Skill templates from `.deepseek/skills/*.md` inside the vault. */
export class SkillLoader {
  constructor(private app: App) {}

  async list(): Promise<Skill[]> {
    const folder = this.app.vault.getAbstractFileByPath(SKILL_DIR);
    if (!(folder instanceof TFolder)) {
      logger.debug("skill dir absent", SKILL_DIR);
      return [];
    }
    const files = folder.children.filter((c) => c instanceof TFile && c.path.endsWith(".md")) as TFile[];
    const out: Skill[] = [];
    for (const f of files) {
      out.push({
        name: f.basename,
        body: await this.app.vault.read(f),
        path: f.path,
      });
    }
    return out;
  }

  async save(name: string, body: string): Promise<TFile> {
    const folder = this.app.vault.getAbstractFileByPath(SKILL_DIR);
    if (!(folder instanceof TFolder)) {
      await this.app.vault.createFolder(SKILL_DIR);
    }
    const path = `${SKILL_DIR}/${name}.md`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, body);
      return existing;
    }
    const created = await this.app.vault.create(path, body);
    new Notice(`Skill saved: ${name}`);
    return created;
  }

  async get(name: string): Promise<Skill | undefined> {
    const all = await this.list();
    return all.find((s) => s.name === name);
  }
}

export { SKILL_DIR };