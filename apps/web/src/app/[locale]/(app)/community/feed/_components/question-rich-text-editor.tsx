"use client";

import {
  Bold,
  Braces,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalEditor,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { HeadingNode, QuoteNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { CodeNode, $createCodeNode } from "@lexical/code";

export function QuestionRichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (markdown: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("community");

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "MentorQuestionEditor",
        editable: !disabled,
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
        editorState: () => {
          if (value) $convertFromMarkdownString(value, TRANSFORMERS);
        },
        onError(error) {
          throw error;
        },
        theme: {
          paragraph: "mb-2 last:mb-0",
          quote:
            "border-l-2 border-[var(--community-blue-border)] pl-3 text-[var(--color-secondary)]",
          list: {
            ul: "ml-5 list-disc",
            ol: "ml-5 list-decimal",
            listitem: "my-1",
          },
          text: {
            bold: "font-bold",
            italic: "italic",
            code: "rounded bg-[var(--color-soft)] px-1 font-mono text-[0.9em]",
          },
          code: "my-2 block overflow-x-auto rounded-[var(--radius-card)] bg-[var(--color-soft)] p-3 font-mono text-sm",
          link: "text-[var(--community-blue-ink)] underline underline-offset-2",
        },
      }}
    >
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
        <QuestionEditorToolbar disabled={disabled} />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-label={t("question_content_label")}
                className="min-h-52 max-h-[42dvh] overflow-y-auto px-4 py-3 text-[15px] leading-7 text-[var(--color-body-text)] outline-none"
              />
            }
            placeholder={
              <p className="pointer-events-none absolute left-4 top-3 text-[15px] text-[var(--color-secondary)]">
                {t("question_content_placeholder")}
              </p>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(editorState) => {
          editorState.read(() => onChange($convertToMarkdownString(TRANSFORMERS)));
        }}
      />
    </LexicalComposer>
  );
}

function QuestionEditorToolbar({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("community");
  const [editor] = useLexicalComposerContext();
  const tools = [
    { label: t("editor_bold"), icon: Bold, action: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold") },
    { label: t("editor_italic"), icon: Italic, action: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic") },
    { label: t("editor_inline_code"), icon: Code2, action: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code") },
    { label: t("editor_bullet_list"), icon: List, action: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined) },
    { label: t("editor_ordered_list"), icon: ListOrdered, action: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined) },
    { label: t("editor_quote"), icon: Quote, action: () => setBlock(editor, "quote") },
    { label: t("editor_code_block"), icon: Braces, action: () => setBlock(editor, "code") },
    {
      label: t("editor_link"),
      icon: Link2,
      action: () => {
        const url = window.prompt(t("editor_link_prompt"));
        if (url?.trim()) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
      },
    },
    { label: t("editor_undo"), icon: Undo2, action: () => editor.dispatchCommand(UNDO_COMMAND, undefined) },
    { label: t("editor_redo"), icon: Redo2, action: () => editor.dispatchCommand(REDO_COMMAND, undefined) },
  ];

  return (
    <div
      role="toolbar"
      aria-label={t("editor_toolbar")}
      className="flex min-h-11 flex-wrap items-center gap-1 border-b border-[var(--color-border)] px-2 py-1"
    >
      {tools.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          onClick={action}
          className="flex size-9 items-center justify-center rounded-[var(--radius-card)] text-[var(--color-secondary)] hover:bg-[var(--color-soft)] hover:text-[var(--color-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-40"
        >
          <Icon size={17} aria-hidden />
        </button>
      ))}
    </div>
  );
}

function setBlock(editor: LexicalEditor, type: "quote" | "code") {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    $setBlocksType(selection, () =>
      type === "quote" ? $createQuoteNode() : $createCodeNode(),
    );
  });
}
