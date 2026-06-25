import { defineTool } from "../ToolDefinition";
import { RiskLevel } from "../../types";

export const ShellCommand = defineTool({
  name: "shell_command",
  description: "Execute a shell command and return stdout/stderr. Desktop-only; ALWAYS requires explicit user approval.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command string." },
      cwd: { type: "string", description: "Working directory. Defaults to vault root." },
    },
    required: ["command"],
  },
  riskLevel: RiskLevel.EXTERNAL,
  async execute(args, _ctx) {
    void args;
    // Mobile does not expose child_process; desktop path wired in Phase 5.
    return { success: false, error: "shell_command not implemented in Phase 0" };
  },
});