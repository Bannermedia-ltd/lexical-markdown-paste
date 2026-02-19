import {
  $getRoot,
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
} from 'lexical';
import type {
  Transformer,
} from '@lexical/markdown';
import {
  $convertFromMarkdownString,
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
   * onMarkdownDetected first.
   */
  mode: 'auto' | 'prompt';

  /**
   * Called in prompt mode when markdown
   * is detected. Resolve true to convert,
   * false to paste as plain text.
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
 * Returns true if the editor root is empty
 * (no meaningful text content).
 */
function editorIsEmpty(): boolean {
  return $getRoot().getTextContent().trim() === '';
}

function convertMarkdown(
  editor: ReturnType<
    typeof useLexicalComposerContext
  >[0],
  text: string,
  transformers?: Transformer[],
) {
  editor.update(() => {
    $convertFromMarkdownString(
      text,
      transformers,
    );
  });
}

/**
 * Lexical plugin that intercepts paste events
 * and converts detected markdown into rich
 * Lexical nodes.
 *
 * Conversion only happens when the editor is
 * empty. If the editor already has content,
 * the event is passed to the default handler
 * (plain-text paste) to avoid silently
 * destroying existing work.
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

        // Check emptiness inside a read-only
        // editor state to avoid side effects.
        let isEmpty = false;
        editor.getEditorState().read(() => {
          isEmpty = editorIsEmpty();
        });

        if (!isEmpty) {
          // Editor has content — don't replace.
          // Fall through to default paste handler
          // so the text is inserted safely.
          return false;
        }

        event.preventDefault();

        if (mode === 'auto') {
          convertMarkdown(
            editor,
            text,
            transformers,
          );
          return true;
        }

        if (onMarkdownDetected) {
          onMarkdownDetected(text).then(
            (accepted) => {
              if (!accepted) return;
              convertMarkdown(
                editor,
                text,
                transformers,
              );
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
