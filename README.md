# Starkeep

Starkeep is a local-first personal notebook for notes, collections, and optional web references. Its compact sticker workspace keeps a searchable note list beside the editor on larger screens and switches to a single-pane view on phones. Use the theme selector in the navigation rail to switch between Sticker, Quiet minimal, and Dark ink; your choice stays on this device.

## Local development

Requirements: Node.js 22 (see [.nvmrc](./.nvmrc)).

```bash
npm install
npm run dev
```

Run the quality checks before opening a pull request:

```bash
npm run lint
npm run build
```

## Editing notes and widgets

Notes use a rich-text editor. Widgets have a visual builder and a syntax editor that edit the same widget content. Switching an existing rich-text note to a widget converts its content to plain widget text; the app asks for confirmation before formatting is lost. Switching a widget back to a note keeps its text, but does not restore previous rich formatting. Changes are saved locally in this browser.

## GitHub Pages

The `main` branch deploys through [GitHub Actions](./.github/workflows/deploy.yml) to [starkeep-notes.github.io](https://starkeep-notes.github.io/). The app uses hash routing, so notebook routes remain available when refreshed on GitHub Pages.

## Local-first storage

The notebook will store data in IndexedDB in the browser. Storage belongs to the exact origin, so localhost, the deployed site, and any future custom domain have separate notebooks. Use **Backup & recovery** in the navigation to export a versioned JSON backup or import one from another origin/device. Imports are validated before writing; merge assigns new IDs when needed, while replace clears the current notebook only after confirmation. Backups preserve notes, collections, and web references.
