import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Collection, Note } from './types'
import { database } from './db'
import { notesRepository } from './notesRepository'
import { NoteEditor } from './NoteEditor'
import Delta from 'quill-delta'

const now = () => Date.now()
const newId = () => crypto.randomUUID()
const preview = (content: Note['content']) => content.ops.map((op) => typeof op.insert === 'string' ? op.insert : '').join('').trim() || 'Empty note'
const noteWidgetPreview = (content: Note['content']) => preview(content).split('\n').filter(Boolean).slice(0, 3)

export function NotesPage({ showTrash = false, board = false, newNoteRequest = 0, onNewNoteHandled }: { showTrash?: boolean; board?: boolean; newNoteRequest?: number; onNewNoteHandled?: () => void }) {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const pendingRequest = useRef(0)
  useEffect(() => { void Promise.all([notesRepository.list(), database.collections.toArray()]).then(([loadedNotes, loadedCollections]) => { setNotes(loadedNotes); setCollections(loadedCollections) }) }, [])
  const selected = notes.find((note) => note.id === noteId && Boolean(note.deletedAt) === showTrash) ?? null
  const collectionNames = useMemo(() => new Map(collections.map((collection) => [collection.id, collection.name])), [collections])
  const filtered = useMemo(() => notes.filter((note) => !note.isWidget && Boolean(note.deletedAt) === showTrash && (!collectionId || note.collectionId === collectionId) && `${note.title} ${preview(note.content)} ${note.collectionId ? collectionNames.get(note.collectionId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash, collectionId, collectionNames])
  const noteWidgets = useMemo(() => notes.filter((note) => note.isWidget && !note.deletedAt), [notes])
  const basePath = board ? '/board' : showTrash ? '/trash' : ''
  const createNote = useCallback(async (asWidget = false) => { const timestamp = now(); const note: Note = { id: newId(), title: asWidget ? 'Untitled widget' : 'Untitled note', content: new Delta(), isWidget: asWidget, widgetStyle: asWidget ? 'cream' : undefined, createdAt: timestamp, updatedAt: timestamp }; await notesRepository.add(note); setNotes((current) => [note, ...current]); navigate(`${basePath}/notes/${note.id}`) }, [navigate, basePath])
  useEffect(() => { if (newNoteRequest > 0 && newNoteRequest !== pendingRequest.current) { pendingRequest.current = newNoteRequest; void createNote().finally(() => onNewNoteHandled?.()) } }, [newNoteRequest, onNewNoteHandled, createNote])
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(basePath || '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const heading = board ? 'Board' : showTrash ? 'Trash' : 'All notes'
  if (board) return <section className="board-view">
    {selected ? <div className="board-editor"><NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate('/board')} backLabel="Board" /></div> : <>
      <header className="board-header"><div className="board-heading"><span className="board-star" aria-hidden="true">✦</span><div><p className="eyebrow">Your notebook · Home</p><h1>Board</h1><p className="board-subtitle">Your notes and reusable widgets, together.</p></div></div><div className="board-controls"><label className="board-search"><span className="sr-only">Search board notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" /></label><button className="primary-button" type="button" onClick={() => void createNote()}>＋ New note</button></div></header>
            <section className="board-widgets" aria-labelledby="board-widgets-heading"><div className="board-section-heading"><div><p className="eyebrow">Flexible spaces</p><h2 id="board-widgets-heading">Widgets</h2></div><button className="text-button" type="button" onClick={() => void createNote(true)}>＋ Add widget</button></div>{noteWidgets.length === 0 ? <div className="widget-board-empty"><span>✦</span><p>Turn any note into a widget, or start with a reusable template.</p><button className="primary-button" type="button" onClick={() => navigate('/widgets')}>Browse templates</button></div> : <div className="board-widget-grid">{noteWidgets.map((note) => <article className={`board-widget-card preview-${note.widgetStyle ?? 'cream'}`} key={note.id}><button type="button" className="board-widget-edit" aria-label={`Edit ${note.title}`} onClick={() => navigate(`/board/notes/${note.id}`)}>Edit</button><span className="widget-card-label">Note widget</span><div className="widget-card-content">{noteWidgetPreview(note.content).map((line, index) => <p className={index === 0 ? 'widget-card-lead' : ''} key={`${line}-${index}`}>{line}</p>)}</div></article>)}</div>}</section>
            {collections.length > 0 && <label className="board-filter"><span className="sr-only">Filter board by collection</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
      <p className="board-count" role="status">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</p>
      {filtered.length === 0 ? <div className="board-empty"><span aria-hidden="true">✦</span><h2>{query || collectionId ? 'No matching notes' : 'Your board is ready'}</h2><p>{query || collectionId ? 'Try another search or collection.' : 'Create a note to pin your first idea here.'}</p>{!query && !collectionId && <button className="primary-button" type="button" onClick={() => void createNote()}>＋ New note</button>}</div> : <div className="board-grid">{filtered.map((note) => <article className="board-card" key={note.id}><button className="board-card-open" type="button" onClick={() => navigate(`/board/notes/${note.id}`)} aria-label={`Open ${note.title}`}><strong>{note.title}</strong><span>{preview(note.content)}</span></button><div className="board-card-footer"><small>{note.collectionId ? `${collectionNames.get(note.collectionId) ?? 'Collection'} · ` : ''}{new Date(note.updatedAt).toLocaleDateString()}</small><button type="button" className="text-button danger" aria-label={`Move ${note.title} to trash`} onClick={() => void trashNote(note)}>Trash</button></div></article>)}</div>}
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
