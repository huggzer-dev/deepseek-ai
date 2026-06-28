import { App, TFile, Notice } from "obsidian";
import type DeepSeekPlugin from "../main";
import { translate } from "../i18n";
import { MentionSuggest } from "./MentionSuggest";
import { formatUploadedFileContext, isTextUpload, MAX_TEXT_UPLOAD_BYTES, type UploadedTextFile } from "./UploadAttachment";

export interface ParsedInput {
  text: string;
  mentions: TFile[];
  instruction?: string;
  skillBody?: string;
  /** base64 data-URL images attached via drag / paste. */
  images: string[];
  /** Local text files attached through the folder button. */
  uploadedFiles: UploadedTextFile[];
}

/** Bottom input bar: textarea + send/stop button, parses @[[path]] mentions, $ skills,
 *  # instructions, and image attachments (drag/paste). */
export class InputBar {
  private textarea!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private attachmentBar!: HTMLElement;
  private mention: MentionSuggest;
  private sending = false;
  /** base64 data-URLs of attached images. */
  private attachedImages: string[] = [];
  private uploadedTextFiles: UploadedTextFile[] = [];

  constructor(
    private app: App,
    parent: HTMLElement,
    private plugin: DeepSeekPlugin,
    private onSend: (parsed: ParsedInput) => void,
    private onInputChange?: (text: string) => void,
  ) {
    parent.createDiv({ cls: "dsai-input-bar" }, (bar) => {
      this.attachmentBar = bar.createDiv({ cls: "dsai-attachments" });

      this.textarea = bar.createEl("textarea", {
        attr: { rows: "2", placeholder: translate(this.plugin.settings.language, "chat.placeholder") },
        cls: "dsai-textarea",
      });
      this.textarea.addEventListener("input", () => {
        this.onInput();
        this.onInputChange?.(this.textarea.value);
      });
      this.textarea.addEventListener("keydown", (e) => this.onKey(e));
      // Drag-drop for images
      this.textarea.addEventListener("dragover", (e) => { e.preventDefault(); });
      bar.addEventListener("drop", (e) => { e.preventDefault(); void this.handleImageDrop(e); });

      this.sendBtn = bar.createEl("button", {
        text: translate(this.plugin.settings.language, "chat.send"),
        cls: "dsai-send-btn",
      });
      this.sendBtn.addEventListener("click", () => this.trigger());
    });
    // Global paste listener for images pasted from clipboard
    this.textarea.addEventListener("paste", (e) => { void this.handleImagePaste(e); });
    this.mention = new MentionSuggest(this.app, this.textarea, (file) => this.insertMention(file));
  }

  value(): string {
    return this.textarea.value;
  }

  clear(): void {
    this.textarea.value = "";
    this.autosize();
    this.clearAttachments();
  }

  private clearAttachments(): void {
    this.attachedImages = [];
    this.uploadedTextFiles = [];
    this.attachmentBar.empty();
  }

  /** For the text-only user content we pass to the agent. */
  images(): string[] {
    return this.attachedImages;
  }

  openFilePicker(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.ts,.tsx,.log";
    input.addEventListener("change", () => {
      void this.addPickedFiles(Array.from(input.files ?? []));
      input.remove();
    });
    input.click();
  }

  setSending(isSending: boolean): void {
    this.sending = isSending;
    const t = (k: Parameters<typeof translate>[1]) => translate(this.plugin.settings.language, k);
    this.sendBtn.textContent = isSending ? t("chat.stop") : t("chat.send");
    this.sendBtn.classList.toggle("is-stop", isSending);
  }

  destroy(): void {
    this.mention.close();
    this.textarea.remove();
    this.sendBtn.remove();
  }

  // --- parsing ------------------------------------------------------------

