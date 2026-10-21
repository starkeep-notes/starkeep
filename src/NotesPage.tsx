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
  const filtered = useMemo(() => notes.filter((note) => Boolean(note.deletedAt) === showTrash && (!collectionId || note.collectionId === collectionId) && `${note.title} ${preview(note.content)} ${note.collectionId ? collectionNames.get(note.collectionId) ?? '' : ''}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash, collectionId, collectionNames])
  const createNote = useCallback(async () => { const timestamp = now(); const note: Note = { id: newId(), title: 'Untitled note', content: new Delta(), createdAt: timestamp, updatedAt: timestamp }; await notesRepository.add(note); setNotes((current) => [note, ...current]); navigate(`/notes/${note.id}`) }, [navigate])
  useEffect(() => { if (newNoteRequest > 0 && newNoteRequest !== pendingRequest.current) { pendingRequest.current = newNoteRequest; void createNote().finally(() => onNewNoteHandled?.()) } }, [newNoteRequest, onNewNoteHandled, createNote])
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(showTrash ? '/trash' : '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const heading = board ? 'Board' : showTrash ? 'Trash' : 'All notes'
  const list = <aside className="notes-list" aria-label={`${heading} list`}>
    <div className="notes-list-header"><span className="eyebrow">Your notebook</span><h2>{heading}</h2><span className="note-count">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</span></div>
    <label className="search-field"><span className="sr-only">Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Search notes" /></label>
    {!showTrash && collections.length > 0 && <label className="filter-field"><span className="sr-only">Collection</span><select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}><option value="">All collections</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}
    <div className="notes-list-scroll">{filtered.length === 0 ? <p className="list-empty">{showTrash ? 'Trash is empty.' : query ? 'No matching notes.' : 'No notes yet. Start with a new note.'}</p> : filtered.map((note) => <div className={`note-list-item ${selected?.id === note.id ? 'selected' : ''}`} key={note.id}><button type="button" className="note-list-open" onClick={() => navigate(`${showTrash ? '/trash/notes' : '/notes'}/${note.id}`)}><strong>{note.title}</strong><span>{preview(note.content)}</span><small>{note.collectionId ? `${collectionNames.get(note.collectionId) ?? 'Collection'} · ` : ''}{new Date(note.updatedAt).toLocaleDateString()}</small></button><button type="button" className={`note-list-action ${showTrash ? '' : 'danger'}`} onClick={() => { void (showTrash ? restoreNote(note) : trashNote(note)) }}>{showTrash ? 'Restore' : 'Trash'}</button></div>)}</div>
    {!showTrash && <button type="button" className="list-new" onClick={() => void createNote()}>＋ New note</button>}
  </aside>
  return <section className={`notes-workspace ${board ? 'board-page' : ''} ${selected ? 'has-selection' : ''}`}>{list}<div className="notes-detail">{selected ? <NoteEditor key={selected.id} note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate(showTrash ? '/trash' : '/')} /> : <div className="welcome-panel"><span className="welcome-star" aria-hidden="true">✦</span><p className="eyebrow">A space for your thoughts</p><h1>{showTrash ? 'The little things stay here.' : board ? 'See the bigger picture.' : 'Make room for ideas.'}</h1><p className="muted">{showTrash ? 'Select a note to review or restore it.' : 'Select a note on the left, or start with a fresh page.'}</p>{!showTrash && <button className="primary-button" type="button" onClick={() => void createNote()}>＋ Write a note</button>}</div>}</div></section>
}
