import type { Language } from "../types";

export type TranslationKey =
  | "settings.apiKey"
  | "settings.apiKeyDesc"
  | "settings.model"
  | "settings.modelDesc"
  | "settings.maxTokens"
  | "settings.maxTokensDesc"
  | "settings.temperature"
  | "settings.temperatureDesc"
  | "settings.language"
  | "settings.languageDesc"
  | "settings.autoApproveRisk"
  | "settings.autoApproveRiskDesc"
  | "settings.maxAgentLoops"
  | "settings.maxAgentLoopsDesc"
  | "chat.placeholder"
  | "chat.send"
  | "chat.stop"
  | "chat.reset"
  | "chat.retry"
  | "chat.empty"
  | "chat.stopped"
  | "chat.error"
  | "mention.placeholder"
  | "mention.noFiles"
  | "inline.title"
  | "inline.promptPlaceholder"
  | "inline.apply"
  | "inline.cancel"
  | "inline.regenerate"
  | "inline.emptySelection"
  | "inline.loading"
  | "skill.created"
  | "skill.empty"
  | "instruction.notice"
  | "errors.apiKeyMissing"
  | "errors.networkError"
  | "errors.aborted"
  | "errors.cannotOpenView"
  | "command.openChat"
  | "command.inlineEdit"
  | "approval.title"
  | "approval.allow"
  | "approval.deny"
  | "tabs.untitled"
  | "tabs.newChat"
  | "plan.enable"
  | "plan.disable"
  | "plan.approve"
  | "plan.deny"
  | "plan.plannedFor"
  | "image.dragHint"
  | "image.dropHere"
  | "image.attached"
  | "image.tooLarge"
  | "mcp.connected"
  | "mcp.disconnected"
  | "mcp.error"
  | "langChanged";

