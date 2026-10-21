import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import 'quill/dist/quill.snow.css'
import './App.css'
import { database } from './db'
import type { Collection } from './types'
import { NotesPage } from './NotesPage'

const navigation = [{ label: 'All notes', path: '/' }, { label: 'Collections', path: '/collections' }, { label: 'Web references', path: '/references' }, { label: 'Trash', path: '/trash' }]
const now = () => Date.now()
const newId = () => crypto.randomUUID()

function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const load = () => void database.collections.toArray().then(setCollections)
  useEffect(() => { load() }, [])
  const add = async () => { if (!name.trim()) return; const timestamp = now(); await database.collections.add({ id: newId(), name: name.trim(), parentId: parentId || undefined, createdAt: timestamp, updatedAt: timestamp }); setName(''); setParentId(''); load() }
  const label = (collection: Collection) => { const parent = collection.parentId ? collections.find((item) => item.id === collection.parentId) : undefined; return parent ? `${parent.name} / ${collection.name}` : collection.name }
  return <section className="page"><p className="eyebrow">Notebook</p><h1>Collections</h1><p className="muted">Organize notes into projects, subjects, and workflows.</p><div className="collection-form"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="New collection" /><select value={parentId} onChange={(event) => setParentId(event.target.value)} aria-label="Parent collection"><option value="">Top-level collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{label(collection)}</option>)}</select><button className="primary-button" type="button" onClick={add}>Add</button></div><div className="collection-list">{collections.map((collection) => <div className="collection-row" key={collection.id}>{label(collection)}<small>{new Date(collection.updatedAt).toLocaleDateString()}</small></div>)}</div></section>
}
function PlaceholderPage({ title, description }: { title: string; description: string }) { return <section className="page"><p className="eyebrow">Notebook</p><h1>{title}</h1><p className="muted">{description}</p></section> }
function App() {
  return <HashRouter><div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><span>starkeep</span></div><p className="sidebar-label">Notebook</p><nav aria-label="Primary navigation">{navigation.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'}>{item.label}</NavLink>)}</nav><div className="sidebar-footer"><span className="status-dot" />Local storage enabled</div></aside><main className="main-content"><Routes><Route path="/" element={<NotesPage />} /><Route path="/notes/:noteId" element={<NotesPage />} /><Route path="/collections" element={<CollectionsPage />} /><Route path="/references" element={<PlaceholderPage title="Web references" description="Browse notes that connect back to pages across the web." />} /><Route path="/trash" element={<NotesPage showTrash />} /><Route path="/trash/notes/:noteId" element={<NotesPage showTrash />} /></Routes></main></div></HashRouter>
}
export default App
