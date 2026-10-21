import { useEffect, useMemo, useRef, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import './App.css'
import { database } from './db'
import type { Collection, Note } from './types'

const navigation = [
  { label: 'All notes', path: '/' },
  { label: 'Collections', path: '/collections' },
  { label: 'Web references', path: '/references' },
  { label: 'Trash', path: '/trash' },
]

const now = () => Date.now()
const newId = () => crypto.randomUUID()
const preview = (content: string) => { try { return JSON.parse(content).ops?.map((op: { insert?: string }) => op.insert ?? '').join('').trim() || 'Empty note' } catch { return content || 'Empty note' } }

function NoteEditor({ note, onSaved, onClose }: { note: Note; onSaved: (note: Note) => void; onClose: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const titleRef = useRef(note.title)
  const noteRef = useRef(note)
  const onSavedRef = useRef(onSaved)
  const initialContentRef = useRef(note.content)
  const [title, setTitle] = useState(note.title)
  const [saveState, setSaveState] = useState('Saved locally')

  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { noteRef.current = note }, [note])
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])

  useEffect(() => {
    if (!editorRef.current) return
    const editorElement = editorRef.current
    const quill = new Quill(editorElement, { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], [{ header: [1, 2, false] }], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image']] } })
    try { quill.setContents(JSON.parse(initialContentRef.current)) } catch { quill.setText(initialContentRef.current) }
    quillRef.current = quill
    const save = () => {
      setSaveState('Saving…')
      const updated = { ...noteRef.current, title: titleRef.current.trim() || 'Untitled note', content: JSON.stringify(quill.getContents()), updatedAt: now() }
      void database.notes.put(updated).then(() => { setSaveState('Saved locally'); onSavedRef.current(updated) })
    }
    quill.on('text-change', save)
    return () => { quill.off('text-change', save); quill.disable(); quillRef.current = null; editorElement.replaceChildren() }
  }, [note.id])

  const saveTitle = () => {
    const updated = { ...note, title: title.trim() || 'Untitled note', content: quillRef.current ? JSON.stringify(quillRef.current.getContents()) : note.content, updatedAt: now() }
    setSaveState('Saving…')
    void database.notes.put(updated).then(() => { setSaveState('Saved locally'); onSaved(updated) })
  }

  return <div className="editor-panel">
    <div className="editor-header"><button type="button" className="text-button" onClick={onClose}>← Back</button><span className="save-state">{saveState}</span></div>
    <input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} aria-label="Note title" placeholder="Untitled note" />
    <div ref={editorRef} className="quill-editor" />
  </div>
}

function NotesPage({ showTrash = false }: { showTrash?: boolean }) {
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [selected, setSelected] = useState<Note | null>(null)
  const loadNotes = () => void database.notes.toArray().then((items) => setNotes(items.sort((a, b) => b.updatedAt - a.updatedAt)))
  useEffect(() => { loadNotes() }, [])
  const filtered = useMemo(() => notes.filter((note) => Boolean(note.deletedAt) === showTrash && `${note.title} ${preview(note.content)}`.toLowerCase().includes(query.toLowerCase())), [notes, query, showTrash])

  const createNote = async () => {
    const timestamp = now()
    const note: Note = { id: newId(), title: 'Untitled note', content: '', createdAt: timestamp, updatedAt: timestamp }
    await database.notes.add(note)
    setNotes((current) => [note, ...current])
    setSelected(note)
  }
  const trashNote = async (note: Note) => { await database.notes.update(note.id, { deletedAt: now() }); setSelected(null); loadNotes() }
  const restoreNote = async (note: Note) => { await database.notes.update(note.id, { deletedAt: undefined }); loadNotes() }

  if (selected) return <NoteEditor note={selected} onSaved={(updated) => { setSelected(updated); setNotes((current) => current.map((item) => item.id === updated.id ? updated : item)) }} onClose={() => { setSelected(null); loadNotes() }} />
  return <section className="page">
    <div className="page-heading"><div><p className="eyebrow">Personal notebook</p><h1>{showTrash ? 'Trash' : 'All notes'}</h1><p className="muted">{showTrash ? 'Restore notes or remove them permanently.' : 'Capture ideas, references, and everything in between.'}</p></div>{!showTrash && <button type="button" className="primary-button" onClick={createNote}>New note</button>}</div>
    <label className="search-field"><span>Search notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or content" /></label>
    {filtered.length === 0 ? <div className="empty-state"><span className="empty-icon">✦</span><h2>{showTrash ? 'Trash is empty.' : 'Your notebook is ready.'}</h2><p>{showTrash ? 'Deleted notes will appear here.' : 'Create your first note to begin building your personal knowledge base.'}</p>{!showTrash && <button type="button" className="primary-button" onClick={createNote}>Create your first note</button>}</div> : <div className="note-grid">{filtered.map((note) => <article className="note-card" key={note.id} onClick={() => setSelected(note)}><h2>{note.title}</h2><p>{preview(note.content)}</p><small>{new Date(note.updatedAt).toLocaleDateString()}</small><div className="card-actions">{showTrash ? <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); restoreNote(note) }}>Restore</button> : <button type="button" className="text-button danger" onClick={(event) => { event.stopPropagation(); trashNote(note) }}>Trash</button>}</div></article>)}</div>}
  </section>
}

function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [name, setName] = useState('')
  const load = () => void database.collections.toArray().then(setCollections)
  useEffect(() => { load() }, [])
  const add = async () => { if (!name.trim()) return; const timestamp = now(); await database.collections.add({ id: newId(), name: name.trim(), createdAt: timestamp, updatedAt: timestamp }); setName(''); load() }
  return <section className="page"><p className="eyebrow">Notebook</p><h1>Collections</h1><p className="muted">Organize notes into projects, subjects, and workflows.</p><div className="collection-form"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="New collection" /><button className="primary-button" type="button" onClick={add}>Add</button></div><div className="collection-list">{collections.map((collection) => <div className="collection-row" key={collection.id}>{collection.name}<small>{new Date(collection.updatedAt).toLocaleDateString()}</small></div>)}</div></section>
}

function App() {
  return <HashRouter><div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>starkeep</span></div><p className="sidebar-label">Notebook</p><nav aria-label="Primary navigation">{navigation.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'}>{item.label}</NavLink>)}</nav><div className="sidebar-footer"><span className="status-dot" />Local storage enabled</div></aside><main className="main-content"><Routes><Route path="/" element={<NotesPage />} /><Route path="/collections" element={<CollectionsPage />} /><Route path="/references" element={<PlaceholderPage title="Web references" description="Browse notes that connect back to pages across the web." />} /><Route path="/trash" element={<NotesPage showTrash />} /></Routes></main></div></HashRouter>
}

function PlaceholderPage({ title, description }: { title: string; description: string }) { return <section className="page"><p className="eyebrow">Notebook</p><h1>{title}</h1><p className="muted">{description}</p></section> }
export default App
