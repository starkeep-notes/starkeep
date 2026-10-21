import { useMemo, useState } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'

const navigation = [
  { label: 'All notes', path: '/' },
  { label: 'Collections', path: '/collections' },
  { label: 'Web references', path: '/references' },
  { label: 'Trash', path: '/trash' },
]

function NotesPage() {
  const [query, setQuery] = useState('')
  const notes = useMemo(() => [], [])

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personal notebook</p>
          <h1>All notes</h1>
          <p className="muted">Capture ideas, references, and everything in between.</p>
        </div>
        <button type="button" className="primary-button">New note</button>
      </div>
      <label className="search-field">
        <span>Search notes</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or content" />
      </label>
      {notes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✦</span>
          <h2>Your notebook is ready.</h2>
          <p>Create your first note to begin building your personal knowledge base.</p>
          <button type="button" className="primary-button">Create your first note</button>
        </div>
      ) : null}
    </section>
  )
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <section className="page"><p className="eyebrow">Notebook</p><h1>{title}</h1><p className="muted">{description}</p></section>
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand"><span className="brand-mark">S</span><span>starkeep</span></div>
          <p className="sidebar-label">Notebook</p>
          <nav aria-label="Primary navigation">
            {navigation.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'}>{item.label}</NavLink>)}
          </nav>
          <div className="sidebar-footer"><span className="status-dot" />Local storage enabled</div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<NotesPage />} />
            <Route path="/collections" element={<PlaceholderPage title="Collections" description="Organize notes into nested projects, subjects, and workflows." />} />
            <Route path="/references" element={<PlaceholderPage title="Web references" description="Browse notes that connect back to pages across the web." />} />
            <Route path="/trash" element={<PlaceholderPage title="Trash" description="Deleted notes will be kept here so they can be restored." />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