  async parse(raw: string): Promise<ParsedInput> {
    const mentions: TFile[] = [];
    const re = /@\[\[([^]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const path = m[1].trim();
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) mentions.push(file);
    }

    // `# instruction` → strip line, keep as instruction metadata
    const instrMatch = raw.match(/^\s*#\s+(.+?)$/m);
    const instruction = instrMatch?.[1]?.trim();
    const cleaned1 = instrMatch ? raw.replace(/^\s*#\s+.+$/m, "").trim() : raw;

    // `$skill-name` → load body from `.deepseek/skills/<name>.md`
    const skillMatch = cleaned1.match(/^\s*\$\s+([^\s]+).*$/m);
    let skillBody: string | undefined;
    if (skillMatch?.[1]) {
      skillBody = await this.plugin.skillLoader.get(skillMatch[1]).then((s) => s?.body);
    }
    const text = cleaned1.replace(/^\s*\$\s+[^\s]+.*$/m, "").trim();

    // for display in the message (LLM context), strip mention tags but keep path
    return {
      text,
      mentions,
      instruction,
      skillBody,
      images: [...this.attachedImages],
      uploadedFiles: [...this.uploadedTextFiles],
    };
  }

  focus(): void {
    this.textarea.focus();
  }

  // --- internals ----------------------------------------------------------

  private onInput(): void {
    this.autosize();
    const after = this.textarea.value.slice(this.textarea.selectionStart);
    // trigger suggestion only when the char just typed started an unfinished @[[ …
    const before = this.textarea.value.slice(0, this.textarea.selectionStart);
    const startMatch = before.match(/@\[\[([^][]*)$/);
    if (startMatch && !after.startsWith("]]")) {
      this.mention.open(startMatch[1]);
    } else {
      this.mention.close();
    }
  }

  private insertMention(file: TFile): void {
    const before = this.textarea.value.slice(0, this.textarea.selectionStart);
    const after = this.textarea.value.slice(this.textarea.selectionStart);
    const cutAt = before.lastIndexOf("@[[");
    const head = cutAt >= 0 ? before.slice(0, cutAt) : before;
    const inserted = `@[[${file.path}]]`;
    this.textarea.value = head + inserted + after;
    const pos = (head + inserted).length;
    this.textarea.setSelectionRange(pos, pos);
    this.autosize();
    this.mention.close();
    this.focus();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.trigger();
    }
  }

  private trigger(): void {
    if (this.sending) {
      this.abortController?.abort();
      return;
    }
    const raw = this.textarea.value.trim();
    if (!raw && this.attachedImages.length === 0 && this.uploadedTextFiles.length === 0) return;
    void this.parse(raw).then((p) => this.onSend(p));
  }

  private abortController: AbortController | undefined;
  setAbortController(ac: AbortController): void {
    this.abortController = ac;
  }

  private autosize(): void {
    this.textarea.setCssProps({ height: "auto" });
    this.textarea.setCssProps({ height: `${Math.min(this.textarea.scrollHeight, 160)}px` });
  }

  // --- image attachment ------------------------------------------------

  private async handleImageDrop(e: DragEvent): Promise<void> {
    const files = Array.from(e.dataTransfer?.files ?? []);
    for (const f of files) {
      if (f.type.startsWith("image/")) await this.addImageFile(f);
    }
  }

  private async handleImagePaste(e: ClipboardEvent): Promise<void> {
    const items = Array.from(e.clipboardData?.items ?? []);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) await this.addImageFile(file);
      }
    }
  }

  private async addPickedFiles(files: File[]): Promise<void> {
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        await this.addImageFile(file);
      } else {
        await this.addTextFile(file);
      }
    }
  }

  private async addImageFile(file: File): Promise<void> {
    if (file.size > 10 * 1024 * 1024) {
      new Notice(translate(this.plugin.settings.language, "image.tooLarge"));
      return;
    }
    const b64 = await this.fileToBase64(file);
    this.attachedImages.push(b64);
    this.renderAttachmentThumb(b64, file.name ?? "image");
  }

  private async addTextFile(file: File): Promise<void> {
    if (!isTextUpload(file)) {
      new Notice(this.plugin.settings.language === "zh-CN" ? "暂不支持该文件类型" : "This file type is not supported yet");
      return;
    }
    if (file.size > MAX_TEXT_UPLOAD_BYTES) {
      new Notice(this.plugin.settings.language === "zh-CN" ? "文件太大（最大 1MB）" : "File too large (max 1MB)");
      return;
    }
    const uploaded = { name: file.name, text: await file.text() };
    this.uploadedTextFiles.push(uploaded);
    this.renderTextAttachmentChip(uploaded);
  }

  private renderAttachmentThumb(b64: string, name: string): void {
    const chip = this.attachmentBar.createDiv({ cls: "dsai-attachment" });
    chip.createEl("img", { attr: { src: b64, width: "48", height: "48" } });
    chip.createEl("span", { cls: "dsai-attachment__name", text: name });
    const removeBtn = chip.createEl("span", { cls: "dsai-attachment__remove", text: "×" });
    removeBtn.addEventListener("click", () => {
      this.attachedImages = this.attachedImages.filter((img) => img !== b64);
      chip.remove();
    });
  }

  private renderTextAttachmentChip(uploaded: UploadedTextFile): void {
    const chip = this.attachmentBar.createDiv({ cls: "dsai-attachment" });
    chip.createEl("span", { cls: "dsai-attachment__file", text: "📄" });
    chip.createEl("span", { cls: "dsai-attachment__name", text: uploaded.name });
    const removeBtn = chip.createEl("span", { cls: "dsai-attachment__remove", text: "×" });
    removeBtn.addEventListener("click", () => {
      this.uploadedTextFiles = this.uploadedTextFiles.filter((file) => file !== uploaded);
      chip.remove();
    });
  }

  uploadedFileContext(): string[] {
    return this.uploadedTextFiles.map(formatUploadedFileContext);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => {
        const error = reader.error instanceof Error ? reader.error : new Error("Failed to read image file");
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  }
}
