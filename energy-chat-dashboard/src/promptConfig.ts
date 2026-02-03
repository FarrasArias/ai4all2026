import prompts from "./config/prompts.json";

export type ModeKey = "chat" | "vibe_coding" | "web" | "image";

type PromptEntry = {
  default_user_prompt?: string;
  system?: string;
};

type ModePrompts = {
  default_user_prompt?: string;
  models?: Record<string, PromptEntry>;
};

export function getDefaultUserPrompt(mode: ModeKey, model?: string): string {
  const modeCfg = (prompts as any)[mode] as ModePrompts | undefined;
  if (!modeCfg) return "";
  if (model && modeCfg.models && modeCfg.models[model]?.default_user_prompt) {
    return modeCfg.models[model]!.default_user_prompt!;
  }
  return modeCfg.default_user_prompt ?? "";
}

export default prompts;
