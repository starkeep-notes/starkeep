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

These choices expand the initial data model slightly: notes need a deletion timestamp/state, collections need an optional parent collection ID, and the import/export schema must preserve image content and collection hierarchy.
