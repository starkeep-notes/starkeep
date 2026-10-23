import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate, useParams } from 'react-router-dom'
import type { Board, BoardGroup, Collection, Note } from './types'
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

type ResizeHandleProps = {
  label: string
  span: number
  onCommit: (span: number) => void
}

function ResizeHandle({ label, span, onCommit }: ResizeHandleProps) {
  const start = useRef({ x: 0, span })
  const latest = useRef(span)
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const grid = event.currentTarget.closest('.board-notes-grid, .board-widget-grid, .board-widget-groups')
    if (!grid) return
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
    const columnWidth = grid.getBoundingClientRect().width / columns
    start.current = { x: event.clientX, span }
    latest.current = span
    event.currentTarget.setPointerCapture(event.pointerId)
    const update = (clientX: number) => {
      latest.current = Math.max(1, Math.min(columns, start.current.span + Math.round((clientX - start.current.x) / columnWidth)))
    }
    const move = (moveEvent: PointerEvent) => update(moveEvent.clientX)
    const finish = (finishEvent: PointerEvent) => {
      update(finishEvent.clientX)
      onCommit(latest.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }
  return <button type="button" className="board-resize-handle" aria-label={`Drag to resize ${label}`} onPointerDown={onPointerDown}>↔ Resize</button>
}

type SortableWidgetCardProps = {
  note: Note
  layoutEditing: boolean
  selected: boolean
  resizing: boolean
  widgetValues: Record<string, string>
  groups: BoardGroup[]
  onSelect: () => void
  onEdit: () => void
  onUpdate: (patch: Partial<Note>) => void
  onResize: () => void
  onDuplicate: () => void
  onCardRef: (element: HTMLElement | null) => void
}

function SortableWidgetCard({ note, layoutEditing, selected, resizing, widgetValues, groups, onSelect, onEdit, onUpdate, onResize, onDuplicate, onCardRef }: SortableWidgetCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: note.id, disabled: !layoutEditing || !selected })
  const setCardRef = (element: HTMLElement | null) => { setNodeRef(element); onCardRef(element) }
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }
  const nextHeight = note.widgetHeight === 'short' ? 'medium' : note.widgetHeight === 'medium' ? 'tall' : 'short'
  return <article ref={setCardRef} data-widget-id={note.id} style={style} tabIndex={0} aria-label={`${note.title} widget${selected ? ', selected' : ''}`} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }} className={`board-widget-card widget-size-${note.widgetSize ?? 'medium'} widget-height-${note.widgetHeight ?? 'medium'} preview-${note.widgetStyle ?? 'cream'} ${selected ? 'selected' : ''} ${resizing ? 'resize-mode' : ''} ${layoutEditing && selected ? 'layout-editing' : ''} ${isDragging ? 'is-dragging' : ''}`}>
    {selected && <div className="board-widget-actions" aria-label={`${note.title} actions`}>
      {layoutEditing && <button ref={setActivatorNodeRef} type="button" className="widget-drag-handle" aria-label={`Drag ${note.title}`} {...attributes} {...listeners}>↕ Drag</button>}
      <button type="button" className="board-widget-edit" onClick={onEdit}>Edit</button>
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetPinned: !note.widgetPinned })}>{note.widgetPinned ? 'Unpin' : 'Pin'}</button>
      <button type="button" className="board-widget-action" onClick={onResize}>{resizing ? 'Done resize' : 'Resize'}</button>
      {resizing && <><label className="widget-size-picker"><span>Width</span><select value={note.widgetSize ?? 'medium'} onChange={(event) => onUpdate({ widgetSize: event.target.value as NonNullable<Note['widgetSize']> })}>{(['small', 'medium', 'large', 'wide'] as const).map((size) => <option key={size} value={size}>{size}</option>)}</select></label><ResizeHandle label={note.title} span={note.widgetSize === 'small' ? 1 : note.widgetSize === 'medium' || !note.widgetSize ? 2 : 3} onCommit={(span) => onUpdate({ widgetSize: span === 1 ? 'small' : span === 2 ? 'medium' : 'large' })} /></>}
      <button type="button" className="board-widget-action" onClick={() => onUpdate({ widgetHeight: nextHeight })}>Height: {nextHeight}</button>
      <label className="widget-group-picker"><span className="sr-only">Group for {note.title}</span><select value={note.groupId ?? ''} onChange={(event) => onUpdate({ groupId: event.target.value || undefined })}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
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
  const [boardGroups, setBoardGroups] = useState<BoardGroup[]>([])
  const [groupName, setGroupName] = useState('')
  const [groupStatus, setGroupStatus] = useState('')
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [activeBoardId, setActiveBoardId] = useState('')
  const [selectedWidgetId, setSelectedWidgetId] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [resizeTarget, setResizeTarget] = useState('')
  const [layoutEditing, setLayoutEditing] = useState(false)
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false)
  const [boardSettingsMode, setBoardSettingsMode] = useState<'create' | 'manage'>('manage')
  const [boardName, setBoardName] = useState('')
  const [boardStatus, setBoardStatus] = useState('')
  const pendingRequest = useRef(0)
  const boardInitialization = useRef(false)
  const boardAssociationInitialization = useRef(false)
  const widgetCardRefs = useRef(new Map<string, HTMLElement>())
  const noteCardRefs = useRef(new Map<string, HTMLElement>())
  const groupRefs = useRef(new Map<string, HTMLElement>())
  const boardSettingsTriggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const refresh = () => void Promise.all([notesRepository.list(), database.collections.toArray(), database.boards.toArray(), database.boardGroups.toArray()]).then(([loadedNotes, loadedCollections, loadedBoards, loadedGroups]) => { setNotes(loadedNotes); setCollections(loadedCollections); setBoardGroups(loadedGroups.sort((a, b) => a.order - b.order)); setBoards(loadedBoards.sort((a, b) => a.createdAt - b.createdAt)); setBoardsLoaded(true); setActiveBoardId((current) => current || loadedBoards[0]?.id || '') })
    refresh()
    window.addEventListener('starkeep-notes-changed', refresh)
    return () => window.removeEventListener('starkeep-notes-changed', refresh)
  }, [])
  useEffect(() => {
    if (!board || !boardsLoaded || boards.length || boardInitialization.current) return
    boardInitialization.current = true
    const timestamp = now()
    const personal: Board = { id: newId(), name: 'Personal', createdAt: timestamp, updatedAt: timestamp }
    void database.transaction('rw', database.boards, database.notes, database.boardGroups, async () => {
      await database.boards.add(personal)
      await database.notes.toCollection().modify((note) => { if (note.isWidget && !note.widgetBoardId) note.widgetBoardId = personal.id })
    }).then(() => { setBoards([personal]); setActiveBoardId(personal.id); setNotes((current) => current.map((note) => note.isWidget && !note.widgetBoardId ? { ...note, widgetBoardId: personal.id } : note)) })
  }, [board, boardsLoaded, boards.length, notes])
  useEffect(() => {
    if (!board || !boardsLoaded || boards.length === 0 || boardAssociationInitialization.current) return
    boardAssociationInitialization.current = true
    const boardId = boards[0].id
    void database.notes.toCollection().modify((note) => {
      if (note.isWidget ? !note.widgetBoardId : !note.boardId) {
        if (note.isWidget) note.widgetBoardId = boardId
        else note.boardId = boardId
      }
    }).then(() => setNotes((current) => current.map((note) => note.isWidget ? (note.widgetBoardId ? note : { ...note, widgetBoardId: boardId }) : (note.boardId ? note : { ...note, boardId }))))
  }, [board, boardsLoaded, boards])
  useEffect(() => {
    if (!board || (!selectedWidgetId && !selectedNoteId && !selectedGroupId && !resizeTarget)) return
    const clearSelection = () => { setSelectedWidgetId(''); setSelectedNoteId(''); setSelectedGroupId(''); setResizeTarget('') }
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.board-note-card, .board-widget-card, .board-widget-group')) clearSelection()
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      const widgetId = selectedWidgetId
      const noteId = selectedNoteId
      const groupId = selectedGroupId
      clearSelection()
      requestAnimationFrame(() => (widgetId ? widgetCardRefs.current.get(widgetId) : noteId ? noteCardRefs.current.get(noteId) : groupId ? groupRefs.current.get(groupId) : undefined)?.focus())
    }
    document.addEventListener('pointerdown', dismissOnOutsidePointer)
    document.addEventListener('keydown', dismissOnEscape)
    return () => { document.removeEventListener('pointerdown', dismissOnOutsidePointer); document.removeEventListener('keydown', dismissOnEscape) }
  }, [board, selectedWidgetId, selectedNoteId, selectedGroupId, resizeTarget])
  useEffect(() => {
    if (!boardSettingsOpen) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setBoardSettingsOpen(false)
      requestAnimationFrame(() => boardSettingsTriggerRef.current?.focus())
    }
    document.addEventListener('keydown', dismissOnEscape)
    return () => document.removeEventListener('keydown', dismissOnEscape)
  }, [boardSettingsOpen])
  const selected = notes.find((note) => note.id === noteId && Boolean(note.deletedAt) === showTrash) ?? null
  const collectionNames = useMemo(() => new Map(collections.map((collection) => [collection.id, collection.name])), [collections])
  const filtered = useMemo(() => notes.filter((note) => !note.isWidget && Boolean(note.deletedAt) === showTrash && (!collectionId || note.collectionId === collectionId) && `${note.title} ${preview(note.content)} ${note.collectionId ? collectionNames.get(note.collectionId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash, collectionId, collectionNames])
  const activeBoard = boards.find((item) => item.id === activeBoardId)
  const noteWidgets = useMemo(() => notes.filter((note) => note.isWidget && !note.deletedAt && !note.widgetHidden && note.widgetBoardId === activeBoardId).sort((a, b) => (a.widgetOrder ?? Number.MAX_SAFE_INTEGER) - (b.widgetOrder ?? Number.MAX_SAFE_INTEGER) || Number(Boolean(b.widgetPinned)) - Number(Boolean(a.widgetPinned)) || b.updatedAt - a.updatedAt), [notes, activeBoardId])
  const widgetValues = useMemo(() => createTemplateValues(notes), [notes])
  const updateWidget = async (note: Note, patch: Partial<Note>) => { const updated = { ...note, ...patch, updatedAt: Date.now() }; await notesRepository.save(updated); setNotes((current) => current.map((item) => item.id === note.id ? updated : item)) }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const saveWidgetOrder = async (items: Note[]) => { const timestamp = now(); const updated = items.map((item, index) => ({ ...item, widgetOrder: index, updatedAt: timestamp })); await Promise.all(updated.map((item) => notesRepository.save(item))); setNotes((current) => current.map((item) => updated.find((changed) => changed.id === item.id) ?? item)) }
  const handleWidgetDragEnd = ({ active, over }: DragEndEvent) => { if (!over || active.id === over.id) return; const dragged = noteWidgets.find((item) => item.id === active.id); const target = noteWidgets.find((item) => item.id === over.id); if (!dragged || !target) return; const destination = groupWidgets(target.groupId ?? '').filter((item) => item.id !== dragged.id); const targetIndex = destination.findIndex((item) => item.id === target.id); destination.splice(targetIndex < 0 ? destination.length : targetIndex, 0, { ...dragged, groupId: target.groupId }); void saveWidgetOrder(destination) }
  const createGroup = async () => { const name = groupName.trim(); if (!activeBoardId || !name) { setGroupStatus('Enter a group name.'); return }; const group: BoardGroup = { id: newId(), boardId: activeBoardId, name, order: activeGroups.length, columnSpan: 1, verticalSize: 'normal', collapsed: false }; await database.boardGroups.add(group); setBoardGroups((current) => [...current, group]); setGroupName(''); setGroupStatus('Group created locally.') }
  const updateGroup = async (group: BoardGroup, patch: Partial<BoardGroup>) => { const updated = { ...group, ...patch }; await database.boardGroups.put(updated); setBoardGroups((current) => current.map((item) => item.id === group.id ? updated : item)) }
  const deleteGroup = async (group: BoardGroup) => { const replacement = activeGroups.find((item) => item.id !== group.id); if (!window.confirm(replacement ? `Delete “${group.name}”? Its cards will move to “${replacement.name}”.` : `Delete “${group.name}”? Its cards will become ungrouped.`)) return; await database.transaction('rw', database.boardGroups, database.notes, async () => { await database.notes.where('groupId').equals(group.id).modify({ groupId: replacement?.id, updatedAt: now() }); await database.boardGroups.delete(group.id) }); setNotes((current) => current.map((note) => note.groupId === group.id ? { ...note, groupId: replacement?.id } : note)); setBoardGroups((current) => current.filter((item) => item.id !== group.id)); setGroupStatus('Group deleted and cards reassigned.') }
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
  const closeBoardSettings = () => { setBoardSettingsOpen(false); requestAnimationFrame(() => boardSettingsTriggerRef.current?.focus()) }
  const deleteBoard = async () => {
    if (!activeBoard) return
    if (boards.length <= 1) { setBoardStatus('Keep at least one board. Create another board before deleting this one.'); return }
    const replacement = boards.find((item) => item.id !== activeBoard.id)
    if (!replacement || !window.confirm(`Delete “${activeBoard.name}”? Its widgets will move to “${replacement.name}”.`)) return
    await database.transaction('rw', database.boards, database.notes, database.boardGroups, async () => {
      await database.notes.where('widgetBoardId').equals(activeBoard.id).modify({ widgetBoardId: replacement.id, updatedAt: now() })
      await database.notes.where('boardId').equals(activeBoard.id).modify({ boardId: replacement.id, updatedAt: now() })
      await database.boardGroups.where('boardId').equals(activeBoard.id).delete()
      await database.boards.delete(activeBoard.id)
    })
    setNotes((current) => current.map((note) => note.widgetBoardId === activeBoard.id ? { ...note, widgetBoardId: replacement.id } : note.boardId === activeBoard.id ? { ...note, boardId: replacement.id } : note))
    setBoards((current) => current.filter((item) => item.id !== activeBoard.id))
    setActiveBoardId(replacement.id); setSelectedWidgetId(''); setBoardSettingsOpen(false)
  }
  const basePath = board ? '/board' : showTrash ? '/trash' : ''
  const createNote = useCallback(async (asWidget = false) => { const timestamp = now(); const note: Note = { id: newId(), title: asWidget ? 'Untitled widget' : 'Untitled note', content: new Delta(), boardId: !asWidget && board ? activeBoardId || undefined : undefined, isWidget: asWidget, widgetStyle: asWidget ? 'cream' : undefined, widgetBoardId: asWidget ? activeBoardId || undefined : undefined, widgetOrder: asWidget ? noteWidgets.length : undefined, createdAt: timestamp, updatedAt: timestamp }; await notesRepository.add(note); setNotes((current) => [note, ...current]); navigate(`${basePath}/notes/${note.id}`) }, [navigate, basePath, noteWidgets.length, activeBoardId, board])
  useEffect(() => { if (newNoteRequest > 0 && newNoteRequest !== pendingRequest.current) { pendingRequest.current = newNoteRequest; void createNote().finally(() => onNewNoteHandled?.()) } }, [newNoteRequest, onNewNoteHandled, createNote])
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(basePath || '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const heading = board ? 'Board' : showTrash ? 'Trash' : 'All notes'
  const boardNotes = useMemo(() => notes.filter((note) => !note.isWidget && !note.deletedAt && note.boardId === activeBoardId && `${note.title} ${preview(note.content)}`.toLowerCase().includes(query.toLowerCase())), [notes, activeBoardId, query])
  const pinnedNotes = noteWidgets.filter((note) => note.widgetPinned)
  const activeGroups = useMemo(() => boardGroups.filter((group) => group.boardId === activeBoardId).sort((a, b) => a.order - b.order), [boardGroups, activeBoardId])
  const groupWidgets = (groupId: string) => noteWidgets.filter((note) => note.groupId === groupId)
  const latestNote = boardNotes.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const updateBoardNote = async (note: Note, patch: Partial<Note>) => { const updated = { ...note, ...patch, updatedAt: now() }; await notesRepository.save(updated); setNotes((current) => current.map((item) => item.id === note.id ? updated : item)) }
  if (board) return <section className="board-view">
    {selected ? <div className="board-editor"><NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate('/board')} backLabel="Board" /></div> : <>
      <header className="board-header"><div className="board-heading" onDoubleClick={() => openBoardSettings()}><span className="board-star" aria-hidden="true">✦</span><div><p className="eyebrow">Your notebook · Home</p><h1>Dashboard</h1><p className="board-subtitle">A clear view of your notes, widgets, and next ideas.</p></div></div><div className="board-controls"><label className="board-picker"><span className="sr-only">Active board</span><select value={activeBoardId} disabled={!boardsLoaded || boards.length === 0} onChange={(event) => { const nextBoard = boards.find((item) => item.id === event.target.value); if (nextBoard) switchBoard(nextBoard) }}>{boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="board-layout-button" type="button" disabled={!boardsLoaded} onClick={startCreatingBoard}>＋ New board</button><label className="board-search"><span className="sr-only">Search board notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" /></label><button className="board-layout-button" type="button" onClick={() => setLayoutEditing((current) => !current)}>{layoutEditing ? 'Done layout' : 'Edit layout'}</button><button ref={boardSettingsTriggerRef} className="board-layout-button" type="button" aria-expanded={boardSettingsOpen} aria-controls="board-settings" onClick={() => openBoardSettings()}>Manage board</button><button className="primary-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></div></header>
      {boardSettingsOpen && <section id="board-settings" className="board-settings" role="region" aria-labelledby="board-settings-title"><div><p className="eyebrow">Board settings</p><h2 id="board-settings-title">{boardSettingsMode === 'create' ? 'Create board' : `Manage ${activeBoard?.name ?? 'board'}`}</h2></div><label>Board name<input autoFocus value={boardName} onChange={(event) => setBoardName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && boardSettingsMode === 'create') { event.preventDefault(); void createBoard() } }} /></label><div className="board-settings-actions">{boardSettingsMode === 'create' ? <button className="text-button" type="button" onClick={() => void createBoard()}>Create board</button> : <><button className="text-button" type="button" onClick={() => void renameBoard()}>Save name</button><button className="text-button danger" type="button" onClick={() => void deleteBoard()} disabled={boards.length <= 1}>Delete board</button></>}<button className="text-button" type="button" onClick={closeBoardSettings}>Close</button></div><p className="board-settings-help">{boardSettingsMode === 'create' ? 'Name a new board. It will be stored only in this browser.' : 'Select the active board again, double-click a board name, or use this keyboard-accessible panel to manage it. Deleting moves its widgets to another board.'}</p>{boardStatus && <p role="status" className="board-settings-status">{boardStatus}</p>}</section>}
            <section className="board-summary" aria-label="Notebook summary"><article className="summary-card summary-welcome"><div className="summary-card-top"><h2>Good to see you</h2><span className="summary-badge">Local-first</span></div><p>{boardNotes.length ? `You have ${boardNotes.length} ${boardNotes.length === 1 ? 'note' : 'notes'} ready to revisit.` : 'Start with a note and make this space yours.'}</p><button className="summary-action" type="button" onClick={() => void createNote()}>＋ New note</button></article><article className="summary-card"><div className="summary-card-top"><h2>Notes</h2><span className="summary-badge">Library</span></div><strong className="summary-number">{boardNotes.length}</strong><p>Ideas saved in your notebook</p></article><article className="summary-card"><div className="summary-card-top"><h2>Pinned widgets</h2><span className="summary-badge">Focus</span></div><strong className="summary-number">{pinnedNotes.length}</strong><p>Widgets kept close at hand</p></article><article className="summary-card summary-latest"><h2>Latest note</h2>{latestNote ? <button className="summary-note-link" type="button" onClick={() => navigate(`/board/notes/${latestNote.id}`)}><strong>{latestNote.title}</strong><span>{preview(latestNote.content)}</span></button> : <p>No notes yet. Capture an idea to see it here.</p>}</article></section>
                        <section className="board-notes" aria-labelledby="board-notes-heading"><div className="board-section-heading"><div><p className="eyebrow">Assigned to this board</p><h2 id="board-notes-heading">{activeBoard ? `${activeBoard.name} notes` : 'Notes'}</h2></div><span className="hidden-widget-count">{boardNotes.length} {boardNotes.length === 1 ? 'note' : 'notes'}</span></div>{boardNotes.length === 0 ? <div className="board-empty"><span>✦</span><h2>No notes on this board</h2><p>{query ? 'Try another search.' : 'Create a note here or assign one from its editor.'}</p>{!query && <button className="primary-button" type="button" onClick={() => void createNote()}>＋ New note</button>}</div> : <div className="board-notes-grid">{boardNotes.map((note) => <article ref={(element) => { if (element) noteCardRefs.current.set(note.id, element); else noteCardRefs.current.delete(note.id) }} key={note.id} className={`board-card board-note-card note-size-${note.boardSize ?? 'small'} ${selectedNoteId === note.id ? 'selected' : ''} ${resizeTarget === `note:${note.id}` ? 'resize-mode' : ''}`} tabIndex={0} aria-label={`${note.title} note${selectedNoteId === note.id ? ', selected' : ''}`} onClick={() => { setSelectedNoteId(note.id); setSelectedWidgetId(''); setSelectedGroupId(''); setResizeTarget((current) => current === `note:${note.id}` ? current : '') }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedNoteId(note.id) } }}><button type="button" className="board-card-open" onClick={() => navigate(`/board/notes/${note.id}`)}><strong>{note.title}</strong><span>{preview(note.content)}</span></button><div className="board-card-footer"><small>{new Date(note.updatedAt).toLocaleDateString()}</small>{selectedNoteId === note.id && <div className="board-note-actions"><button type="button" className="board-widget-edit" onClick={() => navigate(`/board/notes/${note.id}`)}>Edit</button><label><span className="sr-only">Move {note.title} to board</span><select value={note.boardId ?? ''} onChange={(event) => void updateBoardNote(note, { boardId: event.target.value || undefined })}>{boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span className="sr-only">Group for {note.title}</span><select value={note.groupId ?? ''} onChange={(event) => void updateBoardNote(note, { groupId: event.target.value || undefined })}><option value="">No group</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><button type="button" className="board-widget-action" onClick={() => setResizeTarget((current) => current === `note:${note.id}` ? '' : `note:${note.id}`)}>{resizeTarget === `note:${note.id}` ? 'Done resize' : 'Resize'}</button>{resizeTarget === `note:${note.id}` && <><label className="note-size-picker">Width<select value={note.boardSize ?? 'small'} onChange={(event) => void updateBoardNote(note, { boardSize: event.target.value as NonNullable<Note['boardSize']> })}>{(['small', 'medium', 'large'] as const).map((size) => <option key={size} value={size}>{size}</option>)}</select></label><ResizeHandle label={note.title} span={note.boardSize === 'large' ? 3 : note.boardSize === 'medium' ? 2 : 1} onCommit={(span) => void updateBoardNote(note, { boardSize: span === 1 ? 'small' : span === 2 ? 'medium' : 'large' })} /></>}<button type="button" className="board-widget-action danger" onClick={() => void trashNote(note)}>Trash</button></div>}</div></article>)}</div>}</section>
      <section className="board-widgets" aria-labelledby="board-widgets-heading"><div className="board-section-heading"><div><p className="eyebrow">Flexible spaces</p><h2 id="board-widgets-heading">{activeBoard ? `${activeBoard.name} widgets` : 'Widgets'}</h2></div><div className="board-section-actions"><button className="text-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></div></div><form className="group-create" onSubmit={(event) => { event.preventDefault(); void createGroup() }}><label>New group<input value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label><button className="text-button" type="submit">Add group</button>{groupStatus && <span role="status">{groupStatus}</span>}</form>{noteWidgets.length === 0 ? <div className="widget-board-empty"><span>✦</span><p>Create a group and add a widget to start organizing your board.</p></div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}><SortableContext items={noteWidgets.map((note) => note.id)} strategy={rectSortingStrategy}><div className="board-widget-groups">{activeGroups.map((group) => <section ref={(element) => { if (element) groupRefs.current.set(group.id, element); else groupRefs.current.delete(group.id) }} className={`board-widget-group group-span-${group.columnSpan} group-height-${group.verticalSize} ${selectedGroupId === group.id ? 'selected' : ''} ${resizeTarget === `group:${group.id}` ? 'resize-mode' : ''}`} key={group.id} aria-labelledby={`widget-group-${group.id}`} tabIndex={0} onClick={() => { setSelectedGroupId(group.id); setSelectedNoteId(''); setResizeTarget((current) => current === `group:${group.id}` ? current : '') }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedGroupId(group.id); setResizeTarget((current) => current === `group:${group.id}` ? current : '') } }}><div className="widget-group-heading"><h3 id={`widget-group-${group.id}`}>{group.name}</h3><span>{groupWidgets(group.id).length}</span>{selectedGroupId === group.id && <div className="group-actions"><button type="button" onClick={() => void updateGroup(group, { collapsed: !group.collapsed })} aria-expanded={!group.collapsed}>{group.collapsed ? 'Expand' : 'Collapse'}</button><button type="button" onClick={() => { const name = window.prompt('Rename group', group.name)?.trim(); if (name) void updateGroup(group, { name }) }}>Rename</button><button type="button" onClick={() => setResizeTarget((current) => current === `group:${group.id}` ? '' : `group:${group.id}`)}>{resizeTarget === `group:${group.id}` ? 'Done resize' : 'Resize'}</button>{resizeTarget === `group:${group.id}` && <><label className="group-size-picker">Width<select value={group.columnSpan} onChange={(event) => void updateGroup(group, { columnSpan: Number(event.target.value) as BoardGroup['columnSpan'] })}>{[1, 2, 3, 4].map((span) => <option key={span} value={span}>{span} columns</option>)}</select></label><ResizeHandle label={group.name} span={group.columnSpan} onCommit={(span) => void updateGroup(group, { columnSpan: Math.min(4, span) as BoardGroup['columnSpan'] })} /></>}<button type="button" onClick={() => void updateGroup(group, { verticalSize: group.verticalSize === 'compact' ? 'normal' : group.verticalSize === 'normal' ? 'tall' : 'compact' })}>Height: {group.verticalSize}</button><button type="button" className="danger" onClick={() => void deleteGroup(group)}>Delete</button></div>}</div>{!group.collapsed && <div className="board-widget-grid">{groupWidgets(group.id).map((note) => <SortableWidgetCard key={note.id} note={note} layoutEditing={layoutEditing} selected={selectedWidgetId === note.id} resizing={resizeTarget === `widget:${note.id}`} widgetValues={widgetValues} groups={activeGroups} onSelect={() => { setSelectedWidgetId(note.id); setSelectedNoteId(''); setSelectedGroupId(group.id); setResizeTarget((current) => current === `widget:${note.id}` ? current : '') }} onEdit={() => navigate(`/board/notes/${note.id}`)} onUpdate={(patch) => void updateWidget(note, patch)} onResize={() => setResizeTarget((current) => current === `widget:${note.id}` ? '' : `widget:${note.id}`)} onDuplicate={() => void duplicateWidget(note)} onCardRef={(element) => { if (element) widgetCardRefs.current.set(note.id, element); else widgetCardRefs.current.delete(note.id) }} />)}</div>}</section>)}{noteWidgets.filter((note) => !note.groupId).length > 0 && <section className="board-widget-group"><div className="widget-group-heading"><h3>Ungrouped</h3><span>{noteWidgets.filter((note) => !note.groupId).length}</span></div><div className="board-widget-grid">{noteWidgets.filter((note) => !note.groupId).map((note) => <SortableWidgetCard key={note.id} note={note} layoutEditing={layoutEditing} selected={selectedWidgetId === note.id} resizing={resizeTarget === `widget:${note.id}`} widgetValues={widgetValues} groups={activeGroups} onSelect={() => { setSelectedWidgetId(note.id); setSelectedNoteId(''); setSelectedGroupId(''); setResizeTarget((current) => current === `widget:${note.id}` ? current : '') }} onEdit={() => navigate(`/board/notes/${note.id}`)} onUpdate={(patch) => void updateWidget(note, patch)} onResize={() => setResizeTarget((current) => current === `widget:${note.id}` ? '' : `widget:${note.id}`)} onDuplicate={() => void duplicateWidget(note)} onCardRef={(element) => { if (element) widgetCardRefs.current.set(note.id, element); else widgetCardRefs.current.delete(note.id) }} />)}</div></section>}</div></SortableContext></DndContext>}</section>
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