type Dict = Record<TranslationKey, string>;
const dicts: Record<Language, Dict> = {
  "zh-CN": {
    "settings.apiKey": "API Key",
    "settings.apiKeyDesc": "在 platform.deepseek.com 申请的 API Key",
    "settings.model": "模型",
    "settings.modelDesc": "DeepSeek 模型版本",
    "settings.maxTokens": "最大 Token",
    "settings.maxTokensDesc": "单次对话上下文窗口上限",
    "settings.temperature": "温度",
    "settings.temperatureDesc": "采样温度，越高越随机",
    "settings.language": "语言",
    "settings.languageDesc": "界面语言",
    "settings.autoApproveRisk": "自动批准工具等级",
    "settings.autoApproveRiskDesc": "低于此等级的工具调用无需确认",
    "settings.maxAgentLoops": "Agent 循环上限",
    "settings.maxAgentLoopsDesc": "ReAct 循环最大轮数，防止失控",
    "chat.placeholder": "输入消息，@ 引用文件…",
    "chat.send": "发送",
    "chat.stop": "停止",
    "chat.reset": "重置对话",
    "chat.retry": "重试",
    "chat.empty": "开始与 DeepSeek 对话吧 ✨",
    "chat.stopped": "（已停止）",
    "chat.error": "请求失败",
    "mention.placeholder": "搜索文件…",
    "mention.noFiles": "未匹配到文件",
    "inline.title": "DeepSeek 内联编辑",
    "inline.promptPlaceholder": "告诉 DeepSeek 你想怎么改这块文字⋯",
    "inline.apply": "应用",
    "inline.cancel": "取消",
    "inline.regenerate": "重新生成",
    "inline.emptySelection": "请先在编辑器中选中一段文字。",
    "inline.loading": "生成中⋯",
    "skill.created": "Skill 已保存",
    "skill.empty": "未找到 skill 模板",
    "instruction.notice": "已设置本次会话额外指令",
    "errors.apiKeyMissing": "请先在设置中填写 DeepSeek API Key",
    "errors.networkError": "DeepSeek 网络错误：",
    "errors.aborted": "已停止生成",
    "errors.cannotOpenView": "无法打开对话面板",
    "command.openChat": "打开 DeepSeek 对话",
    "command.inlineEdit": "用 DeepSeek 编辑选中文本",
    "approval.title": "工具调用需要确认",
    "approval.allow": "允许",
    "approval.deny": "拒绝",
    "tabs.untitled": "未命名会话",
    "tabs.newChat": "新建对话",
    "plan.enable": "启用计划模式",
    "plan.disable": "关闭计划模式",
    "plan.approve": "执行计划",
    "plan.deny": "拒绝计划",
    "plan.plannedFor": "DeepSeek 已制定执行计划：",
    "image.dragHint": "拖入图片以进行视觉分析",
    "image.dropHere": "松开以添加图片",
    "image.attached": "已添加 %d 张图片",
    "image.tooLarge": "图片太大（最大 10MB）",
    "mcp.connected": "MCP 已连接：",
    "mcp.disconnected": "MCP 已断开：",
    "mcp.error": "MCP 错误：",
    "langChanged": "语言已切换，面板将刷新",
  },
  en: {
    "settings.apiKey": "API Key",
    "settings.apiKeyDesc": "Your API Key from platform.deepseek.com",
    "settings.model": "Model",
    "settings.modelDesc": "DeepSeek model version",
    "settings.maxTokens": "Max Tokens",
    "settings.maxTokensDesc": "Upper bound of context window per turn",
    "settings.temperature": "Temperature",
    "settings.temperatureDesc": "Sampling temperature, higher is more random",
    "settings.language": "Language",
    "settings.languageDesc": "Interface language",
    "settings.autoApproveRisk": "Auto-approve risk level",
    "settings.autoApproveRiskDesc": "Tool calls at or below this level need no confirmation",
    "settings.maxAgentLoops": "Agent loop cap",
    "settings.maxAgentLoopsDesc": "Maximum ReAct iterations to prevent runaway",
    "chat.placeholder": "Message, @ for files…",
    "chat.send": "Send",
    "chat.stop": "Stop",
    "chat.reset": "Reset chat",
    "chat.retry": "Retry",
    "chat.empty": "Start chatting with DeepSeek ✨",
    "chat.stopped": " (stopped)",
    "chat.error": "Request failed",
    "mention.placeholder": "Search files…",
    "mention.noFiles": "No matching files",
    "inline.title": "DeepSeek inline edit",
    "inline.promptPlaceholder": "Describe how you want this text changed…",
    "inline.apply": "Apply",
    "inline.cancel": "Cancel",
    "inline.regenerate": "Regenerate",
    "inline.emptySelection": "Select some text in the editor first.",
    "inline.loading": "Generating…",
    "skill.created": "Skill saved",
    "skill.empty": "No skill templates found",
    "instruction.notice": "Session instruction set",
    "errors.apiKeyMissing": "Please set your DeepSeek API Key in settings first",
    "errors.networkError": "DeepSeek network error: ",
    "errors.aborted": "Generation stopped",
    "errors.cannotOpenView": "Could not open chat view",
    "command.openChat": "Open DeepSeek chat",
    "command.inlineEdit": "Edit selection with DeepSeek",
    "approval.title": "Tool call requires approval",
    "approval.allow": "Allow",
    "approval.deny": "Deny",
    "tabs.untitled": "Untitled chat",
    "tabs.newChat": "New conversation",
    "plan.enable": "Enable plan mode",
    "plan.disable": "Disable plan mode",
    "plan.approve": "Execute plan",
    "plan.deny": "Reject plan",
    "plan.plannedFor": "DeepSeek has created an execution plan:",
    "image.dragHint": "Drop images for visual analysis",
    "image.dropHere": "Release to attach images",
    "image.attached": "%d image(s) attached",
    "image.tooLarge": "Image too large (max 10MB)",
    "mcp.connected": "MCP connected: ",
    "mcp.disconnected": "MCP disconnected: ",
    "mcp.error": "MCP error: ",
    "langChanged": "Language changed, panel will refresh",
  },
};

export function translate(lang: Language, key: TranslationKey): string {
  return dicts[lang][key] ?? key;
}