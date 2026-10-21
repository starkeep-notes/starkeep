# Starkeep Notebook Plan

## Product direction

Build Starkeep as a unified, local-first personal notebook hosted on the main site. Notes are the primary entity; web pages are optional metadata attached through one or more web references. Website capture is an integration layer, not the organizing foundation.

## Goals

- Create, edit, delete, organize, and search personal notes.
- Support ordinary notes that have no web source.
- Attach multiple web references to a note, including URL, title, and selected text.
- Browse notes by collection, domain, or specific page.
- Keep the first release static and local-only.
- Make data portable through import/export from the beginning.

## Non-goals for the first release

- Accounts, authentication, hosted synchronization, or server-side persistence.
- Browser extension, bookmarklet, or proxy capture workflow.
- Collaborative editing and sharing.
- Treating a website or domain as a container that owns notes.

## Proposed information architecture

### Primary navigation

- **All notes** — complete notebook view with search and sorting.
- **Collections** — project, subject, or workflow groupings.
- **Web references** — notes with attached URLs, grouped/filterable by domain and page.
- **Trash** — optional if soft deletion is selected; otherwise delete permanently with confirmation.

### Core note experience

- Note list with title, preview, collection, updated date, and reference indicator.
- Editor view for title and rich document content.
- Collection assignment from the editor and list views.
- Reference panel for adding, editing, and removing web references.
- Search across note titles, editor text, collection names, and reference metadata.

## Data model

```ts
type Note = {
  id: string;
  title: string;
  content: unknown; // Editor document JSON
  collectionId?: string;
  createdAt: number;
  updatedAt: number;
};

type WebReference = {
  id: string;
  noteId: string;
  url: string;
  title?: string;
  selectedText?: string;
};

type Collection = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};
```

Implementation should use generated IDs, timestamps maintained in one persistence layer, and foreign-key cleanup when notes or collections are removed. If soft deletion is chosen, add a deletion timestamp rather than changing the core relationship model.

## GitHub Pages preparation

The target deployment is the organization site at `https://starkeep-notes.github.io/`, not the current project-site URL. Before application scaffolding:

### Organization and repository setup

- Confirm the `starkeep-notes` organization has Pages enabled and that the organization permits GitHub Actions for the repository.
- Create or rename the deployment repository to exactly `starkeep-notes.github.io`.
- Keep the repository public unless GitHub Pages availability for the organization’s plan has been explicitly verified for private repositories.
- Protect `main` and require pull-request review if the repository will have multiple contributors.
- Configure a repository-level Pages deployment source of **GitHub Actions**, not a committed `gh-pages` branch.
- Confirmed repository: `starkeep-notes/starkeep-notes.github.io`.
- Confirmed Pages URL: `https://starkeep-notes.github.io/`.
- Confirmed Pages deployment source: GitHub Actions workflow from `main`.
- Use that exact origin for storage testing.

### Repository files and configuration

- Add `package.json`, lockfile, TypeScript/Vite configuration, and a reproducible Node.js version declaration such as `.nvmrc` or `engines`.
- Set Vite `base: "/"` for the organization site repository.
- Use `HashRouter` so refreshes and shared links do not require server-side route fallback support.
- Add a GitHub Actions workflow that installs from the lockfile, runs lint/tests/build, uploads `dist/`, and deploys with the official Pages actions.
- Add Pages permissions for the workflow: `contents: read`, `pages: write`, and `id-token: write`.
- Add a concurrency rule so an obsolete deployment cannot race the current deployment.
- Ensure the build does not require secrets, backend environment variables, or private package registries.
- Add a `404.html` only if the final routing strategy or Pages behavior requires it; it is not needed for hash routing.

### Organization and repository security

- Enable two-factor authentication for organization members and use least-privilege repository roles.
- Review Actions settings and allow only the actions needed by the deployment workflow.
- Do not store notebook data, credentials, or personal notes in the repository; GitHub Pages hosts only the static application bundle.
- Decide whether Dependabot alerts, security updates, and secret scanning are available and enable them where appropriate.
- If a custom domain is desired, configure it at the organization/repository Pages settings and DNS provider, then commit a `CNAME` file only after the domain is chosen.

### Deployment validation

- Test the production build locally before enabling Pages.
- After deployment, test the exact Pages origin in a clean browser profile: initial load, refresh on every hash route, browser back/forward, asset loading, IndexedDB persistence, image storage, export, and import.
- Verify that browser storage is scoped to `https://starkeep-notes.github.io` and document that moving to another origin requires export/import.
- Keep a recovery path for failed deployments: the previous successful Pages deployment and a local JSON notebook backup.

## Technical approach

1. **Application shell**
   - Confirm the frontend framework and build tooling before scaffolding.
   - Establish notebook layout, responsive navigation, empty states, loading states, and keyboard-friendly interactions.

2. **Editor**
   - Use a structured document editor whose JSON format can be stored and restored without lossy conversion.
   - Evaluate Quill as the requested UI/editor foundation, but confirm whether the project should use Quill directly or another editor with stronger document-JSON support.

3. **Persistence**
   - Add IndexedDB through Dexie.
   - Define versioned tables for notes, collections, and web references.
   - Keep repository/data-access functions separate from UI components so sync can be added later.

4. **Portability**
   - Export a versioned JSON backup containing notes, collections, references, and metadata.
   - Import with validation, clear conflict behavior, and a confirmation before replacing or merging data.
   - Consider a plain-text/Markdown export only after the structured backup path is stable.

5. **Web references and filters**
   - Add references manually in the first release.
   - Derive domain and page filters from parsed URLs; do not duplicate site ownership fields on notes.
   - Treat malformed or non-HTTP URLs as validation errors unless explicitly supported.

