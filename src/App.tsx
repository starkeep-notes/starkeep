import { useCallback, useEffect, useRef, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import 'quill/dist/quill.snow.css'
import './App.css'
import './Notebook.css'
import './Widgets.css'
import { database } from './db'
import type { Collection, Note } from './types'
import { NotesPage } from './NotesPage'
import { exportBackup, importBackup } from './portability'
import { notesRepository } from './notesRepository'
import { loadSavedTemplates, renderWidgetTemplate, createTemplateValues, widgetPresets, type WidgetStyle } from './widgetTemplates'

const navigation = [{ label: 'Board', path: '/', icon: '▤' }, { label: 'All notes', path: '/notes', icon: '☰' }, { label: 'Widgets', path: '/widgets', icon: '✦' }, { label: 'Collections', path: '/collections', icon: '▦' }, { label: 'Web references', path: '/references', icon: '↗' }, { label: 'Trash', path: '/trash', icon: '♻' }, { label: 'Backup & recovery', path: '/backup', icon: '⇅' }]
const themes = ['sticker', 'quiet', 'dark'] as const
type Theme = typeof themes[number]
const themeLabels: Record<Theme, string> = { sticker: 'Sticker', quiet: 'Quiet minimal', dark: 'Dark ink' }
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
function PortabilityPage() {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const download = async () => { const payload = await exportBackup(); const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `starkeep-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); setStatus('Backup downloaded.'); setError('') }
  const choose = async (mode: 'merge' | 'replace') => { const file = fileRef.current?.files?.[0]; if (!file) { setError('Choose a JSON backup first.'); return } if (mode === 'replace' && !window.confirm('Replace all notes, collections, and references on this device?')) return; try { const payload = JSON.parse(await file.text()) as unknown; const result = await importBackup(payload, mode); setStatus(`Imported ${result.notes} notes, ${result.collections} collections, and ${result.webReferences} references. Reload to view them.`); setError('') } catch (cause) { setStatus(''); setError(cause instanceof Error ? cause.message : 'The backup could not be imported.') } }
  return <section className="page"><p className="eyebrow">Notebook</p><h1>Backup & recovery</h1><p className="muted">Export a versioned JSON backup or restore one from another device.</p><div className="portability-card"><button className="primary-button" type="button" onClick={() => void download()}>↓ Export backup</button><label className="file-picker">Import JSON backup<input ref={fileRef} type="file" accept="application/json,.json" /></label><div className="portability-actions"><button className="text-button" type="button" onClick={() => void choose('merge')}>Merge backup</button><button className="text-button danger" type="button" onClick={() => void choose('replace')}>Replace notebook</button></div>{status && <p className="success-message" role="status">{status}</p>}{error && <p className="error-message" role="alert">{error}</p>}</div></section>
}
const widgetVariables = [
  ['notes.total', 'Total notes'], ['notes.created_today', 'Notes created today'], ['notes.updated_week', 'Notes updated this week'], ['notes.words', 'Total words'], ['date.today', 'Today'], ['date.greeting', 'Greeting'],
]

function WidgetsPage() {
  const [selectedId, setSelectedId] = useState('quote')
  const [widgetId, setWidgetId] = useState(() => localStorage.getItem('starkeep-template-edit') ?? crypto.randomUUID())
  const [template, setTemplate] = useState(widgetPresets[0].template)
  const [style, setStyle] = useState<WidgetStyle>('cream')
  const [savedTemplates, setSavedTemplates] = useState(() => loadSavedTemplates())
  const [saved, setSaved] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  useEffect(() => { void notesRepository.list().then(setNotes) }, [])
  useEffect(() => { const stored = loadSavedTemplates(); setSavedTemplates(stored); const existing = stored.find((item) => item.id === widgetId); if (existing) { setTemplate(existing.template); setStyle(existing.accent); setSelectedId(widgetPresets.some((preset) => preset.name === existing.name) ? widgetPresets.find((preset) => preset.name === existing.name)?.id ?? 'custom' : 'custom') } }, [widgetId])
  const values = createTemplateValues(notes)
  const choosePreset = (preset: typeof widgetPresets[number]) => { setWidgetId(crypto.randomUUID()); setSelectedId(preset.id); setTemplate(preset.id === 'quote' ? '“The secret of getting ahead is getting started.”\n\n— Mark Twain\n\nQuote of the day' : preset.id === 'counter' ? '# {{notes.total}}\n\nIdeas collected\n\n↑ {{notes.created_today}} this week' : preset.id === 'welcome' ? '# Hello, {{date.greeting}}\n\nYou have **{{notes.total}} notes** in your notebook.' : preset.id === 'goal' ? '## Daily goal\n\n{{notes.updated_week}} notes updated\n\n62% of 400 goal' : 'Your idea starts here.'); setStyle(preset.accent as typeof style); setSaved(false) }
  const insertVariable = (key: string) => { setTemplate((current) => `${current}{{${key}}}`); setSaved(false) }
  return <section className="widgets-page">
    <header className="widgets-heading"><div><p className="eyebrow">Your notebook · Widgets</p><h1>Text widget templates</h1><p className="muted">Design reusable templates for widgets you create from notes.</p></div><button className="primary-button" type="button" onClick={() => { setSaved(true); const widget = { id: widgetId, name: selectedId === 'custom' ? 'Custom widget' : widgetPresets.find((preset) => preset.id === selectedId)?.name ?? 'Widget', template, style, accent: style, category: 'Custom', description: 'Saved reusable widget template.', updatedAt: Date.now() }; const widgets = loadSavedTemplates(); localStorage.setItem('starkeep-widget-templates', JSON.stringify([...widgets.filter((item) => item.id !== widgetId), widget])); setSavedTemplates([...widgets.filter((item) => item.id !== widgetId), widget]); localStorage.setItem('starkeep-template-edit', widgetId) }}>{saved ? '✓ Template saved' : 'Save template'}</button></header>
    <div className="widget-layout">
      <aside className="template-library"><div className="library-header"><div><p className="eyebrow">Level 1</p><h2>Ready-made</h2></div><span className="template-count">{widgetPresets.length + savedTemplates.filter((item) => !widgetPresets.some((preset) => preset.id === item.id)).length}</span></div><p className="library-copy">Choose a design, then make it yours.</p><div className="preset-list">{[...widgetPresets, ...savedTemplates.filter((item) => !widgetPresets.some((preset) => preset.id === item.id))].map((preset) => <button key={preset.id} className={`preset-card ${selectedId === preset.id ? 'selected' : ''}`} type="button" onClick={() => choosePreset(preset)}><span className={`preset-swatch swatch-${preset.accent}`} /><span><strong>{preset.name}</strong><small>{preset.description}</small></span><span className="preset-arrow">→</span></button>)}</div><button className="template-link" type="button" onClick={() => { setSelectedId('custom'); setTemplate(''); setStyle('ink') }}>＋ Start from blank</button></aside>
      <div className="widget-workbench"><div className={`widget-preview preview-${style}`}><div className="preview-topline"><span>LIVE PREVIEW</span><span className="preview-status"><i /> Updates as you type</span></div><div className="preview-content">{renderWidgetTemplate(template, values).split('\n').map((line, index) => line ? <p key={`${line}-${index}`} className={index === 0 ? 'preview-lead' : ''}>{line.replace(/[*#>“”]/g, '')}</p> : <br key={`break-${index}`} />)}</div><div className="preview-footer">Generated from a reusable template <span>✦</span></div></div>
        <div className="editor-card"><div className="editor-card-heading"><div><p className="eyebrow">Level 2 · Level 3</p><h2>Compose your widget</h2></div><span className="syntax-badge">Safe template</span></div><textarea aria-label="Widget template" value={template} onChange={(event) => { setTemplate(event.target.value); setSaved(false) }} placeholder="Write something with {{dynamic.values}}" /><div className="editor-tools"><div><span className="tool-label">Insert dynamic value</span><div className="variable-picker">{widgetVariables.slice(0, 4).map(([key, label]) => <button type="button" key={key} title={label} onClick={() => insertVariable(key)}>{label}</button>)}</div></div><div className="style-picker"><span className="tool-label">Style</span>{(['cream', 'yellow', 'blue', 'green', 'ink'] as const).map((item) => <button type="button" key={item} className={`style-dot dot-${item} ${style === item ? 'active' : ''}`} aria-label={`${item} style`} onClick={() => setStyle(item)} />)}</div></div><div className="language-tip"><span>⌘</span><span><strong>Template language</strong> Use <code>{'{{notes.total}}'}</code> for live values. Add <code>{'{{#if condition}}'}</code> after you are ready for more.</span><button type="button" className="text-button">Read guide →</button></div></div>
      </div>
    </div>
  </section>
}

function NotebookShell({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  const navigate = useNavigate()
  const [newNoteRequest, setNewNoteRequest] = useState(0)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem('starkeep-sidebar-expanded') === 'true')
  const onNewNoteHandled = useCallback(() => setNewNoteRequest(0), [])
  useEffect(() => { localStorage.setItem('starkeep-sidebar-expanded', String(sidebarExpanded)) }, [sidebarExpanded])
  return <div className={`app-shell theme-${theme} ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
    <aside className="sidebar">
      <div className="brand" aria-label="Starkeep"><span className="brand-mark">✦</span><span className="brand-name">starkeep</span></div>
      <button className="sidebar-toggle" type="button" aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={sidebarExpanded} title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'} onClick={() => setSidebarExpanded((value) => !value)}><span aria-hidden="true">{sidebarExpanded ? '«' : '»'}</span><span className="toggle-label">{sidebarExpanded ? 'Collapse' : 'Expand'}</span></button>
      <button className="rail-new" type="button" aria-label="New note" title="New note" onClick={() => { navigate('/notes'); setNewNoteRequest((value) => value + 1) }}>＋</button>
      <button className="rail-widget" type="button" aria-label="Add widget" title="Add widget" onClick={() => navigate('/widgets')}>✦</button>
      <nav aria-label="Primary navigation">{navigation.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/'} aria-label={item.label} title={item.label} className={({ isActive }) => isActive ? 'active' : ''}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span></NavLink>)}</nav>
      <label className="theme-switcher"><span className="theme-icon" aria-hidden="true">◐</span><span className="theme-label">Theme</span><select aria-label="Choose visual theme" value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>{themes.map((item) => <option key={item} value={item}>{themeLabels[item]}</option>)}</select></label>
      <div className="sidebar-footer"><span className="status-dot" /> <span>Saved on this device</span></div>
    </aside>
    <main className="main-content"><Routes><Route path="/" element={<NotesPage board />} /><Route path="/notes" element={<NotesPage newNoteRequest={newNoteRequest} onNewNoteHandled={onNewNoteHandled} />} /><Route path="/notes/:noteId" element={<NotesPage newNoteRequest={newNoteRequest} onNewNoteHandled={onNewNoteHandled} />} /><Route path="/widgets" element={<WidgetsPage />} /><Route path="/collections" element={<CollectionsPage />} /><Route path="/backup" element={<PortabilityPage />} /><Route path="/references" element={<PlaceholderPage title="Web references" description="Browse notes that connect back to pages across the web." />} /><Route path="/board" element={<NotesPage board />} /><Route path="/board/notes/:noteId" element={<NotesPage board />} /><Route path="/trash" element={<NotesPage showTrash />} /><Route path="/trash/notes/:noteId" element={<NotesPage showTrash />} /></Routes></main>
  </div>
}
function App() {
  const [theme, setTheme] = useState<Theme>(() => { const stored = localStorage.getItem('starkeep-theme'); return stored === 'workspace' ? 'sticker' : themes.find((item) => item === stored) ?? 'sticker' })
  const [storageState, setStorageState] = useState<'opening' | 'ready' | 'error'>('opening')
  const [storageError, setStorageError] = useState('')

  const openDatabase = () => {
    setStorageState('opening')
    setStorageError('')
    void database.open().then(() => setStorageState('ready')).catch((error: unknown) => {
      setStorageState('error')
      setStorageError(error instanceof Error ? error.message : 'The browser could not open local storage.')
    })
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('starkeep-theme', theme)
  }, [theme])

  useEffect(() => {
    void database.open().then(() => setStorageState('ready')).catch((error: unknown) => {
      setStorageState('error')
      setStorageError(error instanceof Error ? error.message : 'The browser could not open local storage.')
    })
  }, [])

  if (storageState === 'opening') return <main className="app-state" aria-live="polite"><span className="status-dot" /><p>Opening your local notebook…</p></main>
  if (storageState === 'error') return <main className="app-state app-state-error" role="alert"><span className="empty-icon">!</span><h1>Storage unavailable</h1><p>Starkeep could not open its local notebook. Your existing data has not been changed.</p><small>{storageError}</small><button className="primary-button" type="button" onClick={openDatabase}>Try again</button></main>

  return <HashRouter><NotebookShell theme={theme} setTheme={setTheme} /></HashRouter>
}
export default App
