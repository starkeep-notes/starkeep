import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate, useParams } from 'react-router-dom'
import type { Collection, Note } from './types'
import { renderWidgetTemplate, createTemplateValues } from './widgetTemplates'
import { database } from './db'
import { notesRepository } from './notesRepository'
import { NoteEditor } from './NoteEditor'
import Delta from 'quill-delta'

const now = () => Date.now()
const newId = () => crypto.randomUUID()
const preview = (content: Note['content']) => content.ops.map((op) => typeof op.insert === 'string' ? op.insert : '').join('').trim() || 'Empty note'
const noteWidgetPreview = (content: Note['content'], values: Record<string, string>) => renderWidgetTemplate(preview(content), values).split('\n').filter(Boolean).slice(0, 3)
const widgetLine = (line: string) => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^\s*>\s*/, '').replace(/[“”]/g, '')

type SortableWidgetCardProps = {
  note: Note
  layoutEditing: boolean
  widgetValues: Record<string, string>
  onEdit: () => void
  onUpdate: (patch: Partial<Note>) => void
  onDuplicate: () => void
}

function SortableWidgetCard({ note, layoutEditing, widgetValues, onEdit, onUpdate, onDuplicate }: SortableWidgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id, disabled: !layoutEditing })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }
  return <article ref={setNodeRef} style={style} className={`board-widget-card widget-size-${note.widgetSize ?? 'medium'} preview-${note.widgetStyle ?? 'cream'} ${layoutEditing ? 'layout-editing' : ''} ${isDragging ? 'is-dragging' : ''}`} {...attributes} {...listeners}>
    <div className="board-widget-actions">
      <button type="button" className="board-widget-edit" aria-label={`Edit ${note.title}`} onClick={onEdit}>Edit</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetPinned: !note.widgetPinned })} aria-label={note.widgetPinned ? 'Unpin widget' : 'Pin widget'}>{note.widgetPinned ? '★' : '☆'}</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetSize: note.widgetSize === 'small' ? 'medium' : note.widgetSize === 'medium' ? 'large' : note.widgetSize === 'large' ? 'wide' : 'small' })} aria-label={`Resize ${note.title}`}>↔</button>
      <button type="button" className="board-widget-action" onClick={onDuplicate} aria-label={`Duplicate ${note.title}`}>＋</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetHidden: true })} aria-label={`Hide ${note.title}`}>×</button>
    </div>
    <span className="widget-card-label">{note.widgetPinned ? 'Custom widget' : 'Note widget'} {note.content.ops.some((op) => typeof op.insert === 'string' && op.insert.includes('{{')) ? ' · {{ }}' : ' · Template'}</span>
    <div className="widget-card-content">{noteWidgetPreview(note.content, widgetValues).map((line, index) => <p className={index === 0 ? 'widget-card-lead' : ''} key={`${line}-${index}`}>{widgetLine(line)}</p>)}</div>
  </article>
}

