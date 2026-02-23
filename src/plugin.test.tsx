/**
 * Plugin tests use a headless Lexical editor
 * (createEditor) to avoid jsdom issues with
 * RichTextPlugin (DragEvent, etc). We test
 * the command registration and handler logic
 * directly.
 */
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
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
import {
  ListNode,
  ListItemNode,
} from '@lexical/list';
import {
  CodeNode,
  CodeHighlightNode,
} from '@lexical/code';
import {
  $convertFromMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown';
import {
  LexicalComposer,
} from '@lexical/react/LexicalComposer';
import {
  useLexicalComposerContext,
} from '@lexical/react/LexicalComposerContext';
import { render, act } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { isLikelyMarkdown } from './heuristic.js';
import {
  MarkdownPastePlugin,
  combineAndConvert,
  selectionInsideCode,
} from './plugin.js';
import type {
  MarkdownPasteConfig,
} from './plugin.js';

/**
 * All nodes required by the full
 * TRANSFORMERS set.
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
 * Build a minimal ClipboardEvent-like object.
 */
function makePasteEvent(
  text: string,
): ClipboardEvent {
  const dt = new DataTransfer();
  dt.setData('text/plain', text);

  return new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Creates a headless Lexical editor with
 * markdown nodes.
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
 * Mirrors the PASTE_COMMAND handler that
 * MarkdownPastePlugin registers, but on a
 * bare headless editor.
 *
 * WHY THIS EXISTS: MarkdownPastePlugin uses
 * useLexicalComposerContext (a React hook),
 * so it cannot be tested outside a full
 * React tree. This helper registers the same
 * command logic on a plain createEditor
 * instance, letting us test paste behaviour
 * without mounting jsdom-hostile React
 * components (RichTextPlugin, DragEvent,
 * etc).
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

      // Prompt: save state, insert raw text
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
          },
        );
      }

      return true;
    },
    COMMAND_PRIORITY_NORMAL,
  );
}

// ────────────────────────────────────────────
// React component smoke test
// ────────────────────────────────────────────

describe(
  'MarkdownPastePlugin React component',
  () => {
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
          <LexicalComposer
            initialConfig={initialConfig}
          >
            <MarkdownPastePlugin mode="auto" />
            <Capture />
          </LexicalComposer>,
        );
      });

      expect(mounted).toBe(true);
    });
  },
);

// ────────────────────────────────────────────
// Auto mode
// ────────────────────────────────────────────

describe(
  'MarkdownPastePlugin — auto mode',
  () => {
    it(
      'converts markdown paste in empty'
      + ' editor',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        // Place cursor
        await new Promise<void>((resolve) => {
          editor.update(
            () => { $getRoot().selectEnd(); },
            { onUpdate: resolve },
          );
        });

        const unregister =
          registerPasteHandler(editor, {
            mode: 'auto',
            transformers: TRANSFORMERS,
          });

        const markdown =
          '# Hello World\n\n'
          + 'Some **bold** text.';

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(markdown),
        );

        await new Promise(
          (r) => setTimeout(r, 20),
        );

        let rootText = '';
        editor.getEditorState().read(() => {
          rootText =
            $getRoot().getTextContent();
        });

        expect(rootText).toContain(
          'Hello World',
        );

        unregister();
        cleanup();
      },
    );

    it(
      'converts markdown paste into'
      + ' non-empty editor',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        // Pre-populate
        await new Promise<void>((resolve) => {
          editor.update(
            () => {
              $convertFromMarkdownString(
                '# Existing Title\n\n'
                + 'Some content here.',
                TRANSFORMERS,
              );
            },
            { onUpdate: resolve },
          );
        });

        // Place cursor at end
        await new Promise<void>((resolve) => {
          editor.update(
            () => {
              $getRoot().selectEnd();
            },
            { onUpdate: resolve },
          );
        });

        const unregister =
          registerPasteHandler(editor, {
            mode: 'auto',
            transformers: TRANSFORMERS,
          });

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(
            '## New Section\n\n- item one',
          ),
        );

        await new Promise(
          (r) => setTimeout(r, 50),
        );

        let rootText = '';
        editor.getEditorState().read(() => {
          rootText =
            $getRoot().getTextContent();
        });

        // Both old and new content present
        expect(rootText).toContain(
          'Existing Title',
        );
        expect(rootText).toContain(
          'New Section',
        );
        expect(rootText).toContain(
          'item one',
        );

        unregister();
        cleanup();
      },
    );

    it(
      'does not intercept plain text paste',
      () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        let sentinelFired = false;

        const unregisterSentinel =
          editor.registerCommand(
            PASTE_COMMAND,
            () => {
              sentinelFired = true;
              return true;
            },
            COMMAND_PRIORITY_LOW,
          );

        const unregister =
          registerPasteHandler(editor, {
            mode: 'auto',
            transformers: TRANSFORMERS,
          });

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(
            'Just a normal sentence here.',
          ),
        );

        expect(sentinelFired).toBe(true);

        unregister();
        unregisterSentinel();
        cleanup();
      },
    );
  },
);

