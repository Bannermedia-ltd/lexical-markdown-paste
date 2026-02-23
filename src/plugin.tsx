import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
} from 'lexical';
import type {
  EditorState,
  LexicalEditor,
} from 'lexical';
import type {
  Transformer,
} from '@lexical/markdown';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import {
  useLexicalComposerContext,
} from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import {
  isLikelyMarkdown,
} from './heuristic.js';

export interface MarkdownPasteConfig {
  /**
   * 'auto' converts detected markdown
   * immediately. 'prompt' calls
   * onMarkdownDetected first — the raw
   * text is inserted so the user can see
   * it while the prompt is shown.
   */
  mode: 'auto' | 'prompt';

  /**
   * Called in prompt mode when markdown
   * is detected. Resolve true to convert,
   * false to keep as raw text.
   */
  onMarkdownDetected?: (
    text: string,
  ) => Promise<boolean>;

  /** Markdown transformers for Lexical. */
  transformers?: Transformer[];

  /**
   * Minimum score to trigger detection.
   * Default: 2.
   */
  threshold?: number;
}

/**
 * Returns true if the selection anchor is
 * inside a code block node. Must be called
 * inside a read or update context.
 */
export function selectionInsideCode(): boolean {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return false;
  let node: ReturnType<
    typeof sel.anchor.getNode
  > | null = sel.anchor.getNode();
  while (node !== null) {
    if (node.getType() === 'code') {
      return true;
    }
    node = node.getParent();
  }
  return false;
}

/**
 * Reads existing markdown from an editor
 * state, combines it with pasted markdown,
 * and converts the result to rich nodes.
 */
export function combineAndConvert(
  editor: LexicalEditor,
  preState: EditorState,
  pastedText: string,
  transformers?: Transformer[],
) {
  let existingMd = '';
  preState.read(() => {
    existingMd =
      $convertToMarkdownString(transformers);
  });

  const combined = existingMd
    ? existingMd + '\n\n' + pastedText
    : pastedText;

  editor.update(() => {
    $convertFromMarkdownString(
      combined,
      transformers,
    );
  });
}

/**
 * Lexical plugin that intercepts paste events
 * and converts detected markdown into rich
 * Lexical nodes.
 *
 * Works in both empty and non-empty editors.
 * Paste inside code blocks is never
 * intercepted. In auto mode, conversion is
 * immediate. In prompt mode, the raw text
 * is inserted first and onMarkdownDetected
 * is called — resolve true to convert, false
 * to keep the raw text.
 */
export function MarkdownPastePlugin({
  mode,
  onMarkdownDetected,
  threshold,
  transformers,
}: MarkdownPasteConfig): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const text =
          event.clipboardData
            ?.getData('text/plain') ?? '';

        if (
          !isLikelyMarkdown(text, threshold)
        ) {
          return false;
        }

        // Never intercept paste inside code
        let insideCode = false;
        editor.getEditorState().read(() => {
          insideCode = selectionInsideCode();
        });
        if (insideCode) return false;

        event.preventDefault();

        if (mode === 'auto') {
          combineAndConvert(
            editor,
            editor.getEditorState(),
            text,
            transformers,
          );
          return true;
        }

        // Prompt: save state before inserting
        // raw text so we can restore on convert.
        const preState =
          editor.getEditorState();

        editor.update(() => {
          const sel = $getSelection();
          if ($isRangeSelection(sel)) {
            sel.insertRawText(text);
          }
        });

        if (onMarkdownDetected) {
          onMarkdownDetected(text).then(
            (accepted) => {
              if (accepted) {
                combineAndConvert(
                  editor,
                  preState,
                  text,
                  transformers,
                );
              }
              // Reject: raw text stays as-is
            },
          );
        }

        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [
    editor,
    mode,
    onMarkdownDetected,
    threshold,
    transformers,
  ]);

  return null;
}