export function NotesPage({ showTrash = false, board = false, newNoteRequest = 0, onNewNoteHandled }: { showTrash?: boolean; board?: boolean; newNoteRequest?: number; onNewNoteHandled?: () => void }) {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [layoutEditing, setLayoutEditing] = useState(false)
  const pendingRequest = useRef(0)
  useEffect(() => {
    const refresh = () => void Promise.all([notesRepository.list(), database.collections.toArray()]).then(([loadedNotes, loadedCollections]) => { setNotes(loadedNotes); setCollections(loadedCollections) })
    refresh()
    window.addEventListener('starkeep-notes-changed', refresh)
    return () => window.removeEventListener('starkeep-notes-changed', refresh)
  }, [])
  const selected = notes.find((note) => note.id === noteId && Boolean(note.deletedAt) === showTrash) ?? null
  const collectionNames = useMemo(() => new Map(collections.map((collection) => [collection.id, collection.name])), [collections])
  const filtered = useMemo(() => notes.filter((note) => !note.isWidget && Boolean(note.deletedAt) === showTrash && (!collectionId || note.collectionId === collectionId) && `${note.title} ${preview(note.content)} ${note.collectionId ? collectionNames.get(note.collectionId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash, collectionId, collectionNames])
  const noteWidgets = useMemo(() => notes.filter((note) => note.isWidget && !note.deletedAt && !note.widgetHidden).sort((a, b) => (a.widgetOrder ?? Number.MAX_SAFE_INTEGER) - (b.widgetOrder ?? Number.MAX_SAFE_INTEGER) || Number(Boolean(b.widgetPinned)) - Number(Boolean(a.widgetPinned)) || b.updatedAt - a.updatedAt), [notes])
  const widgetValues = useMemo(() => createTemplateValues(notes), [notes])
  const updateWidget = async (note: Note, patch: Partial<Note>) => { const updated = { ...note, ...patch, updatedAt: Date.now() }; await notesRepository.save(updated); setNotes((current) => current.map((item) => item.id === note.id ? updated : item)) }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const reorderWidgets = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const ordered = noteWidgets.slice()
    const draggedIndex = ordered.findIndex((item) => item.id === draggedId)
    const targetIndex = ordered.findIndex((item) => item.id === targetId)
    if (draggedIndex < 0 || targetIndex < 0) return
    const [dragged] = ordered.splice(draggedIndex, 1)
    ordered.splice(targetIndex, 0, dragged)
    const timestamp = Date.now()
    const updated = ordered.map((item, index) => ({ ...item, widgetOrder: index, updatedAt: timestamp }))
    await Promise.all(updated.map((item) => notesRepository.save(item)))
    setNotes((current) => current.map((item) => updated.find((changed) => changed.id === item.id) ?? item))
  }
  const handleWidgetDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = noteWidgets.findIndex((note) => note.id === active.id)
    const newIndex = noteWidgets.findIndex((note) => note.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    void reorderWidgets(String(active.id), String(over.id))
  }
  const duplicateWidget = async (note: Note) => {
    const timestamp = Date.now()
    const duplicate: Note = { ...note, id: newId(), title: `${note.title} copy`, widgetPinned: false, widgetHidden: false, widgetOrder: noteWidgets.length, createdAt: timestamp, updatedAt: timestamp }
    await notesRepository.add(duplicate)
    setNotes((current) => [...current, duplicate])
  }
  const basePath = board ? '/board' : showTrash ? '/trash' : ''
  const createNote = useCallback(async (asWidget = false) => { const timestamp = now(); const note: Note = { id: newId(), title: asWidget ? 'Untitled widget' : 'Untitled note', content: new Delta(), isWidget: asWidget, widgetStyle: asWidget ? 'cream' : undefined, widgetOrder: asWidget ? noteWidgets.length : undefined, createdAt: timestamp, updatedAt: timestamp }; await notesRepository.add(note); setNotes((current) => [note, ...current]); navigate(`${basePath}/notes/${note.id}`) }, [navigate, basePath, noteWidgets.length])
  useEffect(() => { if (newNoteRequest > 0 && newNoteRequest !== pendingRequest.current) { pendingRequest.current = newNoteRequest; void createNote().finally(() => onNewNoteHandled?.()) } }, [newNoteRequest, onNewNoteHandled, createNote])
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(basePath || '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const heading = board ? 'Board' : showTrash ? 'Trash' : 'All notes'
  const boardNotes = notes.filter((note) => !note.isWidget && !note.deletedAt)
  const pinnedNotes = noteWidgets.filter((note) => note.widgetPinned)
  const hiddenWidgets = notes.filter((note) => note.isWidget && !note.deletedAt && note.widgetHidden)
  const latestNote = boardNotes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (board) return <section className="board-view">
    {selected ? <div className="board-editor"><NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate('/board')} backLabel="Board" /></div> : <>
      <header className="board-header"><div className="board-heading"><span className="board-star" aria-hidden="true">✦</span><div><p className="eyebrow">Your notebook · Home</p><h1>Dashboard</h1><p className="board-subtitle">A clear view of your notes, widgets, and next ideas.</p></div></div><div className="board-controls"><label className="board-search"><span className="sr-only">Search board notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" /></label><button className="board-layout-button" type="button" onClick={() => setLayoutEditing((current) => !current)}>{layoutEditing ? 'Done layout' : 'Edit layout'}</button><button className="primary-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></div></header>
            <section className="board-summary" aria-label="Notebook summary"><article className="summary-card summary-welcome"><div className="summary-card-top"><h2>Good to see you</h2><span className="summary-badge">Local-first</span></div><p>{boardNotes.length ? `You have ${boardNotes.length} ${boardNotes.length === 1 ? 'note' : 'notes'} ready to revisit.` : 'Start with a note and make this space yours.'}</p><button className="summary-action" type="button" onClick={() => void createNote()}>＋ New note</button></article><article className="summary-card"><div className="summary-card-top"><h2>Notes</h2><span className="summary-badge">Library</span></div><strong className="summary-number">{boardNotes.length}</strong><p>Ideas saved in your notebook</p></article><article className="summary-card"><div className="summary-card-top"><h2>Pinned widgets</h2><span className="summary-badge">Focus</span></div><strong className="summary-number">{pinnedNotes.length}</strong><p>Widgets kept close at hand</p></article><article className="summary-card summary-latest"><h2>Latest note</h2>{latestNote ? <button className="summary-note-link" type="button" onClick={() => navigate(`/board/notes/${latestNote.id}`)}><strong>{latestNote.title}</strong><span>{preview(latestNote.content)}</span></button> : <p>No notes yet. Capture an idea to see it here.</p>}</article></section>
            <section className="board-widgets" aria-labelledby="board-widgets-heading"><div className="board-section-heading"><div><p className="eyebrow">Flexible spaces</p><h2 id="board-widgets-heading">Widgets</h2></div><div className="board-section-actions"><button className="text-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button>{hiddenWidgets.length > 0 && <span className="hidden-widget-count">{hiddenWidgets.length} hidden</span>}</div></div>{noteWidgets.length === 0 ? <div className="widget-board-empty"><span>✦</span><p>Turn any note into a widget, or start with a reusable template.</p><button className="primary-button" type="button" onClick={() => navigate('/widgets')}>Browse templates</button></div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}><SortableContext items={noteWidgets.map((note) => note.id)} strategy={rectSortingStrategy}><div className="board-widget-grid">{noteWidgets.map((note) => <SortableWidgetCard key={note.id} note={note} layoutEditing={layoutEditing} widgetValues={widgetValues} onEdit={() => navigate(`/board/notes/${note.id}`)} onUpdate={(patch) => void updateWidget(note, patch)} onDuplicate={() => void duplicateWidget(note)} />)}</div>            </SortableContext></DndContext>}{hiddenWidgets.length > 0 && <div className="hidden-widget-list" aria-label="Hidden widgets"><span>Hidden widgets</span>{hiddenWidgets.map((note) => <button key={note.id} type="button" onClick={() => void updateWidget(note, { widgetHidden: false })}>{note.title} · Show</button>)}</div>}</section>
    </>}
  </section>
  const list = <aside className="notes-list" aria-label={`${heading} list`}>
    <div className="notes-list-header"><span className="eyebrow">Your notebook</span><h2>{heading}</h2><span className="note-count">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</span></div>
    <label className="search-field"><span className="sr-only">Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Search notes" /></label>
    {!showTrash && collections.length > 0 && <label className="filter-field"><span className="sr-only">Collection</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
    <div className="notes-list-scroll">{filtered.length === 0 ? <p className="list-empty">{showTrash ? 'Trash is empty.' : query ? 'No matching notes.' : 'No notes yet. Start with a new note.'}</p> : filtered.map((note) => <div className={`note-list-item ${selected?.id === note.id ? 'selected' : ''}`} key={note.id}><button type="button" className="note-list-open" onClick={() => navigate(`${showTrash ? '/trash/notes' : '/notes'}/${note.id}`)}><strong>{note.title}</strong><span>{preview(note.content)}</span><small>{note.collectionId ? `${collectionNames.get(note.collectionId) ?? 'Collection'} · ` : ''}{new Date(note.updatedAt).toLocaleDateString()}</small></button><button type="button" className={`note-list-action ${showTrash ? '' : 'danger'}`} onClick={() => { void (showTrash ? restoreNote(note) : trashNote(note)) }}>{showTrash ? 'Restore' : 'Trash'}</button></div>)}</div>
    {!showTrash && <button type="button" className="list-new" onClick={() => void createNote()}>＋ New note</button>}
  </aside>
  return <section className={`notes-workspace ${selected ? 'has-selection' : ''}`}>{list}<div className="notes-detail">{selected ? <NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate(showTrash ? '/trash' : '/')} backLabel={showTrash ? 'Trash' : 'All notes'} /> : <div className="welcome-panel"><span className="welcome-star" aria-hidden="true">✦</span><p className="eyebrow">A space for your thoughts</p><h1>{showTrash ? 'The little things stay here.' : 'Make room for ideas.'}</h1><p className="muted">{showTrash ? 'Select a note to review or restore it.' : 'Select a note on the left, or start with a fresh page.'}</p>{!showTrash && <button className="primary-button" type="button" onClick={() => void createNote()}>＋ Write a note</button>}</div>}</div></section>
}
