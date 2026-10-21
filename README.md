# Starkeep

Starkeep is a local-first personal notebook for notes, collections, and optional web references.

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

## GitHub Pages

The `main` branch deploys through [GitHub Actions](./.github/workflows/deploy.yml) to [starkeep-notes.github.io](https://starkeep-notes.github.io/). The app uses hash routing, so notebook routes remain available when refreshed on GitHub Pages.

## Local-first storage

The notebook will store data in IndexedDB in the browser. Storage belongs to the exact origin, so localhost, the deployed site, and any future custom domain have separate notebooks. Use the planned JSON export/import flow to back up or move data between origins and devices.