// ────────────────────────────────────────────
// Code block context
// ────────────────────────────────────────────

describe(
  'MarkdownPastePlugin — code block context',
  () => {
    it(
      'does not intercept paste inside'
      + ' a code block',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        // Create a code block and place
        // the selection inside it
        await new Promise<void>((resolve) => {
          editor.update(
            () => {
              $convertFromMarkdownString(
                '```\nsome code\n```',
                TRANSFORMERS,
              );
              const root = $getRoot();
              const first =
                root.getFirstChild();
              if (first) first.selectEnd();
            },
            { onUpdate: resolve },
          );
        });

        let sentinelFired = false;
        const unregisterSentinel =
          editor.registerCommand(
            PASTE_COMMAND,
            () => {
              sentinelFired = true;
              return true;
            },
            COMMAND_PRIORITY_LOW,
          );

        const unregister =
          registerPasteHandler(editor, {
            mode: 'auto',
            transformers: TRANSFORMERS,
          });

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(
            '# Hello\n\n- item',
          ),
        );

        await new Promise(
          (r) => setTimeout(r, 20),
        );

        // Plugin bailed — sentinel fires
        expect(sentinelFired).toBe(true);

        unregister();
        unregisterSentinel();
        cleanup();
      },
    );
  },
);

// ────────────────────────────────────────────
// Threshold
// ────────────────────────────────────────────

describe(
  'MarkdownPastePlugin — threshold option',
  () => {
    it(
      'does not convert when score is'
      + ' below threshold',
      () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        let sentinelFired = false;

        const unregisterSentinel =
          editor.registerCommand(
            PASTE_COMMAND,
            () => {
              sentinelFired = true;
              return true;
            },
            COMMAND_PRIORITY_LOW,
          );

        // threshold 10 is deliberately high
        const unregister =
          registerPasteHandler(editor, {
            mode: 'auto',
            threshold: 10,
            transformers: TRANSFORMERS,
          });

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent('# Hello\n\n- item'),
        );

        expect(sentinelFired).toBe(true);

        unregister();
        unregisterSentinel();
        cleanup();
      },
    );
  },
);

// ────────────────────────────────────────────
// Prompt mode
// ────────────────────────────────────────────

