# Starkeep Project Guidelines

## Project shape
- Starkeep is a local-first React notebook built with Vite and TypeScript.
- The app stores notebook data in IndexedDB through Dexie; keep persistence origin-local and preserve backup/import behavior.
- Routing uses `HashRouter` for GitHub Pages compatibility. Keep routes refreshable under the deployed static site.
- Main UI areas live in `src/App.tsx` and `src/NotesPage.tsx`; persistence and domain helpers are separate modules in `src/`.
- Treat `references/` as design/reference material, not application runtime code.

## Code style
- Use the existing TypeScript, React, and CSS patterns in `src/`.
- Prefer small, typed React components and repository/helper functions over duplicating IndexedDB or browser-storage logic in components.
- Preserve accessible labels, button semantics, status/alert roles, and responsive behavior when changing UI.
- Avoid adding comments unless they clarify non-obvious behavior.

## Build and validation
- Use Node.js 22 as specified by [.nvmrc](../.nvmrc).
- Install with `npm install`; use `npm ci` in CI-like validation.
- Run `npm run lint`, `npm run build`, and focused `npm run test` checks relevant to the change.
- Do not edit generated `dist/` output; regenerate it with the build when needed.

## Delivery
- Keep changes focused and update directly related documentation when behavior changes.
- Before completing a change, verify local-first storage, import/export safety, responsive layouts, and GitHub Pages routing are not regressed.