6. **Future capture integration**
   - Keep a small capture-oriented API boundary so a bookmarklet or extension can later create a note/reference payload.
   - Do not add browser permissions or extension infrastructure to the first release.

## User experience and architectural philosophy

The notebook should feel like a dependable local application, even though its static shell is hosted on GitHub Pages. The following principles guide implementation and future changes:

- **Fast after first load:** Keep the application shell lightweight and defer heavier editor functionality until a note is opened or created. Prefer responsive local reads over unnecessary network requests.
- **Never hide persistence state:** Make the IndexedDB lifecycle visible through simple loading, ready, saving, saved-locally, and storage-error states. The interface must not imply that data was saved when persistence failed.
- **Local-first is not automatically offline-first:** Dexie makes note data local, but the initial release does not guarantee that the app shell can be reopened without a network connection. Treat installable offline use as a later PWA milestone.
- **Offline evolution without a rewrite:** A future service worker and manifest may cache the static shell and editor assets, allowing the existing IndexedDB-backed application to reopen offline. Cache versioning and update recovery must be designed deliberately.
- **Navigation should feel app-like:** Use hash routing for reliable GitHub Pages refreshes and direct links. Preserve browser back/forward behavior and keep navigation within the SPA without full-page reloads.
- **Responsive by intent:** Desktop layouts may use a sidebar, while small screens should use compact horizontal, drawer, or bottom navigation. The editor and core actions must remain usable on narrow screens.
- **Autosave with confidence:** Save edits locally using debounced writes and save on meaningful lifecycle boundaries. Show clear local-save feedback rather than requiring users to manage a manual save step.
- **Progressive search:** Start with immediate local filtering appropriate for a personal notebook. Introduce indexing or full-text search only when notebook size makes in-memory search insufficient.
- **Images are data, not decoration:** Validate image size and format early. Begin with a practical document representation, but keep the storage boundary flexible enough to move large image blobs into dedicated IndexedDB records later.
- **Portability is a product feature:** Browser storage is scoped to the exact origin, so localhost, GitHub Pages, and any future custom domain are separate notebooks. Versioned export/import is therefore a backup and migration path, not an optional extra.
- **Fail visibly and recoverably:** Storage failures, malformed imports, and unavailable data need actionable error states. Never silently discard edits or present stale data as current.
- **Stabilize local data before synchronization:** Capture integrations, PWA installation, and multi-device synchronization should build on a stable note/reference payload and import/export format. Synchronization is a later concern involving identity, conflicts, privacy, encryption, and service reliability.

## Delivery phases

### Phase 0 — Confirm decisions and scaffold

- Confirm stack, editor choice, and MVP behavior decisions below.
- Add the application shell and baseline styling.
- Define domain types and repository interfaces.

### Phase 1 — Notebook MVP

- Create, edit, save, and delete notes.
- List and search notes.
- Add and manage collections.
- Filter notes by collection.
- Persist and restore data through Dexie.
- **Implemented:** notes can be assigned to collections, All notes supports collection filtering/search, and collection creation supports one nested parent level.

### Phase 2 — Portability and resilience

- Add versioned import/export.
- Validate imported data and handle duplicate IDs safely.
- Add empty, error, and recovery states.
- Test reload persistence and corrupted/partial import behavior.

### Phase 3 — Web references

- Attach, edit, and remove multiple references per note.
- Display source URL, optional title, and selected text.
- Add domain and page filters.
- Include references in search and export/import.

### Phase 4 — Quality and accessibility

- Add keyboard shortcuts where useful.
- Verify responsive behavior and accessible labels/focus states.
- Add targeted unit/component tests for persistence, search, filtering, and import/export.
- Run the project’s lint, build, and test commands.

### Phase 5 — Optional capture integration

- Design and implement a bookmarklet or extension only after the notebook workflow is stable.
- Reuse the note/reference payload boundary rather than making the website the source of truth.

## Acceptance criteria for the first release

- A user can create a note without a URL and find it after a page reload.
- A user can edit rich content without losing document structure.
- A user can organize notes into collections and search note content/title.
- A note can have zero, one, or multiple web references.
- Domain/page filters are derived from references and do not hide ordinary notes from All notes.
- Export followed by import restores notes, collections, and references.
- The UI works on narrow and wide screens and has usable keyboard/focus behavior.
- No server, account, extension, or third-party capture service is required.

## Confirmed implementation decisions

- **Frontend:** React + Vite + TypeScript.
- **Editor:** Quill.
- **Delete behavior:** Recoverable Trash/soft delete.
- **Import behavior:** Offer merge or replace each time.
- **Initial content blocks:** Plain text, headings, bulleted and numbered lists, links, checklists, and images.
- **Collections:** Nested collections are supported in the first release.
- **Loading:** Provide explicit application, database, ready, and storage-error states; defer the heavier editor where practical.
- **Offline:** The first release is local-data-first, but true offline reopening requires a future service worker and installable PWA layer.
- **Navigation:** Use `HashRouter` for GitHub Pages reliability while preserving SPA navigation and browser history behavior.
- **Autosave:** Prefer debounced local autosave with visible save status and lifecycle-boundary saves.
- **Portability:** Treat versioned JSON export/import as required backup and origin-migration infrastructure.
- **Future direction:** Stabilize local persistence and the note/reference payload boundary before adding capture integrations or synchronization.

These choices expand the initial data model slightly: notes need a deletion timestamp/state, collections need an optional parent collection ID, and the import/export schema must preserve image content and collection hierarchy.
