# @scrivenmark/lexical-markdown-paste

Paste markdown as rich text in Lexical editors with heuristic detection.

[![CI](https://github.com/Bannermedia-ltd/lexical-markdown-paste/actions/workflows/ci.yml/badge.svg)](https://github.com/Bannermedia-ltd/lexical-markdown-paste/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@scrivenmark/lexical-markdown-paste)](https://www.npmjs.com/package/@scrivenmark/lexical-markdown-paste)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```sh
pnpm add @scrivenmark/lexical-markdown-paste
# npm install @scrivenmark/lexical-markdown-paste
# yarn add @scrivenmark/lexical-markdown-paste
```

## Quick start

### Auto mode

Converts detected markdown immediately on paste.

```tsx
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { MarkdownPastePlugin } from '@scrivenmark/lexical-markdown-paste';

export function Editor() {
  return (
    <LexicalComposer initialConfig={config}>
      <RichTextPlugin />
      <MarkdownPastePlugin
        mode="auto"
        transformers={TRANSFORMERS}
      />
    </LexicalComposer>
  );
}
```

### Prompt mode

Asks the user before converting.

```tsx
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { MarkdownPastePlugin } from '@scrivenmark/lexical-markdown-paste';

export function Editor() {
  const handleMarkdownDetected = async (
    text: string,
  ): Promise<boolean> => {
    return window.confirm(
      'Markdown detected — convert to rich text?',
    );
  };

  return (
    <LexicalComposer initialConfig={config}>
      <RichTextPlugin />
      <MarkdownPastePlugin
        mode="prompt"
        onMarkdownDetected={handleMarkdownDetected}
        transformers={TRANSFORMERS}
      />
    </LexicalComposer>
  );
}
```

## API reference

### `MarkdownPastePlugin`

React component. Returns `null` (no DOM output).
Must be rendered inside a `LexicalComposer`.

Props are defined by `MarkdownPasteConfig`:

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `mode` | `'auto' \| 'prompt'` | Yes | — | Auto converts immediately; prompt calls `onMarkdownDetected` first |
| `onMarkdownDetected` | `(text: string) => Promise<boolean>` | No | — | Called in prompt mode; resolve `true` to convert |
| `transformers` | `Transformer[]` | No | `undefined` | Lexical markdown transformers |
| `threshold` | `number` | No | `2` | Minimum heuristic score to trigger detection |

### `MarkdownPasteConfig`

TypeScript interface for `MarkdownPastePlugin` props.

```ts
import type {
  MarkdownPasteConfig,
} from '@scrivenmark/lexical-markdown-paste';
```

### `getMarkdownScore(text: string): number`

Returns the heuristic score for the given text.
Higher scores indicate more markdown-like content.
Returns `0` for HTML content or empty strings.

```ts
import {
  getMarkdownScore,
} from '@scrivenmark/lexical-markdown-paste';

getMarkdownScore('# Hello\n\nSome **bold** text.');
// → 3
```

### `isLikelyMarkdown(text: string, threshold?: number): boolean`

Returns `true` if the score meets or exceeds
the threshold (default `2`).

```ts
import {
  isLikelyMarkdown,
} from '@scrivenmark/lexical-markdown-paste';

isLikelyMarkdown('# Hello\n\nSome **bold** text.');
// → true

isLikelyMarkdown('Just plain text.');
// → false
```

## Heuristic scoring

Scores are summed across all matching rules.
HTML content zeroes the score entirely.

| Rule | Pattern | Points |
|---|---|---|
| Heading | `# ` … `###### ` at line start | 2 |
| Bold | `**text**` | 1 |
| Italic (underscore) | `_text_` | 1 |
| Italic (asterisk) | `*text*` | 1 |
| Unordered list | `- item` or `* item` at line start | 2 |
| Ordered list | `1. item` at line start | 2 |
| Fenced code block | ` ``` ` | 2 |
| Inline code | `` `code` `` | 1 |
| Link | `[text](url)` | 2 |
| Blockquote | `> ` at line start | 2 |
| Horizontal rule | `---` or `***` on its own line | 1 |

The default threshold is `2`. A single heading or
unordered list item is enough to trigger conversion.

## Limitations

- **Empty editor only.** The plugin does not convert
  pasted markdown if the editor already contains content,
  to avoid silently replacing existing work.
- **HTML excluded.** Content containing HTML tags scores
  zero and is passed to the default paste handler.

## Peer dependencies

| Package | Version |
|---|---|
| `lexical` | `^0.40.0` |
| `@lexical/markdown` | `^0.40.0` |
| `@lexical/react` | `^0.40.0` |
| `react` | `^18 \|\| ^19` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licence

MIT © [Lettergraph](https://lettergraph.co)
