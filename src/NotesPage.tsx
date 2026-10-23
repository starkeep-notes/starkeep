import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate, useParams } from 'react-router-dom'
import type { Board, Collection, Note } from './types'
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
  selected: boolean
  widgetValues: Record<string, string>
  onSelect: () => void
  onEdit: () => void
  onUpdate: (patch: Partial<Note>) => void
  onDuplicate: () => void
}

function SortableWidgetCard({ note, layoutEditing, selected, widgetValues, onSelect, onEdit, onUpdate, onDuplicate }: SortableWidgetCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: note.id, disabled: !layoutEditing || !selected })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }
  const nextWidth = note.widgetSize === 'small' ? 'medium' : note.widgetSize === 'medium' ? 'large' : note.widgetSize === 'large' ? 'wide' : 'small'
  const nextHeight = note.widgetHeight === 'short' ? 'medium' : note.widgetHeight === 'medium' ? 'tall' : 'short'
  return <article ref={setNodeRef} style={style} tabIndex={0} aria-label={`${note.title} widget${selected ? ', selected' : ''}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }} className={`board-widget-card widget-size-${note.widgetSize ?? 'medium'} widget-height-${note.widgetHeight ?? 'medium'} preview-${note.widgetStyle ?? 'cream'} ${selected ? 'selected' : ''} ${layoutEditing && selected ? 'layout-editing' : ''} ${isDragging ? 'is-dragging' : ''}`}>
    {selected && <div className="board-widget-actions" aria-label={`${note.title} actions`}>
      {layoutEditing && <button ref={setActivatorNodeRef} type="button" className="widget-drag-handle" aria-label={`Drag ${note.title}`} {...attributes} {...listeners}>↕ Drag</button>}
      <button type="button" className="board-widget-edit" onClick={onEdit}>Edit</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetPinned: !note.widgetPinned })}>{note.widgetPinned ? 'Unpin' : 'Pin'}</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetSize: nextWidth })}>Width: {nextWidth}</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetHeight: nextHeight })}>Height: {nextHeight}</button>
      <label className="widget-group-picker"><span className="sr-only">Group for {note.title}</span><select value={note.widgetGroup ?? ''} onChange={(event) => onUpdate({ widgetGroup: event.target.value || undefined })}><option value="">Ungrouped</option><option value="Today">Today</option><option value="Projects">Projects</option><option value="Reference">Reference</option><option value="Personal">Personal</option></select></label>
      <button type="button" className="board-widget-action" onClick={onDuplicate}>Duplicate</button>
      <button type="button" className="board-widget-action danger" onClick={() => onUpdate({ widgetHidden: true })}>Hide</button>
    </div>}
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
  const [boards, setBoards] = useState<Board[]>([])
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [activeBoardId, setActiveBoardId] = useState('')
  const [selectedWidgetId, setSelectedWidgetId] = useState('')
  const [layoutEditing, setLayoutEditing] = useState(false)
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false)
  const [boardSettingsMode, setBoardSettingsMode] = useState<'create' | 'manage'>('manage')
  const [boardName, setBoardName] = useState('')
  const [boardStatus, setBoardStatus] = useState('')
  const pendingRequest = useRef(0)
  const boardInitialization = useRef(false)
  useEffect(() => {
    const refresh = () => void Promise.all([notesRepository.list(), database.collections.toArray(), database.boards.toArray()]).then(([loadedNotes, loadedCollections, loadedBoards]) => { setNotes(loadedNotes); setCollections(loadedCollections); setBoards(loadedBoards.sort((a, b) => a.createdAt - b.createdAt)); setBoardsLoaded(true); setActiveBoardId((current) => current || loadedBoards[0]?.id || '') })
    refresh()
    window.addEventListener('starkeep-notes-changed', refresh)
    return () => window.removeEventListener('starkeep-notes-changed', refresh)
  }, [])
  useEffect(() => {
    if (!board || !boardsLoaded || boards.length || boardInitialization.current) return
    boardInitialization.current = true
    const timestamp = now()
    const personal: Board = { id: newId(), name: 'Personal', createdAt: timestamp, updatedAt: timestamp }
    void database.transaction('rw', database.boards, database.notes, async () => {
      await database.boards.add(personal)
      await database.notes.toCollection().modify((note) => { if (note.isWidget && !note.widgetBoardId) note.widgetBoardId = personal.id })
    }).then(() => { setBoards([personal]); setActiveBoardId(personal.id); setNotes((current) => current.map((note) => note.isWidget && !note.widgetBoardId ? { ...note, widgetBoardId: personal.id } : note)) })
  }, [board, boardsLoaded, boards.length, notes])
  const selected = notes.find((note) => note.id === noteId && Boolean(note.deletedAt) === showTrash) ?? null
  const collectionNames = useMemo(() => new Map(collections.map((collection) => [collection.id, collection.name])), [collections])
  const filtered = useMemo(() => notes.filter((note) => !note.isWidget && Boolean(note.deletedAt) === showTrash && (!collectionId || note.collectionId === collectionId) && `${note.title} ${preview(note.content)} ${note.collectionId ? collectionNames.get(note.collectionId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash, collectionId, collectionNames])
  const activeBoard = boards.find((item) => item.id === activeBoardId)
  const noteWidgets = useMemo(() => notes.filter((note) => note.isWidget && !note.deletedAt && !note.widgetHidden && note.widgetBoardId === activeBoardId).sort((a, b) => (a.widgetOrder ?? Number.MAX_SAFE_INTEGER) - (b.widgetOrder ?? Number.MAX_SAFE_INTEGER) || Number(Boolean(b.widgetPinned)) - Number(Boolean(a.widgetPinned)) || b.updatedAt - a.updatedAt), [notes, activeBoardId])
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
  const createBoard = async () => {
    const name = boardName.trim()
    if (!name) { setBoardStatus('Enter a board name.'); return }
    const timestamp = now()
    const newBoard: Board = { id: newId(), name, createdAt: timestamp, updatedAt: timestamp }
    await database.boards.add(newBoard)
    setBoards((current) => [...current, newBoard])
    setActiveBoardId(newBoard.id)
    setSelectedWidgetId('')
    setBoardSettingsMode('manage')
    setBoardName(newBoard.name)
    setBoardStatus('Board created locally.')
  }
  const startCreatingBoard = () => { setSelectedWidgetId(''); setBoardSettingsMode('create'); setBoardName(''); setBoardStatus(''); setBoardSettingsOpen(true) }
  const switchBoard = (item: Board) => { setActiveBoardId(item.id); setSelectedWidgetId(''); setLayoutEditing(false); setBoardSettingsOpen(false); setBoardStatus('') }
  const openBoardSettings = (item = activeBoard) => { if (!item) return; setActiveBoardId(item.id); setSelectedWidgetId(''); setBoardSettingsMode('manage'); setBoardName(item.name); setBoardStatus(''); setBoardSettingsOpen(true) }
  const renameBoard = async () => { if (!activeBoard || !boardName.trim()) { setBoardStatus('Enter a board name.'); return }; const updated = { ...activeBoard, name: boardName.trim(), updatedAt: now() }; await database.boards.put(updated); setBoards((current) => current.map((item) => item.id === updated.id ? updated : item)); setBoardName(updated.name); setBoardStatus('Board renamed locally.') }
  const deleteBoard = async () => {
    if (!activeBoard) return
    if (boards.length <= 1) { setBoardStatus('Keep at least one board. Create another board before deleting this one.'); return }
    const replacement = boards.find((item) => item.id !== activeBoard.id)
    if (!replacement || !window.confirm(`Delete “${activeBoard.name}”? Its widgets will move to “${replacement.name}”.`)) return
    await database.transaction('rw', database.boards, database.notes, async () => {
      await database.notes.where('widgetBoardId').equals(activeBoard.id).modify({ widgetBoardId: replacement.id, updatedAt: now() })
      await database.boards.delete(activeBoard.id)
    })
    setNotes((current) => current.map((note) => note.widgetBoardId === activeBoard.id ? { ...note, widgetBoardId: replacement.id } : note))
    setBoards((current) => current.filter((item) => item.id !== activeBoard.id))
    setActiveBoardId(replacement.id); setSelectedWidgetId(''); setBoardSettingsOpen(false)
  }
  const basePath = board ? '/board' : showTrash ? '/trash' : ''
  const createNote = useCallback(async (asWidget = false) => { const timestamp = now(); const note: Note = { id: newId(), title: asWidget ? 'Untitled widget' : 'Untitled note', content: new Delta(), isWidget: asWidget, widgetStyle: asWidget ? 'cream' : undefined, widgetBoardId: asWidget ? activeBoardId || undefined : undefined, widgetOrder: asWidget ? noteWidgets.length : undefined, createdAt: timestamp, updatedAt: timestamp }; await notesRepository.add(note); setNotes((current) => [note, ...current]); navigate(`${basePath}/notes/${note.id}`) }, [navigate, basePath, noteWidgets.length, activeBoardId])
  useEffect(() => { if (newNoteRequest > 0 && newNoteRequest !== pendingRequest.current) { pendingRequest.current = newNoteRequest; void createNote().finally(() => onNewNoteHandled?.()) } }, [newNoteRequest, onNewNoteHandled, createNote])
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(basePath || '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const heading = board ? 'Board' : showTrash ? 'Trash' : 'All notes'
  const boardNotes = notes.filter((note) => !note.isWidget && !note.deletedAt)
  const pinnedNotes = noteWidgets.filter((note) => note.widgetPinned)
  const hiddenWidgets = notes.filter((note) => note.isWidget && !note.deletedAt && note.widgetHidden && note.widgetBoardId === activeBoardId)
  const widgetGroups = noteWidgets.reduce<Record<string, Note[]>>((groups, note) => { const group = note.widgetGroup || 'Ungrouped'; (groups[group] ??= []).push(note); return groups }, {})
  const latestNote = boardNotes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (board) return <section className="board-view">
    {selected ? <div className="board-editor"><NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate('/board')} backLabel="Board" /></div> : <>
      <header className="board-header"><div className="board-heading" onDoubleClick={() => openBoardSettings()}><span className="board-star" aria-hidden="true">✦</span><div><p className="eyebrow">Your notebook · Home</p><h1>Dashboard</h1><p className="board-subtitle">A clear view of your notes, widgets, and next ideas.</p></div></div><div className="board-switcher" role="group" aria-label="Choose a board">{boards.map((item) => <button key={item.id} className={item.id === activeBoardId ? 'active' : ''} type="button" aria-pressed={item.id === activeBoardId} onClick={() => item.id === activeBoardId ? openBoardSettings(item) : switchBoard(item)} onDoubleClick={() => openBoardSettings(item)}>{item.name}</button>)}<button type="button" disabled={!boardsLoaded} onClick={startCreatingBoard}>＋ New board</button></div><div className="board-controls"><label className="board-search"><span className="sr-only">Search board notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" /></label><button className="board-layout-button" type="button" onClick={() => setLayoutEditing((current) => !current)}>{layoutEditing ? 'Done layout' : 'Edit layout'}</button><button className="board-layout-button" type="button" onClick={() => openBoardSettings()}>Manage board</button><button className="primary-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></div></header>
      {boardSettingsOpen && <section className="board-settings" role="region" aria-labelledby="board-settings-title"><div><p className="eyebrow">Board settings</p><h2 id="board-settings-title">{boardSettingsMode === 'create' ? 'Create board' : `Manage ${activeBoard?.name ?? 'board'}`}</h2></div><label>Board name<input autoFocus value={boardName} onChange={(event) => setBoardName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && boardSettingsMode === 'create') { event.preventDefault(); void createBoard() } }} /></label><div className="board-settings-actions">{boardSettingsMode === 'create' ? <button className="text-button" type="button" onClick={() => void createBoard()}>Create board</button> : <><button className="text-button" type="button" onClick={() => void renameBoard()}>Save name</button><button className="text-button danger" type="button" onClick={() => void deleteBoard()} disabled={boards.length <= 1}>Delete board</button></>}<button className="text-button" type="button" onClick={() => setBoardSettingsOpen(false)}>Close</button></div><p className="board-settings-help">{boardSettingsMode === 'create' ? 'Name a new board. It will be stored only in this browser.' : 'Select the active board again, double-click a board name, or use this keyboard-accessible panel to manage it. Deleting moves its widgets to another board.'}</p>{boardStatus && <p role="status" className="board-settings-status">{boardStatus}</p>}</section>}
            <section className="board-summary" aria-label="Notebook summary"><article className="summary-card summary-welcome"><div className="summary-card-top"><h2>Good to see you</h2><span className="summary-badge">Local-first</span></div><p>{boardNotes.length ? `You have ${boardNotes.length} ${boardNotes.length === 1 ? 'note' : 'notes'} ready to revisit.` : 'Start with a note and make this space yours.'}</p><button className="summary-action" type="button" onClick={() => void createNote()}>＋ New note</button></article><article className="summary-card"><div className="summary-card-top"><h2>Notes</h2><span className="summary-badge">Library</span></div><strong className="summary-number">{boardNotes.length}</strong><p>Ideas saved in your notebook</p></article><article className="summary-card"><div className="summary-card-top"><h2>Pinned widgets</h2><span className="summary-badge">Focus</span></div><strong className="summary-number">{pinnedNotes.length}</strong><p>Widgets kept close at hand</p></article><article className="summary-card summary-latest"><h2>Latest note</h2>{latestNote ? <button className="summary-note-link" type="button" onClick={() => navigate(`/board/notes/${latestNote.id}`)}><strong>{latestNote.title}</strong><span>{preview(latestNote.content)}</span></button> : <p>No notes yet. Capture an idea to see it here.</p>}</article></section>
            <section className="board-widgets" aria-labelledby="board-widgets-heading"><div className="board-section-heading"><div><p className="eyebrow">Flexible spaces</p><h2 id="board-widgets-heading">{activeBoard ? `${activeBoard.name} widgets` : 'Widgets'}</h2></div><div className="board-section-actions"><button className="text-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button>{hiddenWidgets.length > 0 && <span className="hidden-widget-count">{hiddenWidgets.length} hidden</span>}</div></div>{noteWidgets.length === 0 ? <div className="widget-board-empty"><span>✦</span><p>Turn any note into a widget, or start with a reusable template.</p><button className="primary-button" type="button" onClick={() => navigate('/widgets')}>Browse templates</button></div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}><SortableContext items={noteWidgets.map((note) => note.id)} strategy={rectSortingStrategy}><div className="board-widget-groups">{Object.entries(widgetGroups).map(([group, groupedNotes]) => <section className="board-widget-group" key={group} aria-labelledby={`widget-group-${group}`}><div className="widget-group-heading"><h3 id={`widget-group-${group}`}>{group}</h3><span>{groupedNotes.length}</span></div><div className="board-widget-grid">{groupedNotes.map((note) => <SortableWidgetCard key={note.id} note={note} layoutEditing={layoutEditing} selected={selectedWidgetId === note.id} widgetValues={widgetValues} onSelect={() => setSelectedWidgetId(note.id)} onEdit={() => navigate(`/board/notes/${note.id}`)} onUpdate={(patch) => void updateWidget(note, patch)} onDuplicate={() => void duplicateWidget(note)} />)}</div></section>)}</div>            </SortableContext></DndContext>}{hiddenWidgets.length > 0 && <div className="hidden-widget-list" aria-label="Hidden widgets"><span>Hidden widgets</span>{hiddenWidgets.map((note) => <button key={note.id} type="button" onClick={() => void updateWidget(note, { widgetHidden: false })}>{note.title} · Show</button>)}</div>}</section>
    </>}
  </section>
  const list = <aside className="notes-list" aria-label={`${heading} list`}>
    <div className="notes-list-header"><span className="eyebrow">Your notebook</span><h2>{heading}</h2><span className="note-count">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</span></div>
    <label className="search-field"><span className="sr-only">Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Search notes" /></label>
    {!showTrash && collections.length > 0 && <label className="filter-field"><span className="sr-only">Collection</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
    <div className="notes-list-scroll">{filtered.length === 0 ? <p className="list-empty">{showTrash ? 'Trash is empty.' : query ? 'No matching notes.' : 'No notes yet. Start with a new note.'}</p> : filtered.map((note) => <div className={`note-list-item ${selected?.id === note.id ? 'selected' : ''}`} key={note.id}><button type="button" className="note-list-open" onClick={() => navigate(`${showTrash ? '/trash/notes' : '/notes'}/${note.id}`)}><strong>{note.title}</strong><span>{preview(note.content)}</span><small>{note.collectionId ? `${collectionNames.get(note.collectionId) ?? 'Collection'} · ` : ''}{new Date(note.updatedAt).toLocaleDateString()}</small></button>{selected?.id === note.id && <button type="button" className={`note-list-action ${showTrash ? '' : 'danger'}`} onClick={() => { void (showTrash ? restoreNote(note) : trashNote(note)) }}>{showTrash ? 'Restore' : 'Trash'}</button>}</div>)}</div>
    {!showTrash && <button type="button" className="list-new" onClick={() => void createNote()}>＋ New note</button>}
  </aside>
  return <section className={`notes-workspace ${selected ? 'has-selection' : ''}`}>{list}<div className="notes-detail">{selected ? <NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate(showTrash ? '/trash' : '/')} backLabel={showTrash ? 'Trash' : 'All notes'} /> : <div className="welcome-panel"><span className="welcome-star" aria-hidden="true">✦</span><p className="eyebrow">A space for your thoughts</p><h1>{showTrash ? 'The little things stay here.' : 'Make room for ideas.'}</h1><p className="muted">{showTrash ? 'Select a note to review or restore it.' : 'Select a note on the left, or start with a fresh page.'}</p>{!showTrash && <button className="primary-button" type="button" onClick={() => void createNote()}>＋ Write a note</button>}</div>}</div></section>
}
