Here are the highest-value additions I’d consider next for Starkeep’s board and widget system.

## Highest priority

### 1. Widget management
Add basic controls directly on each widget:

- Duplicate widget
- Delete widget
- Hide/show widget
- Rename widget
- Pin/favorite widget
- “Move to…” or drag-to-reorder

A small `⋯` menu on each widget card would keep the board clean.

### 2. Drag-and-drop board layout
Let users rearrange notes and widgets freely:

- Two-column or three-column layout
- Widget width options: small, medium, wide
- Drag handles
- Persist board positions locally
- Optional “compact mode”

This would make the board feel like a personal dashboard rather than a list.

### 3. Better saved widget flow
The current template editor should support a clearer distinction between:

- **Create widget**
- **Save changes**
- **Save as new widget**

Also add a widget name field, for example:

> Widget name: “Weekly progress”

That is more useful than deriving the name from the selected preset.

### 4. Widget gallery
Expand the preset library with useful notebook-oriented widgets:

- Recent notes
- Notes created today
- Unfinished ideas
- Random note
- Collection summary
- Writing streak
- Word count
- Weekly activity
- “On this day”
- Favorite notes
- Quick capture
- Daily intention
- Quote from my notes

## Improve the template system

### 5. More visual blocks
Instead of making everything plain text, add supported blocks:

- Heading
- Quote
- Stat
- Progress bar
- Divider
- Note preview
- Collection list
- Button/link
- Icon or emoji
- Empty-state message

Users could build widgets visually while power users still use template syntax.

### 6. Real conditional rendering
Implement the syntax already hinted at in the UI:

```text
{{#if notes.created_today}}
You wrote today.
{{else}}
Capture one idea today.
{{/if}}
```

Useful supported conditions could include:

- Value exists
- Value is greater than zero
- Date comparisons
- Collection is empty
- Notes match a search

Avoid arbitrary JavaScript expressions.

### 7. Loops over notebook data
Support controlled loops such as:

```text
{{#each notes.recent}}
- {{title}}
{{/each}}
```

Start with fixed datasets:

- Recent notes
- Favorite notes
- Notes in a collection
- Recently edited notes

Add a maximum item limit to prevent oversized widgets.

### 8. Formatting filters
Add safe formatting helpers:

```text
{{date.today | date}}
{{notes.total | number}}
{{notes.words | compact}}
{{note.title | truncate:40}}
```

Good initial filters:

- `date`
- `number`
- `uppercase`
- `lowercase`
- `truncate`
- `default`
- `pluralize`

## Board UX improvements

### 9. Board sections
Allow users to create sections such as:

- Today
- Projects
- Personal
- Inspiration
- Progress

Widgets and notes could be assigned to sections, making larger boards easier to scan.

### 10. Board editing mode
Add a toggle:

> Edit board

In edit mode users can:

- Rearrange cards
- Resize widgets
- Rename sections
- Remove widgets
- Change layout

Normal mode stays visually calm and interaction-focused.

### 11. Board themes
Allow a board-specific visual style independent of the global theme:

- Paper
- Grid
- Dark canvas
- Soft pastel
- Monochrome
- Sticker collage

You already have theme infrastructure, so this could build on it cleanly.

### 12. Quick-add command menu
A keyboard shortcut such as `⌘K` or `Ctrl+K` could open:

- New note
- Add widget
- Search notes
- Insert dynamic value
- Switch board section
- Open recently edited note

This would be particularly valuable for power users.

## Data and persistence

### 13. Better widget storage
Move widgets from `localStorage` into Dexie alongside notes. This enables:

- Backup and restore
- Multiple widgets
- Safer structured data
- Future sync support
- Widget ordering and layout fields
- Version migrations

A useful model might include:

```ts
type Widget = {
  id: string
  name: string
  template: string
  style: WidgetStyle
  position: number
  width: 'small' | 'medium' | 'wide'
  sectionId?: string
  createdAt: number
  updatedAt: number
}
```

### 14. Include widgets in backup/export
The current backup flow should eventually include:

- Widget definitions
- Board layout
- Widget styles
- Sections
- Ordering

This is especially important once users invest time building custom widgets.

### 15. Import/export templates
Support sharing individual widget definitions as JSON:

- Export widget
- Import widget
- Copy template
- Duplicate imported widget
- Validate unsupported fields

A template gallery can come later after this foundation exists.

## Quality-of-life features

### 16. Error and preview states
Improve the template editor with:

- Unknown variable warnings
- Unclosed block warnings
- Invalid filter warnings
- Preview fallback content
- Line numbers
- “Jump to error”
- Reset to preset

### 17. Data picker improvements
The dynamic-value picker could include:

- Search
- Categories
- Descriptions
- Example output
- Insert-at-cursor instead of append-to-end
- Recently used fields
- Favorites

### 18. Mobile board experience
On mobile:

- Horizontal widget carousel
- Sticky “Add” button
- Bottom-sheet template picker
- Swipe actions for edit/delete
- Collapsible note and widget sections

## Recommended next sequence

I’d implement these in this order:

1. Move widgets into Dexie
2. Add rename, duplicate, delete, and save-as-new
3. Include widgets in backup/export
4. Add drag-to-reorder and widget widths
5. Add more notebook widgets
6. Implement conditionals
7. Add visual blocks
8. Add loops and template gallery

The most important architectural decision is moving widgets out of `localStorage` before adding more features. That will make persistence, backup, ordering, editing, and future synchronization much easier.

Add browser-level automation

Use Playwright to create a note, verify widget values become non-zero, and confirm reactive updates after editing.
Improve widget ordering

Add move-up/move-down controls or drag-and-drop ordering instead of only sorting pinned widgets first.
Improve template management

Add permanent template deletion alongside the current hide behavior.
Add template categories or search.
Improve cross-tab synchronization

Replace the custom browser event with Dexie live queries or a shared state layer so multiple tabs stay synchronized.
Accessibility polish

Add Escape-key handling, focus trapping, and focus restoration to the template guide dialog.
Reduce existing warnings

Refactor the ref access and synchronous effect state updates reported in App.tsx and NoteEditor.tsx.