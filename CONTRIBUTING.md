# Contributing

## Prerequisites

- Node 18+
- pnpm 9+

## Getting started

```sh
git clone https://github.com/Bannermedia-ltd/lexical-markdown-paste.git
cd lexical-markdown-paste
pnpm install
pnpm test
```

## Development workflow

```sh
pnpm test:watch   # run tests in watch mode
pnpm lint         # ESLint
pnpm typecheck    # TypeScript type checking
pnpm build        # build for distribution
```

## Pull request guidelines

- One feature or fix per PR.
- Tests are required. PRs without coverage will not
  be merged.
- All CI checks must pass before review.
- Keep changes focused. Unrelated refactors belong
  in a separate PR.

## Code style

- TypeScript strict mode.
- ESLint enforced (see `eslint.config.js`).
- 80 character line limit.
- No comments that restate what the code does —
  comment *why*, not *what*.
