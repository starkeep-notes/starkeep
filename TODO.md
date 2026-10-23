# Dashboard-inspired UI plan

- [x] Rework the Board into a dashboard grid with summary cards, prominent actions, and Keep-inspired widget hierarchy.
- [x] Polish the compact sidebar rail and active navigation states to match the reference dashboard.
- [x] Restructure widget creation into a three-column template, customization, and live-preview builder.
- [x] Refine the syntax editor with line-oriented presentation, validation status, preview, and cheat sheet.
- [x] Rework Quill, the Tiptap widget builder, and CodeMirror around a shared draft with reliable saves and confirmed rich-text conversion.
- [x] Show a recovery screen instead of a blank page after an uncaught render error.
- [x] Document the reference visual language and verify responsive layouts, local-first backup/merge safety, and GitHub Pages hash-route refreshes.
- [x] Add persisted flexible dashboard editing with dnd-kit: drag-handle ordering, visibility, duplication, and small/medium/large widget sizing.
- [x] Add structured widget blocks: headings, metrics, progress bars, and inline dynamic values.
- [ ] Add widget block reordering, duplication, and deletion controls.
- [ ] Add callout, divider, list, and chart blocks with block-level validation.

## Dashboard ideas

### High-value next steps
1. **Quick capture bar**  
   Add a prominent input for instantly creating notes or widgets.

2. **Widget grouping**  
   Support sections such as *Today*, *Projects*, *Reference*, and *Personal*.

3. **Dashboard views**  
   Add presets like:
   - Focus
   - All widgets
   - Recently edited
   - Pinned only

4. **Widget filters**  
   Filter by collection, type, color, pinned state, or recently updated.

5. **Resizable dashboard columns**  
   Let users adjust grid density and column count.

6. **Widget collapse controls**  
   Collapse large widgets without hiding them.

7. **Recently edited timeline**  
   Display recent notes and widgets as a chronological activity stream.

8. **Favorites and starred notes**  
   Extend pinning with a separate favorite state for notes.

9. **Empty-state onboarding**  
   Provide starter widgets and suggested layouts for new users.

10. **Keyboard shortcuts**  
   Examples:
   - `N` — new note
   - `W` — new widget
   - `/` — search
   - `L` — toggle layout editing

### Keep-inspired polish
- More varied card sizes and playful rotations.
- Color palette selector for dashboard themes.
- Small status labels such as “Draft”, “Updated today”, or “Needs review”.
- Compact widget headers with icons and metadata.
- Pinned widgets displayed above the general widget grid.
- A “shuffle layout” action for experimentation.

### Longer-term features
- Multi-select widgets for bulk hide, delete, or recolor.
- Dashboard layout presets with save/restore.
- Import/export dashboard layouts separately from note data.
- Optional date-based widgets such as calendar, countdown, and daily focus.
- Lightweight charts and statistics based on local notebook data.
