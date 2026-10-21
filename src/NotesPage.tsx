import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Note } from './types'
import { notesRepository } from './notesRepository'
import { NoteEditor } from './NoteEditor'
import Delta from 'quill-delta'

const now = () => Date.now()
const newId = () => crypto.randomUUID()
const preview = (content: Note['content']) => content.ops.map((op) => typeof op.insert === 'string' ? op.insert : '').join('').trim() || 'Empty note'

export function NotesPage({ showTrash = false }: { showTrash?: boolean }) {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => { void notesRepository.list().then(setNotes) }, [])
  const selected = notes.find((note) => note.id === noteId && Boolean(note.deletedAt) === showTrash) ?? null
  const filtered = useMemo(() => notes.filter((note) => Boolean(note.deletedAt) === showTrash && `${note.title} ${preview(note.content)}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash])
  const createNote = async () => { const timestamp = now(); const note: Note = { id: newId(), title: 'Untitled note', content: new Delta(), createdAt: timestamp, updatedAt: timestamp }; await notesRepository.add(note); setNotes((current) => [note, ...current]); navigate(`${showTrash ? '/trash/notes' : '/notes'}/${note.id}`) }
  const trashNote = async (note: Note) => { await notesRepository.trash(note.id); navigate(showTrash ? '/trash' : '/'); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  const restoreNote = async (note: Note) => { await notesRepository.restore(note.id); setNotes((current) => current.filter((item) => item.id !== note.id)) }
  if (selected) return <NoteEditor note={selected} onSaved={(updated) => setNotes((current) => current.map((item) => item.id === updated.id ? updated : item))} onClose={() => navigate(showTrash ? '/trash' : '/')} />
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">Personal notebook</p><h1>{showTrash ? 'Trash' : 'All notes'}</h1><p className="muted">{showTrash ? 'Restore notes or remove them permanently.' : 'Capture ideas, references, and everything in between.'}</p></div>{!showTrash && <button type="button" className="primary-button" onClick={createNote}>New note</button>}</div><label className="search-field"><span>Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or content" /></label>{filtered.length === 0 ? <div className="empty-state"><span className="empty-icon">✦</span><h2>{showTrash ? 'Trash is empty.' : 'Your notebook is ready.'}</h2><p>{showTrash ? 'Deleted notes will appear here.' : 'Create your first note to begin building your personal knowledge base.'}</p>{!showTrash && <button type="button" className="primary-button" onClick={createNote}>Create your first note</button>}</div> : <div className="note-grid">{filtered.map((note) => <article className="note-card" key={note.id} onClick={() => navigate(`${showTrash ? '/trash/notes' : '/notes'}/${note.id}`)}><h2>{note.title}</h2><p>{preview(note.content)}</p><small>{new Date(note.updatedAt).toLocaleDateString()}</small><div className="card-actions">{showTrash ? <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); void restoreNote(note) }}>Restore</button> : <button type="button" className="text-button danger" onClick={(event) => { event.stopPropagation(); void trashNote(note) }}>Trash</button>}</div></article>)}</div>}</section>
}