describe(
  'MarkdownPastePlugin — prompt mode',
  () => {
    it(
      'inserts raw text and calls'
      + ' onMarkdownDetected',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        await new Promise<void>((resolve) => {
          editor.update(
            () => { $getRoot().selectEnd(); },
            { onUpdate: resolve },
          );
        });

        const onMarkdownDetected =
          vi.fn().mockResolvedValue(false);

        const unregister =
          registerPasteHandler(editor, {
            mode: 'prompt',
            onMarkdownDetected,
            transformers: TRANSFORMERS,
          });

        const markdown =
          '# Prompt Test\n\n- item\n- item';
        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(markdown),
        );

        await new Promise(
          (r) => setTimeout(r, 20),
        );

        expect(
          onMarkdownDetected,
        ).toHaveBeenCalledWith(markdown);

        // Raw text visible in editor
        let rootText = '';
        editor.getEditorState().read(() => {
          rootText =
            $getRoot().getTextContent();
        });
        expect(rootText).toContain(
          '# Prompt Test',
        );

        unregister();
        cleanup();
      },
    );

    it(
      'converts when callback resolves true',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        await new Promise<void>((resolve) => {
          editor.update(
            () => { $getRoot().selectEnd(); },
            { onUpdate: resolve },
          );
        });

        const onMarkdownDetected =
          vi.fn().mockResolvedValue(true);

        const unregister =
          registerPasteHandler(editor, {
            mode: 'prompt',
            onMarkdownDetected,
            transformers: TRANSFORMERS,
          });

        const markdown =
          '# Accept\n\n**bold** content.';
        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(markdown),
        );

        await new Promise(
          (r) => setTimeout(r, 50),
        );

        let rootText = '';
        editor.getEditorState().read(() => {
          rootText =
            $getRoot().getTextContent();
        });

        expect(rootText).toContain('Accept');
        // The # should be gone (converted
        // to heading node)
        expect(rootText).not.toContain(
          '# Accept',
        );

        unregister();
        cleanup();
      },
    );

    it(
      'keeps raw text when callback'
      + ' resolves false',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        await new Promise<void>((resolve) => {
          editor.update(
            () => { $getRoot().selectEnd(); },
            { onUpdate: resolve },
          );
        });

        const onMarkdownDetected =
          vi.fn().mockResolvedValue(false);

        const unregister =
          registerPasteHandler(editor, {
            mode: 'prompt',
            onMarkdownDetected,
            transformers: TRANSFORMERS,
          });

        const markdown =
          '# Reject\n\n- not converted';
        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(markdown),
        );

        await new Promise(
          (r) => setTimeout(r, 50),
        );

        let rootText = '';
        editor.getEditorState().read(() => {
          rootText =
            $getRoot().getTextContent();
        });

        // Raw text stays (# visible)
        expect(rootText).toContain(
          '# Reject',
        );
        expect(rootText).toContain(
          '- not converted',
        );

        unregister();
        cleanup();
      },
    );

    it(
      'does not call callback for plain'
      + ' text paste',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        await new Promise<void>((resolve) => {
          editor.update(
            () => { $getRoot().selectEnd(); },
            { onUpdate: resolve },
          );
        });

        const onMarkdownDetected =
          vi.fn().mockResolvedValue(false);

        const unregister =
          registerPasteHandler(editor, {
            mode: 'prompt',
            onMarkdownDetected,
            transformers: TRANSFORMERS,
          });

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(
            'Just some regular text.',
          ),
        );

        await new Promise(
          (r) => setTimeout(r, 10),
        );

        expect(
          onMarkdownDetected,
        ).not.toHaveBeenCalled();

        unregister();
        cleanup();
      },
    );

    it(
      'works in non-empty editor',
      async () => {
        const { editor, cleanup } =
          makeHeadlessEditor();

        await new Promise<void>((resolve) => {
          editor.update(
            () => {
              $convertFromMarkdownString(
                '# Existing\n\nContent.',
                TRANSFORMERS,
              );
              $getRoot().selectEnd();
            },
            { onUpdate: resolve },
          );
        });

        const onMarkdownDetected =
          vi.fn().mockResolvedValue(true);

        const unregister =
          registerPasteHandler(editor, {
            mode: 'prompt',
            onMarkdownDetected,
            transformers: TRANSFORMERS,
          });

        editor.dispatchCommand(
          PASTE_COMMAND,
          makePasteEvent(
            '## New\n\n- item',
          ),
        );

        await new Promise(
          (r) => setTimeout(r, 50),
        );

        let rootText = '';
        editor.getEditorState().read(() => {
          rootText =
            $getRoot().getTextContent();
        });

        expect(rootText).toContain(
          'Existing',
        );
        expect(rootText).toContain('New');
        expect(rootText).toContain('item');

        unregister();
        cleanup();
      },
    );
  },
);
