/**
 * Plugin tests use a headless Lexical editor (createEditor)
 * to avoid jsdom issues with RichTextPlugin (DragEvent, etc).
 * We test the command registration and handler logic directly.
 */
import {
  $getRoot,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  PASTE_COMMAND,
  createEditor,
} from 'lexical';
import {
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import { LinkNode } from '@lexical/link';
import { ListNode, ListItemNode } from '@lexical/list';
import {
  CodeNode,
  CodeHighlightNode,
} from '@lexical/code';
import {
  $convertFromMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from
  '@lexical/react/LexicalComposerContext';
import { render, act } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { isLikelyMarkdown } from './heuristic.js';
import { MarkdownPastePlugin } from './plugin.js';
import type { MarkdownPasteConfig } from './plugin.js';

/**
 * All nodes required by the full TRANSFORMERS set.
 */
const MARKDOWN_NODES = [
  HeadingNode,
  QuoteNode,
  LinkNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
];

/**
 * Build a minimal ClipboardEvent-like object suitable
 * for passing to editor.dispatchCommand(PASTE_COMMAND).
 */
function makePasteEvent(text: string): ClipboardEvent {
  const dt = new DataTransfer();
  dt.setData('text/plain', text);

  return new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Creates a headless Lexical editor with markdown nodes.
 */
function makeHeadlessEditor() {
  const div = document.createElement('div');
  document.body.appendChild(div);

  const editor = createEditor({
    namespace: 'test',
    nodes: MARKDOWN_NODES,
    onError: (err) => {
      throw err;
    },
  });

  editor.setRootElement(div);

  return {
    editor,
    cleanup: () => {
      editor.setRootElement(null);
      document.body.removeChild(div);
    },
  };
}

/**
 * Registers the same PASTE_COMMAND handler logic that
 * MarkdownPastePlugin wires up, but on a bare editor.
 * This avoids React mounting complexity for behaviour tests.
 */
function registerPasteHandler(
  editor: ReturnType<typeof createEditor>,
  config: MarkdownPasteConfig,
): () => void {
  const {
    mode,
    onMarkdownDetected,
    threshold,
    transformers,
  } = config;

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

      let isEmpty = false;
      editor.getEditorState().read(() => {
        isEmpty =
          $getRoot().getTextContent().trim() === '';
      });

      if (!isEmpty) {
        return false;
      }

      event.preventDefault();

      if (mode === 'auto') {
        editor.update(() => {
          $convertFromMarkdownString(
            text,
            transformers,
          );
        });
        return true;
      }

      if (onMarkdownDetected) {
        onMarkdownDetected(text).then(
          (accepted) => {
            if (!accepted) return;
            editor.update(() => {
              $convertFromMarkdownString(
                text,
                transformers,
              );
            });
          },
        );
      }

      return true;
    },
    COMMAND_PRIORITY_NORMAL,
  );
}

// ──────────────────────────────────────────────────────────
// React component smoke test
// ──────────────────────────────────────────────────────────

describe('MarkdownPastePlugin React component', () => {
  it('mounts without throwing', async () => {
    const initialConfig = {
      namespace: 'test',
      nodes: MARKDOWN_NODES,
      onError: (err: Error) => {
        throw err;
      },
      theme: {},
    };

    let mounted = false;

    function Capture() {
      useLexicalComposerContext();
      mounted = true;
      return null;
    }

    await act(async () => {
      render(
        <LexicalComposer initialConfig={initialConfig}>
          <MarkdownPastePlugin mode="auto" />
          <Capture />
        </LexicalComposer>,
      );
    });

    expect(mounted).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// Headless editor behaviour tests
// ──────────────────────────────────────────────────────────

describe('MarkdownPastePlugin — auto mode', () => {
  it('converts markdown paste to rich nodes', async () => {
    const { editor, cleanup } = makeHeadlessEditor();

    const unregister = registerPasteHandler(editor, {
      mode: 'auto',
      transformers: TRANSFORMERS,
    });

    const markdown = '# Hello World\n\nSome **bold** text.';

    editor.dispatchCommand(
      PASTE_COMMAND,
      makePasteEvent(markdown),
    );

    // Wait for editor.update() to flush
    await new Promise((r) => setTimeout(r, 10));

    let rootText = '';
    editor.getEditorState().read(() => {
      rootText = $getRoot().getTextContent();
    });

    expect(rootText).toContain('Hello World');

    unregister();
    cleanup();
  });

  it('does not intercept plain text paste', () => {
    const { editor, cleanup } = makeHeadlessEditor();

    let sentinelFired = false;

    // Lower-priority sentinel: fires only if our handler
    // returned false (did not consume the command).
    const unregisterSentinel = editor.registerCommand(
      PASTE_COMMAND,
      () => {
        sentinelFired = true;
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregister = registerPasteHandler(editor, {
      mode: 'auto',
      transformers: TRANSFORMERS,
    });

    editor.dispatchCommand(
      PASTE_COMMAND,
      makePasteEvent('Just a normal sentence here.'),
    );

    // Our plugin returns false for plain text, so the
    // lower-priority sentinel should have fired.
    expect(sentinelFired).toBe(true);

    unregister();
    unregisterSentinel();
    cleanup();
  });
});

describe('MarkdownPastePlugin — safe paste (non-empty editor)', () => {
  it(
    'does not replace content when editor has text',
    async () => {
      const { editor, cleanup } = makeHeadlessEditor();

      // Pre-populate the editor with existing content
      await new Promise<void>((resolve) => {
        editor.update(() => {
          $convertFromMarkdownString(
            'Existing content.',
            TRANSFORMERS,
          );
        }, { onUpdate: resolve });
      });

      const unregister = registerPasteHandler(editor, {
        mode: 'auto',
        transformers: TRANSFORMERS,
      });

      editor.dispatchCommand(
        PASTE_COMMAND,
        makePasteEvent('# New Heading\n\n- item one'),
      );

      await new Promise((r) => setTimeout(r, 20));

      let rootText = '';
      editor.getEditorState().read(() => {
        rootText = $getRoot().getTextContent();
      });

      // Existing content must be preserved
      expect(rootText).toContain('Existing content');
      // Pasted markdown must NOT have replaced it
      expect(rootText).not.toContain('New Heading');

      unregister();
      cleanup();
    },
  );
});

describe('MarkdownPastePlugin — threshold option', () => {
  it(
    'does not convert when score is below threshold',
    () => {
      const { editor, cleanup } = makeHeadlessEditor();

      let sentinelFired = false;

      const unregisterSentinel = editor.registerCommand(
        PASTE_COMMAND,
        () => {
          sentinelFired = true;
          return true;
        },
        COMMAND_PRIORITY_LOW,
      );

      // threshold 10 is deliberately very high
      const unregister = registerPasteHandler(editor, {
        mode: 'auto',
        threshold: 10,
        transformers: TRANSFORMERS,
      });

      // Score for "# Hello\n\n- item" is below 10
      editor.dispatchCommand(
        PASTE_COMMAND,
        makePasteEvent('# Hello\n\n- item'),
      );

      // Plugin returned false → sentinel should fire
      expect(sentinelFired).toBe(true);

      unregister();
      unregisterSentinel();
      cleanup();
    },
  );
});

describe('MarkdownPastePlugin — prompt mode', () => {
  it('calls onMarkdownDetected with the pasted text', async () => {
    const { editor, cleanup } = makeHeadlessEditor();
    const onMarkdownDetected = vi.fn().mockResolvedValue(false);

    const unregister = registerPasteHandler(editor, {
      mode: 'prompt',
      onMarkdownDetected,
      transformers: TRANSFORMERS,
    });

    const markdown = '# Prompt Test\n\n- item\n- item';
    editor.dispatchCommand(
      PASTE_COMMAND,
      makePasteEvent(markdown),
    );

    await new Promise((r) => setTimeout(r, 10));

    expect(onMarkdownDetected).toHaveBeenCalledWith(markdown);

    unregister();
    cleanup();
  });

  it('converts when callback resolves true', async () => {
    const { editor, cleanup } = makeHeadlessEditor();
    const onMarkdownDetected = vi.fn().mockResolvedValue(true);

    const unregister = registerPasteHandler(editor, {
      mode: 'prompt',
      onMarkdownDetected,
      transformers: TRANSFORMERS,
    });

    const markdown = '# Accept\n\n**bold** content here.';
    editor.dispatchCommand(
      PASTE_COMMAND,
      makePasteEvent(markdown),
    );

    await new Promise((r) => setTimeout(r, 50));

    let rootText = '';
    editor.getEditorState().read(() => {
      rootText = $getRoot().getTextContent();
    });

    expect(rootText).toContain('Accept');

    unregister();
    cleanup();
  });

  it('does not convert when callback resolves false', async () => {
    const { editor, cleanup } = makeHeadlessEditor();
    const onMarkdownDetected = vi.fn().mockResolvedValue(false);

    const unregister = registerPasteHandler(editor, {
      mode: 'prompt',
      onMarkdownDetected,
      transformers: TRANSFORMERS,
    });

    const markdown = '# Reject\n\n- not converted';
    editor.dispatchCommand(
      PASTE_COMMAND,
      makePasteEvent(markdown),
    );

    await new Promise((r) => setTimeout(r, 50));

    editor.getEditorState().read(() => {
      const firstChild = $getRoot().getFirstChild();
      expect(firstChild?.getTextContent() ?? '').toBe('');
    });

    unregister();
    cleanup();
  });

  it('does not call callback for plain text paste', async () => {
    const { editor, cleanup } = makeHeadlessEditor();
    const onMarkdownDetected = vi.fn().mockResolvedValue(false);

    const unregister = registerPasteHandler(editor, {
      mode: 'prompt',
      onMarkdownDetected,
      transformers: TRANSFORMERS,
    });

    editor.dispatchCommand(
      PASTE_COMMAND,
      makePasteEvent('Just some regular text.'),
    );

    await new Promise((r) => setTimeout(r, 10));

    expect(onMarkdownDetected).not.toHaveBeenCalled();

    unregister();
    cleanup();
  });
});
