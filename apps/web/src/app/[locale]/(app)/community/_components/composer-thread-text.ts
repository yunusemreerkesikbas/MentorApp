import type { ComposerAudienceMode } from "./composer-audience";

interface ComposerThreadTextInput {
  mode: ComposerAudienceMode;
  body: string;
  title: string;
  pollTitle: string;
  hasPoll: boolean;
}

export function resolveComposerThreadText(
  input: ComposerThreadTextInput,
): { body: string; title: string | undefined } {
  if (input.hasPoll) {
    return { body: input.pollTitle.trim(), title: undefined };
  }
  return {
    body: input.body.trim(),
    title: input.mode === "question" ? input.title.trim() || undefined : undefined,
  };
}
