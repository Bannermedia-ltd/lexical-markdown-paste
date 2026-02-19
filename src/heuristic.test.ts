import { describe, expect, it } from 'vitest';
import {
  getMarkdownScore,
  isLikelyMarkdown,
} from './heuristic.js';

describe('getMarkdownScore', () => {
  it('returns 0 for plain text', () => {
    expect(
      getMarkdownScore('Hello world, this is plain text.'),
    ).toBe(0);
  });

  it('scores a heading', () => {
    expect(getMarkdownScore('# Hello')).toBeGreaterThan(0);
  });

  it('scores a level-2 heading', () => {
    expect(
      getMarkdownScore('## Section Title'),
    ).toBeGreaterThan(0);
  });

  it('scores a level-3 heading', () => {
    expect(
      getMarkdownScore('### Subsection'),
    ).toBeGreaterThan(0);
  });

  it('scores bold text', () => {
    expect(
      getMarkdownScore('This is **bold** text'),
    ).toBeGreaterThan(0);
  });

  it('scores italic text with underscores', () => {
    expect(
      getMarkdownScore('This is _italic_ text'),
    ).toBeGreaterThan(0);
  });

  it('scores italic text with asterisks', () => {
    expect(
      getMarkdownScore('This is *italic* text'),
    ).toBeGreaterThan(0);
  });

  it('scores unordered list with dashes', () => {
    expect(
      getMarkdownScore('- item 1\n- item 2\n- item 3'),
    ).toBeGreaterThan(0);
  });

  it('scores unordered list with asterisks', () => {
    expect(
      getMarkdownScore('* item 1\n* item 2'),
    ).toBeGreaterThan(0);
  });

  it('scores ordered list', () => {
    expect(
      getMarkdownScore('1. First\n2. Second\n3. Third'),
    ).toBeGreaterThan(0);
  });

  it('scores triple-backtick code blocks', () => {
    expect(
      getMarkdownScore('```\nconst x = 1;\n```'),
    ).toBeGreaterThan(0);
  });

  it('scores inline code', () => {
    expect(
      getMarkdownScore('Use the `console.log` function'),
    ).toBeGreaterThan(0);
  });

  it('scores links', () => {
    expect(
      getMarkdownScore('[click here](https://example.com)'),
    ).toBeGreaterThan(0);
  });

  it('scores blockquotes', () => {
    expect(
      getMarkdownScore('> This is a blockquote'),
    ).toBeGreaterThan(0);
  });

  it('scores horizontal rules with dashes', () => {
    expect(getMarkdownScore('---')).toBeGreaterThan(0);
  });

  it('scores horizontal rules with asterisks', () => {
    expect(getMarkdownScore('***')).toBeGreaterThan(0);
  });

  it('accumulates higher score for mixed markdown', () => {
    const mixed = [
      '# Title',
      '',
      'Some **bold** and _italic_ text.',
      '',
      '- item one',
      '- item two',
      '',
      '```',
      'code here',
      '```',
    ].join('\n');
    const score = getMarkdownScore(mixed);
    expect(score).toBeGreaterThan(3);
  });

  it('does not score plain prose highly', () => {
    const prose = [
      'The quick brown fox jumps over the lazy dog.',
      'This sentence has no markdown in it at all.',
      'Another completely normal sentence here.',
    ].join('\n');
    expect(getMarkdownScore(prose)).toBe(0);
  });

  it('does not score JSON', () => {
    const json = JSON.stringify(
      { name: 'test', value: 42, active: true },
      null,
      2,
    );
    expect(getMarkdownScore(json)).toBeLessThan(2);
  });

  it('does not score a single dash as markdown', () => {
    expect(getMarkdownScore('-')).toBe(0);
  });

  it('does not score a single hash without space', () => {
    expect(getMarkdownScore('#nospace')).toBe(0);
  });

  it('does not score HTML as markdown', () => {
    const html =
      '<h1>Title</h1><p><strong>bold</strong></p>';
    expect(getMarkdownScore(html)).toBe(0);
  });
});

describe('isLikelyMarkdown', () => {
  it('returns false for plain text', () => {
    expect(
      isLikelyMarkdown('Hello world, plain text.'),
    ).toBe(false);
  });

  it('returns true for text with a heading', () => {
    expect(isLikelyMarkdown('# Hello World')).toBe(true);
  });

  it('returns true for bold and italic text', () => {
    expect(
      isLikelyMarkdown('This has **bold** and _italic_.'),
    ).toBe(true);
  });

  it('returns true for a bulleted list', () => {
    expect(
      isLikelyMarkdown('- alpha\n- beta\n- gamma'),
    ).toBe(true);
  });

  it('returns true for a code block', () => {
    expect(
      isLikelyMarkdown('```js\nconsole.log("hi");\n```'),
    ).toBe(true);
  });

  it('returns true for a link', () => {
    expect(
      isLikelyMarkdown('[link](https://example.com)'),
    ).toBe(true);
  });

  it('returns true for a blockquote', () => {
    expect(
      isLikelyMarkdown('> Famous quote goes here'),
    ).toBe(true);
  });

  it('returns false for JSON', () => {
    const json = JSON.stringify({ key: 'value' }, null, 2);
    expect(isLikelyMarkdown(json)).toBe(false);
  });

  it('returns false for plain HTML', () => {
    expect(
      isLikelyMarkdown('<p>Hello <strong>world</strong></p>'),
    ).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isLikelyMarkdown('')).toBe(false);
  });

  it('returns false for whitespace only', () => {
    expect(isLikelyMarkdown('   \n\n   ')).toBe(false);
  });
});
